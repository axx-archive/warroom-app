import { exec } from "child_process";
import { promisify } from "util";
import { promises as fs } from "fs";
import path from "path";

const execAsync = promisify(exec);

export interface WorktreeInfo {
  path: string;
  branch: string;
  exists: boolean;
}

export interface WorktreeResult {
  success: boolean;
  path: string;
  branch: string;
  error?: string;
  alreadyExisted?: boolean;
}

/**
 * Check if a path exists
 */
async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a worktree already exists at the given path
 */
export async function worktreeExists(worktreePath: string): Promise<boolean> {
  return pathExists(worktreePath);
}

/**
 * Check if a branch already exists in the repo
 */
async function branchExists(repoPath: string, branchName: string): Promise<boolean> {
  try {
    await execAsync(`git show-ref --verify --quiet refs/heads/${branchName}`, {
      cwd: repoPath,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * List all worktrees for a repo
 */
export async function listWorktrees(repoPath: string): Promise<WorktreeInfo[]> {
  try {
    const { stdout } = await execAsync("git worktree list --porcelain", {
      cwd: repoPath,
    });

    const worktrees: WorktreeInfo[] = [];
    const lines = stdout.trim().split("\n");
    let currentWorktree: Partial<WorktreeInfo> = {};

    for (const line of lines) {
      if (line.startsWith("worktree ")) {
        if (currentWorktree.path) {
          worktrees.push({
            path: currentWorktree.path,
            branch: currentWorktree.branch || "",
            exists: true,
          });
        }
        currentWorktree = { path: line.slice(9) };
      } else if (line.startsWith("branch ")) {
        currentWorktree.branch = line.slice(7).replace("refs/heads/", "");
      }
    }

    // Don't forget the last one
    if (currentWorktree.path) {
      worktrees.push({
        path: currentWorktree.path,
        branch: currentWorktree.branch || "",
        exists: true,
      });
    }

    return worktrees;
  } catch (err) {
    console.error("Error listing worktrees:", err);
    return [];
  }
}

/**
 * Create a worktree at the given path with the specified branch
 *
 * Strategy:
 * 1. If branch exists, use: git worktree add <path> <branch>
 * 2. If branch doesn't exist, use: git worktree add -b <branch> <path>
 */
export async function createWorktree(
  repoPath: string,
  worktreePath: string,
  branchName: string
): Promise<WorktreeResult> {
  try {
    // Check if worktree path already exists
    if (await pathExists(worktreePath)) {
      // Check if it's already a valid worktree for this branch
      const worktrees = await listWorktrees(repoPath);
      const existingWorktree = worktrees.find((wt) => wt.path === worktreePath);

      if (existingWorktree) {
        if (existingWorktree.branch === branchName) {
          // Already exists with correct branch - reuse
          return {
            success: true,
            path: worktreePath,
            branch: branchName,
            alreadyExisted: true,
          };
        } else {
          // Exists but with different branch
          return {
            success: false,
            path: worktreePath,
            branch: branchName,
            error: `Worktree already exists at path with different branch: ${existingWorktree.branch}`,
          };
        }
      } else {
        // Path exists but isn't a worktree - could be a regular directory
        return {
          success: false,
          path: worktreePath,
          branch: branchName,
          error: "Path already exists and is not a git worktree",
        };
      }
    }

    // Ensure parent directory exists
    await fs.mkdir(path.dirname(worktreePath), { recursive: true });

    // Check if branch exists
    const hasBranch = await branchExists(repoPath, branchName);

    let command: string;
    if (hasBranch) {
      // Branch exists - checkout to worktree
      command = `git worktree add "${worktreePath}" "${branchName}"`;
    } else {
      // Branch doesn't exist - create new branch with worktree
      command = `git worktree add -b "${branchName}" "${worktreePath}"`;
    }

    const { stdout, stderr } = await execAsync(command, { cwd: repoPath });

    // Log output for debugging
    if (stdout) console.log("Worktree stdout:", stdout);
    if (stderr) console.log("Worktree stderr:", stderr);

    return {
      success: true,
      path: worktreePath,
      branch: branchName,
      alreadyExisted: false,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("Error creating worktree:", errorMessage);

    return {
      success: false,
      path: worktreePath,
      branch: branchName,
      error: errorMessage,
    };
  }
}

/**
 * Remove a worktree (useful for cleanup)
 */
export async function removeWorktree(
  repoPath: string,
  worktreePath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await execAsync(`git worktree remove "${worktreePath}" --force`, {
      cwd: repoPath,
    });
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
