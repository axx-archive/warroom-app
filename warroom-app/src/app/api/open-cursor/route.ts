import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import os from "os";

const execFileAsync = promisify(execFile);

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
    const requestedPath = String(body.path);

    // Basic hardening: ensure a real, absolute path and keep it within the user's home directory.
    // (This is a local-only tool, but we still avoid arbitrary shell execution.)
    const resolved = path.resolve(requestedPath);
    const home = os.homedir();
    if (!path.isAbsolute(resolved) || !resolved.startsWith(home + path.sep)) {
      return NextResponse.json(
        { success: false, error: "Invalid path" },
        { status: 400 }
      );
    }

    // Open Cursor with the -n flag for a new window (no shell)
    await execFileAsync("/usr/local/bin/cursor", ["-n", resolved], {
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
