// API route to add a new lane to an in-progress run
// POST /api/runs/[slug]/add-lane - creates worktree, packet, and updates plan.json

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import {
  WarRoomPlan,
  StatusJson,
  Lane,
  AgentType,
  LaneAutonomy,
  LaneVerify,
} from "@/lib/plan-schema";
import { generatePacketMarkdown } from "@/lib/packet-templates";

const execAsync = promisify(exec);

interface AddLaneRequest {
  laneId: string;
  agent: AgentType;
  branchName?: string; // Optional - will be auto-generated if not provided
  dependsOn: string[];
  autonomy?: LaneAutonomy;
  verify?: LaneVerify;
  allowedPaths?: string[];
}

interface AddLaneResponse {
  success: boolean;
  lane?: Lane;
  worktreePath?: string;
  error?: string;
}

// Check if a git branch exists (local or remote)
async function branchExists(
  repoPath: string,
  branch: string
): Promise<boolean> {
  try {
    await execAsync(`git show-ref --verify --quiet refs/heads/${branch}`, {
      cwd: repoPath,
    });
    return true;
  } catch {
    try {
      await execAsync(
        `git show-ref --verify --quiet refs/remotes/origin/${branch}`,
        { cwd: repoPath }
      );
      return true;
    } catch {
      return false;
    }
  }
}

// Create a new branch from current HEAD
async function createBranch(repoPath: string, branch: string): Promise<void> {
  await execAsync(`git branch ${branch}`, { cwd: repoPath });
}

// Check if worktree already exists at the given path
async function worktreeExists(worktreePath: string): Promise<boolean> {
  try {
    await fs.access(worktreePath);
    const gitDir = path.join(worktreePath, ".git");
    await fs.access(gitDir);
    return true;
  } catch {
    return false;
  }
}

// Create worktree for the new lane
async function createWorktree(
  repoPath: string,
  worktreePath: string,
  branch: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if worktree already exists
    if (await worktreeExists(worktreePath)) {
      return { success: false, error: "Worktree already exists at this path" };
    }

    // Create parent directory if needed
    const parentDir = path.dirname(worktreePath);
    await fs.mkdir(parentDir, { recursive: true });

    // Check if branch exists, create if not
    if (!(await branchExists(repoPath, branch))) {
      await createBranch(repoPath, branch);
    }

    // Create the worktree
    await execAsync(`git worktree add "${worktreePath}" ${branch}`, {
      cwd: repoPath,
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Write packet to worktree
async function writePacketToWorktree(
  lane: Lane,
  plan: WarRoomPlan,
  worktreePath: string,
  autonomy?: LaneAutonomy
): Promise<{ success: boolean; error?: string }> {
  try {
    const destPath = path.join(worktreePath, "WARROOM_PACKET.md");
    const content = generatePacketMarkdown(lane, plan, autonomy);
    await fs.writeFile(destPath, content, "utf-8");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body: AddLaneRequest = await request.json();

    // Validate required fields
    if (!body.laneId || !body.agent) {
      return NextResponse.json(
        { success: false, error: "laneId and agent are required" },
        { status: 400 }
      );
    }

    // Validate laneId format (alphanumeric, dashes, underscores only)
    if (!/^[a-zA-Z0-9_-]+$/.test(body.laneId)) {
      return NextResponse.json(
        {
          success: false,
          error: "laneId must contain only alphanumeric characters, dashes, and underscores",
        },
        { status: 400 }
      );
    }

    const runDir = path.join(
      os.homedir(),
      ".openclaw/workspace/warroom/runs",
      slug
    );
    const planPath = path.join(runDir, "plan.json");
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

    // Read the plan
    let plan: WarRoomPlan;
    try {
      const content = await fs.readFile(planPath, "utf-8");
      plan = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { success: false, error: "Failed to read plan.json" },
        { status: 500 }
      );
    }

    // Check if laneId already exists
    if (plan.lanes.some((lane) => lane.laneId === body.laneId)) {
      return NextResponse.json(
        { success: false, error: `Lane '${body.laneId}' already exists` },
        { status: 400 }
      );
    }

    // Validate dependencies exist
    for (const dep of body.dependsOn || []) {
      if (!plan.lanes.some((lane) => lane.laneId === dep)) {
        return NextResponse.json(
          { success: false, error: `Dependency '${dep}' does not exist` },
          { status: 400 }
        );
      }
    }

    // Generate branch name if not provided
    const branchName =
      body.branchName || `warroom/${slug}/${body.laneId}`;

    // Generate worktree path
    const worktreesDir = path.join(
      os.homedir(),
      ".openclaw/workspace/warroom/worktrees",
      slug
    );
    const worktreePath = path.join(worktreesDir, body.laneId);

    // Create the new lane object
    const newLane: Lane = {
      laneId: body.laneId,
      agent: body.agent,
      branch: branchName,
      worktreePath,
      packetName: "WARROOM_PACKET.md",
      dependsOn: body.dependsOn || [],
      autonomy: body.autonomy || { dangerouslySkipPermissions: false },
      verify: body.verify || {
        commands: ["npm run typecheck", "npm run lint"],
        required: true,
      },
      allowedPaths: body.allowedPaths,
    };

    // Create the worktree
    const worktreeResult = await createWorktree(
      plan.repo.path,
      worktreePath,
      branchName
    );

    if (!worktreeResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Failed to create worktree: ${worktreeResult.error}`,
        },
        { status: 500 }
      );
    }

    // Add lane to plan
    plan.lanes.push(newLane);

    // Write updated plan
    await fs.writeFile(planPath, JSON.stringify(plan, null, 2));

    // Write packet to worktree
    const packetResult = await writePacketToWorktree(
      newLane,
      plan,
      worktreePath,
      newLane.autonomy
    );

    if (!packetResult.success) {
      console.error("Failed to write packet:", packetResult.error);
      // Non-fatal - lane is still created
    }

    // Update status.json to include new lane
    let status: StatusJson;
    try {
      const content = await fs.readFile(statusPath, "utf-8");
      status = JSON.parse(content);
    } catch {
      status = {
        runId: plan.runId,
        status: "staged",
        lanesCompleted: [],
        updatedAt: new Date().toISOString(),
      };
    }

    if (!status.lanes) {
      status.lanes = {};
    }

    status.lanes[body.laneId] = {
      staged: true,
      status: "pending",
      autonomy: newLane.autonomy,
    };

    status.updatedAt = new Date().toISOString();

    await fs.writeFile(statusPath, JSON.stringify(status, null, 2));

    const response: AddLaneResponse = {
      success: true,
      lane: newLane,
      worktreePath,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("Error adding lane:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to add lane",
      },
      { status: 500 }
    );
  }
}
