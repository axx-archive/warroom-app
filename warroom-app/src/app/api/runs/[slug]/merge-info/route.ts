import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import { WarRoomPlan, StatusJson, LaneStatus, MergeState, AutoPushOptions, PushState } from "@/lib/plan-schema";

const execAsync = promisify(exec);

interface LaneMergeInfo {
  laneId: string;
  branch: string;
  status: LaneStatus;
  isComplete: boolean;
  isMergeCandidate: boolean;
  commitsAhead: number;
  filesChanged: string[];
  conflictRisk: "none" | "low" | "medium" | "high";
  overlappingLanes: string[];
  error?: string;
}

interface MergeInfoResponse {
  success: boolean;
  integrationBranch: string;
  lanes: LaneMergeInfo[];
  overlapMatrix: Record<string, string[]>; // laneId -> list of lanes it overlaps with
  mergeState?: MergeState;
  repoPath?: string;
  autoPushOptions?: AutoPushOptions;
  integrationBranchPushState?: PushState;
  error?: string;
}

// Get lane status from status.json (supports both formats)
function getLaneStatus(
  laneId: string,
  status: StatusJson | null
): LaneStatus {
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
): Promise<{ count: number; error?: string }> {
  try {
    // First check if the branch exists
    const { stdout: branchCheck } = await execAsync(
      `git show-ref --verify --quiet refs/heads/${laneBranch} && echo "exists" || echo "missing"`,
      { cwd: repoPath }
    );

    if (branchCheck.trim() === "missing") {
      return { count: 0, error: "Branch does not exist" };
    }

    // Check if integration branch exists
    const { stdout: integrationCheck } = await execAsync(
      `git show-ref --verify --quiet refs/heads/${integrationBranch} && echo "exists" || echo "missing"`,
      { cwd: repoPath }
    );

    let baseBranch = integrationBranch;
    if (integrationCheck.trim() === "missing") {
      // Fall back to main or master
      const { stdout: mainCheck } = await execAsync(
        `git show-ref --verify --quiet refs/heads/main && echo "main" || (git show-ref --verify --quiet refs/heads/master && echo "master" || echo "none")`,
        { cwd: repoPath }
      );
      baseBranch = mainCheck.trim();
      if (baseBranch === "none") {
        return { count: 0, error: "No base branch found" };
      }
    }

    // Count commits ahead
    const { stdout } = await execAsync(
      `git rev-list --count ${baseBranch}..${laneBranch}`,
      { cwd: repoPath }
    );

    return { count: parseInt(stdout.trim(), 10) || 0 };
  } catch (error) {
    return { count: 0, error: String(error) };
  }
}

// Get files changed in a lane branch compared to integration branch
async function getFilesChanged(
  repoPath: string,
  laneBranch: string,
  integrationBranch: string
): Promise<{ files: string[]; error?: string }> {
  try {
    // Check if branch exists
    const { stdout: branchCheck } = await execAsync(
      `git show-ref --verify --quiet refs/heads/${laneBranch} && echo "exists" || echo "missing"`,
      { cwd: repoPath }
    );

    if (branchCheck.trim() === "missing") {
      return { files: [], error: "Branch does not exist" };
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
        return { files: [], error: "No base branch found" };
      }
    }

    // Get list of files changed
    const { stdout } = await execAsync(
      `git diff --name-only ${baseBranch}...${laneBranch}`,
      { cwd: repoPath }
    );

    const files = stdout
      .trim()
      .split("\n")
      .filter((f) => f.length > 0);
    return { files };
  } catch (error) {
    return { files: [], error: String(error) };
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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
): Promise<NextResponse<MergeInfoResponse>> {
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
        integrationBranch: "",
        lanes: [],
        overlapMatrix: {},
        error: "Failed to read plan.json",
      },
      { status: 404 }
    );
  }

  if (!plan) {
    return NextResponse.json(
      {
        success: false,
        integrationBranch: "",
        lanes: [],
        overlapMatrix: {},
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

  // First pass: collect files changed for each lane
  const laneFilesMap = new Map<string, string[]>();
  const laneInfoPromises = plan.lanes.map(async (lane) => {
    const { files } = await getFilesChanged(
      repoPath,
      lane.branch,
      integrationBranch
    );
    laneFilesMap.set(lane.laneId, files);
    return { laneId: lane.laneId, files };
  });

  await Promise.all(laneInfoPromises);

  // Second pass: build lane merge info with conflict detection
  const lanesInfo: LaneMergeInfo[] = await Promise.all(
    plan.lanes.map(async (lane) => {
      const laneStatus = getLaneStatus(lane.laneId, status);
      const isComplete = laneStatus === "complete";
      const isMergeCandidate = isComplete;

      const { count: commitsAhead, error: commitError } = await getCommitsAhead(
        repoPath,
        lane.branch,
        integrationBranch
      );

      const filesChanged = laneFilesMap.get(lane.laneId) || [];
      const { risk, overlappingLanes } = calculateConflictRisk(
        filesChanged,
        laneFilesMap,
        lane.laneId
      );

      return {
        laneId: lane.laneId,
        branch: lane.branch,
        status: laneStatus,
        isComplete,
        isMergeCandidate,
        commitsAhead,
        filesChanged,
        conflictRisk: risk,
        overlappingLanes,
        error: commitError,
      };
    })
  );

  // Build overlap matrix
  const overlapMatrix: Record<string, string[]> = {};
  for (const laneInfo of lanesInfo) {
    if (laneInfo.overlappingLanes.length > 0) {
      overlapMatrix[laneInfo.laneId] = laneInfo.overlappingLanes;
    }
  }

  return NextResponse.json({
    success: true,
    integrationBranch,
    lanes: lanesInfo,
    overlapMatrix,
    mergeState: status?.mergeState,
    repoPath: plan.repo.path,
    autoPushOptions: status?.autoPushOptions,
    integrationBranchPushState: status?.integrationBranchPushState,
  });
}
