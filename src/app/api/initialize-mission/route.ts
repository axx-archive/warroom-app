import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { promises as fs } from "fs";

const execAsync = promisify(exec);

interface InitializeRequest {
  goal: string;
  repoPath: string;
  maxLanes?: number;
  autonomy?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body: InitializeRequest = await request.json();
    const { goal, repoPath, maxLanes, autonomy } = body;

    if (!goal?.trim() || !repoPath?.trim()) {
      return NextResponse.json(
        { error: "Goal and repository path are required" },
        { status: 400 }
      );
    }

    // Verify repo path exists
    try {
      await fs.access(repoPath);
    } catch {
      return NextResponse.json(
        { error: `Repository path not found: ${repoPath}` },
        { status: 400 }
      );
    }

    // Build the PM prompt with /warroom-plan skill
    const autonomyLine = autonomy
      ? "\nAutonomy: ON (dangerouslySkipPermissions enabled)"
      : "\nAutonomy: OFF (human checkpoints required)";

    const maxLanesLine = maxLanes ? `\nMax lanes: ${maxLanes}` : "";

    const pmPrompt = `@pm /warroom-plan

**Repository:** ${repoPath}

**Goal:** ${goal}
${maxLanesLine}${autonomyLine}

Please generate a War Room plan for this mission. Create the plan.json with lanes, packets, and merge strategy. Then stage the lanes so I can begin execution.`;

    // Open Cursor to the repo
    try {
      await execAsync(`cursor -n "${repoPath}"`);
    } catch (error) {
      console.error("Failed to open Cursor:", error);
      // Non-fatal - continue to return prompt
    }

    return NextResponse.json({
      success: true,
      repoPath,
      prompt: pmPrompt,
    });
  } catch (error) {
    console.error("Initialize mission error:", error);
    return NextResponse.json(
      { error: "Failed to initialize mission" },
      { status: 500 }
    );
  }
}
