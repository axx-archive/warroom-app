import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    if (!slug) {
      return NextResponse.json(
        { error: "Run slug is required" },
        { status: 400 }
      );
    }

    const runDir = path.join(
      os.homedir(),
      ".openclaw/workspace/warroom/runs",
      slug
    );

    // Verify the directory exists
    try {
      await fs.access(runDir);
    } catch {
      return NextResponse.json(
        { error: "Run not found" },
        { status: 404 }
      );
    }

    // Read plan to check for worktrees that need cleanup
    let plan;
    try {
      const planContent = await fs.readFile(
        path.join(runDir, "plan.json"),
        "utf-8"
      );
      plan = JSON.parse(planContent);
    } catch {
      // No plan file, just delete the directory
    }

    // Clean up worktrees if they exist
    if (plan?.lanes && plan?.repo?.path) {
      const { exec } = await import("child_process");
      const { promisify } = await import("util");
      const execAsync = promisify(exec);

      for (const lane of plan.lanes) {
        if (lane.worktreePath) {
          try {
            // Remove worktree from git
            await execAsync(`git worktree remove "${lane.worktreePath}" --force`, {
              cwd: plan.repo.path,
            });
          } catch (error) {
            // Worktree might not exist or already be removed
            console.log(`Could not remove worktree for ${lane.laneId}:`, error);
          }
        }
      }

      // Prune any stale worktrees
      try {
        await execAsync("git worktree prune", { cwd: plan.repo.path });
      } catch {
        // Non-fatal
      }
    }

    // Delete the run directory recursively
    await fs.rm(runDir, { recursive: true, force: true });

    return NextResponse.json({
      success: true,
      deleted: slug,
    });
  } catch (error) {
    console.error("Delete run error:", error);
    return NextResponse.json(
      { error: "Failed to delete run" },
      { status: 500 }
    );
  }
}
