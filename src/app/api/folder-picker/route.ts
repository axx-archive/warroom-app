import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function POST() {
  try {
    // Use osascript to open native macOS folder picker
    const script = `
      osascript -e 'POSIX path of (choose folder with prompt "Select repository folder")'
    `;

    const { stdout } = await execAsync(script, { timeout: 60000 });
    const folderPath = stdout.trim();

    if (!folderPath) {
      return NextResponse.json(
        { error: "No folder selected" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      path: folderPath,
    });
  } catch (error) {
    // User cancelled or error
    const errorMessage = error instanceof Error ? error.message : String(error);

    // User cancelled - not an error
    if (errorMessage.includes("User canceled") || errorMessage.includes("-128")) {
      return NextResponse.json(
        { error: "cancelled", message: "User cancelled folder selection" },
        { status: 400 }
      );
    }

    console.error("Folder picker error:", error);
    return NextResponse.json(
      { error: "Failed to open folder picker" },
      { status: 500 }
    );
  }
}
