// Git operations for auto-committing lane work and merging
// Handles automatic commits when lanes signal completion and auto-merge functionality

import { exec as execCallback, execFile as execFileCallback } from "child_process";
import { promisify } from "util";
import { existsSync, readFileSync, lstatSync } from "fs";
import path from "path";
import os from "os";
import { LaneAgentStatus, MergeMethod } from "../plan-schema";

const exec = promisify(execCallback);
const execFile = promisify(execFileCallback);

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

// ============ Auto-Merge Operations ============

// Result of a lane merge operation
export interface MergeLaneResult {
  success: boolean;
  laneId: string;
  branch: string;
  method: MergeMethod;
  error?: string;
  conflictingFiles?: string[];
}

// Result of the full auto-merge process
export interface AutoMergeResult {
  success: boolean;
  mergedLanes: string[];
  conflict?: {
    laneId: string;
    branch: string;
    conflictingFiles: string[];
  };
  error?: string;
}

/**
 * Execute git command with error handling
 */
async function gitExec(
  cmd: string,
  cwd: string
): Promise<{ stdout: string; stderr: string; success: boolean; error?: string }> {
  try {
    const { stdout, stderr } = await exec(cmd, {
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

/**
 * Check if there are merge conflicts
 */
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

/**
 * Abort an in-progress merge
 */
async function abortMerge(repoPath: string): Promise<void> {
  await gitExec(`git merge --abort`, repoPath);
}

/**
 * Get the main branch name (main or master)
 */
export async function getMainBranch(repoPath: string): Promise<string | null> {
  const mainCheck = await gitExec(
    `git show-ref --verify --quiet refs/heads/main && echo "main" || (git show-ref --verify --quiet refs/heads/master && echo "master" || echo "none")`,
    repoPath
  );
  const branch = mainCheck.stdout.trim();
  return branch === "none" ? null : branch;
}

/**
 * Check if integration branch exists
 */
export async function integrationBranchExists(
  repoPath: string,
  integrationBranch: string
): Promise<boolean> {
  const result = await gitExec(
    `git show-ref --verify --quiet refs/heads/${integrationBranch}`,
    repoPath
  );
  return result.success;
}

/**
 * Create or checkout integration branch
 */
async function ensureIntegrationBranch(
  repoPath: string,
  integrationBranch: string
): Promise<{ success: boolean; error?: string }> {
  // First try to checkout existing branch
  const checkoutResult = await gitExec(
    `git checkout ${integrationBranch}`,
    repoPath
  );

  if (checkoutResult.success) {
    return { success: true };
  }

  // Branch doesn't exist, create it from main/master
  const mainBranch = await getMainBranch(repoPath);
  if (!mainBranch) {
    return { success: false, error: "No main or master branch found to branch from" };
  }

  // First checkout main
  const checkoutMain = await gitExec(`git checkout ${mainBranch}`, repoPath);
  if (!checkoutMain.success) {
    return { success: false, error: `Failed to checkout ${mainBranch}: ${checkoutMain.error}` };
  }

  // Create new integration branch
  const createResult = await gitExec(
    `git checkout -b ${integrationBranch}`,
    repoPath
  );

  if (!createResult.success) {
    return { success: false, error: `Failed to create integration branch: ${createResult.error}` };
  }

  return { success: true };
}

/**
 * Merge a single lane branch into the integration branch
 */
export async function mergeLaneBranch(
  repoPath: string,
  integrationBranch: string,
  laneBranch: string,
  method: MergeMethod,
  laneId: string
): Promise<MergeLaneResult> {
  console.log(`[GitOperations] Merging lane ${laneId} (${laneBranch}) into ${integrationBranch} using ${method}`);

  // Ensure we're on the integration branch
  const branchResult = await ensureIntegrationBranch(repoPath, integrationBranch);
  if (!branchResult.success) {
    return {
      success: false,
      laneId,
      branch: laneBranch,
      method,
      error: branchResult.error,
    };
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
      // For cherry-pick, fall back to merge for now
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
      console.log(`[GitOperations] Merge conflict detected for lane ${laneId}`);
      return {
        success: false,
        laneId,
        branch: laneBranch,
        method,
        error: "Merge conflict",
        conflictingFiles,
      };
    }
    return {
      success: false,
      laneId,
      branch: laneBranch,
      method,
      error: mergeResult.error || "Merge failed",
    };
  }

  // For squash merges, we need to commit
  if (method === "squash") {
    const statusResult = await gitExec(`git status --porcelain`, repoPath);
    if (statusResult.stdout.trim().length > 0) {
      const commitResult = await gitExec(
        `git commit -m "Squash merge ${laneId} (${laneBranch}) into ${integrationBranch}"`,
        repoPath
      );
      if (!commitResult.success) {
        return {
          success: false,
          laneId,
          branch: laneBranch,
          method,
          error: `Squash commit failed: ${commitResult.error}`,
        };
      }
    }
  }

  console.log(`[GitOperations] Successfully merged lane ${laneId}`);
  return {
    success: true,
    laneId,
    branch: laneBranch,
    method,
  };
}

/**
 * Auto-merge all completed lanes in dependency order
 */
export async function autoMergeLanes(
  repoPath: string,
  integrationBranch: string,
  lanes: Array<{ laneId: string; branch: string; dependsOn: string[] }>,
  defaultMethod: MergeMethod = "merge"
): Promise<AutoMergeResult> {
  console.log(`[GitOperations] Starting auto-merge of ${lanes.length} lanes into ${integrationBranch}`);

  const mergedLanes: string[] = [];

  // Sort lanes by dependencies (topological sort)
  const sortedLanes = topologicalSort(lanes);

  for (const lane of sortedLanes) {
    const result = await mergeLaneBranch(
      repoPath,
      integrationBranch,
      lane.branch,
      defaultMethod,
      lane.laneId
    );

    if (!result.success) {
      if (result.conflictingFiles && result.conflictingFiles.length > 0) {
        // Conflict detected - stop and return conflict info
        return {
          success: false,
          mergedLanes,
          conflict: {
            laneId: lane.laneId,
            branch: lane.branch,
            conflictingFiles: result.conflictingFiles,
          },
        };
      }

      // Non-conflict failure
      return {
        success: false,
        mergedLanes,
        error: `Failed to merge lane ${lane.laneId}: ${result.error}`,
      };
    }

    mergedLanes.push(lane.laneId);
  }

  console.log(`[GitOperations] Auto-merge complete: ${mergedLanes.length} lanes merged`);
  return {
    success: true,
    mergedLanes,
  };
}

/**
 * Topological sort of lanes based on dependencies
 */
function topologicalSort(
  lanes: Array<{ laneId: string; branch: string; dependsOn: string[] }>
): Array<{ laneId: string; branch: string; dependsOn: string[] }> {
  const result: Array<{ laneId: string; branch: string; dependsOn: string[] }> = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const laneMap = new Map(lanes.map((l) => [l.laneId, l]));

  function visit(laneId: string): void {
    if (visited.has(laneId)) return;
    if (inStack.has(laneId)) {
      // Cycle detected - just continue (shouldn't happen with valid dependencies)
      console.warn(`[GitOperations] Dependency cycle detected involving ${laneId}`);
      return;
    }

    const lane = laneMap.get(laneId);
    if (!lane) return;

    inStack.add(laneId);

    // Visit dependencies first
    for (const depId of lane.dependsOn) {
      visit(depId);
    }

    inStack.delete(laneId);
    visited.add(laneId);
    result.push(lane);
  }

  for (const lane of lanes) {
    visit(lane.laneId);
  }

  return result;
}

/**
 * Abort any in-progress merge (for conflict resolution)
 */
export async function abortAutoMerge(repoPath: string): Promise<{ success: boolean; error?: string }> {
  try {
    await abortMerge(repoPath);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============ Git Push Operations ============

// Result of a push operation
export interface PushResult {
  success: boolean;
  branch: string;
  remote: string;
  error?: string;
  errorType?: "auth" | "protected" | "rejected" | "network" | "unknown";
}

/**
 * Check if a remote tracking branch exists
 */
export async function hasRemoteTrackingBranch(
  repoPath: string,
  branch: string,
  remote: string = "origin"
): Promise<boolean> {
  const result = await gitExec(
    `git ls-remote --heads ${remote} ${branch}`,
    repoPath
  );
  return result.success && result.stdout.trim().length > 0;
}

/**
 * Get the current branch name in a worktree
 */
export async function getCurrentBranch(worktreePath: string): Promise<string | null> {
  const result = await gitExec(`git rev-parse --abbrev-ref HEAD`, worktreePath);
  if (!result.success) return null;
  const branch = result.stdout.trim();
  return branch === "HEAD" ? null : branch;
}

/**
 * Push a branch to remote with proper error handling
 * Handles common failure cases: auth errors, protected branches, rejected pushes
 */
export async function pushBranch(
  repoPath: string,
  branch: string,
  remote: string = "origin",
  setUpstream: boolean = false
): Promise<PushResult> {
  console.log(`[GitOperations] Pushing branch ${branch} to ${remote}`);

  // Build push command
  const upstreamFlag = setUpstream ? "-u" : "";
  const pushCmd = `git push ${upstreamFlag} ${remote} ${branch}`.trim().replace(/\s+/g, " ");

  const result = await gitExec(pushCmd, repoPath);

  if (result.success) {
    console.log(`[GitOperations] Successfully pushed ${branch} to ${remote}`);
    return {
      success: true,
      branch,
      remote,
    };
  }

  // Parse error type from stderr
  const stderr = result.stderr.toLowerCase();
  let errorType: PushResult["errorType"] = "unknown";

  if (
    stderr.includes("authentication") ||
    stderr.includes("permission denied") ||
    stderr.includes("could not read from remote") ||
    stderr.includes("invalid credentials")
  ) {
    errorType = "auth";
  } else if (
    stderr.includes("protected branch") ||
    stderr.includes("pre-receive hook declined") ||
    stderr.includes("denied to")
  ) {
    errorType = "protected";
  } else if (
    stderr.includes("rejected") ||
    stderr.includes("non-fast-forward") ||
    stderr.includes("failed to push")
  ) {
    errorType = "rejected";
  } else if (
    stderr.includes("could not resolve host") ||
    stderr.includes("network") ||
    stderr.includes("connection refused") ||
    stderr.includes("timed out")
  ) {
    errorType = "network";
  }

  console.error(`[GitOperations] Push failed for ${branch}: ${result.error}`);

  return {
    success: false,
    branch,
    remote,
    error: result.error || result.stderr || "Push failed",
    errorType,
  };
}

/**
 * Push a lane branch after commit
 * This is called when auto-push for lane branches is enabled
 */
export async function pushLaneBranch(
  worktreePath: string,
  branch: string
): Promise<PushResult> {
  console.log(`[GitOperations] Auto-pushing lane branch ${branch}`);

  // Check if remote tracking exists - if not, set upstream
  const hasTracking = await hasRemoteTrackingBranch(worktreePath, branch);
  return await pushBranch(worktreePath, branch, "origin", !hasTracking);
}

/**
 * Push the integration branch after merge
 * This is called when auto-push for integration branch is enabled
 */
export async function pushIntegrationBranch(
  repoPath: string,
  integrationBranch: string
): Promise<PushResult> {
  console.log(`[GitOperations] Auto-pushing integration branch ${integrationBranch}`);

  // Check if remote tracking exists - if not, set upstream
  const hasTracking = await hasRemoteTrackingBranch(repoPath, integrationBranch);
  return await pushBranch(repoPath, integrationBranch, "origin", !hasTracking);
}

/**
 * Check if a branch is a protected main branch
 * Used to prevent accidental pushes without human confirmation
 */
export function isProtectedMainBranch(branch: string): boolean {
  const protectedBranches = ["main", "master", "production", "prod", "release"];
  return protectedBranches.includes(branch.toLowerCase());
}

// ============ Worktree Cleanup Operations ============

// Result of checking if a worktree can be removed
export interface WorktreeSafetyCheckResult {
  safe: boolean;
  reason: string;
  hasUncommittedChanges?: boolean;
  isSymlink?: boolean;
  pathOutsideBoundary?: boolean;
}

// Result of a worktree removal operation
export interface RemoveWorktreeResult {
  success: boolean;
  worktreePath: string;
  error?: string;
}

// Result of a branch deletion operation
export interface DeleteBranchResult {
  success: boolean;
  branch: string;
  forcedDelete?: boolean;
  error?: string;
}

// Dangerous paths that should never be removed
const DANGEROUS_PATHS = [
  os.homedir(),
  "/",
  "/usr",
  "/etc",
  "/var",
  "/tmp",
  "/bin",
  "/sbin",
  "/Applications",
];

/**
 * Get the expected worktree root directory
 * Defaults to ~/Desktop/worktrees if not configured
 */
export function getWorktreeRoot(): string {
  return path.join(os.homedir(), "Desktop", "worktrees");
}

/**
 * Validate that a path is safe for removal
 * Implements path boundary checks from security review
 */
export function validateWorktreePath(worktreePath: string): WorktreeSafetyCheckResult {
  const resolvedPath = path.resolve(worktreePath);
  const worktreeRoot = getWorktreeRoot();
  const resolvedRoot = path.resolve(worktreeRoot);

  // Check if path is a symlink (security: symlink attacks)
  try {
    const stats = lstatSync(resolvedPath);
    if (stats.isSymbolicLink()) {
      return {
        safe: false,
        reason: "Worktree path is a symlink - refusing to remove for security",
        isSymlink: true,
      };
    }
  } catch {
    // Path doesn't exist - that's fine for removal
  }

  // Check if path is under the worktree root
  if (!resolvedPath.startsWith(resolvedRoot + path.sep) && resolvedPath !== resolvedRoot) {
    return {
      safe: false,
      reason: `Worktree path is outside the expected root (${worktreeRoot})`,
      pathOutsideBoundary: true,
    };
  }

  // Check against dangerous paths
  for (const dangerous of DANGEROUS_PATHS) {
    const resolvedDangerous = path.resolve(dangerous);
    if (resolvedPath === resolvedDangerous || resolvedPath.startsWith(resolvedDangerous + path.sep)) {
      // Only block if the dangerous path is not under worktree root
      if (!resolvedDangerous.startsWith(resolvedRoot + path.sep)) {
        return {
          safe: false,
          reason: `Path ${resolvedPath} is or is under a protected system directory`,
          pathOutsideBoundary: true,
        };
      }
    }
  }

  return {
    safe: true,
    reason: "Path validation passed",
  };
}

/**
 * Check if a branch is merged into the target branch
 */
export async function isBranchMerged(
  repoPath: string,
  branch: string,
  targetBranch: string
): Promise<boolean> {
  try {
    // Use git merge-base --is-ancestor to check if branch is merged
    const result = await gitExec(
      `git merge-base --is-ancestor ${branch} ${targetBranch}`,
      repoPath
    );
    return result.success;
  } catch {
    return false;
  }
}

/**
 * Check if a worktree is safe to remove
 * Validates path, checks for uncommitted changes, etc.
 */
export async function isWorktreeSafeToRemove(
  worktreePath: string
): Promise<WorktreeSafetyCheckResult> {
  // First validate the path itself
  const pathValidation = validateWorktreePath(worktreePath);
  if (!pathValidation.safe) {
    return pathValidation;
  }

  // Check if directory exists
  if (!existsSync(worktreePath)) {
    return {
      safe: true,
      reason: "Worktree directory does not exist (already removed)",
    };
  }

  // Re-check for uncommitted changes immediately before removal (TOCTOU mitigation)
  try {
    const hasChanges = await hasUncommittedChanges(worktreePath);
    if (hasChanges) {
      return {
        safe: false,
        reason: "Worktree has uncommitted changes",
        hasUncommittedChanges: true,
      };
    }
  } catch (error) {
    // If we can't check git status, the directory might not be a valid git worktree
    return {
      safe: false,
      reason: `Unable to check git status: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  return {
    safe: true,
    reason: "Worktree is safe to remove",
  };
}

/**
 * Remove a worktree using execFile for security (avoids shell injection)
 */
export async function removeWorktree(
  repoPath: string,
  worktreePath: string,
  force: boolean = true
): Promise<RemoveWorktreeResult> {
  console.log(`[GitOperations] Removing worktree at ${worktreePath}`);

  // Validate path before removal
  const pathValidation = validateWorktreePath(worktreePath);
  if (!pathValidation.safe) {
    return {
      success: false,
      worktreePath,
      error: pathValidation.reason,
    };
  }

  try {
    // Use execFile to avoid shell injection (security recommendation)
    const args = ["worktree", "remove", worktreePath];
    if (force) {
      args.push("--force");
    }

    await execFile("git", args, { cwd: repoPath });

    console.log(`[GitOperations] Successfully removed worktree at ${worktreePath}`);
    return {
      success: true,
      worktreePath,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[GitOperations] Failed to remove worktree:`, error);

    return {
      success: false,
      worktreePath,
      error: errorMessage,
    };
  }
}

/**
 * Delete a lane branch
 * Uses -d (safe delete) by default, falls back to -D if merged in MergeState
 */
export async function deleteLaneBranch(
  repoPath: string,
  branch: string,
  forceDelete: boolean = false
): Promise<DeleteBranchResult> {
  console.log(`[GitOperations] Deleting branch ${branch}${forceDelete ? " (force)" : ""}`);

  try {
    // Use execFile to avoid shell injection
    const flag = forceDelete ? "-D" : "-d";
    await execFile("git", ["branch", flag, branch], { cwd: repoPath });

    console.log(`[GitOperations] Successfully deleted branch ${branch}`);
    return {
      success: true,
      branch,
      forcedDelete: forceDelete,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[GitOperations] Failed to delete branch ${branch}:`, error);

    return {
      success: false,
      branch,
      error: errorMessage,
    };
  }
}

/**
 * Prune stale worktree references
 */
export async function pruneWorktrees(repoPath: string): Promise<{ success: boolean; error?: string }> {
  try {
    await execFile("git", ["worktree", "prune"], { cwd: repoPath });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
