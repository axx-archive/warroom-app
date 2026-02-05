import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

const execAsync = promisify(exec);

interface InitializeRequest {
  goal: string;
  repoPath: string;
  maxLanes?: number;
  autonomy?: boolean;
}

// Check if iTerm2 is installed
async function hasIterm(): Promise<boolean> {
  try {
    await fs.access("/Applications/iTerm.app");
    return true;
  } catch {
    return false;
  }
}

// Spawn terminal with Claude Code running /warroom-plan
async function spawnPlanningTerminal(
  repoPath: string,
  goal: string,
  maxLanes: number | undefined,
  autonomy: boolean
): Promise<{ success: boolean; terminal: string; error?: string }> {
  try {
    // Create a context file that /warroom-plan can read
    const contextDir = path.join(os.homedir(), ".openclaw/workspace/warroom");
    await fs.mkdir(contextDir, { recursive: true });

    const contextFile = path.join(contextDir, "pending-mission.json");
    await fs.writeFile(contextFile, JSON.stringify({
      goal,
      repoPath,
      maxLanes,
      autonomy,
      createdAt: new Date().toISOString(),
    }, null, 2));

    // Build a simple single-line prompt to avoid AppleScript escaping issues
    // Replace newlines and quotes in the goal to make it safe
    const safeGoal = goal.replace(/[\n\r]+/g, ' ').replace(/"/g, "'");
    const maxLanesStr = maxLanes ? `, Max lanes: ${maxLanes}` : "";
    const autonomyStr = autonomy ? " Execute autonomously: generate plan, create run, stage and launch all lanes." : "";

    const prompt = `/warroom-plan - Repository: ${repoPath}, Goal: ${safeGoal}${maxLanesStr}.${autonomyStr}`;
    const escapedPrompt = prompt.replace(/"/g, '\\"');

    const claudeCmd = autonomy
      ? `claude --dangerously-skip-permissions -p "${escapedPrompt}"`
      : `claude -p "${escapedPrompt}"`;

    const useIterm = await hasIterm();

    if (useIterm) {
      // Use iTerm2 with AppleScript - use double quotes in AppleScript
      const shellCmd = `cd "${repoPath}" && ${claudeCmd}`;
      const script = `
        tell application "iTerm"
          activate
          create window with default profile
          tell current session of current window
            write text "${shellCmd.replace(/"/g, '\\"')}"
          end tell
        end tell
      `;
      await execAsync(`osascript -e '${script.replace(/'/g, "'\\''")}'`);
      return { success: true, terminal: "iTerm2" };
    } else {
      // Use Terminal.app with AppleScript
      const shellCmd = `cd "${repoPath}" && ${claudeCmd}`;
      const script = `
        tell application "Terminal"
          activate
          do script "${shellCmd.replace(/"/g, '\\"')}"
        end tell
      `;
      await execAsync(`osascript -e '${script.replace(/'/g, "'\\''")}'`);
      return { success: true, terminal: "Terminal.app" };
    }
  } catch (error) {
    return {
      success: false,
      terminal: "unknown",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: InitializeRequest = await request.json();
    const { goal, repoPath, maxLanes, autonomy = false } = body;

    if (!goal?.trim() || !repoPath?.trim()) {
      return NextResponse.json(
        { error: "Goal and repository path are required" },
        { status: 400 }
      );
    }

    // Verify repo path exists
    try {
      await fs.access(repoPath);
    } catch {
      return NextResponse.json(
        { error: `Repository path not found: ${repoPath}` },
        { status: 400 }
      );
    }

    // Spawn terminal with Claude Code running /warroom-plan
    const terminalResult = await spawnPlanningTerminal(
      repoPath,
      goal.trim(),
      maxLanes,
      autonomy
    );

    if (!terminalResult.success) {
      return NextResponse.json(
        { error: `Failed to spawn terminal: ${terminalResult.error}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      repoPath,
      terminal: terminalResult.terminal,
      message: `Mission initialized in ${terminalResult.terminal}. Claude Code is running /warroom-plan.`,
    });
  } catch (error) {
    console.error("Initialize mission error:", error);
    return NextResponse.json(
      { error: "Failed to initialize mission" },
      { status: 500 }
    );
  }
}
