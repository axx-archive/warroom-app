// API route to get uncommitted changes, commit counts, and completion suggestions per lane
// GET /api/runs/[slug]/lane-status - returns uncommitted file counts, file lists, commits since launch, and completion signals per lane
// Also performs auto-completion detection and marking when autonomy is enabled

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import { WarRoomPlan, Lane, StatusJson, CompletionDetection, LaunchMode, LaneAgentStatus, RetryState, PushState, CostTracking } from "@/lib/plan-schema";
import { detectLaneCompletion } from "@/lib/completion-detector";
import { emitLaneStatusChange } from "@/lib/websocket";
import { getLaneCostTracking, getRunCostTracking } from "@/lib/orchestrator";

const execAsync = promisify(exec);

interface UncommittedFile {
  status: string; // e.g. "M", "A", "D", "??"
  path: string;
}

// Completion suggestion signals detected for a lane
export interface CompletionSuggestion {
  suggested: boolean;
  reason?: string; // e.g., "REVIEW.md exists", "Commit message contains 'complete'"
  signals: string[]; // List of all detected signals
  dismissed?: boolean; // True if user dismissed this suggestion
}

interface LaneUncommittedStatus {
  laneId: string;
  uncommittedCount: number;
  uncommittedFiles: UncommittedFile[];
  worktreeExists: boolean;
  error?: string;
  // Commits tracking
  commitsSinceLaunch?: number;
  commitsAtLaunch?: number;
  currentCommits?: number;
  branch?: string;
  // Completion suggestion
  completionSuggestion?: CompletionSuggestion;
  // Auto-completion detection
  completionDetection?: CompletionDetection;
  autoMarkedComplete?: boolean; // True if lane was auto-marked complete this poll cycle
  // Launch mode preference
  launchMode?: LaunchMode; // 'cursor' or 'terminal'
  // Agent progress from LANE_STATUS.json
  agentStatus?: LaneAgentStatus;
  // Retry state for failed lanes
  retryState?: RetryState;
  // Push state for the lane branch
  pushState?: PushState;
  // Cost tracking for the lane
  costTracking?: CostTracking;
}

export interface LaneStatusResponse {
  success: boolean;
  lanes: Record<string, LaneUncommittedStatus>;
  // Total cost tracking for the run
  totalCostUsd?: number;
  error?: string;
}

async function getUncommittedFiles(worktreePath: string): Promise<{ files: UncommittedFile[]; error?: string }> {
  try {
    // Check if directory exists
    await fs.access(worktreePath);
  } catch {
    return { files: [], error: "Worktree does not exist" };
  }

  try {
    const { stdout } = await execAsync("git status --porcelain", {
      cwd: worktreePath,
    });

    const files: UncommittedFile[] = stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        // Format is "XY path" where XY is status codes
        const status = line.substring(0, 2).trim();
        const filePath = line.substring(3);
        return { status, path: filePath };
      });

    return { files };
  } catch (error) {
    return { files: [], error: `Git error: ${error instanceof Error ? error.message : String(error)}` };
  }
}

// Get the current commit count for a worktree
async function getCommitCount(worktreePath: string): Promise<number | null> {
  try {
    await fs.access(worktreePath);
    const { stdout } = await execAsync("git rev-list --count HEAD", { cwd: worktreePath });
    return parseInt(stdout.trim(), 10) || 0;
  } catch {
    return null;
  }
}

// Read LANE_STATUS.json from a worktree (agent progress status)
async function readLaneAgentStatus(worktreePath: string): Promise<LaneAgentStatus | null> {
  try {
    const statusPath = path.join(worktreePath, "LANE_STATUS.json");
    const content = await fs.readFile(statusPath, "utf-8");
    const agentStatus: LaneAgentStatus = JSON.parse(content);

    // Validate required fields
    if (
      typeof agentStatus.phase !== "string" ||
      !Array.isArray(agentStatus.completedSteps) ||
      typeof agentStatus.currentStep !== "string" ||
      typeof agentStatus.progress !== "number" ||
      !Array.isArray(agentStatus.blockers)
    ) {
      console.warn(`[lane-status] Invalid LANE_STATUS.json format at ${statusPath}`);
      return null;
    }

    return agentStatus;
  } catch {
    // File doesn't exist or couldn't be read - this is normal for lanes that haven't started
    return null;
  }
}

