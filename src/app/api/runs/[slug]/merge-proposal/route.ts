import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import {
  WarRoomPlan,
  StatusJson,
  LaneStatus,
  MergeMethod,
  MergeProposal,
  MergeProposalLane,
} from "@/lib/plan-schema";

const execAsync = promisify(exec);

interface MergeProposalResponse {
  success: boolean;
  proposal?: MergeProposal;
  error?: string;
}

// Get lane status from status.json (supports both formats)
function getLaneStatus(laneId: string, status: StatusJson | null): LaneStatus {
  if (!status) return "pending";

  // Format 1: lanes object
  if (status.lanes && status.lanes[laneId]) {
    return status.lanes[laneId].status;
  }

  // Format 2: lanesCompleted array
  if (status.lanesCompleted?.includes(laneId)) {
    return "complete";
  }

  return "pending";
}

// Get commit count ahead of integration branch
async function getCommitsAhead(
  repoPath: string,
  laneBranch: string,
  integrationBranch: string
): Promise<number> {
  try {
    // Check if the branch exists
    const { stdout: branchCheck } = await execAsync(
      `git show-ref --verify --quiet refs/heads/${laneBranch} && echo "exists" || echo "missing"`,
      { cwd: repoPath }
    );

    if (branchCheck.trim() === "missing") {
      return 0;
    }

    // Check if integration branch exists, fall back to main/master
    const { stdout: integrationCheck } = await execAsync(
      `git show-ref --verify --quiet refs/heads/${integrationBranch} && echo "exists" || echo "missing"`,
      { cwd: repoPath }
    );

    let baseBranch = integrationBranch;
    if (integrationCheck.trim() === "missing") {
      const { stdout: mainCheck } = await execAsync(
        `git show-ref --verify --quiet refs/heads/main && echo "main" || (git show-ref --verify --quiet refs/heads/master && echo "master" || echo "none")`,
        { cwd: repoPath }
      );
      baseBranch = mainCheck.trim();
      if (baseBranch === "none") {
        return 0;
      }
    }

    // Count commits ahead
    const { stdout } = await execAsync(
      `git rev-list --count ${baseBranch}..${laneBranch}`,
      { cwd: repoPath }
    );

    return parseInt(stdout.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

// Get files changed in a lane branch
async function getFilesChanged(
  repoPath: string,
  laneBranch: string,
  integrationBranch: string
): Promise<string[]> {
  try {
    const { stdout: branchCheck } = await execAsync(
      `git show-ref --verify --quiet refs/heads/${laneBranch} && echo "exists" || echo "missing"`,
      { cwd: repoPath }
    );

    if (branchCheck.trim() === "missing") {
      return [];
    }

    const { stdout: integrationCheck } = await execAsync(
      `git show-ref --verify --quiet refs/heads/${integrationBranch} && echo "exists" || echo "missing"`,
      { cwd: repoPath }
    );

    let baseBranch = integrationBranch;
    if (integrationCheck.trim() === "missing") {
      const { stdout: mainCheck } = await execAsync(
        `git show-ref --verify --quiet refs/heads/main && echo "main" || (git show-ref --verify --quiet refs/heads/master && echo "master" || echo "none")`,
        { cwd: repoPath }
      );
      baseBranch = mainCheck.trim();
      if (baseBranch === "none") {
        return [];
      }
    }

    const { stdout } = await execAsync(
      `git diff --name-only ${baseBranch}...${laneBranch}`,
      { cwd: repoPath }
    );

    return stdout
      .trim()
      .split("\n")
      .filter((f) => f.length > 0);
  } catch {
    return [];
  }
}

// Calculate conflict risk based on file overlap
function calculateConflictRisk(
  filesChanged: string[],
  allLaneFiles: Map<string, string[]>,
  currentLaneId: string
): { risk: "none" | "low" | "medium" | "high"; overlappingLanes: string[] } {
  const overlappingLanes: string[] = [];

  for (const [otherLaneId, otherFiles] of allLaneFiles.entries()) {
    if (otherLaneId === currentLaneId) continue;

    const overlap = filesChanged.filter((f) => otherFiles.includes(f));
    if (overlap.length > 0) {
      overlappingLanes.push(otherLaneId);
    }
  }

  if (overlappingLanes.length === 0) {
    return { risk: "none", overlappingLanes };
  } else if (overlappingLanes.length === 1) {
    return { risk: "low", overlappingLanes };
  } else if (overlappingLanes.length <= 3) {
    return { risk: "medium", overlappingLanes };
  } else {
    return { risk: "high", overlappingLanes };
  }
}

// Topological sort based on dependencies
function topologicalSort(
  lanes: { laneId: string; dependsOn: string[] }[]
): string[] {
  const result: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  const laneMap = new Map<string, { laneId: string; dependsOn: string[] }>();
  for (const lane of lanes) {
    laneMap.set(lane.laneId, lane);
  }

  function visit(laneId: string): void {
    if (visited.has(laneId)) return;
    if (visiting.has(laneId)) {
      // Cycle detected, break out
      return;
    }

    visiting.add(laneId);
    const lane = laneMap.get(laneId);
    if (lane) {
      for (const dep of lane.dependsOn) {
        visit(dep);
      }
    }
    visiting.delete(laneId);
    visited.add(laneId);
    result.push(laneId);
  }

  for (const lane of lanes) {
    visit(lane.laneId);
  }

  return result;
}

// Determine merge method based on lane characteristics
function determineMergeMethod(
  commitsAhead: number,
  conflictRisk: "none" | "low" | "medium" | "high"
): MergeMethod {
  // Single commit: squash is clean
  if (commitsAhead === 1) {
    return "squash";
  }

  // High conflict risk: merge to preserve history for conflict resolution
  if (conflictRisk === "high" || conflictRisk === "medium") {
    return "merge";
  }

  // Multiple commits, low risk: squash for clean history
  return "squash";
}

// Generate PM prompt for merge
function generatePMPrompt(
  plan: WarRoomPlan,
  mergeOrder: MergeProposalLane[],
  warnings: string[]
): string {
  const lanesList = mergeOrder
    .map(
      (lane, idx) =>
        `${idx + 1}. ${lane.laneId} (${lane.branch}) - ${lane.method} - ${lane.commitsAhead} commits`
    )
    .join("\n");

  const warningsList =
    warnings.length > 0
      ? `\n**Warnings:**\n${warnings.map((w) => `- ${w}`).join("\n")}\n`
      : "";

  return `# War Room Merge Choreography

## Run: ${plan.runSlug}
**Goal:** ${plan.goal}
**Integration Branch:** ${plan.integrationBranch}

## Merge Order
${lanesList}
${warningsList}
## Instructions

1. Review each lane's changes before merging
2. Merge lanes in the proposed order
3. If conflicts occur, resolve them before continuing
4. Run tests after each merge
5. After all lanes merged, verify the integration branch

## Commands Reference

\`\`\`bash
# Check out integration branch
git checkout ${plan.integrationBranch}

# Merge a lane (replace BRANCH with actual branch name)
git merge --no-ff BRANCH -m "Merge LANE_ID into integration"

# Or squash merge
git merge --squash BRANCH && git commit -m "Merge LANE_ID: description"
\`\`\`

---
Generated by War Room`;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
): Promise<NextResponse<MergeProposalResponse>> {
  const { slug } = await context.params;

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
        error: "Failed to read plan.json",
      },
      { status: 404 }
    );
  }

  if (!plan) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid plan.json",
      },
      { status: 400 }
    );
  }

  // Read status.json
  let status: StatusJson | null = null;
  try {
    const statusContent = await fs.readFile(
      path.join(runDir, "status.json"),
      "utf-8"
    );
    status = JSON.parse(statusContent);
  } catch {
    // Status is optional
  }

  const repoPath = plan.repo.path;
  const integrationBranch = plan.integrationBranch;

  // Collect files changed for each lane
  const laneFilesMap = new Map<string, string[]>();
  const laneCommitsMap = new Map<string, number>();

  await Promise.all(
    plan.lanes.map(async (lane) => {
      const files = await getFilesChanged(
        repoPath,
        lane.branch,
        integrationBranch
      );
      const commits = await getCommitsAhead(
        repoPath,
        lane.branch,
        integrationBranch
      );
      laneFilesMap.set(lane.laneId, files);
      laneCommitsMap.set(lane.laneId, commits);
    })
  );

  // Filter to only complete lanes (merge candidates)
  const completeLanes = plan.lanes.filter((lane) => {
    const laneStatus = getLaneStatus(lane.laneId, status);
    return laneStatus === "complete";
  });

  // Build dependency graph for complete lanes
  const lanesForSort = completeLanes.map((lane) => ({
    laneId: lane.laneId,
    dependsOn: lane.dependsOn.filter((dep) =>
      completeLanes.some((l) => l.laneId === dep)
    ),
  }));

  // Topological sort to determine merge order
  const sortedLaneIds = topologicalSort(lanesForSort);

  // Build merge proposal lanes
  const warnings: string[] = [];
  const mergeOrder: MergeProposalLane[] = sortedLaneIds.map((laneId, order) => {
    const lane = plan!.lanes.find((l) => l.laneId === laneId)!;
    const commitsAhead = laneCommitsMap.get(laneId) || 0;
    const filesChanged = laneFilesMap.get(laneId) || [];
    const { risk, overlappingLanes } = calculateConflictRisk(
      filesChanged,
      laneFilesMap,
      laneId
    );

    // Add warnings for high conflict risk
    if (risk === "high") {
      warnings.push(
        `${laneId} has HIGH conflict risk with ${overlappingLanes.join(", ")}`
      );
    } else if (risk === "medium") {
      warnings.push(
        `${laneId} has potential conflicts with ${overlappingLanes.join(", ")}`
      );
    }

    // Determine merge method
    const method = determineMergeMethod(commitsAhead, risk);

    // Generate notes
    let notes = "";
    if (commitsAhead === 0) {
      notes = "No commits to merge";
    } else if (overlappingLanes.length > 0) {
      notes = `Review file overlap with ${overlappingLanes.join(", ")} before merging`;
    }

    return {
      laneId,
      branch: lane.branch,
      order: order + 1,
      method,
      dependsOn: lane.dependsOn,
      commitsAhead,
      conflictRisk: risk,
      overlappingLanes,
      notes,
    };
  });

  // Add warning if not all lanes are complete
  const incompleteLanes = plan.lanes.filter((lane) => {
    const laneStatus = getLaneStatus(lane.laneId, status);
    return laneStatus !== "complete";
  });

  if (incompleteLanes.length > 0) {
    warnings.push(
      `${incompleteLanes.length} lane(s) not yet complete: ${incompleteLanes.map((l) => l.laneId).join(", ")}`
    );
  }

  // Generate PM prompt
  const pmPrompt = generatePMPrompt(plan, mergeOrder, warnings);

  // Build the proposal
  const proposal: MergeProposal = {
    runId: plan.runId,
    runSlug: plan.runSlug,
    createdAt: new Date().toISOString(),
    integrationBranch,
    mergeOrder,
    defaultMethod: plan.merge.method,
    warnings,
    pmPrompt,
  };

  // Write proposal to run artifacts
  try {
    await fs.writeFile(
      path.join(runDir, "merge-proposal.json"),
      JSON.stringify(proposal, null, 2),
      "utf-8"
    );
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: `Failed to write merge-proposal.json: ${String(err)}`,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    proposal,
  });
}

// GET: Read existing merge proposal
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
): Promise<NextResponse<MergeProposalResponse>> {
  const { slug } = await context.params;

  const runDir = path.join(
    os.homedir(),
    ".openclaw/workspace/warroom/runs",
    slug
  );

  try {
    const proposalContent = await fs.readFile(
      path.join(runDir, "merge-proposal.json"),
      "utf-8"
    );
    const proposal: MergeProposal = JSON.parse(proposalContent);
    return NextResponse.json({
      success: true,
      proposal,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "No merge proposal found",
      },
      { status: 404 }
    );
  }
}
