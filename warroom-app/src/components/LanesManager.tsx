"use client";

import { useCallback } from "react";
import { Lane, LaneStatus, LaneAutonomy } from "@/lib/plan-schema";
import { LaneStatusCard } from "./LaneStatusCard";
import { LaneUncommittedStatus } from "@/hooks/useStatusPolling";

interface LaneState {
  status: LaneStatus;
  staged: boolean;
  autonomy: LaneAutonomy;
}

interface LanesManagerProps {
  lanes: Lane[];
  slug: string;
  laneStates: Record<string, LaneState>; // Controlled state from parent (polling)
  laneUncommitted?: Record<string, LaneUncommittedStatus>; // Uncommitted file data from polling
  onStatusChange?: (laneId: string, newStatus: LaneStatus) => void;
  onPreviewChanges?: (laneId: string) => void; // Callback to open diff preview modal
}

export function LanesManager({
  lanes,
  slug,
  laneStates,
  laneUncommitted = {},
  onStatusChange,
  onPreviewChanges,
}: LanesManagerProps) {
  // Get list of completed lane IDs
  const completedLanes = lanes
    .filter((lane) => laneStates[lane.laneId]?.status === "complete")
    .map((lane) => lane.laneId);

  // Handle status change from a lane card - notify parent
  const handleStatusChange = useCallback((laneId: string, newStatus: LaneStatus) => {
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
        const uncommitted = laneUncommitted[lane.laneId];
        return (
          <LaneStatusCard
            key={lane.laneId}
            lane={lane}
            slug={slug}
            initialStatus={state.status}
            initialStaged={state.staged}
            initialAutonomy={state.autonomy}
            completedLanes={completedLanes}
            uncommittedStatus={uncommitted}
            onStatusChange={handleStatusChange}
            onPreviewChanges={onPreviewChanges}
          />
        );
      })}
    </div>
  );
}
