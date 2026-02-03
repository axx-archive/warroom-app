import { exec } from "child_process";
import { promisify } from "util";
import { promises as fs } from "fs";

const execAsync = promisify(exec);

// Default Cursor path - can be configured
const CURSOR_PATH = "/usr/local/bin/cursor";

export interface CursorLaunchResult {
  success: boolean;
  path: string;
  error?: string;
}

/**
 * Check if Cursor is available at the expected path
 */
export async function isCursorAvailable(): Promise<boolean> {
  try {
    await fs.access(CURSOR_PATH, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Launch Cursor in a new window at the specified worktree path
 *
 * Uses: /usr/local/bin/cursor -n <worktreePath>
 * The -n flag opens a new window
 */
export async function launchCursor(worktreePath: string): Promise<CursorLaunchResult> {
  try {
    // First verify Cursor exists
    const available = await isCursorAvailable();
    if (!available) {
      return {
        success: false,
        path: worktreePath,
        error: `Cursor not found at ${CURSOR_PATH}. Please ensure Cursor is installed.`,
      };
    }

    // Launch Cursor in a new window
    // We use spawn-like behavior to not wait for Cursor to exit
    const command = `"${CURSOR_PATH}" -n "${worktreePath}"`;

    // Use exec with a short timeout since Cursor will keep running
    // We just need to verify the command was accepted
    await execAsync(command, {
      timeout: 10000, // 10 second timeout to start
      windowsHide: true,
    });

    return {
      success: true,
      path: worktreePath,
    };
  } catch (err) {
    // If the process was started but didn't return immediately,
    // that might be expected behavior for GUI apps
    const errorMessage = err instanceof Error ? err.message : String(err);

    // Check if it's a timeout error (which might mean Cursor is running)
    if (errorMessage.includes("TIMEOUT") || errorMessage.includes("timed out")) {
      // This is actually okay - Cursor opened and is running
      return {
        success: true,
        path: worktreePath,
      };
    }

    console.error("Error launching Cursor:", errorMessage);

    return {
      success: false,
      path: worktreePath,
      error: errorMessage,
    };
  }
}

/**
 * Launch Cursor for multiple worktree paths
 * Returns results for each path, doesn't fail if one fails
 */
export async function launchCursorMultiple(
  worktreePaths: string[]
): Promise<CursorLaunchResult[]> {
  const results: CursorLaunchResult[] = [];

  for (const path of worktreePaths) {
    const result = await launchCursor(path);
    results.push(result);

    // Small delay between launches to avoid overwhelming the system
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return results;
}
