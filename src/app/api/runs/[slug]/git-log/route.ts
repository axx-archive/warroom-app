// API route to open git log in terminal for a lane
// POST /api/runs/[slug]/git-log - opens iTerm2/Terminal.app with git log

import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { promises as fs } from "fs";

const execAsync = promisify(exec);

interface GitLogRequest {
  laneId: string;
  worktreePath: string;
  commitCount?: number;
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body: GitLogRequest = await request.json();
    const { laneId, worktreePath, commitCount = 10 } = body;

    if (!laneId || !worktreePath) {
      return NextResponse.json(
        { error: "laneId and worktreePath are required" },
        { status: 400 }
      );
    }

    // Check if worktree exists
    try {
      await fs.access(worktreePath);
    } catch {
      return NextResponse.json(
        { error: "Worktree does not exist" },
        { status: 404 }
      );
    }

    // Git log command - show recent commits with nice formatting
    const gitLogCmd = `git log --oneline --graph --decorate -n ${commitCount}`;
    const useIterm = await hasIterm();

    if (useIterm) {
      // Open iTerm2 with git log
      const appleScript = `
        tell application "iTerm"
          activate
          create window with default profile
          tell current session of current window
            write text "cd '${worktreePath.replace(/'/g, "'\\''")}' && ${gitLogCmd}"
          end tell
          tell current window
            set name to "Git Log: ${laneId} (${slug})"
          end tell
        end tell
      `;
      await execAsync(`osascript -e '${appleScript.replace(/'/g, "'\\''")}'`);
    } else {
      // Fall back to Terminal.app
      const appleScript = `
        tell application "Terminal"
          activate
          do script "cd '${worktreePath.replace(/'/g, "'\\''")}' && ${gitLogCmd}"
          set custom title of front window to "Git Log: ${laneId} (${slug})"
        end tell
      `;
      await execAsync(`osascript -e '${appleScript.replace(/'/g, "'\\''")}'`);
    }

    return NextResponse.json({
      success: true,
      laneId,
      worktreePath,
      commitCount,
      terminal: useIterm ? "iTerm" : "Terminal.app",
    });
  } catch (error) {
    console.error("Git log error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to open git log" },
      { status: 500 }
    );
  }
}
