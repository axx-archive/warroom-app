import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

interface OpenCursorRequest {
  path: string;
}

interface OpenCursorResponse {
  success: boolean;
  error?: string;
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<OpenCursorResponse>> {
  let body: OpenCursorRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request body" },
      { status: 400 }
    );
  }

  if (!body.path) {
    return NextResponse.json(
      { success: false, error: "Path is required" },
      { status: 400 }
    );
  }

  try {
    // Open Cursor with the -n flag for a new window
    await execAsync(`/usr/local/bin/cursor -n "${body.path}"`, {
      timeout: 10000,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: `Failed to open Cursor: ${err instanceof Error ? err.message : String(err)}`,
      },
      { status: 500 }
    );
  }
}
