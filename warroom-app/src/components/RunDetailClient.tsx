"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Lane, LaneStatus, MergeProposal } from "@/lib/plan-schema";
import { LanesManager } from "./LanesManager";
import { MergeView, MergeViewHandle } from "./MergeView";
import { useRealtimeStatus, LaneState } from "@/hooks/useRealtimeStatus";
import { ConnectionStatusIndicator } from "./ConnectionStatusIndicator";
import { DiffPreviewModal } from "./DiffPreviewModal";
import { ActivityFeed } from "./ActivityFeed";
import { useActivityFeed } from "@/hooks/useActivityFeed";
import { MissionPhase, MissionProgressEvent, MergeProgressEvent, LaneStatusChangeEvent } from "@/lib/websocket/types";
import { useWebSocket } from "@/hooks/useWebSocket";
import { AddLaneModal } from "./AddLaneModal";
import { HistoryTab } from "./HistoryTab";
import { TimelineView } from "./TimelineView";
import { useNotifications } from "@/hooks/useNotifications";
import { ToastNotifications } from "./ToastNotifications";
import { NotificationCenter } from "./NotificationCenter";

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

// Notification types for auto-merge proposal
interface MergeNotification {
  type: "success" | "warning" | "error";
  message: string;
  details?: string;
}

// Mission state for one-click Start Mission
interface MissionState {
  isRunning: boolean;
  phase: MissionPhase | null;
  message: string;
  overallProgress: number;
  lanesLaunched: number;
  lanesRunning: number;
  lanesComplete: number;
  lanesFailed: number;
  lanesMerged: number;
  totalLanes: number;
}

// Notification for mission events
interface MissionNotification {
  type: "success" | "warning" | "error" | "info";
  message: string;
  details?: string;
}

// Format cost for display
function formatCost(cost: number): string {
  if (cost === 0) {
    return "$0.00";
  } else if (cost < 0.001) {
    return "<$0.001";
  } else if (cost < 0.01) {
    return `$${cost.toFixed(3)}`;
  } else if (cost < 1) {
    return `$${cost.toFixed(2)}`;
  } else {
    return `$${cost.toFixed(2)}`;
  }
}

