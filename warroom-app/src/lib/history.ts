// History/Audit Log Utilities
// Append-only logging to history.jsonl in run directory

import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import {
  HistoryEvent,
  HistoryEventType,
  LaneLaunchedEvent,
  LaneStatusChangeEvent,
  CommitEvent,
  MergeStartedEvent,
  MergeLaneCompleteEvent,
  MergeCompleteEvent,
  MergeConflictEvent,
  MergeFailedEvent,
  PushStartedEvent,
  PushCompleteEvent,
  PushFailedEvent,
  ErrorEvent,
  RetryScheduledEvent,
  RetryStartedEvent,
  MissionStartedEvent,
  MissionStoppedEvent,
  MissionCompleteEvent,
  LaneResetEvent,
  LaneAddedEvent,
  LaneStatus,
  LaunchMode,
  AgentType,
} from "./plan-schema";

// Helper to get history file path for a run
export function getHistoryFilePath(runDir: string): string {
  return path.join(runDir, "history.jsonl");
}

// Append a history event to the log
export function appendHistoryEvent(runDir: string, event: HistoryEvent): void {
  const historyPath = getHistoryFilePath(runDir);
  const line = JSON.stringify(event) + "\n";

  try {
    fs.appendFileSync(historyPath, line, "utf-8");
  } catch (error) {
    console.error("Failed to append history event:", error);
  }
}

