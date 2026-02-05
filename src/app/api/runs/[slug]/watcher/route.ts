// API route to control file watcher for a run
// GET /api/runs/[slug]/watcher - get watcher status
// POST /api/runs/[slug]/watcher - start/stop watcher

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { WarRoomPlan } from "@/lib/plan-schema";
import {
  getFileWatcher,
  removeFileWatcher,
} from "@/lib/file-watcher";
import { initializeWebSocketServer } from "@/lib/websocket";

// Initialize WebSocket server on module load
initializeWebSocketServer();

// GET handler for watcher status
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const watcher = getFileWatcher(slug);
    const status = watcher.getStatus();

    return NextResponse.json({
      success: true,
      runSlug: slug,
      ...status,
    });
  } catch (error) {
    console.error("Error getting watcher status:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get watcher status",
      },
      { status: 500 }
    );
  }
}

interface WatcherControlRequest {
  action: "start" | "stop";
}

// POST handler for watcher control
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body: WatcherControlRequest = await request.json();

    const runDir = path.join(
      os.homedir(),
      ".openclaw/workspace/warroom/runs",
      slug
    );
    const planPath = path.join(runDir, "plan.json");

    // Check if run directory exists
    try {
      await fs.access(runDir);
    } catch {
      return NextResponse.json(
        { success: false, error: "Run not found" },
        { status: 404 }
      );
    }

    if (body.action === "start") {
      // Read plan to get lane worktree paths
      let plan: WarRoomPlan;
      try {
        const content = await fs.readFile(planPath, "utf-8");
        plan = JSON.parse(content);
      } catch {
        return NextResponse.json(
          { success: false, error: "Plan not found" },
          { status: 404 }
        );
      }

      // Get or create watcher
      const watcher = getFileWatcher(slug);

      // Add all lanes from the plan
      for (const lane of plan.lanes) {
        watcher.addLane(lane.laneId, lane.worktreePath);
      }

      // Start watching
      watcher.start();

      const status = watcher.getStatus();
      console.log(`[Watcher API] Started watcher for run ${slug}`);

      return NextResponse.json({
        success: true,
        runSlug: slug,
        message: "Watcher started",
        ...status,
      });
    } else if (body.action === "stop") {
      // Stop and remove watcher
      removeFileWatcher(slug);
      console.log(`[Watcher API] Stopped watcher for run ${slug}`);

      return NextResponse.json({
        success: true,
        runSlug: slug,
        message: "Watcher stopped",
        running: false,
        lanes: [],
      });
    } else {
      return NextResponse.json(
        { success: false, error: "Invalid action. Use 'start' or 'stop'" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error controlling watcher:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to control watcher",
      },
      { status: 500 }
    );
  }
}
