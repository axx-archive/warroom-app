"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { StatusJson, LaneStatus, LaneAutonomy } from "@/lib/plan-schema";
import { useWebSocket, ConnectionStatus } from "./useWebSocket";
import { LaneStatusChangeEvent, LaneActivityEvent } from "@/lib/websocket/types";

const POLL_INTERVAL_WEBSOCKET = 30000; // 30 seconds when WebSocket is connected
const POLL_INTERVAL_FALLBACK = 5000; // 5 seconds fallback when WebSocket is disconnected

export interface UncommittedFile {
  status: string; // e.g. "M", "A", "D", "??"
  path: string;
}

// Completion suggestion signals detected for a lane
export interface CompletionSuggestion {
  suggested: boolean;
  reason?: string; // e.g., "REVIEW.md exists", "Commit message contains 'complete'"
  signals: string[]; // List of all detected signals
  dismissed?: boolean; // True if user dismissed this suggestion
}

export interface LaneUncommittedStatus {
  uncommittedCount: number;
  uncommittedFiles: UncommittedFile[];
  worktreeExists: boolean;
  error?: string;
  // Commits tracking
  commitsSinceLaunch?: number;
  commitsAtLaunch?: number;
  currentCommits?: number;
  branch?: string;
  // Completion suggestion
  completionSuggestion?: CompletionSuggestion;
}

export interface LaneState {
  status: LaneStatus;
  staged: boolean;
  autonomy: LaneAutonomy;
}

export interface RealtimeState {
  status: StatusJson | null;
  laneStates: Record<string, LaneState>;
  laneUncommitted: Record<string, LaneUncommittedStatus>;
  isRefreshing: boolean;
  error: string | null;
  lastUpdated: Date | null;
  connectionStatus: ConnectionStatus;
  usingWebSocket: boolean;
}

interface UseRealtimeStatusOptions {
  slug: string;
  initialLaneStates: Record<string, LaneState>;
  enabled?: boolean;
  // Activity feed callbacks
  onLaneActivity?: (event: LaneActivityEvent) => void;
  onLaneStatusChange?: (event: LaneStatusChangeEvent) => void;
}

