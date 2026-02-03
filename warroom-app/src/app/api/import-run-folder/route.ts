// POST /api/import-run-folder
// Imports an existing run folder by path and validates its contents

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { WarRoomPlan, StatusJson } from "@/lib/plan-schema";

interface ImportRunFolderRequest {
  runPath: string;
}

interface ImportRunFolderResponse {
  success: boolean;
  plan?: WarRoomPlan;
  status?: StatusJson;
  runDir?: string;
  error?: string;
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(p: string): Promise<boolean> {
  try {
    const stat = await fs.stat(p);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<ImportRunFolderResponse>> {
  try {
    const body = (await request.json()) as ImportRunFolderRequest;

    // Validate runPath is provided
    if (!body.runPath || typeof body.runPath !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "runPath string is required",
        },
        { status: 400 }
      );
    }

    // Normalize the path (expand ~ if needed, resolve to absolute)
    let runPath = body.runPath.trim();

    // Expand home directory if path starts with ~
    if (runPath.startsWith("~")) {
      const home = process.env.HOME;
      if (!home) {
        return NextResponse.json(
          {
            success: false,
            error: "Cannot expand ~ - HOME environment variable not set",
          },
          { status: 400 }
        );
      }
      runPath = runPath.replace(/^~/, home);
    }

    // Resolve to absolute path
    runPath = path.resolve(runPath);

    // Validate the path exists
    if (!(await pathExists(runPath))) {
      return NextResponse.json(
        {
          success: false,
          error: `Path does not exist: ${runPath}`,
        },
        { status: 400 }
      );
    }

    // Validate it's a directory
    if (!(await isDirectory(runPath))) {
      return NextResponse.json(
        {
          success: false,
          error: `Path is not a directory: ${runPath}`,
        },
        { status: 400 }
      );
    }

    // Check for plan.json
    const planPath = path.join(runPath, "plan.json");
    if (!(await pathExists(planPath))) {
      return NextResponse.json(
        {
          success: false,
          error: `Missing required file: plan.json not found in ${runPath}`,
        },
        { status: 400 }
      );
    }

    // Read and parse plan.json
    let plan: WarRoomPlan;
    try {
      const planContent = await fs.readFile(planPath, "utf-8");
      plan = JSON.parse(planContent);
    } catch (e) {
      return NextResponse.json(
        {
          success: false,
          error: `Failed to parse plan.json: ${e instanceof Error ? e.message : "Parse error"}`,
        },
        { status: 400 }
      );
    }

    // Validate plan has required fields
    if (!plan.goal) {
      return NextResponse.json(
        {
          success: false,
          error: "plan.json is missing required field: goal",
        },
        { status: 400 }
      );
    }

    // Read status.json if it exists
    let status: StatusJson | undefined;
    const statusPath = path.join(runPath, "status.json");
    if (await pathExists(statusPath)) {
      try {
        const statusContent = await fs.readFile(statusPath, "utf-8");
        status = JSON.parse(statusContent);
      } catch (e) {
        // Log but don't fail - status.json is optional
        console.warn(
          `[import-run-folder] Failed to parse status.json: ${e instanceof Error ? e.message : "Parse error"}`
        );
      }
    }

    console.log(`[import-run-folder] Successfully imported run from: ${runPath}`);

    return NextResponse.json({
      success: true,
      plan,
      status,
      runDir: runPath,
    });
  } catch (error) {
    console.error("[import-run-folder] Error:", error);

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
