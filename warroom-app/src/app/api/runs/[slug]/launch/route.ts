import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Check if a git branch exists
async function branchExists(repoPath: string, branch: string): Promise<boolean> {
  try {
    await execAsync(`git show-ref --verify --quiet refs/heads/${branch}`, { cwd: repoPath });
    return true;
  } catch {
    return false;
  }
}

// Get the commit count for a worktree/branch
async function getCommitCount(worktreePath: string): Promise<number> {
  try {
    const { stdout } = await execAsync("git rev-list --count HEAD", { cwd: worktreePath });
    return parseInt(stdout.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

// Create worktree for a lane if it doesn't exist
async function ensureWorktree(
  repoPath: string,
  worktreePath: string,
  branch: string
): Promise<{ created: boolean; error?: string }> {
  try {
    // Check if worktree already exists
    await fs.access(worktreePath);
    return { created: false }; // Already exists
  } catch {
    // Worktree doesn't exist, create it
  }

  try {
    // Create parent directory
    await fs.mkdir(path.dirname(worktreePath), { recursive: true });

    // Create branch if it doesn't exist
    if (!(await branchExists(repoPath, branch))) {
      await execAsync(`git branch ${branch}`, { cwd: repoPath });
    }

    // Create the worktree
    await execAsync(`git worktree add "${worktreePath}" ${branch}`, { cwd: repoPath });

    return { created: true };
  } catch (error) {
    return {
      created: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

type LaunchMode = "cursor" | "terminal";

interface LaunchRequest {
  laneId: string;
  skipPermissions?: boolean;
  launchMode?: LaunchMode;
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

// Spawn iTerm2 or Terminal.app with Claude Code
async function spawnTerminal(
  worktreePath: string,
  laneId: string,
  slug: string,
  skipPermissions: boolean
): Promise<{ success: boolean; terminal: string; error?: string }> {
  try {
    const claudeCmd = skipPermissions
      ? "claude --dangerously-skip-permissions"
      : "claude";

    const useIterm = await hasIterm();

    if (useIterm) {
      // Open iTerm2 with Claude Code
      const appleScript = `
        tell application "iTerm"
          activate
          create window with default profile
          tell current session of current window
            write text "cd '${worktreePath.replace(/'/g, "'\\''")}' && ${claudeCmd}"
          end tell
          tell current window
            set name to "Lane: ${laneId} (${slug})"
          end tell
        end tell
      `;
      await execAsync(`osascript -e '${appleScript.replace(/'/g, "'\\''")}'`);
      return { success: true, terminal: "iTerm" };
    } else {
      // Fall back to Terminal.app
      const appleScript = `
        tell application "Terminal"
          activate
          do script "cd '${worktreePath.replace(/'/g, "'\\''")}' && ${claudeCmd}"
          set custom title of front window to "Lane: ${laneId} (${slug})"
        end tell
      `;
      await execAsync(`osascript -e '${appleScript.replace(/'/g, "'\\''")}'`);
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

// Common output file patterns to look for in completed lane worktrees
const OUTPUT_PATTERNS = [
  "REVIEW.md",
  "FINDINGS.md",
  "OUTPUT.md",
  "REPORT.md",
  "ANALYSIS.md",
  "RECOMMENDATIONS.md",
  "warroom-output.md",
  "lane-output.md",
];

// Find outputs from a completed lane's worktree
async function findLaneOutputs(
  worktreePath: string,
  laneId: string
): Promise<{ laneId: string; files: { name: string; path: string }[] }> {
  const outputs: { name: string; path: string }[] = [];

  for (const pattern of OUTPUT_PATTERNS) {
    const filePath = path.join(worktreePath, pattern);
    try {
      await fs.access(filePath);
      outputs.push({ name: pattern, path: filePath });
    } catch {
      // File doesn't exist, skip
    }
  }

  return { laneId, files: outputs };
}

// Build prerequisites section for packet
function buildPrerequisitesSection(
  dependencyOutputs: { laneId: string; files: { name: string; path: string }[] }[]
): string {
  const depsWithOutputs = dependencyOutputs.filter((d) => d.files.length > 0);

  if (depsWithOutputs.length === 0) {
    return "";
  }

  let section = `## Prerequisites from Completed Lanes

**IMPORTANT:** Review the outputs from your dependency lanes before proceeding.

`;

  for (const dep of depsWithOutputs) {
    section += `### From ${dep.laneId}:\n`;
    for (const file of dep.files) {
      section += `- \`${file.path}\`\n`;
    }
    section += `\nRead ${dep.files.length === 1 ? "this file" : "these files"} to understand findings, recommendations, or constraints that may affect your work.\n\n`;
  }

  section += "---\n\n";
  return section;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body: LaunchRequest = await request.json();
    const { laneId, skipPermissions, launchMode = "cursor" } = body;

    if (!laneId) {
      return NextResponse.json(
        { error: "laneId is required" },
        { status: 400 }
      );
    }

    const runDir = path.join(
      os.homedir(),
      ".openclaw/workspace/warroom/runs",
      slug
    );

    // Read the plan to get lane info
    let plan;
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

    // Find the lane
    const lane = plan.lanes?.find((l: { laneId: string }) => l.laneId === laneId);
    if (!lane) {
      return NextResponse.json(
        { error: `Lane ${laneId} not found` },
        { status: 404 }
      );
    }

    // Read the packet content
    let packetContent = "";
    const packetPath = path.join(runDir, "packets", `${laneId}.md`);
    try {
      packetContent = await fs.readFile(packetPath, "utf-8");
    } catch {
      // No packet file, return empty
      packetContent = `# No packet found for ${laneId}\n\nCheck ${packetPath}`;
    }

    // Check for outputs from dependency lanes
    const dependencyOutputs: { laneId: string; files: { name: string; path: string }[] }[] = [];

    if (lane.dependsOn && lane.dependsOn.length > 0) {
      // Find other lanes that this lane depends on
      for (const depLaneId of lane.dependsOn) {
        const depLane = plan.lanes?.find((l: { laneId: string }) => l.laneId === depLaneId);
        if (depLane?.worktreePath) {
          try {
            await fs.access(depLane.worktreePath);
            const outputs = await findLaneOutputs(depLane.worktreePath, depLaneId);
            dependencyOutputs.push(outputs);
          } catch {
            // Worktree doesn't exist, skip
          }
        }
      }
    }

    // Build prerequisites section from dependency outputs
    const prerequisitesSection = buildPrerequisitesSection(dependencyOutputs);

    // Prepend skip permissions instruction if enabled
    let headerContent = "";

    if (skipPermissions) {
      headerContent += `> **AUTONOMY MODE ENABLED**
> Run with \`--dangerously-skip-permissions\` flag.
> You have full autonomy to execute without asking for permission.
> Complete all tasks end-to-end without stopping for confirmation.

---

`;
    }

    // Add prerequisites section if there are dependency outputs
    if (prerequisitesSection) {
      headerContent += prerequisitesSection;
    }

    packetContent = headerContent + packetContent;

    // Ensure worktree exists (create if needed)
    let openPath = lane.worktreePath;
    let worktreeCreated = false;

    if (lane.worktreePath && plan.repo?.path) {
      const worktreeResult = await ensureWorktree(
        plan.repo.path,
        lane.worktreePath,
        lane.branch
      );

      if (worktreeResult.error) {
        console.error("Failed to create worktree:", worktreeResult.error);
        // Fall back to repo path
        openPath = plan.repo.path;
      } else {
        worktreeCreated = worktreeResult.created;
        openPath = lane.worktreePath;

        // If we just created the worktree, write the packet file there too
        if (worktreeCreated) {
          const packetDestPath = path.join(lane.worktreePath, "WARROOM_PACKET.md");
          try {
            await fs.writeFile(packetDestPath, packetContent, "utf-8");
          } catch (writeError) {
            console.error("Failed to write packet to worktree:", writeError);
          }
        }
      }
    } else {
      openPath = plan.repo?.path;
    }

    if (!openPath) {
      return NextResponse.json(
        { error: "No valid path to open" },
        { status: 400 }
      );
    }

    // Always write the packet file to worktree before launching (for Terminal mode to read)
    const packetDestPath = path.join(openPath, "WARROOM_PACKET.md");
    try {
      await fs.writeFile(packetDestPath, packetContent, "utf-8");
    } catch (writeError) {
      console.error("Failed to write packet to worktree:", writeError);
    }

    // Launch based on mode
    let terminalResult: { success: boolean; terminal: string; error?: string } | undefined;

    if (launchMode === "terminal") {
      // Terminal mode: spawn iTerm2/Terminal.app with Claude Code
      terminalResult = await spawnTerminal(
        openPath,
        laneId,
        slug,
        skipPermissions ?? false
      );
      if (!terminalResult.success) {
        console.error("Failed to spawn terminal:", terminalResult.error);
      }
    } else {
      // Cursor mode: open Cursor with -n flag for new window
      try {
        await execAsync(`cursor -n "${openPath}"`);
      } catch (error) {
        console.error("Failed to open Cursor:", error);
        // Don't fail the request - maybe Cursor isn't installed
        // Return success anyway so clipboard copy still works
      }
    }

    // Update status.json to mark lane as staged and update run status
    const statusPath = path.join(runDir, "status.json");
    try {
      let statusJson: Record<string, unknown> = {};
      try {
        const content = await fs.readFile(statusPath, "utf-8");
        statusJson = JSON.parse(content);
      } catch {
        // No existing status, create new
        statusJson = {
          runId: plan.runId,
          status: "ready_to_stage",
          lanesCompleted: [],
        };
      }

      // Ensure lanes object exists
      if (!statusJson.lanes) {
        statusJson.lanes = {};
      }

      // Mark this lane as staged
      const lanesObj = statusJson.lanes as Record<string, Record<string, unknown>>;
      if (!lanesObj[laneId]) {
        lanesObj[laneId] = {};
      }
      lanesObj[laneId].staged = true;
      if (!lanesObj[laneId].status || lanesObj[laneId].status === "pending") {
        lanesObj[laneId].status = "in_progress";
      }

      // Track commits at launch (only if not already set)
      if (openPath && lanesObj[laneId].commitsAtLaunch === undefined) {
        const commitCount = await getCommitCount(openPath);
        lanesObj[laneId].commitsAtLaunch = commitCount;
      }

      // Update overall run status to "staged" if it was "ready_to_stage"
      if (statusJson.status === "ready_to_stage" || statusJson.status === "draft") {
        statusJson.status = "staged";
      }

      statusJson.updatedAt = new Date().toISOString();

      await fs.writeFile(statusPath, JSON.stringify(statusJson, null, 2));
    } catch (error) {
      console.error("Failed to update status.json:", error);
      // Non-fatal - continue
    }

    return NextResponse.json({
      success: true,
      laneId,
      openedPath: openPath,
      worktreeCreated,
      packetContent,
      statusUpdated: true,
      launchMode,
      terminal: terminalResult?.terminal,
    });
  } catch (error) {
    console.error("Launch error:", error);
    return NextResponse.json(
      { error: "Failed to launch lane" },
      { status: 500 }
    );
  }
}
