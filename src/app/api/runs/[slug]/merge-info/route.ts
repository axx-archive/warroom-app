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
  // Lanes whose changes are included in this lane (via merge/ancestry) - overlap is safe
  includedLanes: string[];
  // Lanes with true conflict risk (independent changes to same files)
  conflictingLanes: string[];
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

// Warroom-specific artifact files that should be excluded from conflict detection
// These are lane-specific files that each lane creates independently
const WARROOM_ARTIFACT_PATTERNS = [
  /^LANE_STATUS\.json$/,
  /^LANE_COMPLETE\.md$/,
  /^REVIEW\.md$/,
  /^FINDINGS\.md$/,
  /^TEST_RESULTS\.md$/,
  /^WARROOM_PACKET\.md$/,
];

function isWarroomArtifact(file: string): boolean {
  return WARROOM_ARTIFACT_PATTERNS.some((pattern) => pattern.test(file));
}

// Filter out warroom artifacts for conflict detection purposes
function filterForConflictDetection(files: string[]): string[] {
  return files.filter((f) => !isWarroomArtifact(f));
}

// Check if branchA contains branchB (branchB is an ancestor of branchA)
// This means branchA has merged or includes all commits from branchB
async function branchContains(
  repoPath: string,
  branchA: string,
  branchB: string
): Promise<boolean> {
  try {
    // git merge-base --is-ancestor returns 0 if branchB is ancestor of branchA
    await execAsync(
      `git merge-base --is-ancestor ${branchB} ${branchA}`,
      { cwd: repoPath }
    );
    return true;
  } catch {
    // Non-zero exit means branchB is NOT an ancestor of branchA
    return false;
  }
}

// Build ancestry map: for each lane, which other lanes' commits does it contain?
async function buildAncestryMap(
  repoPath: string,
  lanes: Array<{ laneId: string; branch: string }>
): Promise<Map<string, Set<string>>> {
  const ancestryMap = new Map<string, Set<string>>();

  // Initialize empty sets for each lane
  for (const lane of lanes) {
    ancestryMap.set(lane.laneId, new Set());
  }

  // Check each pair of lanes
  const checks: Promise<void>[] = [];

  for (const laneA of lanes) {
    for (const laneB of lanes) {
      if (laneA.laneId === laneB.laneId) continue;

      checks.push(
        branchContains(repoPath, laneA.branch, laneB.branch).then((contains) => {
          if (contains) {
            // laneA contains laneB's commits
            ancestryMap.get(laneA.laneId)!.add(laneB.laneId);
          }
        })
      );
    }
  }

  await Promise.all(checks);
  return ancestryMap;
}

// Calculate conflict risk based on file overlap, accounting for ancestry
// Excludes warroom artifacts from conflict detection
// Ancestry is bidirectional: if A includes B OR B includes A, they're in the same dependency chain
function calculateConflictRisk(
  filesChanged: string[],
  allLaneFiles: Map<string, string[]>,
  currentLaneId: string,
  includedLanes: Set<string>,
  ancestryMap: Map<string, Set<string>>
): {
  risk: "none" | "low" | "medium" | "high";
  overlappingLanes: string[];
  includedLanes: string[];
  conflictingLanes: string[];
} {
  const overlappingLanes: string[] = [];
  const includedLanesList: string[] = [];
  const conflictingLanes: string[] = [];

  // Filter out warroom artifacts for conflict detection
  const sourceFiles = filterForConflictDetection(filesChanged);

  for (const [otherLaneId, otherFiles] of allLaneFiles.entries()) {
    if (otherLaneId === currentLaneId) continue;

    // Filter other lane's files too
    const otherSourceFiles = filterForConflictDetection(otherFiles);
    const overlap = sourceFiles.filter((f) => otherSourceFiles.includes(f));
    if (overlap.length > 0) {
      overlappingLanes.push(otherLaneId);

      // Check if this overlap is safe:
      // 1. Current lane includes the other lane (we merged their changes)
      // 2. Other lane includes current lane (they merged our changes - downstream dependency)
      const currentIncludesOther = includedLanes.has(otherLaneId);
      const otherIncludesCurrent = ancestryMap.get(otherLaneId)?.has(currentLaneId) ?? false;

      if (currentIncludesOther || otherIncludesCurrent) {
        includedLanesList.push(otherLaneId);
      } else {
        conflictingLanes.push(otherLaneId);
      }
    }
  }

  // Risk is based only on TRUE conflicts, not inherited overlaps
  if (conflictingLanes.length === 0) {
    return { risk: "none", overlappingLanes, includedLanes: includedLanesList, conflictingLanes };
  } else if (conflictingLanes.length === 1) {
    return { risk: "low", overlappingLanes, includedLanes: includedLanesList, conflictingLanes };
  } else if (conflictingLanes.length <= 3) {
    return { risk: "medium", overlappingLanes, includedLanes: includedLanesList, conflictingLanes };
  } else {
    return { risk: "high", overlappingLanes, includedLanes: includedLanesList, conflictingLanes };
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

  // Build ancestry map to detect which lanes include other lanes' commits
  const ancestryMap = await buildAncestryMap(
    repoPath,
    plan.lanes.map((l) => ({ laneId: l.laneId, branch: l.branch }))
  );

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
      const includedLanes = ancestryMap.get(lane.laneId) || new Set();
      const { risk, overlappingLanes, includedLanes: includedLanesList, conflictingLanes } = calculateConflictRisk(
        filesChanged,
        laneFilesMap,
        lane.laneId,
        includedLanes,
        ancestryMap
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
        includedLanes: includedLanesList,
        conflictingLanes,
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
