// API route to get and update run status
// GET /api/runs/[slug]/status - returns status.json for polling
// POST /api/runs/[slug]/status - updates status.json for a run

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { StatusJson, LaneStatus, RunStatus, LaneAutonomy } from "@/lib/plan-schema";

// GET handler for polling status
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const runDir = path.join(
      os.homedir(),
      ".openclaw/workspace/warroom/runs",
      slug
    );
    const statusPath = path.join(runDir, "status.json");

    // Check if run directory exists
    try {
      await fs.access(runDir);
    } catch {
      return NextResponse.json(
        { success: false, error: "Run not found" },
        { status: 404 }
      );
    }

    // Read current status or return default
    let currentStatus: StatusJson;
    try {
      const content = await fs.readFile(statusPath, "utf-8");
      currentStatus = JSON.parse(content);
    } catch {
      // No status.json exists, return a default
      currentStatus = {
        runId: slug,
        status: "draft",
        lanesCompleted: [],
        updatedAt: new Date().toISOString(),
      };
    }

    return NextResponse.json({
      success: true,
      status: currentStatus,
    });
  } catch (error) {
    console.error("Error reading status:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to read status",
      },
      { status: 500 }
    );
  }
}

interface UpdateStatusRequest {
  // Update lane completion status
  laneId?: string;
  laneStatus?: LaneStatus;
  // Update lane autonomy settings
  autonomy?: LaneAutonomy;
  // Update overall run status
  status?: RunStatus;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body: UpdateStatusRequest = await request.json();

    const runDir = path.join(
      os.homedir(),
      ".openclaw/workspace/warroom/runs",
      slug
    );
    const statusPath = path.join(runDir, "status.json");

    // Check if run directory exists
    try {
      await fs.access(runDir);
    } catch {
      return NextResponse.json(
        { success: false, error: "Run not found" },
        { status: 404 }
      );
    }

    // Read current status or create default
    let currentStatus: StatusJson;
    try {
      const content = await fs.readFile(statusPath, "utf-8");
      currentStatus = JSON.parse(content);
    } catch {
      // No status.json exists, create a default
      currentStatus = {
        runId: slug,
        status: "draft",
        lanesCompleted: [],
        updatedAt: new Date().toISOString(),
      };
    }

    // Apply updates
    if (body.status) {
      currentStatus.status = body.status;
    }

    if (body.laneId && body.laneStatus) {
      // Update lane status - support both formats
      // Format 1: lanes object (preferred for detailed status)
      if (!currentStatus.lanes) {
        currentStatus.lanes = {};
      }

      const isComplete = body.laneStatus === "complete";
      currentStatus.lanes[body.laneId] = {
        staged: currentStatus.lanes[body.laneId]?.staged ?? false,
        status: body.laneStatus,
        autonomy: currentStatus.lanes[body.laneId]?.autonomy,
      };

      // Format 2: Also update lanesCompleted array for backwards compatibility
      if (!currentStatus.lanesCompleted) {
        currentStatus.lanesCompleted = [];
      }

      if (isComplete && !currentStatus.lanesCompleted.includes(body.laneId)) {
        currentStatus.lanesCompleted.push(body.laneId);
      } else if (!isComplete) {
        currentStatus.lanesCompleted = currentStatus.lanesCompleted.filter(
          (id) => id !== body.laneId
        );
      }
    }

    // Update lane autonomy settings
    if (body.laneId && body.autonomy !== undefined) {
      if (!currentStatus.lanes) {
        currentStatus.lanes = {};
      }

      // Preserve existing lane status if it exists
      const existingLane = currentStatus.lanes[body.laneId];
      currentStatus.lanes[body.laneId] = {
        staged: existingLane?.staged ?? false,
        status: existingLane?.status ?? "pending",
        autonomy: body.autonomy,
      };
    }

    // Update timestamp
    currentStatus.updatedAt = new Date().toISOString();

    // Write updated status
    await fs.writeFile(statusPath, JSON.stringify(currentStatus, null, 2));

    return NextResponse.json({
      success: true,
      status: currentStatus,
    });
  } catch (error) {
    console.error("Error updating status:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update status",
      },
      { status: 500 }
    );
  }
}
