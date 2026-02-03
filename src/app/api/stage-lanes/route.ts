import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { createWorktree, worktreeExists } from "@/lib/worktree-manager";
import { launchCursor } from "@/lib/cursor-launcher";
import { transferPacket } from "@/lib/packet-writer";

interface PlanLane {
  laneId: string;
  agent: string;
  branch: string;
  worktreePath: string;
  packetName?: string;
  dependsOn?: string[];
}

interface Plan {
  runId: string;
  runSlug?: string;
  runDir?: string;
  repo: {
    name: string;
    path: string;
  };
  lanes: PlanLane[];
}

interface LaneStagingResult {
  laneId: string;
  worktreeCreated: boolean;
  worktreePath: string;
  packetWritten: boolean;
  cursorLaunched: boolean;
  error?: string;
}

interface StatusFile {
  runId: string;
  status: string;
  updatedAt: string;
  lanes: Array<{
    laneId: string;
    status: string;
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
  } catch (err) {
    console.error("Error reading plan:", err);
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
 * Write status.json to run directory
 */
async function writeStatus(runDir: string, status: StatusFile): Promise<void> {
  const statusPath = path.join(runDir, "status.json");
  status.updatedAt = new Date().toISOString();
  await fs.writeFile(statusPath, JSON.stringify(status, null, 2));
}

/**
 * Update lane status after staging
 */
async function updateLaneStatus(
  runDir: string,
  laneId: string,
  staged: boolean
): Promise<void> {
  const status = await readStatus(runDir);
  if (!status) return;

  const laneIndex = status.lanes.findIndex((l) => l.laneId === laneId);
  if (laneIndex >= 0) {
    status.lanes[laneIndex].staged = staged;
    status.lanes[laneIndex].stagedAt = new Date().toISOString();
  }

  // If all lanes are staged, update run status
  const allStaged = status.lanes.every((l) => l.staged);
  if (allStaged) {
    status.status = "staged";
  }

  await writeStatus(runDir, status);
}

/**
 * POST /api/stage-lanes
 *
 * Body: { runDir: string, repoPath?: string }
 *
 * Creates worktrees, writes packets, and launches Cursor for all lanes in a plan
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { runDir, repoPath: requestedRepoPath } = body;

    if (!runDir) {
      return NextResponse.json(
        { success: false, error: "runDir is required" },
        { status: 400 }
      );
    }

    // Read the plan
    const plan = await readPlan(runDir);
    if (!plan) {
      return NextResponse.json(
        { success: false, error: `Could not read plan.json from ${runDir}` },
        { status: 404 }
      );
    }

    // Use repo path from request or from plan
    const repoPath = requestedRepoPath || plan.repo.path;

    const results: LaneStagingResult[] = [];

    // Process each lane
    for (const lane of plan.lanes) {
      const result: LaneStagingResult = {
        laneId: lane.laneId,
        worktreeCreated: false,
        worktreePath: lane.worktreePath,
        packetWritten: false,
        cursorLaunched: false,
      };

      // 1. Create worktree
      const worktreeResult = await createWorktree(
        repoPath,
        lane.worktreePath,
        lane.branch
      );

      if (worktreeResult.success) {
        result.worktreeCreated = true;

        // 2. Write packet
        const packetResult = await transferPacket(
          runDir,
          lane.laneId,
          lane.worktreePath
        );

        if (packetResult.success) {
          result.packetWritten = true;
        } else {
          result.error = packetResult.error;
        }

        // 3. Launch Cursor
        const cursorResult = await launchCursor(lane.worktreePath);

        if (cursorResult.success) {
          result.cursorLaunched = true;
        } else {
          // Log cursor error but don't fail the whole operation
          console.warn(
            `Cursor launch warning for ${lane.laneId}:`,
            cursorResult.error
          );
        }

        // 4. Update lane status
        await updateLaneStatus(
          runDir,
          lane.laneId,
          result.worktreeCreated && result.packetWritten
        );
      } else {
        result.error = worktreeResult.error;
      }

      results.push(result);
    }

    // Determine overall success
    const allSuccess = results.every(
      (r) => r.worktreeCreated && r.packetWritten
    );

    return NextResponse.json({
      success: allSuccess,
      results,
      summary: {
        total: results.length,
        worktreesCreated: results.filter((r) => r.worktreeCreated).length,
        packetsWritten: results.filter((r) => r.packetWritten).length,
        cursorLaunched: results.filter((r) => r.cursorLaunched).length,
        errors: results.filter((r) => r.error).length,
      },
    });
  } catch (err) {
    console.error("Stage lanes error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
