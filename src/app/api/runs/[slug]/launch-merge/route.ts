import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import { WarRoomPlan, StatusJson } from "@/lib/plan-schema";

const execAsync = promisify(exec);

// Check if iTerm2 is installed
async function hasIterm(): Promise<boolean> {
  try {
    await fs.access("/Applications/iTerm.app");
    return true;
  } catch {
    return false;
  }
}

// Spawn terminal with Claude Code running /warroom-merge
async function spawnMergeTerminal(
  repoPath: string,
  runSlug: string,
  integrationBranch: string
): Promise<{ success: boolean; terminal: string; error?: string }> {
  try {
    // Build the Claude command - use /warroom-merge skill with full autonomy
    const claudeCmd = `claude --dangerously-skip-permissions -p '/warroom-merge

Run slug: ${runSlug}
Repository: ${repoPath}
Integration branch: ${integrationBranch}

Execute the merge autonomously:
1. Merge all complete lanes into the integration branch (in dependency order)
2. Merge integration branch into main
3. Push integration branch and main to GitHub
4. Update status.json and history.jsonl'`;

    const useIterm = await hasIterm();

    if (useIterm) {
      // Use iTerm2 with AppleScript
      const script = `
        tell application "iTerm"
          activate
          create window with default profile
          tell current session of current window
            write text "cd '${repoPath}' && ${claudeCmd.replace(/'/g, "'\\''")}"
          end tell
        end tell
      `;
      await execAsync(`osascript -e '${script.replace(/'/g, "'\\''")}'`);
      return { success: true, terminal: "iTerm2" };
    } else {
      // Use Terminal.app with AppleScript
      const script = `
        tell application "Terminal"
          activate
          do script "cd '${repoPath}' && ${claudeCmd.replace(/'/g, "'\\''")}"
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const runDir = path.join(
      os.homedir(),
      ".openclaw/workspace/warroom/runs",
      slug
    );

    // Read plan.json to get repo path
    let plan: WarRoomPlan;
    try {
      const planContent = await fs.readFile(
        path.join(runDir, "plan.json"),
        "utf-8"
      );
      plan = JSON.parse(planContent);
    } catch {
      return NextResponse.json(
        { error: "Could not read plan.json" },
        { status: 404 }
      );
    }

    // Read merge-proposal.json to verify it exists
    let proposal;
    try {
      const proposalContent = await fs.readFile(
        path.join(runDir, "merge-proposal.json"),
        "utf-8"
      );
      proposal = JSON.parse(proposalContent);
    } catch {
      return NextResponse.json(
        { error: "No merge proposal found. Generate one first." },
        { status: 404 }
      );
    }

    const repoPath = plan.repo?.path;
    if (!repoPath) {
      return NextResponse.json(
        { error: "No repository path in plan" },
        { status: 400 }
      );
    }

    // Spawn terminal with Claude Code running /warroom-merge
    const terminalResult = await spawnMergeTerminal(
      repoPath,
      slug,
      plan.integrationBranch
    );

    if (!terminalResult.success) {
      return NextResponse.json(
        { error: `Failed to spawn terminal: ${terminalResult.error}` },
        { status: 500 }
      );
    }

    // Update status to "merging"
    const statusPath = path.join(runDir, "status.json");
    try {
      let statusJson: StatusJson;
      try {
        const content = await fs.readFile(statusPath, "utf-8");
        statusJson = JSON.parse(content);
      } catch {
        statusJson = { runId: plan.runId, status: "merging", updatedAt: new Date().toISOString() };
      }

      statusJson.status = "merging";
      statusJson.updatedAt = new Date().toISOString();

      await fs.writeFile(statusPath, JSON.stringify(statusJson, null, 2));
    } catch (error) {
      console.error("Failed to update status:", error);
    }

    return NextResponse.json({
      success: true,
      repoPath,
      terminal: terminalResult.terminal,
      message: `Merge launched in ${terminalResult.terminal}. Claude Code is running /warroom-merge.`,
      prompt: proposal.pmPrompt, // Still return the prompt for reference
    });
  } catch (error) {
    console.error("Launch merge error:", error);
    return NextResponse.json(
      { error: "Failed to launch merge" },
      { status: 500 }
    );
  }
}
