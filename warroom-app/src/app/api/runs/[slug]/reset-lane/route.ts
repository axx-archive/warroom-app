// API route to reset a lane to its initial state
// POST /api/runs/[slug]/reset-lane - resets worktree and clears status

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import { StatusJson } from "@/lib/plan-schema";
import { emitLaneStatusChange } from "@/lib/websocket";

const execAsync = promisify(exec);

interface ResetLaneRequest {
  laneId: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body: ResetLaneRequest = await request.json();
    const { laneId } = body;

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

    // Reset the worktree: git checkout . && git clean -fd
    try {
      // Discard all modifications to tracked files
      await execAsync("git checkout .", { cwd: lane.worktreePath });
      // Remove all untracked files and directories
      await execAsync("git clean -fd", { cwd: lane.worktreePath });
    } catch (error) {
      return NextResponse.json(
        { error: `Failed to reset worktree: ${error}` },
        { status: 500 }
      );
    }

    // Remove LANE_STATUS.json if it exists
    const laneStatusPath = path.join(lane.worktreePath, "LANE_STATUS.json");
    try {
      await fs.unlink(laneStatusPath);
    } catch {
      // File doesn't exist, that's fine
    }

    // Update status.json to reset the lane status to 'pending'
    const statusPath = path.join(runDir, "status.json");
    let currentStatus: StatusJson;

    try {
      const content = await fs.readFile(statusPath, "utf-8");
      currentStatus = JSON.parse(content);
    } catch {
      currentStatus = {
        runId: slug,
        status: "staged",
        lanesCompleted: [],
        updatedAt: new Date().toISOString(),
      };
    }

    // Get previous status for WebSocket event
    const previousStatus = currentStatus.lanes?.[laneId]?.status ?? "pending";

    // Reset lane status in the lanes object
    if (!currentStatus.lanes) {
      currentStatus.lanes = {};
    }

    // Preserve autonomy and launchMode settings, but reset everything else
    const existingLane = currentStatus.lanes[laneId];
    currentStatus.lanes[laneId] = {
      staged: existingLane?.staged ?? true,
      status: "pending",
      autonomy: existingLane?.autonomy,
      launchMode: existingLane?.launchMode,
      // Clear these fields:
      // - commitsAtLaunch
      // - suggestionDismissed
      // - lastActivityAt
      // - completionDetection
      // - retryState
      // - pushState
    };

    // Remove from lanesCompleted array
    if (currentStatus.lanesCompleted) {
      currentStatus.lanesCompleted = currentStatus.lanesCompleted.filter(
        (id) => id !== laneId
      );
    }

    // Update timestamp
    currentStatus.updatedAt = new Date().toISOString();

    // Write updated status
    await fs.writeFile(statusPath, JSON.stringify(currentStatus, null, 2));

    // Emit WebSocket event for status change
    if (previousStatus !== "pending") {
      emitLaneStatusChange({
        runSlug: slug,
        laneId,
        previousStatus,
        newStatus: "pending",
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      laneId,
      message: "Lane reset successfully",
      previousStatus,
      newStatus: "pending",
    });
  } catch (error) {
    console.error("Reset lane error:", error);
    return NextResponse.json(
      { error: "Failed to reset lane" },
      { status: 500 }
    );
  }
}
