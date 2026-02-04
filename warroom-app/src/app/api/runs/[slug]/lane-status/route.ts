// API route to get uncommitted changes and commit counts per lane
// GET /api/runs/[slug]/lane-status - returns uncommitted file counts, file lists, and commits since launch per lane

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import { WarRoomPlan, Lane, StatusJson } from "@/lib/plan-schema";

const execAsync = promisify(exec);

interface UncommittedFile {
  status: string; // e.g. "M", "A", "D", "??"
  path: string;
}

interface LaneUncommittedStatus {
  laneId: string;
  uncommittedCount: number;
  uncommittedFiles: UncommittedFile[];
  worktreeExists: boolean;
  error?: string;
  // New fields for commits tracking
  commitsSinceLaunch?: number;
  commitsAtLaunch?: number;
  currentCommits?: number;
  branch?: string;
}

export interface LaneStatusResponse {
  success: boolean;
  lanes: Record<string, LaneUncommittedStatus>;
  error?: string;
}

async function getUncommittedFiles(worktreePath: string): Promise<{ files: UncommittedFile[]; error?: string }> {
  try {
    // Check if directory exists
    await fs.access(worktreePath);
  } catch {
    return { files: [], error: "Worktree does not exist" };
  }

  try {
    const { stdout } = await execAsync("git status --porcelain", {
      cwd: worktreePath,
    });

    const files: UncommittedFile[] = stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        // Format is "XY path" where XY is status codes
        const status = line.substring(0, 2).trim();
        const filePath = line.substring(3);
        return { status, path: filePath };
      });

    return { files };
  } catch (error) {
    return { files: [], error: `Git error: ${error instanceof Error ? error.message : String(error)}` };
  }
}

// Get the current commit count for a worktree
async function getCommitCount(worktreePath: string): Promise<number | null> {
  try {
    await fs.access(worktreePath);
    const { stdout } = await execAsync("git rev-list --count HEAD", { cwd: worktreePath });
    return parseInt(stdout.trim(), 10) || 0;
  } catch {
    return null;
  }
}

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

    // Check if run directory exists
    try {
      await fs.access(runDir);
    } catch {
      return NextResponse.json(
        { success: false, error: "Run not found", lanes: {} },
        { status: 404 }
      );
    }

    // Read the plan to get lane info
    let plan: WarRoomPlan;
    try {
      const planContent = await fs.readFile(
        path.join(runDir, "plan.json"),
        "utf-8"
      );
      plan = JSON.parse(planContent);
    } catch {
      return NextResponse.json(
        { success: false, error: "Could not read plan.json", lanes: {} },
        { status: 404 }
      );
    }

    // Read status.json to get commitsAtLaunch values
    let statusJson: StatusJson | null = null;
    try {
      const statusContent = await fs.readFile(
        path.join(runDir, "status.json"),
        "utf-8"
      );
      statusJson = JSON.parse(statusContent);
    } catch {
      // Status.json may not exist yet - that's okay
    }

    // Get uncommitted files and commit counts for each lane
    const laneStatuses: Record<string, LaneUncommittedStatus> = {};

    await Promise.all(
      plan.lanes.map(async (lane: Lane) => {
        const { files, error } = await getUncommittedFiles(lane.worktreePath);
        const currentCommits = await getCommitCount(lane.worktreePath);

        // Get commitsAtLaunch from status.json
        const commitsAtLaunch = statusJson?.lanes?.[lane.laneId]?.commitsAtLaunch;

        // Calculate commits since launch
        let commitsSinceLaunch: number | undefined;
        if (currentCommits !== null && commitsAtLaunch !== undefined) {
          commitsSinceLaunch = Math.max(0, currentCommits - commitsAtLaunch);
        }

        laneStatuses[lane.laneId] = {
          laneId: lane.laneId,
          uncommittedCount: files.length,
          uncommittedFiles: files,
          worktreeExists: !error || !error.includes("does not exist"),
          error,
          commitsSinceLaunch,
          commitsAtLaunch,
          currentCommits: currentCommits ?? undefined,
          branch: lane.branch,
        };
      })
    );

    const response: LaneStatusResponse = {
      success: true,
      lanes: laneStatuses,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error getting lane status:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get lane status",
        lanes: {},
      },
      { status: 500 }
    );
  }
}