export function useRealtimeStatus({
  slug,
  initialLaneStates,
  enabled = true,
  onLaneActivity,
  onLaneStatusChange: onLaneStatusChangeCallback,
}: UseRealtimeStatusOptions) {
  const [state, setState] = useState<RealtimeState>({
    status: null,
    laneStates: initialLaneStates,
    laneUncommitted: {},
    isRefreshing: false,
    error: null,
    lastUpdated: null,
    connectionStatus: "disconnected",
    usingWebSocket: false,
  });

  const isVisible = useRef(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const fetchStatusRef = useRef<() => void>(() => {});

  // Store callbacks in refs to avoid stale closures
  const onLaneActivityRef = useRef(onLaneActivity);
  const onLaneStatusChangeCallbackRef = useRef(onLaneStatusChangeCallback);

  useEffect(() => {
    onLaneActivityRef.current = onLaneActivity;
    onLaneStatusChangeCallbackRef.current = onLaneStatusChangeCallback;
  }, [onLaneActivity, onLaneStatusChangeCallback]);

  // Handle lane status change events from WebSocket
  const handleLaneStatusChange = useCallback((event: LaneStatusChangeEvent) => {
    setState((prev) => ({
      ...prev,
      laneStates: {
        ...prev.laneStates,
        [event.laneId]: {
          ...prev.laneStates[event.laneId],
          status: event.newStatus,
        },
      },
      lastUpdated: new Date(),
    }));
    // Forward event to activity feed callback
    if (onLaneStatusChangeCallbackRef.current) {
      onLaneStatusChangeCallbackRef.current(event);
    }
  }, []);

  // Handle lane activity events from WebSocket
  const handleLaneActivity = useCallback((event: LaneActivityEvent) => {
    // Forward event to activity feed callback
    if (onLaneActivityRef.current) {
      onLaneActivityRef.current(event);
    }
    // On activity, do a full refresh to get uncommitted files etc.
    fetchStatusRef.current();
  }, []);

  // WebSocket connection
  const { connectionStatus, isConnected, reconnect } = useWebSocket({
    runSlug: slug,
    enabled,
    onLaneStatusChange: handleLaneStatusChange,
    onLaneActivity: handleLaneActivity,
  });

  // Update connection status in state
  useEffect(() => {
    setState((prev) => ({
      ...prev,
      connectionStatus,
      usingWebSocket: isConnected,
    }));
  }, [connectionStatus, isConnected]);

  const fetchStatus = useCallback(async () => {
    setState((prev) => ({ ...prev, isRefreshing: true }));

    try {
      // Fetch both status and uncommitted data in parallel
      const [statusResponse, uncommittedResponse] = await Promise.all([
        fetch(`/api/runs/${slug}/status`),
        fetch(`/api/runs/${slug}/lane-status`),
      ]);

      const statusData = await statusResponse.json();
      const uncommittedData = await uncommittedResponse.json();

      if (!statusResponse.ok) {
        throw new Error(statusData.error || "Failed to fetch status");
      }

      const status: StatusJson = statusData.status;

      // Convert status.json lanes to LaneState format
      const newLaneStates: Record<string, LaneState> = {};
      const defaultAutonomy: LaneAutonomy = { dangerouslySkipPermissions: false };

      // Start with initial states as base
      for (const [laneId, laneState] of Object.entries(initialLaneStates)) {
        newLaneStates[laneId] = { ...laneState };
      }

      // Update with data from status.json
      if (status.lanes) {
        for (const [laneId, laneEntry] of Object.entries(status.lanes)) {
          newLaneStates[laneId] = {
            status: laneEntry.status,
            staged: laneEntry.staged,
            autonomy: laneEntry.autonomy ?? defaultAutonomy,
          };
        }
      }

      // Also check lanesCompleted for backwards compatibility
      if (status.lanesCompleted) {
        for (const laneId of status.lanesCompleted) {
          if (newLaneStates[laneId]) {
            newLaneStates[laneId].status = "complete";
          }
        }
      }

      // Process uncommitted data (including commits info and completion suggestions)
      const newLaneUncommitted: Record<string, LaneUncommittedStatus> = {};
      if (uncommittedResponse.ok && uncommittedData.success && uncommittedData.lanes) {
        for (const [laneId, laneData] of Object.entries(uncommittedData.lanes)) {
          const data = laneData as {
            uncommittedCount: number;
            uncommittedFiles: UncommittedFile[];
            worktreeExists: boolean;
            error?: string;
            commitsSinceLaunch?: number;
            commitsAtLaunch?: number;
            currentCommits?: number;
            branch?: string;
            completionSuggestion?: CompletionSuggestion;
          };
          newLaneUncommitted[laneId] = {
            uncommittedCount: data.uncommittedCount,
            uncommittedFiles: data.uncommittedFiles,
            worktreeExists: data.worktreeExists,
            error: data.error,
            commitsSinceLaunch: data.commitsSinceLaunch,
            commitsAtLaunch: data.commitsAtLaunch,
            currentCommits: data.currentCommits,
            branch: data.branch,
            completionSuggestion: data.completionSuggestion,
          };
        }
      }

      setState((prev) => ({
        ...prev,
        status,
        laneStates: newLaneStates,
        laneUncommitted: newLaneUncommitted,
        isRefreshing: false,
        error: null,
        lastUpdated: new Date(),
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isRefreshing: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }));
    }
  }, [slug, initialLaneStates]);

  // Keep fetchStatusRef in sync with fetchStatus
  useEffect(() => {
    fetchStatusRef.current = fetchStatus;
  }, [fetchStatus]);

  // Determine poll interval based on WebSocket connection
  const getPollInterval = useCallback(() => {
    return isConnected ? POLL_INTERVAL_WEBSOCKET : POLL_INTERVAL_FALLBACK;
  }, [isConnected]);

  // Define startPolling and stopPolling
  const startPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    intervalRef.current = setInterval(() => {
      if (isVisible.current) {
        fetchStatus();
      }
    }, getPollInterval());
  }, [fetchStatus, getPollInterval]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Restart polling when connection status changes (to adjust interval)
  useEffect(() => {
    if (enabled && isVisible.current) {
      startPolling();
    }
    return () => {
      stopPolling();
    };
  }, [enabled, isConnected, startPolling, stopPolling]);

  // Handle visibility change - pause polling when tab is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisible.current = document.visibilityState === "visible";

      if (isVisible.current && enabled) {
        // Resume polling - fetch immediately when tab becomes visible
        fetchStatus();
        startPolling();
      } else {
        // Pause polling when tab is hidden
        stopPolling();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, fetchStatus, startPolling, stopPolling]);

  // Initial fetch on mount
  useEffect(() => {
    if (enabled && isVisible.current) {
      fetchStatus();
    }
  }, [enabled, fetchStatus]);

  // Manual refresh function
  const refresh = useCallback(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Update a single lane state locally (for optimistic updates)
  const updateLaneState = useCallback((laneId: string, newStatus: LaneStatus) => {
    setState((prev) => ({
      ...prev,
      laneStates: {
        ...prev.laneStates,
        [laneId]: {
          ...prev.laneStates[laneId],
          status: newStatus,
        },
      },
    }));
  }, []);

  return {
    ...state,
    refresh,
    updateLaneState,
    reconnect,
  };
}
