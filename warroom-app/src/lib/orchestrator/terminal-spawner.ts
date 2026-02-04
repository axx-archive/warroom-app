// Terminal Spawner - Spawns iTerm2 or Terminal.app windows with Claude Code
// Returns process handles for monitoring via the orchestrator

import { exec } from "child_process";
import { promisify } from "util";
import { promises as fs } from "fs";

const execAsync = promisify(exec);

// Result of spawning a terminal
export interface SpawnTerminalResult {
  success: boolean;
  terminal: "iTerm" | "Terminal.app" | "unknown";
  pid?: number;
  windowId?: string;
  error?: string;
}

// Options for terminal spawning
export interface SpawnTerminalOptions {
  worktreePath: string;
  laneId: string;
  runSlug: string;
  skipPermissions?: boolean;
  customCommand?: string;
}

// Check if iTerm2 is installed
export async function hasIterm(): Promise<boolean> {
  try {
    await fs.access("/Applications/iTerm.app");
    return true;
  } catch {
    return false;
  }
}

// Escape single quotes for AppleScript
function escapeForAppleScript(str: string): string {
  return str.replace(/'/g, "'\\''");
}

// Escape double quotes for AppleScript
function escapeDoubleQuotes(str: string): string {
  return str.replace(/"/g, '\\"');
}

// Get the Claude Code command to run
function getClaudeCommand(skipPermissions: boolean, customCommand?: string): string {
  if (customCommand) {
    return customCommand;
  }
  return skipPermissions ? "claude --dangerously-skip-permissions" : "claude";
}

// Build iTerm2 AppleScript
function buildItermAppleScript(
  worktreePath: string,
  laneId: string,
  runSlug: string,
  claudeCmd: string
): string {
  const escapedPath = escapeForAppleScript(worktreePath);
  const windowTitle = `Lane: ${laneId} (${runSlug})`;

  return `
tell application "iTerm"
  activate
  create window with default profile
  tell current session of current window
    write text "cd '${escapedPath}' && ${claudeCmd}"
  end tell
  tell current window
    set name to "${escapeDoubleQuotes(windowTitle)}"
  end tell
  -- Return the window ID for tracking
  return id of current window
end tell
`.trim();
}

// Build Terminal.app AppleScript
function buildTerminalAppleScript(
  worktreePath: string,
  laneId: string,
  runSlug: string,
  claudeCmd: string
): string {
  const escapedPath = escapeForAppleScript(worktreePath);
  const windowTitle = `Lane: ${laneId} (${runSlug})`;

  return `
tell application "Terminal"
  activate
  do script "cd '${escapedPath}' && ${claudeCmd}"
  set custom title of front window to "${escapeDoubleQuotes(windowTitle)}"
  -- Return the window ID for tracking
  return id of front window
end tell
`.trim();
}

/**
 * Spawn an iTerm2 or Terminal.app window with Claude Code running.
 * Prefers iTerm2 if installed, falls back to Terminal.app.
 *
 * @param options - Configuration for the terminal spawn
 * @returns Result including success status, terminal type, and window ID
 */
export async function spawnTerminal(
  options: SpawnTerminalOptions
): Promise<SpawnTerminalResult> {
  const {
    worktreePath,
    laneId,
    runSlug,
    skipPermissions = false,
    customCommand,
  } = options;

  try {
    // Validate worktree path exists
    try {
      await fs.access(worktreePath);
    } catch {
      return {
        success: false,
        terminal: "unknown",
        error: `Worktree path does not exist: ${worktreePath}`,
      };
    }

    const claudeCmd = getClaudeCommand(skipPermissions, customCommand);
    const useIterm = await hasIterm();

    if (useIterm) {
      // Spawn iTerm2 window
      const appleScript = buildItermAppleScript(worktreePath, laneId, runSlug, claudeCmd);

      // Execute AppleScript and capture the window ID
      const { stdout } = await execAsync(`osascript -e '${escapeForAppleScript(appleScript)}'`);
      const windowId = stdout.trim();

      console.log(`[TerminalSpawner] Spawned iTerm window for ${laneId}, window ID: ${windowId}`);

      return {
        success: true,
        terminal: "iTerm",
        windowId,
      };
    } else {
      // Fall back to Terminal.app
      const appleScript = buildTerminalAppleScript(worktreePath, laneId, runSlug, claudeCmd);

      // Execute AppleScript and capture the window ID
      const { stdout } = await execAsync(`osascript -e '${escapeForAppleScript(appleScript)}'`);
      const windowId = stdout.trim();

      console.log(`[TerminalSpawner] Spawned Terminal.app window for ${laneId}, window ID: ${windowId}`);

      return {
        success: true,
        terminal: "Terminal.app",
        windowId,
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[TerminalSpawner] Failed to spawn terminal for ${laneId}:`, errorMessage);

    return {
      success: false,
      terminal: "unknown",
      error: errorMessage,
    };
  }
}

/**
 * Close an iTerm2 or Terminal.app window by ID.
 *
 * @param terminal - The terminal type ("iTerm" or "Terminal.app")
 * @param windowId - The window ID to close
 * @returns Success status
 */
export async function closeTerminalWindow(
  terminal: "iTerm" | "Terminal.app",
  windowId: string
): Promise<boolean> {
  try {
    if (terminal === "iTerm") {
      const appleScript = `
tell application "iTerm"
  close window id ${windowId}
end tell
`.trim();
      await execAsync(`osascript -e '${escapeForAppleScript(appleScript)}'`);
    } else {
      const appleScript = `
tell application "Terminal"
  close window id ${windowId}
end tell
`.trim();
      await execAsync(`osascript -e '${escapeForAppleScript(appleScript)}'`);
    }
    return true;
  } catch (error) {
    console.error(`[TerminalSpawner] Failed to close window ${windowId}:`, error);
    return false;
  }
}

/**
 * Check if a terminal window is still open.
 *
 * @param terminal - The terminal type ("iTerm" or "Terminal.app")
 * @param windowId - The window ID to check
 * @returns Whether the window is still open
 */
export async function isTerminalWindowOpen(
  terminal: "iTerm" | "Terminal.app",
  windowId: string
): Promise<boolean> {
  try {
    if (terminal === "iTerm") {
      const appleScript = `
tell application "iTerm"
  set windowIds to id of every window
  return ${windowId} is in windowIds
end tell
`.trim();
      const { stdout } = await execAsync(`osascript -e '${escapeForAppleScript(appleScript)}'`);
      return stdout.trim() === "true";
    } else {
      const appleScript = `
tell application "Terminal"
  set windowIds to id of every window
  return ${windowId} is in windowIds
end tell
`.trim();
      const { stdout } = await execAsync(`osascript -e '${escapeForAppleScript(appleScript)}'`);
      return stdout.trim() === "true";
    }
  } catch {
    // If we can't check, assume it's closed
    return false;
  }
}

/**
 * Get running terminal sessions for a specific run.
 * Searches for windows with titles matching our naming convention.
 *
 * @param runSlug - The run slug to search for
 * @returns Array of lane IDs that have open terminal windows
 */
export async function getOpenTerminalSessions(
  runSlug: string
): Promise<{ laneId: string; terminal: "iTerm" | "Terminal.app"; windowId: string }[]> {
  const sessions: { laneId: string; terminal: "iTerm" | "Terminal.app"; windowId: string }[] = [];

  try {
    // Check iTerm2 first
    if (await hasIterm()) {
      const appleScript = `
tell application "iTerm"
  set result to {}
  repeat with w in windows
    set windowName to name of w
    if windowName contains "(${runSlug})" then
      set end of result to {id of w, windowName}
    end if
  end repeat
  return result
end tell
`.trim();

      try {
        const { stdout } = await execAsync(`osascript -e '${escapeForAppleScript(appleScript)}'`);
        // Parse the result - format is like: {{123, "Lane: lane-1 (run-slug)"}, ...}
        const matches = stdout.matchAll(/\{(\d+),\s*"Lane:\s*([^"]+)\s*\(/g);
        for (const match of matches) {
          sessions.push({
            windowId: match[1],
            laneId: match[2].trim(),
            terminal: "iTerm",
          });
        }
      } catch {
        // iTerm might not be running
      }
    }

    // Check Terminal.app
    const termAppleScript = `
tell application "Terminal"
  set result to {}
  repeat with w in windows
    set windowName to custom title of w
    if windowName contains "(${runSlug})" then
      set end of result to {id of w, windowName}
    end if
  end repeat
  return result
end tell
`.trim();

    try {
      const { stdout } = await execAsync(`osascript -e '${escapeForAppleScript(termAppleScript)}'`);
      // Parse the result
      const matches = stdout.matchAll(/\{(\d+),\s*"Lane:\s*([^"]+)\s*\(/g);
      for (const match of matches) {
        sessions.push({
          windowId: match[1],
          laneId: match[2].trim(),
          terminal: "Terminal.app",
        });
      }
    } catch {
      // Terminal.app might not be running
    }
  } catch (error) {
    console.error("[TerminalSpawner] Error getting open sessions:", error);
  }

  return sessions;
}

/**
 * Send a command to a terminal window via AppleScript.
 * Useful for interacting with running Claude Code sessions.
 *
 * @param terminal - The terminal type
 * @param windowId - The window ID
 * @param text - The text to send (will be typed into the terminal)
 * @returns Success status
 */
export async function sendToTerminal(
  terminal: "iTerm" | "Terminal.app",
  windowId: string,
  text: string
): Promise<boolean> {
  try {
    const escapedText = escapeForAppleScript(text);

    if (terminal === "iTerm") {
      const appleScript = `
tell application "iTerm"
  tell window id ${windowId}
    tell current session
      write text "${escapedText}"
    end tell
  end tell
end tell
`.trim();
      await execAsync(`osascript -e '${escapeForAppleScript(appleScript)}'`);
    } else {
      // For Terminal.app, we need to use keystroke simulation
      const appleScript = `
tell application "Terminal"
  set frontmost of window id ${windowId} to true
end tell
tell application "System Events"
  keystroke "${escapedText}"
  keystroke return
end tell
`.trim();
      await execAsync(`osascript -e '${escapeForAppleScript(appleScript)}'`);
    }
    return true;
  } catch (error) {
    console.error(`[TerminalSpawner] Failed to send to terminal ${windowId}:`, error);
    return false;
  }
}
