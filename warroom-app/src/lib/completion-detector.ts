// Auto-completion detection service for lanes
// Detects when a lane's work appears complete based on configurable rules

import { promises as fs } from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { CompletionDetection, LaneStatusEntry } from "./plan-schema";

const execAsync = promisify(exec);

// Inactivity threshold (5 minutes in milliseconds)
const INACTIVITY_THRESHOLD_MS = 5 * 60 * 1000;

// Completion signal patterns in commit messages
const COMPLETION_PATTERNS = [
  /\bcomplete[sd]?\b/i,
  /\bdone\b/i,
  /\bfinished\b/i,
  /\bready for review\b/i,
  /\bwrap up\b/i,
  /\bfinal\b/i,
];

// Marker files that indicate completion
const COMPLETION_MARKER_FILES = ["REVIEW.md", "FINDINGS.md"];

export interface CompletionCheckResult {
  detection: CompletionDetection;
  shouldAutoMark: boolean;
}

/**
 * Check if a worktree path has completion marker files
 */
async function checkMarkerFiles(worktreePath: string): Promise<string[]> {
  const signals: string[] = [];

  for (const markerFile of COMPLETION_MARKER_FILES) {
    try {
      await fs.access(path.join(worktreePath, markerFile));
      signals.push(`${markerFile} exists`);
    } catch {
      // File doesn't exist, that's okay
    }
  }

  return signals;
}

/**
 * Check recent commit messages for completion patterns
 */
async function checkCommitMessages(worktreePath: string): Promise<string[]> {
  const signals: string[] = [];

  try {
    await fs.access(worktreePath);
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

  return signals;
}

/**
 * Check if there's been no file activity for the inactivity threshold
 * Requires that there are commits since launch (to indicate work was done)
 */
function checkInactivity(
  lastActivityAt: string | undefined,
  commitsSinceLaunch: number | undefined
): string | null {
  // Only consider inactivity if there are commits (work was done)
  if (!commitsSinceLaunch || commitsSinceLaunch <= 0) {
    return null;
  }

  if (!lastActivityAt) {
    return null;
  }

  const lastActivity = new Date(lastActivityAt).getTime();
  const now = Date.now();
  const inactiveMs = now - lastActivity;

  if (inactiveMs >= INACTIVITY_THRESHOLD_MS) {
    const inactiveMinutes = Math.floor(inactiveMs / 60000);
    return `No file changes for ${inactiveMinutes} minutes after commits`;
  }

  return null;
}

/**
 * Detect completion signals for a lane
 * @param worktreePath - Path to the lane's worktree
 * @param laneEntry - Current lane status entry from status.json
 * @param commitsSinceLaunch - Number of commits since lane was launched
 * @param autonomyEnabled - Whether autonomy is enabled for this lane
 * @returns CompletionCheckResult with detection info and whether to auto-mark
 */
export async function detectLaneCompletion(
  worktreePath: string,
  laneEntry: LaneStatusEntry | undefined,
  commitsSinceLaunch: number | undefined,
  autonomyEnabled: boolean
): Promise<CompletionCheckResult> {
  const signals: string[] = [];

  // Don't check for completion if already complete
  if (laneEntry?.status === "complete") {
    return {
      detection: {
        detected: false,
        signals: [],
      },
      shouldAutoMark: false,
    };
  }

  // Only check lanes that are in_progress
  if (laneEntry?.status !== "in_progress") {
    return {
      detection: {
        detected: false,
        signals: [],
      },
      shouldAutoMark: false,
    };
  }

  // Check marker files
  const markerSignals = await checkMarkerFiles(worktreePath);
  signals.push(...markerSignals);

  // Check commit messages
  const commitSignals = await checkCommitMessages(worktreePath);
  signals.push(...commitSignals);

  // Check inactivity (only if we have commits)
  const inactivitySignal = checkInactivity(
    laneEntry?.lastActivityAt,
    commitsSinceLaunch
  );
  if (inactivitySignal) {
    signals.push(inactivitySignal);
  }

  const detected = signals.length > 0;
  const reason = detected ? signals[0] : undefined;

  // Determine if we should auto-mark as complete
  // Auto-mark if:
  // 1. Completion was detected
  // 2. Autonomy is enabled for this lane
  // 3. Lane hasn't already been auto-marked (prevent repeated auto-marking if user changes status back)
  const wasAutoMarked = laneEntry?.completionDetection?.autoMarked ?? false;
  const shouldAutoMark = detected && autonomyEnabled && !wasAutoMarked;

  const detection: CompletionDetection = {
    detected,
    reason,
    signals,
    detectedAt: detected ? new Date().toISOString() : undefined,
    autoMarked: shouldAutoMark ? true : wasAutoMarked,
  };

  return {
    detection,
    shouldAutoMark,
  };
}

/**
 * Update last activity timestamp for a lane
 * Called by file watcher when files change
 */
export function getActivityTimestamp(): string {
  return new Date().toISOString();
}