export function RunDetailClient({
  lanes,
  slug,
  initialStates,
}: RunDetailClientProps) {
  // Notifications system
  const {
    notifications,
    toasts,
    unreadCount,
    preferences: notificationPreferences,
    addNotification,
    dismissToast,
    markAsRead,
    markAllAsRead,
    clearAll: clearAllNotifications,
    updatePreferences: updateNotificationPreferences,
    requestBrowserPermission,
    browserNotificationsSupported,
    browserPermissionStatus,
    notifyLaneComplete,
    notifyLaneFailed,
    notifyAllLanesComplete,
    notifyMergeConflict,
  } = useNotifications({ runSlug: slug });

  // Activity feed state
  const {
    events: activityEvents,
    filter: activityFilter,
    setFilter: setActivityFilter,
    addLaneActivityEvent,
    addStatusChangeEvent,
    laneIds: activityLaneIds,
    eventCount: activityEventCount,
  } = useActivityFeed();

  // Handle lane status change - trigger notifications and forward to activity feed
  const handleLaneStatusChange = useCallback((event: LaneStatusChangeEvent) => {
    // Forward to activity feed
    addStatusChangeEvent(event);

    // Trigger notifications based on new status
    if (event.newStatus === "complete" && event.previousStatus !== "complete") {
      notifyLaneComplete(event.laneId);
    } else if (event.newStatus === "failed" && event.previousStatus !== "failed") {
      notifyLaneFailed(event.laneId);
    }
  }, [addStatusChangeEvent, notifyLaneComplete, notifyLaneFailed]);

  // Use real-time status hook (WebSocket with polling fallback)
  const {
    laneStates,
    laneUncommitted,
    totalCostUsd,
    isRefreshing,
    updateLaneState,
    connectionStatus,
    usingWebSocket,
    reconnect,
  } = useRealtimeStatus({
    slug,
    initialLaneStates: initialStates,
    enabled: true,
    onLaneActivity: addLaneActivityEvent,
    onLaneStatusChange: handleLaneStatusChange,
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

  // Auto-merge proposal state
  const [mergeNotification, setMergeNotification] = useState<MergeNotification | null>(null);
  const [isAutoGeneratingProposal, setIsAutoGeneratingProposal] = useState(false);
  const mergeViewRef = useRef<MergeViewHandle>(null);
  const mergeSectionRef = useRef<HTMLDivElement>(null);
  const hasAutoGeneratedProposalRef = useRef(false); // Prevent duplicate auto-generation
  const prevAllCompleteRef = useRef(false); // Track previous all-complete state

  // Diff preview modal state
  const [previewLaneId, setPreviewLaneId] = useState<string | null>(null);

  // Add lane modal state
  const [showAddLaneModal, setShowAddLaneModal] = useState(false);
  // Local lanes state - allows adding lanes without page reload
  const [currentLanes, setCurrentLanes] = useState<Lane[]>(lanes);

  // Mission state for one-click Start Mission
  const [missionState, setMissionState] = useState<MissionState>({
    isRunning: false,
    phase: null,
    message: "",
    overallProgress: 0,
    lanesLaunched: 0,
    lanesRunning: 0,
    lanesComplete: 0,
    lanesFailed: 0,
    lanesMerged: 0,
    totalLanes: currentLanes.length,
  });
  const [missionNotification, setMissionNotification] = useState<MissionNotification | null>(null);
  const [isStartingMission, setIsStartingMission] = useState(false);
  const [isStoppingMission, setIsStoppingMission] = useState(false);

  // Handle mission progress events from WebSocket
  const handleMissionProgress = useCallback((event: MissionProgressEvent) => {
    setMissionState({
      isRunning: event.phase !== "complete" && event.phase !== "failed" && event.phase !== "stopped",
      phase: event.phase,
      message: event.message,
      overallProgress: event.overallProgress,
      lanesLaunched: event.lanesLaunched,
      lanesRunning: event.lanesRunning,
      lanesComplete: event.lanesComplete,
      lanesFailed: event.lanesFailed,
      lanesMerged: event.lanesMerged,
      totalLanes: event.totalLanes,
    });

    // Show notification for final states (using both old and new notification systems)
    if (event.phase === "complete") {
      setMissionNotification({
        type: "success",
        message: "Mission complete!",
        details: event.message,
      });
      addNotification("success", "Mission complete!", {
        message: event.message,
        eventType: "mission_complete",
      });
    } else if (event.phase === "failed") {
      setMissionNotification({
        type: "error",
        message: "Mission failed",
        details: event.message,
      });
      addNotification("error", "Mission failed", {
        message: event.message,
        eventType: "mission_failed",
        duration: 0, // Don't auto-dismiss errors
      });
    } else if (event.phase === "stopped") {
      setMissionNotification({
        type: "warning",
        message: "Mission stopped",
        details: "Mission was stopped by user",
      });
    }
  }, [addNotification]);

  // Handle merge progress events from WebSocket
  const handleMergeProgress = useCallback((event: MergeProgressEvent) => {
    // Notify on merge conflict
    if (event.status === "conflict" && event.conflictInfo) {
      notifyMergeConflict(
        event.conflictInfo.laneId,
        event.conflictInfo.conflictingFiles
      );
    }
  }, [notifyMergeConflict]);

  // WebSocket for mission and merge progress events
  useWebSocket({
    runSlug: slug,
    enabled: true,
    onMissionProgress: handleMissionProgress,
    onMergeProgress: handleMergeProgress,
  });

  // Fetch mission status on mount to check if mission is already running
  useEffect(() => {
    const fetchMissionStatus = async () => {
      try {
        const response = await fetch(`/api/runs/${slug}/start-mission`);
        if (response.ok) {
          const data = await response.json();
          if (data.isRunning) {
            setMissionState((prev) => ({
              ...prev,
              isRunning: true,
              phase: data.status as MissionPhase || "running",
              message: `Mission ${data.status}`,
            }));
          }
        }
      } catch (error) {
        console.error("Failed to fetch mission status:", error);
      }
    };
    fetchMissionStatus();
  }, [slug]);

  // Start mission handler
  const handleStartMission = useCallback(async () => {
    setIsStartingMission(true);
    setMissionNotification(null);

    try {
      const response = await fetch(`/api/runs/${slug}/start-mission`, {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to start mission");
      }

      setMissionState((prev) => ({
        ...prev,
        isRunning: true,
        phase: "launching",
        message: "Launching lanes...",
        totalLanes: currentLanes.length,
      }));

      setMissionNotification({
        type: "info",
        message: "Mission started",
        details: "Launching all lanes in dependency order...",
      });
    } catch (error) {
      console.error("Start mission error:", error);
      setMissionNotification({
        type: "error",
        message: "Failed to start mission",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsStartingMission(false);
    }
  }, [slug, currentLanes.length]);

  // Stop mission handler
  const handleStopMission = useCallback(async () => {
    setIsStoppingMission(true);

    try {
      const response = await fetch(`/api/runs/${slug}/start-mission`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to stop mission");
      }

      setMissionState((prev) => ({
        ...prev,
        isRunning: false,
        phase: "stopped",
        message: "Mission stopped",
      }));
    } catch (error) {
      console.error("Stop mission error:", error);
      setMissionNotification({
        type: "error",
        message: "Failed to stop mission",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsStoppingMission(false);
    }
  }, [slug]);

  // Clear mission notification after 10 seconds (for success/info notifications only)
  useEffect(() => {
    if (missionNotification && (missionNotification.type === "success" || missionNotification.type === "info")) {
      const timeout = setTimeout(() => {
        setMissionNotification(null);
      }, 10000);
      return () => clearTimeout(timeout);
    }
  }, [missionNotification]);

  // Handle lane added - add to local state and update lane states
  const handleLaneAdded = useCallback((newLane: Lane) => {
    setCurrentLanes((prev) => [...prev, newLane]);
    // Add default state for the new lane
    updateLaneState(newLane.laneId, "pending");
  }, [updateLaneState]);

  // Auto-generate merge proposal when all lanes become complete
  useEffect(() => {
    const allComplete = currentLanes.length > 0 && currentLanes.every(
      (lane) => laneStates[lane.laneId]?.status === "complete"
    );

    // Only trigger when transitioning from not-all-complete to all-complete
    // and we haven't already auto-generated a proposal
    if (allComplete && !prevAllCompleteRef.current && !hasAutoGeneratedProposalRef.current) {
      hasAutoGeneratedProposalRef.current = true;

      // Trigger "all lanes complete" notification
      notifyAllLanesComplete();

      // Auto-generate merge proposal
      const generateProposal = async () => {
        setIsAutoGeneratingProposal(true);
        setMergeNotification(null);

        try {
          const response = await fetch(`/api/runs/${slug}/merge-proposal`, {
            method: "POST",
          });
          const data = await response.json();

          if (!response.ok || !data.success) {
            throw new Error(data.error || "Failed to generate merge proposal");
          }

          const proposal: MergeProposal = data.proposal;

          // Check for conflicts in the proposal
          const hasHighConflict = proposal.mergeOrder.some(
            (lane) => lane.conflictRisk === "high" || lane.conflictRisk === "medium"
          );
          const conflictWarnings = proposal.warnings.filter(
            (w) => w.toLowerCase().includes("conflict")
          );

          if (hasHighConflict || conflictWarnings.length > 0) {
            // Show warning notification for conflicts - stop auto-progression
            setMergeNotification({
              type: "warning",
              message: "All lanes complete. Merge proposal generated with conflict warnings.",
              details: conflictWarnings.length > 0
                ? conflictWarnings[0]
                : "Some lanes have potential merge conflicts. Review carefully before proceeding.",
            });
          } else {
            // Success notification
            setMergeNotification({
              type: "success",
              message: "All lanes complete. Merge proposal generated.",
            });
          }

          // Refresh merge view to show the new proposal
          setMergeViewKey((prev) => prev + 1);

          // Tell MergeView to refresh its data
          if (mergeViewRef.current) {
            mergeViewRef.current.refreshProposal();
          }

          // Auto-scroll to merge readiness section
          setTimeout(() => {
            if (mergeSectionRef.current) {
              mergeSectionRef.current.scrollIntoView({
                behavior: "smooth",
                block: "start"
              });
            }
          }, 100);

        } catch (error) {
          console.error("Auto-generate proposal error:", error);
          setMergeNotification({
            type: "error",
            message: "Failed to auto-generate merge proposal",
            details: error instanceof Error ? error.message : "Unknown error",
          });
        } finally {
          setIsAutoGeneratingProposal(false);
        }
      };

      generateProposal();
    }

    prevAllCompleteRef.current = allComplete;
  }, [currentLanes, laneStates, slug, notifyAllLanesComplete]);

  // Clear merge notification after 10 seconds (for success notifications only)
  useEffect(() => {
    if (mergeNotification?.type === "success") {
      const timeout = setTimeout(() => {
        setMergeNotification(null);
      }, 10000);
      return () => clearTimeout(timeout);
    }
  }, [mergeNotification]);

  // Calculate progress
  const progress = useMemo(() => {
    const total = currentLanes.length;
    const completed = currentLanes.filter(
      (lane) => laneStates[lane.laneId]?.status === "complete"
    ).length;
    return { completed, total };
  }, [currentLanes, laneStates]);

  const handleStatusChange = useCallback((laneId: string, newStatus: LaneStatus) => {
    // Update local state optimistically for immediate UI feedback
    updateLaneState(laneId, newStatus);
    // Increment key to force MergeView to refetch data
    setMergeViewKey((prev) => prev + 1);
  }, [updateLaneState]);

  // Open diff preview modal for a lane
  const handlePreviewChanges = useCallback((laneId: string) => {
    setPreviewLaneId(laneId);
  }, []);

  // Close diff preview modal
  const handleClosePreview = useCallback(() => {
    setPreviewLaneId(null);
  }, []);

  // Approve and mark lane complete from diff preview modal
  const handleApproveAndComplete = useCallback(async () => {
    if (!previewLaneId) return;

    // Mark the lane as complete
    const response = await fetch(`/api/runs/${slug}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        laneId: previewLaneId,
        laneStatus: "complete",
      }),
    });

    if (response.ok) {
      // Update local state
      updateLaneState(previewLaneId, "complete");
      setMergeViewKey((prev) => prev + 1);
    } else {
      console.error("Failed to mark lane as complete");
      throw new Error("Failed to mark lane as complete");
    }
  }, [previewLaneId, slug, updateLaneState]);

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
    const completedLaneIds = currentLanes
      .filter((lane) => laneStates[lane.laneId]?.status === "complete")
      .map((lane) => lane.laneId);

    return currentLanes.filter((lane) => {
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
  }, [currentLanes, laneStates]);

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
    blockedCount = currentLanes.length - readyLanes.length - progress.completed;

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
  }, [getReadyLanes, slug, laneStates, updateLaneState, currentLanes.length, progress.completed]);

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
            {/* Notification Center */}
            <NotificationCenter
              notifications={notifications}
              unreadCount={unreadCount}
              preferences={notificationPreferences}
              onMarkAsRead={markAsRead}
              onMarkAllAsRead={markAllAsRead}
              onClearAll={clearAllNotifications}
              onUpdatePreferences={updateNotificationPreferences}
              onRequestBrowserPermission={requestBrowserPermission}
              browserNotificationsSupported={browserNotificationsSupported}
              browserPermissionStatus={browserPermissionStatus}
            />

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

            {/* Start Mission Button - Primary autonomous control */}
            {missionState.isRunning ? (
              <button
                onClick={handleStopMission}
                disabled={isStoppingMission}
                className="btn btn--danger btn--sm"
                title="Stop the running mission"
              >
                {isStoppingMission ? (
                  <>
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Stopping...
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Stop Mission
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleStartMission}
                disabled={isStartingMission || progress.completed === progress.total}
                className={`btn btn--primary btn--sm ${
                  (isStartingMission || progress.completed === progress.total) ? "opacity-50 cursor-not-allowed" : ""
                }`}
                title={
                  progress.completed === progress.total
                    ? "All lanes are already complete"
                    : "Start the mission - launches all lanes autonomously"
                }
              >
                {isStartingMission ? (
                  <>
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Starting...
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Start Mission
                  </>
                )}
              </button>
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

            {/* Add Lane Button */}
            <button
              onClick={() => setShowAddLaneModal(true)}
              className="btn btn--sm btn--secondary"
              title="Add a new lane to this run"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Lane
            </button>

            {/* Total run cost */}
            {totalCostUsd > 0 && (
              <span
                className="badge flex items-center gap-1.5"
                style={{
                  backgroundColor: "rgba(168, 85, 247, 0.15)",
                  color: "#a855f7",
                  borderColor: "rgba(168, 85, 247, 0.4)",
                }}
                title={`Estimated total API cost for this run`}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Total: {formatCost(totalCostUsd)}
              </span>
            )}

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

        {/* Mission Progress Display */}
        {missionState.isRunning && (
          <div className="mb-5 p-4 rounded border border-[rgba(6,182,212,0.3)] bg-[rgba(6,182,212,0.08)]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-[var(--cyan)] animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="font-medium text-[var(--cyan)]">
                  {missionState.phase === "launching" ? "Phase 1/4: Launching lanes..." :
                   missionState.phase === "running" ? "Phase 2/4: Lanes executing..." :
                   missionState.phase === "committing" ? "Phase 3/4: Committing work..." :
                   missionState.phase === "merging" ? "Phase 4/4: Merging lanes..." :
                   "Mission in progress..."}
                </span>
              </div>
              <span className="text-sm font-mono text-[var(--cyan)]">
                {missionState.overallProgress}%
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full h-2 bg-[rgba(0,0,0,0.3)] rounded overflow-hidden mb-3">
              <div
                className="h-full bg-[var(--cyan)] transition-all duration-500 ease-out"
                style={{ width: `${missionState.overallProgress}%` }}
              />
            </div>
            {/* Status counts */}
            <div className="flex items-center gap-4 text-sm font-mono">
              <span className="text-[var(--text-secondary)]">
                <span className="text-[var(--cyan)]">{missionState.lanesLaunched}</span> launched
              </span>
              <span className="text-[var(--text-secondary)]">
                <span className="text-[var(--status-info)]">{missionState.lanesRunning}</span> running
              </span>
              <span className="text-[var(--text-secondary)]">
                <span className="text-[var(--status-success)]">{missionState.lanesComplete}</span> complete
              </span>
              {missionState.lanesFailed > 0 && (
                <span className="text-[var(--text-secondary)]">
                  <span className="text-[var(--status-danger)]">{missionState.lanesFailed}</span> failed
                </span>
              )}
              {missionState.phase === "merging" && (
                <span className="text-[var(--text-secondary)]">
                  <span className="text-[var(--status-success)]">{missionState.lanesMerged}</span> merged
                </span>
              )}
            </div>
            {missionState.message && (
              <div className="mt-2 text-sm text-[var(--text-ghost)]">
                {missionState.message}
              </div>
            )}
          </div>
        )}

        {/* Mission Notification */}
        {missionNotification && (
          <div
            className={`mb-5 p-4 rounded border ${
              missionNotification.type === "success"
                ? "border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.08)]"
                : missionNotification.type === "warning"
                ? "border-[rgba(234,179,8,0.3)] bg-[rgba(234,179,8,0.08)]"
                : missionNotification.type === "error"
                ? "border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)]"
                : "border-[rgba(6,182,212,0.3)] bg-[rgba(6,182,212,0.08)]"
            }`}
          >
            <div className="flex items-start gap-3">
              {missionNotification.type === "success" ? (
                <svg className="w-5 h-5 text-[var(--status-success)] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : missionNotification.type === "warning" ? (
                <svg className="w-5 h-5 text-[var(--status-warning)] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              ) : missionNotification.type === "error" ? (
                <svg className="w-5 h-5 text-[var(--status-danger)] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-[var(--cyan)] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <div className="flex-1">
                <div
                  className={`font-medium ${
                    missionNotification.type === "success"
                      ? "text-[var(--status-success)]"
                      : missionNotification.type === "warning"
                      ? "text-[var(--status-warning)]"
                      : missionNotification.type === "error"
                      ? "text-[var(--status-danger)]"
                      : "text-[var(--cyan)]"
                  }`}
                >
                  {missionNotification.message}
                </div>
                {missionNotification.details && (
                  <div className="text-sm text-[var(--text-secondary)] mt-1">
                    {missionNotification.details}
                  </div>
                )}
              </div>
              <button
                onClick={() => setMissionNotification(null)}
                className="btn-ghost p-1 text-[var(--text-ghost)] hover:text-[var(--text-secondary)]"
                title="Dismiss"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        <LanesManager
          lanes={currentLanes}
          slug={slug}
          laneStates={laneStates}
          laneUncommitted={laneUncommitted}
          onStatusChange={handleStatusChange}
          onPreviewChanges={handlePreviewChanges}
        />
      </div>

      {/* Activity Feed */}
      <ActivityFeed
        events={activityEvents}
        laneIds={activityLaneIds}
        filter={activityFilter}
        onFilterChange={setActivityFilter}
        eventCount={activityEventCount}
      />

      {/* History Tab */}
      <HistoryTab slug={slug} laneIds={activityLaneIds} />

      {/* Progress Timeline View */}
      <TimelineView slug={slug} lanes={currentLanes} laneStates={laneStates} />

      {/* Auto-merge proposal notification */}
      {mergeNotification && (
        <div
          className={`p-4 rounded border mb-4 ${
            mergeNotification.type === "success"
              ? "border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.08)]"
              : mergeNotification.type === "warning"
              ? "border-[rgba(234,179,8,0.3)] bg-[rgba(234,179,8,0.08)]"
              : "border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)]"
          }`}
        >
          <div className="flex items-start gap-3">
            {/* Icon */}
            {mergeNotification.type === "success" ? (
              <svg className="w-5 h-5 text-[var(--status-success)] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : mergeNotification.type === "warning" ? (
              <svg className="w-5 h-5 text-[var(--status-warning)] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-[var(--status-danger)] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <div className="flex-1">
              <div
                className={`font-medium ${
                  mergeNotification.type === "success"
                    ? "text-[var(--status-success)]"
                    : mergeNotification.type === "warning"
                    ? "text-[var(--status-warning)]"
                    : "text-[var(--status-danger)]"
                }`}
              >
                {mergeNotification.message}
              </div>
              {mergeNotification.details && (
                <div className="text-sm text-[var(--text-secondary)] mt-1">
                  {mergeNotification.details}
                </div>
              )}
            </div>
            {/* Dismiss button */}
            <button
              onClick={() => setMergeNotification(null)}
              className="btn-ghost p-1 text-[var(--text-ghost)] hover:text-[var(--text-secondary)]"
              title="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Auto-generating indicator */}
      {isAutoGeneratingProposal && (
        <div className="p-4 rounded border border-[rgba(6,182,212,0.3)] bg-[rgba(6,182,212,0.08)] mb-4">
          <div className="flex items-center gap-3 text-[var(--cyan)]">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="font-medium">All lanes complete. Generating merge proposal...</span>
          </div>
        </div>
      )}

      {/* Merge Readiness - key forces refresh on status change */}
      <div ref={mergeSectionRef}>
        <MergeView key={mergeViewKey} ref={mergeViewRef} slug={slug} />
      </div>

      {/* Connection status indicator */}
      <ConnectionStatusIndicator
        status={connectionStatus}
        usingWebSocket={usingWebSocket}
        onReconnect={reconnect}
      />

      {/* Diff preview modal */}
      {previewLaneId && (
        <DiffPreviewModal
          slug={slug}
          laneId={previewLaneId}
          onClose={handleClosePreview}
          onApproveAndComplete={handleApproveAndComplete}
        />
      )}

      {/* Add lane modal */}
      {showAddLaneModal && (
        <AddLaneModal
          slug={slug}
          existingLanes={currentLanes}
          onClose={() => setShowAddLaneModal(false)}
          onLaneAdded={handleLaneAdded}
        />
      )}

      {/* Toast notifications */}
      <ToastNotifications toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
