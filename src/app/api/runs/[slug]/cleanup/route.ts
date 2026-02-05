// API route for worktree cleanup execution
// POST /api/runs/[slug]/cleanup - removes worktrees and optionally deletes branches

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { WarRoomPlan, StatusJson, MergeState } from "@/lib/plan-schema";
import {
  isWorktreeSafeToRemove,
  removeWorktree,
  deleteLaneBranch,
  pruneWorktrees,
  validateWorktreePath,
} from "@/lib/orchestrator/git-operations";
import { logWorktreeCleanup } from "@/lib/history";

interface CleanupRequest {
  confirmationToken: string;
  laneIds: string[];
  deleteBranches: boolean;
}

interface LaneCleanupResult {
  laneId: string;
  worktreeRemoved: boolean;
  branchDeleted: boolean;
  error?: string;
}

interface CleanupResponse {
  success: boolean;
  results: LaneCleanupResult[];
  lanesRemoved: string[];
  branchesDeleted: string[];
  errors: string[];
  error?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse<CleanupResponse>> {
  try {
    const { slug } = await params;
    const body: CleanupRequest = await request.json();

    // Validate confirmation token
    if (body.confirmationToken !== "CLEANUP") {
      return NextResponse.json(
        {
          success: false,
          results: [],
          lanesRemoved: [],
          branchesDeleted: [],
          errors: [],
          error: "Invalid confirmation token. Must type 'CLEANUP' to confirm.",
        },
        { status: 400 }
      );
    }

    // Validate laneIds
    if (!body.laneIds || body.laneIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          results: [],
          lanesRemoved: [],
          branchesDeleted: [],
          errors: [],
          error: "No lanes specified for cleanup",
        },
        { status: 400 }
      );
    }

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
          results: [],
          lanesRemoved: [],
          branchesDeleted: [],
          errors: [],
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
          results: [],
          lanesRemoved: [],
          branchesDeleted: [],
          errors: [],
          error: "Plan not found for run",
        },
        { status: 404 }
      );
    }

    // Read status.json to get merge state
    let mergeState: MergeState | null = null;
    try {
      const statusContent = await fs.readFile(
        path.join(runDir, "status.json"),
        "utf-8"
      );
      const status: StatusJson = JSON.parse(statusContent);
      mergeState = status?.mergeState ?? null;
    } catch {
      // Status not available
    }

    const results: LaneCleanupResult[] = [];
    const lanesRemoved: string[] = [];
    const branchesDeleted: string[] = [];
    const errors: string[] = [];

    // Process each lane
    for (const laneId of body.laneIds) {
      const lane = plan.lanes.find((l) => l.laneId === laneId);
      if (!lane) {
        results.push({
          laneId,
          worktreeRemoved: false,
          branchDeleted: false,
          error: "Lane not found in plan",
        });
        errors.push(`${laneId}: Lane not found in plan`);
        continue;
      }

      const { worktreePath, branch } = lane;

      // Re-verify eligibility (TOCTOU mitigation)
      const isMergedInState = mergeState?.mergedLanes?.includes(laneId) ?? false;
      if (!isMergedInState) {
        results.push({
          laneId,
          worktreeRemoved: false,
          branchDeleted: false,
          error: "Lane is not marked as merged - cannot cleanup",
        });
        errors.push(`${laneId}: Lane is not marked as merged`);
        continue;
      }

      // Validate path again
      const pathValidation = validateWorktreePath(worktreePath);
      if (!pathValidation.safe) {
        results.push({
          laneId,
          worktreeRemoved: false,
          branchDeleted: false,
          error: pathValidation.reason,
        });
        errors.push(`${laneId}: ${pathValidation.reason}`);
        continue;
      }

      // Re-check safety immediately before removal (TOCTOU mitigation)
      const safetyCheck = await isWorktreeSafeToRemove(worktreePath);
      if (!safetyCheck.safe) {
        results.push({
          laneId,
          worktreeRemoved: false,
          branchDeleted: false,
          error: safetyCheck.reason,
        });
        errors.push(`${laneId}: ${safetyCheck.reason}`);
        continue;
      }

      // Remove worktree
      const removeResult = await removeWorktree(plan.repo.path, worktreePath, true);

      const worktreeRemoved = removeResult.success;
      let branchDeleted = false;
      let laneError: string | undefined;

      if (!removeResult.success) {
        laneError = `Failed to remove worktree: ${removeResult.error}`;
        errors.push(`${laneId}: ${laneError}`);
      } else {
        lanesRemoved.push(laneId);
      }

      // Delete branch if requested and worktree was removed successfully
      if (body.deleteBranches && worktreeRemoved) {
        // For merged lanes (per MergeState), use force delete since squash/cherry-pick
        // merges won't show as ancestors
        const branchResult = await deleteLaneBranch(plan.repo.path, branch, true);
        branchDeleted = branchResult.success;

        if (!branchResult.success) {
          const branchError = `Failed to delete branch: ${branchResult.error}`;
          if (laneError) {
            laneError += ` | ${branchError}`;
          } else {
            laneError = branchError;
          }
          errors.push(`${laneId}: ${branchError}`);
        } else {
          branchesDeleted.push(branch);
        }
      }

      results.push({
        laneId,
        worktreeRemoved,
        branchDeleted,
        error: laneError,
      });
    }

    // Prune stale worktree references
    await pruneWorktrees(plan.repo.path);

    // Log cleanup to history (not a dry run)
    if (lanesRemoved.length > 0 || branchesDeleted.length > 0) {
      logWorktreeCleanup(runDir, lanesRemoved, branchesDeleted, false);
    }

    const allSuccessful = results.every((r) => r.worktreeRemoved && (!body.deleteBranches || r.branchDeleted));

    return NextResponse.json({
      success: allSuccessful,
      results,
      lanesRemoved,
      branchesDeleted,
      errors,
    });
  } catch (error) {
    console.error("Cleanup error:", error);
    return NextResponse.json(
      {
        success: false,
        results: [],
        lanesRemoved: [],
        branchesDeleted: [],
        errors: [],
        error: error instanceof Error ? error.message : "Failed to execute cleanup",
      },
      { status: 500 }
    );
  }
}
