import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

interface LaneCommitResult {
  laneId: string;
  success: boolean;
  committed: boolean;
  commitHash?: string;
  changedFiles: string[];
  error?: string;
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

    // Read the plan to get all lanes
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

    if (!plan.lanes || plan.lanes.length === 0) {
      return NextResponse.json(
        { error: "No lanes found in plan" },
        { status: 400 }
      );
    }

    const results: LaneCommitResult[] = [];

    for (const lane of plan.lanes) {
      const result: LaneCommitResult = {
        laneId: lane.laneId,
        success: false,
        committed: false,
        changedFiles: [],
      };

      if (!lane.worktreePath) {
        result.error = "No worktree path configured";
        results.push(result);
        continue;
      }

      // Check if worktree exists
      try {
        await fs.access(lane.worktreePath);
      } catch {
        result.error = "Worktree does not exist";
        results.push(result);
        continue;
      }

      // Check for uncommitted changes
      try {
        const { stdout } = await execAsync("git status --porcelain", {
          cwd: lane.worktreePath,
        });
        const changedFiles = stdout.trim().split("\n").filter(Boolean);
        result.changedFiles = changedFiles;

        if (changedFiles.length === 0) {
          result.success = true;
          result.committed = false;
          results.push(result);
          continue;
        }

        // Stage all changes
        await execAsync("git add -A", { cwd: lane.worktreePath });

        // Generate commit message
        const commitMessage = `feat: Complete ${lane.laneId} work\n\nWar Room lane work for ${slug}.\n\nFiles changed:\n${changedFiles.map((f: string) => `- ${f}`).join("\n")}`;

        // Commit
        await execAsync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, {
          cwd: lane.worktreePath,
        });

        // Get commit hash
        const { stdout: hashOut } = await execAsync("git rev-parse HEAD", {
          cwd: lane.worktreePath,
        });
        result.commitHash = hashOut.trim();
        result.success = true;
        result.committed = true;
      } catch (error) {
        if (String(error).includes("nothing to commit")) {
          result.success = true;
          result.committed = false;
        } else {
          result.error = String(error);
        }
      }

      results.push(result);
    }

    const totalCommitted = results.filter((r) => r.committed).length;
    const totalFailed = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: totalFailed === 0,
      results,
      summary: {
        total: results.length,
        committed: totalCommitted,
        noChanges: results.filter((r) => r.success && !r.committed).length,
        failed: totalFailed,
      },
    });
  } catch (error) {
    console.error("Commit all lanes error:", error);
    return NextResponse.json(
      { error: "Failed to commit lanes" },
      { status: 500 }
    );
  }
}
