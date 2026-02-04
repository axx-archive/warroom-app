"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { StatusJson, LaneStatus, LaneAutonomy } from "@/lib/plan-schema";

const POLL_INTERVAL = 5000; // 5 seconds

export interface LaneState {
  status: LaneStatus;
  staged: boolean;
  autonomy: LaneAutonomy;
}

export interface PollingState {
  status: StatusJson | null;
  laneStates: Record<string, LaneState>;
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
    isRefreshing: false,
    error: null,
    lastUpdated: null,
  });

  const isVisible = useRef(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchStatus = useCallback(async () => {
    setState((prev) => ({ ...prev, isRefreshing: true }));

    try {
      const response = await fetch(`/api/runs/${slug}/status`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch status");
      }

      const statusData: StatusJson = data.status;

      // Convert status.json lanes to LaneState format
      const newLaneStates: Record<string, LaneState> = {};
      const defaultAutonomy: LaneAutonomy = { dangerouslySkipPermissions: false };

      // Start with initial states as base
      for (const [laneId, laneState] of Object.entries(initialLaneStates)) {
        newLaneStates[laneId] = { ...laneState };
      }

      // Update with data from status.json
      if (statusData.lanes) {
        for (const [laneId, laneEntry] of Object.entries(statusData.lanes)) {
          newLaneStates[laneId] = {
            status: laneEntry.status,
            staged: laneEntry.staged,
            autonomy: laneEntry.autonomy ?? defaultAutonomy,
          };
        }
      }

      // Also check lanesCompleted for backwards compatibility
      if (statusData.lanesCompleted) {
        for (const laneId of statusData.lanesCompleted) {
          if (newLaneStates[laneId]) {
            newLaneStates[laneId].status = "complete";
          }
        }
      }

      setState({
        status: statusData,
        laneStates: newLaneStates,
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
