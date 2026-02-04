import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

interface CommitLaneRequest {
  laneId: string;
  message?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body: CommitLaneRequest = await request.json();
    const { laneId, message } = body;

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

    if (!lane.worktreePath) {
      return NextResponse.json(
        { error: `Lane ${laneId} has no worktree path` },
        { status: 400 }
      );
    }

    // Check if worktree exists
    try {
      await fs.access(lane.worktreePath);
    } catch {
      return NextResponse.json(
        { error: `Worktree does not exist at ${lane.worktreePath}` },
        { status: 404 }
      );
    }

    // Check for uncommitted changes
    let hasChanges = false;
    let changedFiles: string[] = [];
    try {
      const { stdout } = await execAsync("git status --porcelain", {
        cwd: lane.worktreePath,
      });
      changedFiles = stdout.trim().split("\n").filter(Boolean);
      hasChanges = changedFiles.length > 0;
    } catch (error) {
      return NextResponse.json(
        { error: `Failed to check git status: ${error}` },
        { status: 500 }
      );
    }

    if (!hasChanges) {
      return NextResponse.json({
        success: true,
        laneId,
        message: "No changes to commit",
        committed: false,
        changedFiles: [],
      });
    }

    // Stage all changes
    try {
      await execAsync("git add -A", { cwd: lane.worktreePath });
    } catch (error) {
      return NextResponse.json(
        { error: `Failed to stage changes: ${error}` },
        { status: 500 }
      );
    }

    // Generate commit message
    const commitMessage = message || `feat: Complete ${laneId} work\n\nWar Room lane work for ${slug}.\n\nFiles changed:\n${changedFiles.map(f => `- ${f}`).join("\n")}`;

    // Commit
    try {
      await execAsync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, {
        cwd: lane.worktreePath,
      });
    } catch (error) {
      // Check if it's just "nothing to commit"
      if (String(error).includes("nothing to commit")) {
        return NextResponse.json({
          success: true,
          laneId,
          message: "No changes to commit",
          committed: false,
          changedFiles: [],
        });
      }
      return NextResponse.json(
        { error: `Failed to commit: ${error}` },
        { status: 500 }
      );
    }

    // Get the commit hash
    let commitHash = "";
    try {
      const { stdout } = await execAsync("git rev-parse HEAD", {
        cwd: lane.worktreePath,
      });
      commitHash = stdout.trim();
    } catch {
      // Non-fatal
    }

    return NextResponse.json({
      success: true,
      laneId,
      message: "Changes committed successfully",
      committed: true,
      commitHash,
      changedFiles,
    });
  } catch (error) {
    console.error("Commit lane error:", error);
    return NextResponse.json(
      { error: "Failed to commit lane work" },
      { status: 500 }
    );
  }
}
