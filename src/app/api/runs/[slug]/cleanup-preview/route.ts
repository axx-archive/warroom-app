// API route for cleanup preview (dry-run)
// GET /api/runs/[slug]/cleanup-preview - returns which lanes are eligible for cleanup

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { WarRoomPlan, StatusJson, MergeState } from "@/lib/plan-schema";
import {
  isWorktreeSafeToRemove,
  isBranchMerged,
  validateWorktreePath,
} from "@/lib/orchestrator/git-operations";

interface EligibleLane {
  laneId: string;
  worktreePath: string;
  branch: string;
  reason: string;
}

interface IneligibleLane {
  laneId: string;
  worktreePath: string;
  branch: string;
  reason: string;
}

interface CleanupPreviewResponse {
  success: boolean;
  eligibleLanes: EligibleLane[];
  ineligibleLanes: IneligibleLane[];
  warnings: string[];
  error?: string;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse<CleanupPreviewResponse>> {
  try {
    const { slug } = await params;

    const runDir = path.join(
      os.homedir(),
      ".openclaw/workspace/warroom/runs",
      slug
    );

    // Check if run directory exists
    try {
      await fs.access(runDir);
    } catch {
      return NextResponse.json(
        {
          success: false,
          eligibleLanes: [],
          ineligibleLanes: [],
          warnings: [],
          error: "Run not found",
        },
        { status: 404 }
      );
    }

    // Read plan.json
    let plan: WarRoomPlan;
    try {
      const planContent = await fs.readFile(
        path.join(runDir, "plan.json"),
        "utf-8"
      );
      plan = JSON.parse(planContent);
    } catch {
      return NextResponse.json(
        {
          success: false,
          eligibleLanes: [],
          ineligibleLanes: [],
          warnings: [],
          error: "Plan not found for run",
        },
        { status: 404 }
      );
    }

    // Read status.json to get merge state
    let status: StatusJson | null = null;
    let mergeState: MergeState | null = null;
    try {
      const statusContent = await fs.readFile(
        path.join(runDir, "status.json"),
        "utf-8"
      );
      status = JSON.parse(statusContent);
      mergeState = status?.mergeState ?? null;
    } catch {
      // Status not available, continue without merge state
    }

    const eligibleLanes: EligibleLane[] = [];
    const ineligibleLanes: IneligibleLane[] = [];
    const warnings: string[] = [];

    // Check each lane
    for (const lane of plan.lanes) {
      const { laneId, worktreePath, branch } = lane;

      // Check 1: Is the lane merged?
      const isMergedInState = mergeState?.mergedLanes?.includes(laneId) ?? false;

      if (!isMergedInState) {
        ineligibleLanes.push({
          laneId,
          worktreePath,
          branch,
          reason: "Lane has not been merged yet",
        });
        continue;
      }

      // Check 2: Validate path is within boundaries
      const pathValidation = validateWorktreePath(worktreePath);
      if (!pathValidation.safe) {
        ineligibleLanes.push({
          laneId,
          worktreePath,
          branch,
          reason: pathValidation.reason,
        });
        continue;
      }

      // Check 3: Is worktree safe to remove? (no uncommitted changes, etc.)
      const safetyCheck = await isWorktreeSafeToRemove(worktreePath);
      if (!safetyCheck.safe) {
        ineligibleLanes.push({
          laneId,
          worktreePath,
          branch,
          reason: safetyCheck.reason,
        });
        continue;
      }

      // Check 4: Verify branch is actually merged (git ancestry check)
      // For squash/cherry-pick merges, trust MergeState instead (per security review)
      let branchMergeReason = "Lane is merged (per MergeState)";
      try {
        const ancestryMerged = await isBranchMerged(
          plan.repo.path,
          branch,
          plan.integrationBranch
        );
        if (ancestryMerged) {
          branchMergeReason = "Branch is merged into integration branch";
        } else {
          // Branch not an ancestor - could be squash/cherry-pick merge
          // Trust MergeState per security review recommendation
          warnings.push(
            `${laneId}: Branch ${branch} may have been squash/cherry-pick merged (ancestry check failed, but MergeState shows merged)`
          );
        }
      } catch {
        // Git check failed, but MergeState says it's merged - trust MergeState
        warnings.push(
          `${laneId}: Could not verify branch ancestry, trusting MergeState`
        );
      }

      // Lane is eligible for cleanup
      eligibleLanes.push({
        laneId,
        worktreePath,
        branch,
        reason: branchMergeReason,
      });
    }

    return NextResponse.json({
      success: true,
      eligibleLanes,
      ineligibleLanes,
      warnings,
    });
  } catch (error) {
    console.error("Cleanup preview error:", error);
    return NextResponse.json(
      {
        success: false,
        eligibleLanes: [],
        ineligibleLanes: [],
        warnings: [],
        error: error instanceof Error ? error.message : "Failed to generate cleanup preview",
      },
      { status: 500 }
    );
  }
}
