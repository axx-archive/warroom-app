import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const runDir = path.join(
      os.homedir(),
      ".openclaw/workspace/warroom/runs",
      slug
    );

    // Read plan.json to get repo path
    let plan;
    try {
      const planContent = await fs.readFile(
        path.join(runDir, "plan.json"),
        "utf-8"
      );
      plan = JSON.parse(planContent);
    } catch {
      return NextResponse.json(
        { error: "Could not read plan.json" },
        { status: 404 }
      );
    }

    // Read merge-proposal.json to get the PM prompt
    let proposal;
    try {
      const proposalContent = await fs.readFile(
        path.join(runDir, "merge-proposal.json"),
        "utf-8"
      );
      proposal = JSON.parse(proposalContent);
    } catch {
      return NextResponse.json(
        { error: "No merge proposal found. Generate one first." },
        { status: 404 }
      );
    }

    const repoPath = plan.repo?.path;
    if (!repoPath) {
      return NextResponse.json(
        { error: "No repository path in plan" },
        { status: 400 }
      );
    }

    // Open Cursor to the main repo
    try {
      await execAsync(`cursor -n "${repoPath}"`);
    } catch (error) {
      console.error("Failed to open Cursor:", error);
      // Non-fatal - continue to return prompt
    }

    // Update status to "merging"
    const statusPath = path.join(runDir, "status.json");
    try {
      let statusJson: Record<string, unknown> = {};
      try {
        const content = await fs.readFile(statusPath, "utf-8");
        statusJson = JSON.parse(content);
      } catch {
        statusJson = { runId: plan.runId };
      }

      statusJson.status = "merging";
      statusJson.updatedAt = new Date().toISOString();

      await fs.writeFile(statusPath, JSON.stringify(statusJson, null, 2));
    } catch (error) {
      console.error("Failed to update status:", error);
    }

    return NextResponse.json({
      success: true,
      repoPath,
      prompt: proposal.pmPrompt,
    });
  } catch (error) {
    console.error("Launch merge error:", error);
    return NextResponse.json(
      { error: "Failed to launch merge" },
      { status: 500 }
    );
  }
}
