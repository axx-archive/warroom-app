"use client";

import { useState, useCallback } from "react";
import { Lane, LaneStatus, LaneAutonomy } from "@/lib/plan-schema";
import { LaneStatusCard } from "./LaneStatusCard";

interface LaneState {
  status: LaneStatus;
  staged: boolean;
  autonomy: LaneAutonomy;
}

interface LanesManagerProps {
  lanes: Lane[];
  slug: string;
  initialStates: Record<string, LaneState>;
  onStatusChange?: (laneId: string, newStatus: LaneStatus) => void; // Callback when any lane status changes
}

export function LanesManager({
  lanes,
  slug,
  initialStates,
  onStatusChange,
}: LanesManagerProps) {
  const [laneStates, setLaneStates] = useState<Record<string, LaneState>>(initialStates);

  // Get list of completed lane IDs
  const completedLanes = lanes
    .filter((lane) => laneStates[lane.laneId]?.status === "complete")
    .map((lane) => lane.laneId);

  // Handle status change from a lane card
  const handleStatusChange = useCallback((laneId: string, newStatus: LaneStatus) => {
    setLaneStates((prev) => ({
      ...prev,
      [laneId]: {
        ...prev[laneId],
        status: newStatus,
      },
    }));
    // Notify parent to refresh merge readiness, etc.
    onStatusChange?.(laneId, newStatus);
  }, [onStatusChange]);

  return (
    <div className="space-y-3">
      {lanes.map((lane) => {
        const state = laneStates[lane.laneId] || {
          status: "pending" as LaneStatus,
          staged: false,
          autonomy: { dangerouslySkipPermissions: false },
        };
        return (
          <LaneStatusCard
            key={lane.laneId}
            lane={lane}
            slug={slug}
            initialStatus={state.status}
            initialStaged={state.staged}
            initialAutonomy={state.autonomy}
            completedLanes={completedLanes}
            onStatusChange={handleStatusChange}
          />
        );
      })}
    </div>
  );
}
