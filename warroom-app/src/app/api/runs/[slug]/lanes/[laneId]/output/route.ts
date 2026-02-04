// API route to get stdout/stderr output for a lane's Claude Code process
// GET /api/runs/[slug]/lanes/[laneId]/output - returns output buffer data

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import {
  getOrchestratorLaneOutput,
  getOrchestratorRecentOutput,
  getOrchestratorLaneErrors,
  LaneOutputState,
  OutputLine,
  DetectedError,
} from "@/lib/orchestrator";

// Response type for the output endpoint
export interface LaneOutputResponse {
  success: boolean;
  laneId: string;
  runSlug: string;
  output?: LaneOutputState;
  recentLines?: OutputLine[];
  errors?: DetectedError[];
  error?: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; laneId: string }> }
) {
  try {
    const { slug, laneId } = await params;

    // Validate run exists
    const runDir = path.join(
      os.homedir(),
      ".openclaw/workspace/warroom/runs",
      slug
    );

    try {
      await fs.access(runDir);
    } catch {
      return NextResponse.json(
        { success: false, error: "Run not found", laneId, runSlug: slug },
        { status: 404 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode") || "full"; // "full", "recent", "errors"
    const count = parseInt(searchParams.get("count") || "100", 10);

    // Get output based on mode
    let response: LaneOutputResponse;

    switch (mode) {
      case "recent":
        const recentLines = getOrchestratorRecentOutput(slug, laneId, count);
        response = {
          success: true,
          laneId,
          runSlug: slug,
          recentLines,
        };
        break;

      case "errors":
        const errors = getOrchestratorLaneErrors(slug, laneId);
        response = {
          success: true,
          laneId,
          runSlug: slug,
          errors,
        };
        break;

      case "full":
      default:
        const output = getOrchestratorLaneOutput(slug, laneId);
        if (!output) {
          // No output captured yet - could be that process hasn't started
          // or is running in terminal mode (where we can't capture output)
          const now = new Date().toISOString();
          response = {
            success: true,
            laneId,
            runSlug: slug,
            output: {
              laneId,
              lines: [],
              totalLines: 0,
              errors: [],
              warnings: [],
              startedAt: now,
              lastActivityAt: now,
              tokenUsage: {
                inputTokens: 0,
                outputTokens: 0,
                cacheReadTokens: 0,
                cacheWriteTokens: 0,
                totalTokens: 0,
                updatedAt: now,
              },
              costTracking: {
                tokenUsage: {
                  inputTokens: 0,
                  outputTokens: 0,
                  cacheReadTokens: 0,
                  cacheWriteTokens: 0,
                  totalTokens: 0,
                  updatedAt: now,
                },
                estimatedCostUsd: 0,
                isEstimate: true,
              },
            },
          };
        } else {
          response = {
            success: true,
            laneId,
            runSlug: slug,
            output,
          };
        }
        break;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error getting lane output:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get lane output",
        laneId: "",
        runSlug: "",
      },
      { status: 500 }
    );
  }
}
