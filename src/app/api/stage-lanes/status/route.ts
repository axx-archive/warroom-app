import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { worktreeExists } from "@/lib/worktree-manager";
import { packetExistsInWorktree } from "@/lib/packet-writer";

interface PlanLane {
  laneId: string;
  agent: string;
  branch: string;
  worktreePath: string;
}

interface Plan {
  runId: string;
  lanes: PlanLane[];
}

interface StatusFile {
  lanes: Array<{
    laneId: string;
    staged?: boolean;
    stagedAt?: string;
  }>;
}

/**
 * Read plan.json from run directory
 */
async function readPlan(runDir: string): Promise<Plan | null> {
  const planPath = path.join(runDir, "plan.json");

  try {
    const content = await fs.readFile(planPath, "utf-8");
    return JSON.parse(content) as Plan;
  } catch {
    return null;
  }
}

/**
 * Read status.json from run directory
 */
async function readStatus(runDir: string): Promise<StatusFile | null> {
  const statusPath = path.join(runDir, "status.json");

  try {
    const content = await fs.readFile(statusPath, "utf-8");
    return JSON.parse(content) as StatusFile;
  } catch {
    return null;
  }
}

/**
 * POST /api/stage-lanes/status
 *
 * Body: { runDir: string }
 *
 * Returns the staging status of all lanes
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { runDir } = body;

    if (!runDir) {
      return NextResponse.json(
        { success: false, error: "runDir is required" },
        { status: 400 }
      );
    }

    // Read the plan and status
    const [plan, status] = await Promise.all([
      readPlan(runDir),
      readStatus(runDir),
    ]);

    if (!plan) {
      return NextResponse.json(
        { success: false, error: `Could not read plan.json from ${runDir}` },
        { status: 404 }
      );
    }

    // Check actual filesystem status for each lane
    const statuses: Record<string, { staged: boolean; error?: string }> = {};

    for (const lane of plan.lanes) {
      const [hasWorktree, hasPacket] = await Promise.all([
        worktreeExists(lane.worktreePath),
        packetExistsInWorktree(lane.worktreePath),
      ]);

      // Check recorded status as well
      const recordedStatus = status?.lanes.find(
        (l) => l.laneId === lane.laneId
      );

      statuses[lane.laneId] = {
        staged: hasWorktree && hasPacket,
      };

      // Add note if there's a mismatch between recorded and actual
      if (recordedStatus?.staged && !statuses[lane.laneId].staged) {
        statuses[lane.laneId].error =
          "Recorded as staged but worktree/packet missing";
      }
    }

    return NextResponse.json({
      success: true,
      runId: plan.runId,
      statuses,
    });
  } catch (err) {
    console.error("Status check error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
