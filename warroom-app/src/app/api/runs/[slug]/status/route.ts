// API route to update run status
// POST /api/runs/[slug]/status - updates status.json for a run

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { StatusJson, LaneStatus, RunStatus } from "@/lib/plan-schema";

interface UpdateStatusRequest {
  // Update lane completion status
  laneId?: string;
  laneStatus?: LaneStatus;
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
