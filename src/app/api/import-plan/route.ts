// POST /api/import-plan
// Imports a plan.json from pasted JSON and writes to run directory

import { NextRequest, NextResponse } from "next/server";
import { WarRoomPlan } from "@/lib/plan-schema";
import { initializeRun } from "@/lib/run-manager";
import { v4 as uuidv4 } from "uuid";

interface ImportPlanRequest {
  planJson: string;
}

interface ImportPlanResponse {
  success: boolean;
  plan?: WarRoomPlan;
  runDir?: string;
  error?: string;
}

function generateSlug(goal: string): string {
  return goal
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .substring(0, 30)
    .replace(/-+$/, "");
}

const WORKSPACE_PATH = process.env.HOME
  ? `${process.env.HOME}/.openclaw/workspace`
  : "/tmp/.openclaw/workspace";

const WORKTREES_PATH = process.env.HOME
  ? `${process.env.HOME}/.openclaw/worktrees`
  : "/tmp/.openclaw/worktrees";

function validatePlan(plan: unknown): { valid: boolean; error?: string } {
  if (typeof plan !== "object" || plan === null) {
    return { valid: false, error: "Plan must be a JSON object" };
  }

  const p = plan as Record<string, unknown>;

  // Required fields
  if (!p.goal || typeof p.goal !== "string") {
    return { valid: false, error: "Plan must have a 'goal' string" };
  }

  if (!p.repo || typeof p.repo !== "object") {
    return { valid: false, error: "Plan must have a 'repo' object" };
  }

  const repo = p.repo as Record<string, unknown>;
  if (!repo.path || typeof repo.path !== "string") {
    return { valid: false, error: "Plan repo must have a 'path' string" };
  }

  // lanes is optional - if not provided, we'll generate default lanes
  if (p.lanes !== undefined) {
    if (!Array.isArray(p.lanes)) {
      return { valid: false, error: "'lanes' must be an array if provided" };
    }
  }

  return { valid: true };
}

function normalizePlan(rawPlan: Record<string, unknown>): WarRoomPlan {
  // Generate missing IDs and metadata
  const runId = (rawPlan.runId as string) || uuidv4();
  const slug = generateSlug(rawPlan.goal as string);
  const runSlug = (rawPlan.runSlug as string) || `${slug}-${Date.now().toString(36)}`;
  const runDir =
    (rawPlan.runDir as string) || `${WORKSPACE_PATH}/warroom/runs/${runSlug}`;

  const repo = rawPlan.repo as { name?: string; path: string };

  // Default lanes if not provided
  let lanes = rawPlan.lanes as WarRoomPlan["lanes"] | undefined;
  if (!lanes || lanes.length === 0) {
    lanes = [
      {
        laneId: "lane-1",
        agent: "architect",
        branch: `warroom/${slug}/architect`,
        worktreePath: `${WORKTREES_PATH}/${slug}-lane-1`,
        packetName: "WARROOM_PACKET.md",
        dependsOn: [],
        autonomy: { dangerouslySkipPermissions: false },
        verify: { commands: ["npm run typecheck", "npm run lint", "npm run build"], required: true },
      },
      {
        laneId: "lane-2",
        agent: "developer",
        branch: `warroom/${slug}/developer`,
        worktreePath: `${WORKTREES_PATH}/${slug}-lane-2`,
        packetName: "WARROOM_PACKET.md",
        dependsOn: ["lane-1"],
        autonomy: { dangerouslySkipPermissions: false },
        verify: { commands: ["npm run typecheck", "npm run lint", "npm run build"], required: true },
      },
      {
        laneId: "lane-3",
        agent: "qa-tester",
        branch: `warroom/${slug}/qa-tester`,
        worktreePath: `${WORKTREES_PATH}/${slug}-lane-3`,
        packetName: "WARROOM_PACKET.md",
        dependsOn: ["lane-2"],
        autonomy: { dangerouslySkipPermissions: false },
        verify: { commands: ["npm run typecheck", "npm run lint", "npm run build"], required: true },
      },
    ];
  }

  // Merge configuration
  const merge = (rawPlan.merge as WarRoomPlan["merge"]) || {
    proposedOrder: lanes.map((l) => l.laneId),
    method: "merge" as const,
    notes: "Merge sequentially to integration branch. Final merge to main requires human review.",
    requiresHuman: true as const,
  };

  // Build the normalized plan
  const plan: WarRoomPlan = {
    runId,
    runSlug,
    runDir,
    createdAt: (rawPlan.createdAt as string) || new Date().toISOString(),
    startMode: (rawPlan.startMode as WarRoomPlan["startMode"]) || "claude_code_import",
    repo: {
      name: repo.name || repo.path.split("/").pop() || "repo",
      path: repo.path,
    },
    goal: rawPlan.goal as string,
    workstream: (rawPlan.workstream as WarRoomPlan["workstream"]) || {
      type: "quick_task",
    },
    integrationBranch:
      (rawPlan.integrationBranch as string) || `warroom/integration/${slug}`,
    lanes,
    merge,
  };

  return plan;
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<ImportPlanResponse>> {
  try {
    const body = (await request.json()) as ImportPlanRequest;

    // Validate JSON string is provided
    if (!body.planJson || typeof body.planJson !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "planJson string is required",
        },
        { status: 400 }
      );
    }

    // Parse the JSON
    let rawPlan: unknown;
    try {
      rawPlan = JSON.parse(body.planJson);
    } catch (parseError) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid JSON: ${parseError instanceof Error ? parseError.message : "Parse error"}`,
        },
        { status: 400 }
      );
    }

    // Validate the plan structure
    const validation = validatePlan(rawPlan);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error,
        },
        { status: 400 }
      );
    }

    // Normalize the plan with defaults
    const plan = normalizePlan(rawPlan as Record<string, unknown>);

    // Initialize the run directory with plan and packets
    const { runDirectory, packetFiles } = await initializeRun(plan);

    console.log(
      `[import-plan] Created run: ${plan.runSlug} with ${packetFiles.length} packets`
    );
    console.log(`[import-plan] Run directory: ${runDirectory.runDir}`);

    return NextResponse.json({
      success: true,
      plan,
      runDir: runDirectory.runDir,
    });
  } catch (error) {
    console.error("[import-plan] Error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
