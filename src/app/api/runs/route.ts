// API route to list all War Room runs
// GET /api/runs - returns list of runs with status

import { NextResponse } from "next/server";
import { listRuns } from "@/lib/run-manager";
import os from "os";

export async function GET() {
  try {
    const workspacePath = `${os.homedir()}/.openclaw/workspace`;
    const runs = await listRuns(workspacePath);

    return NextResponse.json({
      success: true,
      runs,
    });
  } catch (error) {
    console.error("Error listing runs:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to list runs",
      },
      { status: 500 }
    );
  }
}
