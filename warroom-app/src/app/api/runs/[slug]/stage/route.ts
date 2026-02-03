// API route to stage lanes - creates git worktrees for each lane
// POST /api/runs/[slug]/stage - creates worktrees and branches

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import { WarRoomPlan, StatusJson, Lane } from "@/lib/plan-schema";

const execAsync = promisify(exec);

interface StageResult {
  laneId: string;
  success: boolean;
  worktreePath?: string;
  branch?: string;
  error?: string;
}

interface CursorResult {
  laneId: string;
  success: boolean;
  worktreePath?: string;
  error?: string;
}

interface StageResponse {
  success: boolean;
  staged: StageResult[];
  errors: StageResult[];
  cursorOpened: CursorResult[];
  cursorErrors: CursorResult[];
}

// Check if a git branch exists (local or remote)
async function branchExists(
  repoPath: string,
  branch: string
): Promise<boolean> {
  try {
    // Check local branches first
    await execAsync(`git show-ref --verify --quiet refs/heads/${branch}`, {
      cwd: repoPath,
    });
    return true;
  } catch {
    // Check remote branches
    try {
      await execAsync(
        `git show-ref --verify --quiet refs/remotes/origin/${branch}`,
        { cwd: repoPath }
      );
      return true;
    } catch {
      return false;
    }
  }
}

// Create a new branch from the current HEAD
async function createBranch(repoPath: string, branch: string): Promise<void> {
  await execAsync(`git branch ${branch}`, { cwd: repoPath });
}

// Check if a worktree already exists at the given path
async function worktreeExists(worktreePath: string): Promise<boolean> {
  try {
    await fs.access(worktreePath);
    // Check if it's actually a git worktree
    const gitDir = path.join(worktreePath, ".git");
    await fs.access(gitDir);
    return true;
  } catch {
    return false;
  }
}

// Open Cursor window for a worktree
async function openCursorWindow(
  laneId: string,
  worktreePath: string
): Promise<CursorResult> {
  try {
    // Use -n flag to open in new window
    // Use spawn with detached option so Cursor doesn't block
    await execAsync(`/usr/local/bin/cursor -n "${worktreePath}"`, {
      timeout: 10000, // 10 second timeout for cursor to launch
    });

    return {
      laneId,
      success: true,
      worktreePath,
    };
  } catch (error) {
    // If cursor command fails, it's non-fatal - worktree is still staged
    return {
      laneId,
      success: false,
      worktreePath,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Create a git worktree for a lane
async function createWorktree(
  repoPath: string,
  lane: Lane
): Promise<StageResult> {
  const { laneId, branch, worktreePath } = lane;

  try {
    // Check if worktree already exists
    if (await worktreeExists(worktreePath)) {
      return {
        laneId,
        success: true,
        worktreePath,
        branch,
        error: "Worktree already exists (reusing)",
      };
    }

    // Create parent directory if needed
    const parentDir = path.dirname(worktreePath);
    await fs.mkdir(parentDir, { recursive: true });

    // Check if branch exists, create if not
    if (!(await branchExists(repoPath, branch))) {
      await createBranch(repoPath, branch);
    }

    // Create the worktree
    // Use -B to create branch if it doesn't exist or reset if it does
    await execAsync(`git worktree add "${worktreePath}" ${branch}`, {
      cwd: repoPath,
    });

    return {
      laneId,
      success: true,
      worktreePath,
      branch,
    };
  } catch (error) {
    return {
      laneId,
      success: false,
      worktreePath,
      branch,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const runDir = path.join(
      os.homedir(),
      ".openclaw/workspace/warroom/runs",
      slug
    );
    const planPath = path.join(runDir, "plan.json");
    const statusPath = path.join(runDir, "status.json");

    // Check if run directory exists
    try {
      await fs.access(runDir);
    } catch {
      return NextResponse.json(
        { success: false, error: "Run not found" },
        { status: 404 }
      );
    }

    // Read the plan
    let plan: WarRoomPlan;
    try {
      const content = await fs.readFile(planPath, "utf-8");
      plan = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { success: false, error: "Failed to read plan.json" },
        { status: 500 }
      );
    }

    // Verify repo path exists
    try {
      await fs.access(plan.repo.path);
    } catch {
      return NextResponse.json(
        { success: false, error: `Repository path not found: ${plan.repo.path}` },
        { status: 400 }
      );
    }

    // Stage each lane (create worktrees)
    const results: StageResult[] = [];

    for (const lane of plan.lanes) {
      const result = await createWorktree(plan.repo.path, lane);
      results.push(result);
    }

    // Separate successes and errors
    const staged = results.filter((r) => r.success);
    const errors = results.filter((r) => !r.success);

    // Open Cursor windows for successfully staged lanes
    const cursorResults: CursorResult[] = [];
    for (const result of staged) {
      if (result.worktreePath) {
        const cursorResult = await openCursorWindow(
          result.laneId,
          result.worktreePath
        );
        cursorResults.push(cursorResult);
      }
    }

    const cursorOpened = cursorResults.filter((r) => r.success);
    const cursorErrors = cursorResults.filter((r) => !r.success);

    // Update status.json
    let currentStatus: StatusJson;
    try {
      const content = await fs.readFile(statusPath, "utf-8");
      currentStatus = JSON.parse(content);
    } catch {
      currentStatus = {
        runId: plan.runId,
        status: "draft",
        lanesCompleted: [],
        updatedAt: new Date().toISOString(),
      };
    }

    // Update lanes status to mark staged lanes
    if (!currentStatus.lanes) {
      currentStatus.lanes = {};
    }

    for (const result of staged) {
      currentStatus.lanes[result.laneId] = {
        staged: true,
        status: currentStatus.lanes[result.laneId]?.status ?? "pending",
      };
    }

    // Update overall status if all lanes staged successfully
    if (errors.length === 0 && staged.length > 0) {
      currentStatus.status = "staged";
    }

    currentStatus.updatedAt = new Date().toISOString();

    await fs.writeFile(statusPath, JSON.stringify(currentStatus, null, 2));

    const response: StageResponse = {
      success: errors.length === 0,
      staged,
      errors,
      cursorOpened,
      cursorErrors,
    };

    // 207 Multi-Status if partial success (worktree or cursor errors)
    const hasAnyErrors = errors.length > 0 || cursorErrors.length > 0;
    return NextResponse.json(response, {
      status: hasAnyErrors ? 207 : 200,
    });
  } catch (error) {
    console.error("Error staging lanes:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to stage lanes",
      },
      { status: 500 }
    );
  }
}
