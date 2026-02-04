// Git operations for auto-committing lane work
// Handles automatic commits when lanes signal completion

import { exec as execCallback } from "child_process";
import { promisify } from "util";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { LaneAgentStatus } from "../plan-schema";

const exec = promisify(execCallback);

// Result of an auto-commit operation
export interface AutoCommitResult {
  success: boolean;
  committed: boolean; // True if a commit was actually made (vs skipped because no changes)
  commitHash?: string;
  commitMessage?: string;
  error?: string;
  filesChanged?: number;
}

/**
 * Check if a worktree has uncommitted changes
 */
export async function hasUncommittedChanges(worktreePath: string): Promise<boolean> {
  try {
    const { stdout } = await exec("git status --porcelain", { cwd: worktreePath });
    return stdout.trim().length > 0;
  } catch (error) {
    console.error(`[GitOperations] Error checking git status:`, error);
    return false;
  }
}

/**
 * Get count of uncommitted files in worktree
 */
export async function getUncommittedFileCount(worktreePath: string): Promise<number> {
  try {
    const { stdout } = await exec("git status --porcelain", { cwd: worktreePath });
    const lines = stdout.trim().split("\n").filter(line => line.length > 0);
    return lines.length;
  } catch (error) {
    console.error(`[GitOperations] Error getting uncommitted file count:`, error);
    return 0;
  }
}

/**
 * Read LANE_STATUS.json from worktree to get summary for commit message
 */
export function readLaneStatus(worktreePath: string): LaneAgentStatus | null {
  const statusPath = path.join(worktreePath, "LANE_STATUS.json");

  if (!existsSync(statusPath)) {
    return null;
  }

  try {
    const content = readFileSync(statusPath, "utf-8");
    return JSON.parse(content) as LaneAgentStatus;
  } catch (error) {
    console.error(`[GitOperations] Error reading LANE_STATUS.json:`, error);
    return null;
  }
}

/**
 * Generate commit message for lane work
 */
function generateCommitMessage(laneId: string, agentStatus: LaneAgentStatus | null): string {
  // Extract a concise summary
  let summary = "Auto-commit lane work";

  if (agentStatus) {
    if (agentStatus.summary) {
      // Use the agent's summary if available
      summary = agentStatus.summary;
    } else if (agentStatus.currentStep) {
      // Fall back to current step
      summary = agentStatus.currentStep;
    } else if (agentStatus.completedSteps.length > 0) {
      // Fall back to last completed step
      summary = agentStatus.completedSteps[agentStatus.completedSteps.length - 1];
    }
  }

  // Truncate summary to reasonable length and sanitize
  summary = summary
    .replace(/["\n\r]/g, " ")
    .trim()
    .slice(0, 100);

  return `feat(${laneId}): ${summary}`;
}

/**
 * Auto-commit all changes in a worktree
 * Called when lane completion is detected (LANE_STATUS.json phase='complete' or clean exit)
 */
export async function autoCommitLaneWork(
  worktreePath: string,
  laneId: string
): Promise<AutoCommitResult> {
  console.log(`[GitOperations] Auto-committing work for lane ${laneId} at ${worktreePath}`);

  try {
    // Check for uncommitted changes
    const hasChanges = await hasUncommittedChanges(worktreePath);

    if (!hasChanges) {
      console.log(`[GitOperations] No uncommitted changes in lane ${laneId}, skipping commit`);
      return {
        success: true,
        committed: false,
      };
    }

    // Get file count for result
    const filesChanged = await getUncommittedFileCount(worktreePath);

    // Read LANE_STATUS.json for commit message
    const agentStatus = readLaneStatus(worktreePath);
    const commitMessage = generateCommitMessage(laneId, agentStatus);

    console.log(`[GitOperations] Committing ${filesChanged} files with message: ${commitMessage}`);

    // Stage all changes
    await exec("git add -A", { cwd: worktreePath });

    // Create commit
    // Escape single quotes in commit message for shell
    const escapedMessage = commitMessage.replace(/'/g, "'\\''");
    const { stdout: commitOutput } = await exec(
      `git commit -m '${escapedMessage}'`,
      { cwd: worktreePath }
    );

    // Extract commit hash from output
    const hashMatch = commitOutput.match(/\[[\w\-/]+ ([a-f0-9]+)\]/);
    const commitHash = hashMatch ? hashMatch[1] : undefined;

    console.log(`[GitOperations] Successfully committed lane ${laneId} work: ${commitHash}`);

    return {
      success: true,
      committed: true,
      commitHash,
      commitMessage,
      filesChanged,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[GitOperations] Error auto-committing lane ${laneId}:`, error);

    return {
      success: false,
      committed: false,
      error: errorMessage,
    };
  }
}

/**
 * Check if LANE_STATUS.json indicates completion
 */
export function isLaneStatusComplete(worktreePath: string): boolean {
  const agentStatus = readLaneStatus(worktreePath);
  if (!agentStatus) {
    return false;
  }

  // Check if phase indicates completion
  // Valid completion phases: "complete", "completed", "completing", "done", "finished"
  const completionPhases = ["complete", "completed", "completing", "done", "finished"];
  return completionPhases.includes(agentStatus.phase.toLowerCase());
}
