import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import {
  WarRoomPlan,
  StatusJson,
  MergeProposal,
  MergeMethod,
} from "@/lib/plan-schema";

const execAsync = promisify(exec);

interface MergeRequest {
  /** Lane IDs to merge. If omitted, uses merge-proposal.json order */
  laneIds?: string[];
  /** Whether to merge to main after integration branch */
  mergeToMain?: boolean;
  /** Explicit confirmation required for merge to main */
  confirmMergeToMain?: boolean;
}

interface ConflictInfo {
  laneId: string;
  branch: string;
  conflictingFiles: string[];
  worktreePath: string;
}

interface MergeLaneResult {
  laneId: string;
  branch: string;
  success: boolean;
  method: MergeMethod;
  error?: string;
}

interface MergeResponse {
  success: boolean;
  results: MergeLaneResult[];
  conflict?: ConflictInfo;
  mergedToMain?: boolean;
  error?: string;
}

// Execute git command with error handling
async function gitExec(
  cmd: string,
  cwd: string
): Promise<{ stdout: string; stderr: string; success: boolean; error?: string }> {
  try {
    const { stdout, stderr } = await execAsync(cmd, {
      cwd,
      timeout: 60000, // 60 second timeout for git operations
    });
    return { stdout, stderr, success: true };
  } catch (err: unknown) {
    const error = err as { stdout?: string; stderr?: string; message?: string };
    return {
      stdout: error.stdout || "",
      stderr: error.stderr || "",
      success: false,
      error: error.message || "Git command failed",
    };
  }
}

// Check if there are merge conflicts
async function checkForConflicts(repoPath: string): Promise<string[]> {
  const { stdout } = await gitExec(
    `git diff --name-only --diff-filter=U`,
    repoPath
  );
  return stdout
    .trim()
    .split("\n")
    .filter((f) => f.length > 0);
}

// Abort an in-progress merge
async function abortMerge(repoPath: string): Promise<void> {
  await gitExec(`git merge --abort`, repoPath);
}

// Perform merge for a single lane
async function mergeLane(
  repoPath: string,
  integrationBranch: string,
  laneBranch: string,
  method: MergeMethod,
  laneId: string
): Promise<{ success: boolean; error?: string; conflictingFiles?: string[] }> {
  // Ensure we're on the integration branch
  const checkoutResult = await gitExec(
    `git checkout ${integrationBranch}`,
    repoPath
  );
  if (!checkoutResult.success) {
    // Try to create the integration branch if it doesn't exist
    const createResult = await gitExec(
      `git checkout -b ${integrationBranch}`,
      repoPath
    );
    if (!createResult.success) {
      return {
        success: false,
        error: `Failed to checkout integration branch: ${createResult.error}`,
      };
    }
  }

  // Determine merge command based on method
  let mergeCmd: string;
  switch (method) {
    case "squash":
      mergeCmd = `git merge --squash ${laneBranch}`;
      break;
    case "merge":
      mergeCmd = `git merge --no-ff ${laneBranch} -m "Merge ${laneId} (${laneBranch}) into ${integrationBranch}"`;
      break;
    case "cherry-pick":
      // For cherry-pick, we need to get the commits from the branch
      // This is more complex, for now fall back to merge
      mergeCmd = `git merge --no-ff ${laneBranch} -m "Merge ${laneId} (${laneBranch}) into ${integrationBranch}"`;
      break;
    default:
      mergeCmd = `git merge --no-ff ${laneBranch} -m "Merge ${laneId} (${laneBranch}) into ${integrationBranch}"`;
  }

  const mergeResult = await gitExec(mergeCmd, repoPath);

  if (!mergeResult.success) {
    // Check if it's a conflict
    const conflictingFiles = await checkForConflicts(repoPath);
    if (conflictingFiles.length > 0) {
      return {
        success: false,
        error: "Merge conflict",
        conflictingFiles,
      };
    }
    return {
      success: false,
      error: mergeResult.error || "Merge failed",
    };
  }

  // For squash merges, we need to commit
  if (method === "squash") {
    // Check if there are changes to commit
    const statusResult = await gitExec(`git status --porcelain`, repoPath);
    if (statusResult.stdout.trim().length > 0) {
      const commitResult = await gitExec(
        `git commit -m "Squash merge ${laneId} (${laneBranch}) into ${integrationBranch}"`,
        repoPath
      );
      if (!commitResult.success) {
        return {
          success: false,
          error: `Squash commit failed: ${commitResult.error}`,
        };
      }
    }
  }

  return { success: true };
}