// Completion signal patterns in commit messages
const COMPLETION_PATTERNS = [
  /\bcomplete[sd]?\b/i,
  /\bdone\b/i,
  /\bfinished\b/i,
  /\bready for review\b/i,
  /\bwrap up\b/i,
];

// Detect completion signals for a lane
async function detectCompletionSignals(
  worktreePath: string,
  dismissed: boolean = false
): Promise<CompletionSuggestion> {
  const signals: string[] = [];

  // If dismissed, return early with no suggestion
  if (dismissed) {
    return { suggested: false, signals: [], dismissed: true };
  }

  try {
    await fs.access(worktreePath);
  } catch {
    return { suggested: false, signals: [] };
  }

  // Check for REVIEW.md
  try {
    await fs.access(path.join(worktreePath, "REVIEW.md"));
    signals.push("REVIEW.md exists");
  } catch {
    // File doesn't exist, that's okay
  }

  // Check for FINDINGS.md
  try {
    await fs.access(path.join(worktreePath, "FINDINGS.md"));
    signals.push("FINDINGS.md exists");
  } catch {
    // File doesn't exist, that's okay
  }

  // Check recent commit messages for completion patterns
  try {
    const { stdout } = await execAsync("git log --oneline -5 --format=%s", {
      cwd: worktreePath,
    });
    const recentCommits = stdout.trim().split("\n").filter(Boolean);

    for (const commit of recentCommits) {
      for (const pattern of COMPLETION_PATTERNS) {
        if (pattern.test(commit)) {
          signals.push(`Commit message: "${commit.substring(0, 50)}${commit.length > 50 ? "..." : ""}"`);
          break; // Only add once per commit
        }
      }
    }
  } catch {
    // Git command failed, that's okay
  }

  // Determine if we should suggest completion
  const suggested = signals.length > 0;
  const reason = signals.length > 0 ? signals[0] : undefined;

  return { suggested, reason, signals };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const runDir = path.join(
      os.homedir(),
      ".openclaw/workspace/warroom/runs",
      slug
    );

    // Check if run directory exists
    try {
      await fs.access(runDir);
    } catch {
      return NextResponse.json(
        { success: false, error: "Run not found", lanes: {} },
        { status: 404 }
      );
    }

    // Read the plan to get lane info
    let plan: WarRoomPlan;
    try {
      const planContent = await fs.readFile(
        path.join(runDir, "plan.json"),
        "utf-8"
      );
      plan = JSON.parse(planContent);
    } catch {
      return NextResponse.json(
        { success: false, error: "Could not read plan.json", lanes: {} },
        { status: 404 }
      );
    }

    // Read status.json to get commitsAtLaunch values
    let statusJson: StatusJson | null = null;
    try {
      const statusContent = await fs.readFile(
        path.join(runDir, "status.json"),
        "utf-8"
      );
      statusJson = JSON.parse(statusContent);
    } catch {
      // Status.json may not exist yet - that's okay
    }

    // Get uncommitted files, commit counts, and completion suggestions for each lane
    const laneStatuses: Record<string, LaneUncommittedStatus> = {};
    const statusPath = path.join(runDir, "status.json");
    let statusUpdated = false;

    await Promise.all(
      plan.lanes.map(async (lane: Lane) => {
        const { files, error } = await getUncommittedFiles(lane.worktreePath);
        const currentCommits = await getCommitCount(lane.worktreePath);
        const agentStatus = await readLaneAgentStatus(lane.worktreePath);

        // Get lane-specific data from status.json
        const laneStatusEntry = statusJson?.lanes?.[lane.laneId];
        const commitsAtLaunch = laneStatusEntry?.commitsAtLaunch;
        const suggestionDismissed = laneStatusEntry?.suggestionDismissed ?? false;
        const laneStatus = laneStatusEntry?.status;
        const launchMode = laneStatusEntry?.launchMode;

        // Calculate commits since launch
        let commitsSinceLaunch: number | undefined;
        if (currentCommits !== null && commitsAtLaunch !== undefined) {
          commitsSinceLaunch = Math.max(0, currentCommits - commitsAtLaunch);
        }

        // Detect completion signals (only for lanes that are in_progress and not already complete)
        let completionSuggestion: CompletionSuggestion | undefined;
        if (laneStatus === "in_progress") {
          completionSuggestion = await detectCompletionSignals(
            lane.worktreePath,
            suggestionDismissed
          );
        }

        // Auto-completion detection
        // Check if autonomy is enabled for this lane
        const autonomyEnabled = lane.autonomy?.dangerouslySkipPermissions ?? false;
        const { detection, shouldAutoMark } = await detectLaneCompletion(
          lane.worktreePath,
          laneStatusEntry,
          commitsSinceLaunch,
          autonomyEnabled
        );

        let autoMarkedComplete = false;

        // If auto-mark should happen, update status.json
        if (shouldAutoMark && statusJson) {
          if (!statusJson.lanes) {
            statusJson.lanes = {};
          }

          const previousStatus = statusJson.lanes[lane.laneId]?.status ?? "pending";

          statusJson.lanes[lane.laneId] = {
            ...statusJson.lanes[lane.laneId],
            staged: statusJson.lanes[lane.laneId]?.staged ?? false,
            status: "complete",
            completionDetection: detection,
          };

          // Also update lanesCompleted array for backwards compatibility
          if (!statusJson.lanesCompleted) {
            statusJson.lanesCompleted = [];
          }
          if (!statusJson.lanesCompleted.includes(lane.laneId)) {
            statusJson.lanesCompleted.push(lane.laneId);
          }

          statusUpdated = true;
          autoMarkedComplete = true;

          console.log(
            `[Auto-completion] Lane ${lane.laneId} auto-marked complete. Reason: ${detection.reason}`
          );

          // Emit WebSocket event for status change
          emitLaneStatusChange({
            runSlug: slug,
            laneId: lane.laneId,
            previousStatus,
            newStatus: "complete",
            timestamp: new Date().toISOString(),
          });
        }

        // Get cost tracking from output buffer (if available) or from status.json
        const liveCostTracking = getLaneCostTracking(slug, lane.laneId);
        const savedCostTracking = laneStatusEntry?.costTracking;
        // Prefer live cost tracking if available, otherwise use saved
        const costTracking = liveCostTracking ?? savedCostTracking;

        laneStatuses[lane.laneId] = {
          laneId: lane.laneId,
          uncommittedCount: files.length,
          uncommittedFiles: files,
          worktreeExists: !error || !error.includes("does not exist"),
          error,
          commitsSinceLaunch,
          commitsAtLaunch,
          currentCommits: currentCommits ?? undefined,
          branch: lane.branch,
          completionSuggestion,
          completionDetection: detection.detected ? detection : undefined,
          autoMarkedComplete,
          launchMode,
          agentStatus: agentStatus ?? undefined,
          retryState: laneStatusEntry?.retryState,
          pushState: laneStatusEntry?.pushState,
          costTracking,
        };
      })
    );

    // Write updated status.json if any lane was auto-marked
    if (statusUpdated && statusJson) {
      statusJson.updatedAt = new Date().toISOString();
      await fs.writeFile(statusPath, JSON.stringify(statusJson, null, 2));
    }

    // Get total run cost tracking
    const runCosts = getRunCostTracking(slug);

    const response: LaneStatusResponse = {
      success: true,
      lanes: laneStatuses,
      totalCostUsd: runCosts.totalCostUsd,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error getting lane status:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get lane status",
        lanes: {},
      },
      { status: 500 }
    );
  }
}
