"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Lane, LaneStatus } from "@/lib/plan-schema";
import { LanesManager } from "./LanesManager";
import { MergeView } from "./MergeView";
import { useRealtimeStatus, LaneState } from "@/hooks/useRealtimeStatus";
import { ConnectionStatusIndicator } from "./ConnectionStatusIndicator";

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

// Launch All state
interface LaunchAllProgress {
  isLaunching: boolean;
  currentLane: string | null;
  launchedCount: number;
  totalToLaunch: number;
  results: Array<{
    laneId: string;
    success: boolean;
    error?: string;
  }>;
}

interface LaunchAllSummary {
  launched: number;
  blocked: number;
  failed: number;
}

export function RunDetailClient({
  lanes,
  slug,
  initialStates,
}: RunDetailClientProps) {
  // Use real-time status hook (WebSocket with polling fallback)
  const {
    laneStates,
    laneUncommitted,
    isRefreshing,
    updateLaneState,
    connectionStatus,
    usingWebSocket,
    reconnect,
  } = useRealtimeStatus({
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

  // Launch all lanes state
  const [launchAllProgress, setLaunchAllProgress] = useState<LaunchAllProgress>({
    isLaunching: false,
    currentLane: null,
    launchedCount: 0,
    totalToLaunch: 0,
    results: [],
  });
  const [launchAllSummary, setLaunchAllSummary] = useState<LaunchAllSummary | null>(null);
  const launchAllAbortRef = useRef(false);

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

  // Find lanes that are ready to launch (pending/in_progress with dependencies met)
  const getReadyLanes = useCallback(() => {
    const completedLaneIds = lanes
      .filter((lane) => laneStates[lane.laneId]?.status === "complete")
      .map((lane) => lane.laneId);

    return lanes.filter((lane) => {
      const state = laneStates[lane.laneId];
      const status = state?.status || "pending";
      // Lane must be pending or in_progress (not complete or failed)
      if (status === "complete" || status === "failed") return false;
      // All dependencies must be complete
      const dependenciesMet =
        lane.dependsOn.length === 0 ||
        lane.dependsOn.every((depId) => completedLaneIds.includes(depId));
      return dependenciesMet;
    });
  }, [lanes, laneStates]);

  // Launch all ready lanes sequentially with 2-second delay
  const handleLaunchAllReady = useCallback(async () => {
    const readyLanes = getReadyLanes();
    if (readyLanes.length === 0) return;

    launchAllAbortRef.current = false;
    setLaunchAllSummary(null);
    setLaunchAllProgress({
      isLaunching: true,
      currentLane: null,
      launchedCount: 0,
      totalToLaunch: readyLanes.length,
      results: [],
    });

    const results: Array<{ laneId: string; success: boolean; error?: string }> = [];
    let blockedCount = 0;

    for (let i = 0; i < readyLanes.length; i++) {
      if (launchAllAbortRef.current) break;

      const lane = readyLanes[i];

      setLaunchAllProgress((prev) => ({
        ...prev,
        currentLane: lane.laneId,
        launchedCount: i,
      }));

      try {
        const autonomy = laneStates[lane.laneId]?.autonomy;
        const skipPermissions = autonomy?.dangerouslySkipPermissions ?? false;

        const response = await fetch(`/api/runs/${slug}/launch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            laneId: lane.laneId,
            skipPermissions,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to launch");
        }

        const data = await response.json();

        // Copy packet content to clipboard
        if (data.packetContent) {
          try {
            await navigator.clipboard.writeText(data.packetContent);
          } catch {
            // Fallback method
            const textarea = document.createElement("textarea");
            textarea.value = data.packetContent;
            textarea.style.position = "fixed";
            textarea.style.opacity = "0";
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand("copy");
            document.body.removeChild(textarea);
          }
        }

        // Update lane status to in_progress
        updateLaneState(lane.laneId, "in_progress");

        results.push({ laneId: lane.laneId, success: true });
      } catch (error) {
        console.error(`Failed to launch ${lane.laneId}:`, error);
        results.push({
          laneId: lane.laneId,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }

      setLaunchAllProgress((prev) => ({
        ...prev,
        launchedCount: i + 1,
        results: [...results],
      }));

      // Wait 2 seconds before launching next lane (unless it's the last one)
      if (i < readyLanes.length - 1 && !launchAllAbortRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    // Calculate summary
    const launched = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    // Blocked lanes = total lanes - ready lanes
    blockedCount = lanes.length - readyLanes.length - progress.completed;

    setLaunchAllProgress((prev) => ({
      ...prev,
      isLaunching: false,
      currentLane: null,
    }));

    setLaunchAllSummary({
      launched,
      blocked: blockedCount,
      failed,
    });

    // Clear summary after 5 seconds
    setTimeout(() => setLaunchAllSummary(null), 5000);

    // Refresh merge view
    setMergeViewKey((prev) => prev + 1);
  }, [getReadyLanes, slug, laneStates, updateLaneState, lanes.length, progress.completed]);

  // Count of ready lanes for the button
  const readyLanesCount = useMemo(() => getReadyLanes().length, [getReadyLanes]);

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

            {/* Launch All Ready Button */}
            {launchAllProgress.isLaunching ? (
              <span className="flex items-center gap-2 text-sm font-mono" style={{ color: "var(--accent)" }}>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Launching {launchAllProgress.launchedCount + 1} of {launchAllProgress.totalToLaunch}...
              </span>
            ) : launchAllSummary ? (
              <span
                className="flex items-center gap-2 text-sm font-mono"
                style={{ color: launchAllSummary.failed > 0 ? "var(--status-warning)" : "var(--status-success)" }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Launched {launchAllSummary.launched} lane{launchAllSummary.launched !== 1 ? "s" : ""}
                {launchAllSummary.blocked > 0 && `, ${launchAllSummary.blocked} blocked`}
                {launchAllSummary.failed > 0 && `, ${launchAllSummary.failed} failed`}
              </span>
            ) : (
              <button
                onClick={handleLaunchAllReady}
                disabled={readyLanesCount === 0}
                className={`btn btn--primary btn--sm ${readyLanesCount === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
                title={
                  readyLanesCount === 0
                    ? "No lanes are ready to launch"
                    : `Launch ${readyLanesCount} ready lane${readyLanesCount !== 1 ? "s" : ""}`
                }
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Launch All Ready ({readyLanesCount})
              </button>
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

      {/* Connection status indicator */}
      <ConnectionStatusIndicator
        status={connectionStatus}
        usingWebSocket={usingWebSocket}
        onReconnect={reconnect}
      />
    </>
  );
}