// Get main branch name (main or master)
async function getMainBranch(repoPath: string): Promise<string | null> {
  const mainCheck = await gitExec(
    `git show-ref --verify --quiet refs/heads/main && echo "main" || (git show-ref --verify --quiet refs/heads/master && echo "master" || echo "none")`,
    repoPath
  );
  const branch = mainCheck.stdout.trim();
  return branch === "none" ? null : branch;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
): Promise<NextResponse<MergeResponse>> {
  const { slug } = await context.params;

  // Parse request body
  let body: MergeRequest = {};
  try {
    body = await request.json();
  } catch {
    // Empty body is fine, will use defaults
  }

  const runDir = path.join(
    os.homedir(),
    ".openclaw/workspace/warroom/runs",
    slug
  );

  // Read plan.json
  let plan: WarRoomPlan | null = null;
  try {
    const planContent = await fs.readFile(
      path.join(runDir, "plan.json"),
      "utf-8"
    );
    plan = JSON.parse(planContent);
  } catch {
    return NextResponse.json(
      {
        success: false,
        results: [],
        error: "Failed to read plan.json",
      },
      { status: 404 }
    );
  }

  if (!plan) {
    return NextResponse.json(
      {
        success: false,
        results: [],
        error: "Invalid plan.json",
      },
      { status: 400 }
    );
  }

  // Read merge proposal if available
  let proposal: MergeProposal | null = null;
  try {
    const proposalContent = await fs.readFile(
      path.join(runDir, "merge-proposal.json"),
      "utf-8"
    );
    proposal = JSON.parse(proposalContent);
  } catch {
    // No proposal is fine if laneIds provided
  }

  // Determine merge order
  let mergeOrder: { laneId: string; branch: string; method: MergeMethod }[];

  if (body.laneIds && body.laneIds.length > 0) {
    // Use provided lane IDs
    mergeOrder = body.laneIds
      .map((laneId) => {
        const lane = plan!.lanes.find((l) => l.laneId === laneId);
        const proposalLane = proposal?.mergeOrder.find(
          (l) => l.laneId === laneId
        );
        return lane
          ? {
              laneId: lane.laneId,
              branch: lane.branch,
              method: proposalLane?.method || plan!.merge.method,
            }
          : null;
      })
      .filter((l): l is NonNullable<typeof l> => l !== null);
  } else if (proposal) {
    // Use proposal order
    mergeOrder = proposal.mergeOrder.map((l) => ({
      laneId: l.laneId,
      branch: l.branch,
      method: l.method,
    }));
  } else {
    return NextResponse.json(
      {
        success: false,
        results: [],
        error:
          "No merge proposal found. Generate a merge proposal first or provide laneIds.",
      },
      { status: 400 }
    );
  }

  if (mergeOrder.length === 0) {
    return NextResponse.json(
      {
        success: false,
        results: [],
        error: "No lanes to merge",
      },
      { status: 400 }
    );
  }

  const repoPath = plan.repo.path;
  const integrationBranch = plan.integrationBranch;
  const results: MergeLaneResult[] = [];

  // Execute merges in order
  for (const laneInfo of mergeOrder) {
    const result = await mergeLane(
      repoPath,
      integrationBranch,
      laneInfo.branch,
      laneInfo.method,
      laneInfo.laneId
    );

    results.push({
      laneId: laneInfo.laneId,
      branch: laneInfo.branch,
      success: result.success,
      method: laneInfo.method,
      error: result.error,
    });

    // If conflict occurred, stop and return conflict info
    if (!result.success && result.conflictingFiles) {
      // Find the lane's worktree path for opening in Cursor
      const lane = plan.lanes.find((l) => l.laneId === laneInfo.laneId);

      return NextResponse.json(
        {
          success: false,
          results,
          conflict: {
            laneId: laneInfo.laneId,
            branch: laneInfo.branch,
            conflictingFiles: result.conflictingFiles,
            worktreePath: lane?.worktreePath || repoPath,
          },
          error: `Merge conflict in ${laneInfo.laneId}. Resolve conflicts manually.`,
        },
        { status: 409 }
      );
    }

    // If merge failed for other reasons, stop
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          results,
          error: `Merge failed for ${laneInfo.laneId}: ${result.error}`,
        },
        { status: 500 }
      );
    }
  }

  // Handle merge to main if requested
  let mergedToMain = false;
  if (body.mergeToMain) {
    // Require explicit confirmation
    if (!body.confirmMergeToMain) {
      return NextResponse.json(
        {
          success: false,
          results,
          error:
            "Merge to main requires explicit confirmation. Set confirmMergeToMain: true to proceed.",
        },
        { status: 400 }
      );
    }

    const mainBranch = await getMainBranch(repoPath);
    if (!mainBranch) {
      return NextResponse.json(
        {
          success: false,
          results,
          error: "No main or master branch found",
        },
        { status: 400 }
      );
    }

    // Checkout main and merge integration branch
    const checkoutMain = await gitExec(`git checkout ${mainBranch}`, repoPath);
    if (!checkoutMain.success) {
      return NextResponse.json(
        {
          success: false,
          results,
          error: `Failed to checkout ${mainBranch}: ${checkoutMain.error}`,
        },
        { status: 500 }
      );
    }

    const mergeToMainResult = await gitExec(
      `git merge --no-ff ${integrationBranch} -m "Merge ${integrationBranch} into ${mainBranch}"`,
      repoPath
    );

    if (!mergeToMainResult.success) {
      const conflictingFiles = await checkForConflicts(repoPath);
      if (conflictingFiles.length > 0) {
        // Abort the merge to main
        await abortMerge(repoPath);
        return NextResponse.json(
          {
            success: false,
            results,
            conflict: {
              laneId: "main",
              branch: integrationBranch,
              conflictingFiles,
              worktreePath: repoPath,
            },
            error: `Conflict when merging to ${mainBranch}. Integration branch merges complete, but merge to main has conflicts.`,
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        {
          success: false,
          results,
          error: `Merge to ${mainBranch} failed: ${mergeToMainResult.error}`,
        },
        { status: 500 }
      );
    }

    mergedToMain = true;
  }

  // Update status.json to indicate merging complete
  try {
    const statusPath = path.join(runDir, "status.json");
    let status: StatusJson;
    try {
      const statusContent = await fs.readFile(statusPath, "utf-8");
      status = JSON.parse(statusContent);
    } catch {
      status = {
        runId: plan.runId,
        status: "in_progress",
        updatedAt: new Date().toISOString(),
      };
    }

    status.status = mergedToMain ? "complete" : "merging";
    status.updatedAt = new Date().toISOString();

    await fs.writeFile(statusPath, JSON.stringify(status, null, 2), "utf-8");
  } catch {
    // Non-fatal error
  }

  return NextResponse.json({
    success: true,
    results,
    mergedToMain,
  });
}
