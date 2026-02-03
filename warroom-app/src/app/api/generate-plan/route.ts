// POST /api/generate-plan
// Generates plan.json + packets and writes to run directory

import { NextRequest, NextResponse } from "next/server";
import {
  GeneratePlanRequest,
  GeneratePlanResponse,
} from "@/lib/plan-schema";
import { generatePlan } from "@/lib/plan-generator";
import { initializeRun } from "@/lib/run-manager";

export async function POST(
  request: NextRequest
): Promise<NextResponse<GeneratePlanResponse>> {
  try {
    const body = (await request.json()) as GeneratePlanRequest;

    // Validate required fields
    if (!body.goal || typeof body.goal !== "string" || body.goal.trim() === "") {
      return NextResponse.json(
        {
          success: false,
          error: "Goal is required",
        },
        { status: 400 }
      );
    }

    if (
      !body.repoPath ||
      typeof body.repoPath !== "string" ||
      body.repoPath.trim() === ""
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Repository path is required",
        },
        { status: 400 }
      );
    }

    // Generate the plan
    const plan = generatePlan({
      goal: body.goal.trim(),
      repoPath: body.repoPath.trim(),
      repoName: body.repoName,
      workstreamType: body.workstreamType,
      prdPath: body.prdPath,
      maxLanes: body.maxLanes,
      autonomy: body.autonomy,
    });

    // Initialize the run directory with plan and packets
    const { runDirectory, packetFiles } = await initializeRun(plan);

    console.log(
      `[generate-plan] Created run: ${plan.runSlug} with ${packetFiles.length} packets`
    );
    console.log(`[generate-plan] Run directory: ${runDirectory.runDir}`);

    return NextResponse.json({
      success: true,
      plan,
      runDir: runDirectory.runDir,
    });
  } catch (error) {
    console.error("[generate-plan] Error:", error);

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
