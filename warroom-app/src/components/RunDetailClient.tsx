"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { Lane, LaneStatus } from "@/lib/plan-schema";
import { LanesManager } from "./LanesManager";
import { MergeView } from "./MergeView";
import { useStatusPolling, LaneState } from "@/hooks/useStatusPolling";

interface RunDetailClientProps {
  lanes: Lane[];
  slug: string;
  initialStates: Record<string, LaneState>;
  onProgressUpdate?: (completed: number, total: number) => void;
}

interface CommitAllResult {
  laneId: string;
  success: boolean;
  committed: boolean;
  error?: string;
}

export function RunDetailClient({
  lanes,
  slug,
  initialStates,
}: RunDetailClientProps) {
  // Use polling hook for real-time status updates
  const {
    laneStates,
    laneUncommitted,
    isRefreshing,
    updateLaneState,
  } = useStatusPolling({
    slug,
    initialLaneStates: initialStates,
    enabled: true,
  });

  // Key to force MergeView refresh
  const [mergeViewKey, setMergeViewKey] = useState(0);

  // Track previous lane states to detect changes for merge view refresh
  const [prevLaneStates, setPrevLaneStates] = useState<Record<string, LaneState>>(initialStates);

  // Refresh merge view when lane states change from polling
  useEffect(() => {
    const hasChanged = Object.keys(laneStates).some(
      (laneId) => laneStates[laneId]?.status !== prevLaneStates[laneId]?.status
    );
    if (hasChanged) {
      setMergeViewKey((prev) => prev + 1);
      setPrevLaneStates(laneStates);
    }
  }, [laneStates, prevLaneStates]);

  // Commit all lanes state
  const [isCommittingAll, setIsCommittingAll] = useState(false);
  const [commitAllStatus, setCommitAllStatus] = useState<"idle" | "success" | "partial" | "error">("idle");
  const [, setCommitAllResults] = useState<CommitAllResult[]>([]);

  // Calculate progress
  const progress = useMemo(() => {
    const total = lanes.length;
    const completed = lanes.filter(
      (lane) => laneStates[lane.laneId]?.status === "complete"
    ).length;
    return { completed, total };
  }, [lanes, laneStates]);

  const handleStatusChange = useCallback((laneId: string, newStatus: LaneStatus) => {
    // Update local state optimistically for immediate UI feedback
    updateLaneState(laneId, newStatus);
    // Increment key to force MergeView to refetch data
    setMergeViewKey((prev) => prev + 1);
  }, [updateLaneState]);

  const handleCommitAll = useCallback(async () => {
    setIsCommittingAll(true);
    setCommitAllStatus("idle");
    setCommitAllResults([]);

    try {
      const response = await fetch(`/api/runs/${slug}/commit-all-lanes`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to commit lanes");
      }

      setCommitAllResults(data.results);

      if (data.summary.failed > 0) {
        setCommitAllStatus("partial");
      } else if (data.summary.committed > 0) {
        setCommitAllStatus("success");
      } else {
        setCommitAllStatus("success"); // All no changes
      }

      // Refresh merge view
      setMergeViewKey((prev) => prev + 1);

      setTimeout(() => setCommitAllStatus("idle"), 5000);
    } catch (error) {
      console.error("Commit all error:", error);
      setCommitAllStatus("error");
      setTimeout(() => setCommitAllStatus("idle"), 5000);
    } finally {
      setIsCommittingAll(false);
    }
  }, [slug]);

  return (
    <>
      {/* Agent Lanes */}
      <div className="panel-bracketed p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-[var(--cyan-glow)] border border-[var(--cyan-dim)] flex items-center justify-center">
              <svg className="w-4 h-4 text-[var(--cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-[var(--text-primary)]">
              Agent Lanes
            </h3>
          </div>
          <div className="flex items-center gap-3">
            {/* Refreshing indicator */}
            {isRefreshing && (
              <span className="flex items-center gap-1.5 text-xs text-[var(--text-ghost)] font-mono">
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                refreshing...
              </span>
            )}
            {/* Commit All Button */}
            <button
              onClick={handleCommitAll}
              disabled={isCommittingAll}
              className={`btn btn--sm ${
                commitAllStatus === "success" ? "btn--success" :
                commitAllStatus === "partial" ? "btn--warning" :
                commitAllStatus === "error" ? "btn--danger" :
                "btn--secondary"
              } ${isCommittingAll ? "opacity-50 cursor-wait" : ""}`}
              title="Commit uncommitted changes in all lane worktrees"
            >
              {isCommittingAll ? (
                <>
                  <svg className="w-3 h-3 spinner" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Committing...
                </>
              ) : commitAllStatus === "success" ? (
                <>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  All Committed!
                </>
              ) : commitAllStatus === "partial" ? (
                <>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
                  </svg>
                  Partial Success
                </>
              ) : commitAllStatus === "error" ? (
                <>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Error
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={2} fill="none" />
                  </svg>
                  Commit All
                </>
              )}
            </button>
            {/* Live progress counter */}
            <span
              className={`badge ${
                progress.completed === progress.total
                  ? "badge-success"
                  : progress.completed > 0
                  ? "badge-warning"
                  : "badge-neutral"
              }`}
            >
              {progress.completed} / {progress.total} complete
            </span>
          </div>
        </div>

        <LanesManager
          lanes={lanes}
          slug={slug}
          laneStates={laneStates}
          laneUncommitted={laneUncommitted}
          onStatusChange={handleStatusChange}
        />
      </div>

      {/* Merge Readiness - key forces refresh on status change */}
      <MergeView key={mergeViewKey} slug={slug} />
    </>
  );
}