// Read all history events from the log
export function readHistoryEvents(runDir: string): HistoryEvent[] {
  const historyPath = getHistoryFilePath(runDir);

  if (!fs.existsSync(historyPath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(historyPath, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    return lines.map((line) => JSON.parse(line) as HistoryEvent);
  } catch (error) {
    console.error("Failed to read history events:", error);
    return [];
  }
}

// Read history events with filtering
export interface HistoryFilter {
  eventTypes?: HistoryEventType[];
  laneIds?: string[];
  since?: string; // ISO-8601 timestamp
  until?: string; // ISO-8601 timestamp
  limit?: number;
  offset?: number;
}

export function readHistoryEventsFiltered(
  runDir: string,
  filter: HistoryFilter
): { events: HistoryEvent[]; total: number } {
  let events = readHistoryEvents(runDir);
  const total = events.length;

  // Filter by event type
  if (filter.eventTypes && filter.eventTypes.length > 0) {
    events = events.filter((e) => filter.eventTypes!.includes(e.type));
  }

  // Filter by lane ID
  if (filter.laneIds && filter.laneIds.length > 0) {
    events = events.filter(
      (e) => e.laneId && filter.laneIds!.includes(e.laneId)
    );
  }

  // Filter by time range
  if (filter.since) {
    const sinceTime = new Date(filter.since).getTime();
    events = events.filter((e) => new Date(e.timestamp).getTime() >= sinceTime);
  }

  if (filter.until) {
    const untilTime = new Date(filter.until).getTime();
    events = events.filter((e) => new Date(e.timestamp).getTime() <= untilTime);
  }

  // Apply pagination
  const offset = filter.offset ?? 0;
  const limit = filter.limit ?? events.length;
  events = events.slice(offset, offset + limit);

  return { events, total };
}

// Helper to create a base event
function createBaseEvent(
  type: HistoryEventType,
  message: string,
  laneId?: string
): {
  id: string;
  type: HistoryEventType;
  timestamp: string;
  laneId?: string;
  message: string;
} {
  return {
    id: uuidv4(),
    type,
    timestamp: new Date().toISOString(),
    ...(laneId && { laneId }),
    message,
  };
}

// Event creation helpers
export function logLaneLaunched(
  runDir: string,
  laneId: string,
  launchMode: LaunchMode,
  autonomy: boolean
): LaneLaunchedEvent {
  const event: LaneLaunchedEvent = {
    ...createBaseEvent(
      "lane_launched",
      `Lane ${laneId} launched in ${launchMode} mode`,
      laneId
    ),
    type: "lane_launched",
    details: {
      launchMode,
      autonomy,
    },
  };
  appendHistoryEvent(runDir, event);
  return event;
}

export function logLaneStatusChange(
  runDir: string,
  laneId: string,
  previousStatus: LaneStatus,
  newStatus: LaneStatus,
  reason?: string
): LaneStatusChangeEvent {
  const event: LaneStatusChangeEvent = {
    ...createBaseEvent(
      "lane_status_change",
      `Lane ${laneId} status changed from ${previousStatus} to ${newStatus}${reason ? `: ${reason}` : ""}`,
      laneId
    ),
    type: "lane_status_change",
    details: {
      previousStatus,
      newStatus,
      reason,
    },
  };
  appendHistoryEvent(runDir, event);
  return event;
}

export function logCommit(
  runDir: string,
  laneId: string,
  commitHash: string,
  commitMessage: string,
  filesChanged: number,
  autoCommit: boolean
): CommitEvent {
  const event: CommitEvent = {
    ...createBaseEvent(
      "commit",
      `${autoCommit ? "Auto-committed" : "Committed"} in lane ${laneId}: ${commitMessage.slice(0, 50)}${commitMessage.length > 50 ? "..." : ""}`,
      laneId
    ),
    type: "commit",
    details: {
      commitHash,
      commitMessage,
      filesChanged,
      autoCommit,
    },
  };
  appendHistoryEvent(runDir, event);
  return event;
}

export function logMergeStarted(
  runDir: string,
  lanesToMerge: string[],
  integrationBranch: string
): MergeStartedEvent {
  const event: MergeStartedEvent = {
    ...createBaseEvent(
      "merge_started",
      `Started merging ${lanesToMerge.length} lanes into ${integrationBranch}`
    ),
    type: "merge_started",
    details: {
      lanesToMerge,
      integrationBranch,
    },
  };
  appendHistoryEvent(runDir, event);
  return event;
}

export function logMergeLaneComplete(
  runDir: string,
  laneId: string,
  mergedLanes: string[],
  remainingLanes: string[]
): MergeLaneCompleteEvent {
  const event: MergeLaneCompleteEvent = {
    ...createBaseEvent(
      "merge_lane_complete",
      `Merged lane ${laneId} (${mergedLanes.length} merged, ${remainingLanes.length} remaining)`,
      laneId
    ),
    type: "merge_lane_complete",
    details: {
      mergedLane: laneId,
      mergedLanes,
      remainingLanes,
    },
  };
  appendHistoryEvent(runDir, event);
  return event;
}

export function logMergeComplete(
  runDir: string,
  mergedLanes: string[],
  integrationBranch: string
): MergeCompleteEvent {
  const event: MergeCompleteEvent = {
    ...createBaseEvent(
      "merge_complete",
      `Successfully merged all ${mergedLanes.length} lanes into ${integrationBranch}`
    ),
    type: "merge_complete",
    details: {
      mergedLanes,
      integrationBranch,
    },
  };
  appendHistoryEvent(runDir, event);
  return event;
}

export function logMergeConflict(
  runDir: string,
  laneId: string,
  conflictingFiles: string[]
): MergeConflictEvent {
  const event: MergeConflictEvent = {
    ...createBaseEvent(
      "merge_conflict",
      `Merge conflict in lane ${laneId}: ${conflictingFiles.length} files`,
      laneId
    ),
    type: "merge_conflict",
    details: {
      conflictingLane: laneId,
      conflictingFiles,
    },
  };
  appendHistoryEvent(runDir, event);
  return event;
}

export function logMergeFailed(
  runDir: string,
  error: string,
  failedLane?: string
): MergeFailedEvent {
  const event: MergeFailedEvent = {
    ...createBaseEvent(
      "merge_failed",
      `Merge failed${failedLane ? ` on lane ${failedLane}` : ""}: ${error}`,
      failedLane
    ),
    type: "merge_failed",
    details: {
      failedLane,
      error,
    },
  };
  appendHistoryEvent(runDir, event);
  return event;
}

export function logPushStarted(
  runDir: string,
  branch: string,
  pushType: "lane" | "integration" | "main",
  laneId?: string
): PushStartedEvent {
  const event: PushStartedEvent = {
    ...createBaseEvent(
      "push_started",
      `Started pushing ${pushType} branch: ${branch}`,
      laneId
    ),
    type: "push_started",
    details: {
      branch,
      pushType,
    },
  };
  appendHistoryEvent(runDir, event);
  return event;
}

export function logPushComplete(
  runDir: string,
  branch: string,
  pushType: "lane" | "integration" | "main",
  laneId?: string
): PushCompleteEvent {
  const event: PushCompleteEvent = {
    ...createBaseEvent(
      "push_complete",
      `Successfully pushed ${pushType} branch: ${branch}`,
      laneId
    ),
    type: "push_complete",
    details: {
      branch,
      pushType,
    },
  };
  appendHistoryEvent(runDir, event);
  return event;
}

export function logPushFailed(
  runDir: string,
  branch: string,
  pushType: "lane" | "integration" | "main",
  error: string,
  errorType: "auth" | "protected" | "rejected" | "network" | "unknown",
  laneId?: string
): PushFailedEvent {
  const event: PushFailedEvent = {
    ...createBaseEvent(
      "push_failed",
      `Failed to push ${pushType} branch ${branch}: ${error}`,
      laneId
    ),
    type: "push_failed",
    details: {
      branch,
      pushType,
      error,
      errorType,
    },
  };
  appendHistoryEvent(runDir, event);
  return event;
}

export function logError(
  runDir: string,
  errorType: string,
  error: string,
  stack?: string,
  laneId?: string
): ErrorEvent {
  const event: ErrorEvent = {
    ...createBaseEvent(
      "error",
      `Error${laneId ? ` in lane ${laneId}` : ""}: ${error}`,
      laneId
    ),
    type: "error",
    details: {
      errorType,
      error,
      stack,
    },
  };
  appendHistoryEvent(runDir, event);
  return event;
}

export function logRetryScheduled(
  runDir: string,
  laneId: string,
  attempt: number,
  maxAttempts: number,
  scheduledFor: string,
  backoffSeconds: number
): RetryScheduledEvent {
  const event: RetryScheduledEvent = {
    ...createBaseEvent(
      "retry_scheduled",
      `Lane ${laneId} retry ${attempt}/${maxAttempts} scheduled in ${backoffSeconds}s`,
      laneId
    ),
    type: "retry_scheduled",
    details: {
      attempt,
      maxAttempts,
      scheduledFor,
      backoffSeconds,
    },
  };
  appendHistoryEvent(runDir, event);
  return event;
}

export function logRetryStarted(
  runDir: string,
  laneId: string,
  attempt: number,
  maxAttempts: number
): RetryStartedEvent {
  const event: RetryStartedEvent = {
    ...createBaseEvent(
      "retry_started",
      `Lane ${laneId} retry attempt ${attempt}/${maxAttempts} started`,
      laneId
    ),
    type: "retry_started",
    details: {
      attempt,
      maxAttempts,
    },
  };
  appendHistoryEvent(runDir, event);
  return event;
}

export function logMissionStarted(
  runDir: string,
  totalLanes: number,
  launchMode: LaunchMode
): MissionStartedEvent {
  const event: MissionStartedEvent = {
    ...createBaseEvent(
      "mission_started",
      `Mission started with ${totalLanes} lanes in ${launchMode} mode`
    ),
    type: "mission_started",
    details: {
      totalLanes,
      launchMode,
    },
  };
  appendHistoryEvent(runDir, event);
  return event;
}

export function logMissionStopped(
  runDir: string,
  completedLanes: number,
  totalLanes: number,
  reason: string
): MissionStoppedEvent {
  const event: MissionStoppedEvent = {
    ...createBaseEvent(
      "mission_stopped",
      `Mission stopped: ${reason} (${completedLanes}/${totalLanes} lanes completed)`
    ),
    type: "mission_stopped",
    details: {
      completedLanes,
      totalLanes,
      reason,
    },
  };
  appendHistoryEvent(runDir, event);
  return event;
}

export function logMissionComplete(
  runDir: string,
  completedLanes: number,
  totalLanes: number,
  duration: number
): MissionCompleteEvent {
  const durationMin = Math.floor(duration / 60);
  const event: MissionCompleteEvent = {
    ...createBaseEvent(
      "mission_complete",
      `Mission complete: ${completedLanes}/${totalLanes} lanes in ${durationMin}m`
    ),
    type: "mission_complete",
    details: {
      completedLanes,
      totalLanes,
      duration,
    },
  };
  appendHistoryEvent(runDir, event);
  return event;
}

export function logLaneReset(
  runDir: string,
  laneId: string,
  previousStatus: LaneStatus
): LaneResetEvent {
  const event: LaneResetEvent = {
    ...createBaseEvent(
      "lane_reset",
      `Lane ${laneId} reset from ${previousStatus} to pending`,
      laneId
    ),
    type: "lane_reset",
    details: {
      previousStatus,
    },
  };
  appendHistoryEvent(runDir, event);
  return event;
}

export function logLaneAdded(
  runDir: string,
  laneId: string,
  agent: AgentType,
  dependencies: string[]
): LaneAddedEvent {
  const event: LaneAddedEvent = {
    ...createBaseEvent(
      "lane_added",
      `Lane ${laneId} added with agent ${agent}${dependencies.length > 0 ? `, depends on: ${dependencies.join(", ")}` : ""}`,
      laneId
    ),
    type: "lane_added",
    details: {
      agent,
      dependencies,
    },
  };
  appendHistoryEvent(runDir, event);
  return event;
}

// Export history as JSON
export function exportHistoryAsJson(runDir: string): string {
  const events = readHistoryEvents(runDir);
  return JSON.stringify(events, null, 2);
}
