"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { StatusJson, LaneStatus, LaneAutonomy, LaunchMode, LaneAgentStatus, RetryState, PushState } from "@/lib/plan-schema";

const POLL_INTERVAL = 5000; // 5 seconds

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
  // Launch mode preference
  launchMode?: LaunchMode;
  // Agent progress from LANE_STATUS.json
  agentStatus?: LaneAgentStatus;
  // Retry state for failed lanes
  retryState?: RetryState;
  // Push state for the lane branch
  pushState?: PushState;
}

export interface LaneState {
  status: LaneStatus;
  staged: boolean;
  autonomy: LaneAutonomy;
}

export interface PollingState {
  status: StatusJson | null;
  laneStates: Record<string, LaneState>;
  laneUncommitted: Record<string, LaneUncommittedStatus>;
  isRefreshing: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

interface UseStatusPollingOptions {
  slug: string;
  initialLaneStates: Record<string, LaneState>;
  enabled?: boolean;
}

export function useStatusPolling({
  slug,
  initialLaneStates,
  enabled = true,
}: UseStatusPollingOptions) {
  const [state, setState] = useState<PollingState>({
    status: null,
    laneStates: initialLaneStates,
    laneUncommitted: {},
    isRefreshing: false,
    error: null,
    lastUpdated: null,
  });

  const isVisible = useRef(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

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

      // Process uncommitted data (including commits info, completion suggestions, and agent status)
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
            launchMode?: LaunchMode;
            agentStatus?: LaneAgentStatus;
            retryState?: RetryState;
            pushState?: PushState;
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
            launchMode: data.launchMode,
            agentStatus: data.agentStatus,
            retryState: data.retryState,
            pushState: data.pushState,
          };
        }
      }

      setState({
        status,
        laneStates: newLaneStates,
        laneUncommitted: newLaneUncommitted,
        isRefreshing: false,
        error: null,
        lastUpdated: new Date(),
      });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isRefreshing: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }));
    }
  }, [slug, initialLaneStates]);

  // Define startPolling and stopPolling before they are used
  const startPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    intervalRef.current = setInterval(() => {
      if (isVisible.current) {
        fetchStatus();
      }
    }, POLL_INTERVAL);
  }, [fetchStatus]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

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

  // Start polling on mount, cleanup on unmount
  useEffect(() => {
    if (enabled && isVisible.current) {
      // Initial fetch
      fetchStatus();
      startPolling();
    }

    return () => {
      stopPolling();
    };
  }, [enabled, fetchStatus, startPolling, stopPolling]);

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
  };
}
