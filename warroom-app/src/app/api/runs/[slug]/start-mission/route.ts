// API endpoint to start a mission (autonomous orchestration of all lanes)
// POST /api/runs/[slug]/start-mission

import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { startRun, getOrchestratorStatus, stopRun } from "@/lib/orchestrator";
import { StatusJson, WarRoomPlan } from "@/lib/plan-schema";
import { getFileWatcher } from "@/lib/file-watcher";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const runDir = path.join(os.homedir(), ".openclaw/workspace/warroom/runs", slug);

    // Verify run exists
    try {
      await fs.access(runDir);
    } catch {
      return NextResponse.json(
        { success: false, error: "Run not found" },
        { status: 404 }
      );
    }

    // Load plan.json
    const planPath = path.join(runDir, "plan.json");
    let plan: WarRoomPlan;
    try {
      const planContent = await fs.readFile(planPath, "utf-8");
      plan = JSON.parse(planContent);
    } catch {
      return NextResponse.json(
        { success: false, error: "Failed to load plan.json" },
        { status: 500 }
      );
    }

    // Load status.json
    const statusPath = path.join(runDir, "status.json");
    let statusJson: StatusJson;
    try {
      const statusContent = await fs.readFile(statusPath, "utf-8");
      statusJson = JSON.parse(statusContent);
    } catch {
      return NextResponse.json(
        { success: false, error: "Failed to load status.json" },
        { status: 500 }
      );
    }

    // Check if mission is already running
    const orchestratorStatus = getOrchestratorStatus();
    if (orchestratorStatus.runStatuses[slug]?.status === "running") {
      return NextResponse.json(
        { success: false, error: "Mission is already running" },
        { status: 400 }
      );
    }

    // Start the file watcher for real-time updates
    try {
      const watcher = getFileWatcher(slug);
      // Add each lane to the watcher
      for (const lane of plan.lanes) {
        watcher.addLane(lane.laneId, lane.worktreePath);
      }
      watcher.start();
    } catch (error) {
      console.error("[start-mission] Failed to start file watcher:", error);
      // Continue anyway - watcher is not critical
    }

    // Update status.json to in_progress
    statusJson.status = "in_progress";
    statusJson.updatedAt = new Date().toISOString();
    await fs.writeFile(statusPath, JSON.stringify(statusJson, null, 2));

    // Start the mission via orchestrator
    const result = await startRun(slug);

    if (!result.success) {
      // Revert status if start failed
      statusJson.status = "staged";
      statusJson.updatedAt = new Date().toISOString();
      await fs.writeFile(statusPath, JSON.stringify(statusJson, null, 2));

      return NextResponse.json(
        { success: false, error: result.error || "Failed to start mission" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Mission started",
      runSlug: slug,
    });
  } catch (error) {
    console.error("[start-mission] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check mission status
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const orchestratorStatus = getOrchestratorStatus();
    const runStatus = orchestratorStatus.runStatuses[slug];

    if (!runStatus) {
      return NextResponse.json({
        success: true,
        isRunning: false,
        status: "idle",
        lanes: {},
      });
    }

    return NextResponse.json({
      success: true,
      isRunning: runStatus.status === "running" || runStatus.status === "starting" || runStatus.status === "merging",
      status: runStatus.status,
      lanes: runStatus.lanes,
      startedAt: runStatus.startedAt,
      stoppedAt: runStatus.stoppedAt,
    });
  } catch (error) {
    console.error("[start-mission] GET Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// DELETE endpoint to stop the mission
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Stop the mission
    await stopRun(slug);

    // Stop the file watcher
    try {
      const watcher = getFileWatcher(slug);
      watcher.stop();
    } catch {
      // Ignore watcher errors
    }

    // Update status.json
    const runDir = path.join(os.homedir(), ".openclaw/workspace/warroom/runs", slug);
    const statusPath = path.join(runDir, "status.json");
    try {
      const statusContent = await fs.readFile(statusPath, "utf-8");
      const statusJson: StatusJson = JSON.parse(statusContent);
      statusJson.status = "staged"; // Revert to staged so mission can be restarted
      statusJson.updatedAt = new Date().toISOString();
      await fs.writeFile(statusPath, JSON.stringify(statusJson, null, 2));
    } catch {
      // Ignore status update errors
    }

    return NextResponse.json({
      success: true,
      message: "Mission stopped",
    });
  } catch (error) {
    console.error("[start-mission] DELETE Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
