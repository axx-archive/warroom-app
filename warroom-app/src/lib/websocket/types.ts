// WebSocket event types for War Room real-time updates

import { LaneStatus, LaneAgentStatus } from "@/lib/plan-schema";

// Events emitted from server to client
export interface ServerToClientEvents {
  "lane-activity": (data: LaneActivityEvent) => void;
  "lane-status-change": (data: LaneStatusChangeEvent) => void;
  "lane-progress": (data: LaneProgressEvent) => void;
  "merge-ready": (data: MergeReadyEvent) => void;
  "merge-progress": (data: MergeProgressEvent) => void;
  "run-complete": (data: RunCompleteEvent) => void;
  "mission-progress": (data: MissionProgressEvent) => void;
  "connection-status": (data: ConnectionStatusEvent) => void;
}

// Events emitted from client to server
export interface ClientToServerEvents {
  "subscribe-run": (runSlug: string) => void;
  "unsubscribe-run": (runSlug: string) => void;
  ping: () => void;
}

// Event payloads
export interface LaneActivityEvent {
  runSlug: string;
  laneId: string;
  type: "file-created" | "file-modified" | "file-deleted" | "commit" | "output" | "retry" | "status";
  path?: string;
  message?: string;
  details?: {
    stream?: "stdout" | "stderr";
    line?: string;
    // Retry event details
    retryAttempt?: number;
    maxAttempts?: number;
    nextRetryAt?: string;
    backoffSeconds?: number;
    // Push event details
    pushType?: "lane" | "integration" | "main";
    status?: "pushing" | "success" | "failed";
    errorType?: "auth" | "protected" | "rejected" | "network" | "unknown";
  };
  timestamp: string;
}

export interface LaneStatusChangeEvent {
  runSlug: string;
  laneId: string;
  previousStatus: LaneStatus;
  newStatus: LaneStatus;
  timestamp: string;
}

// Event emitted when LANE_STATUS.json is updated by an agent
export interface LaneProgressEvent {
  runSlug: string;
  laneId: string;
  agentStatus: LaneAgentStatus;
  timestamp: string;
}

export interface MergeReadyEvent {
  runSlug: string;
  lanesComplete: string[];
  timestamp: string;
}

// Event emitted during auto-merge process
export interface MergeProgressEvent {
  runSlug: string;
  status: "started" | "merging" | "complete" | "conflict" | "failed" | "pushing" | "pushed" | "push_failed";
  currentLane?: string;
  mergedLanes: string[];
  message?: string;
  // Conflict info if status is "conflict"
  conflictInfo?: {
    laneId: string;
    branch: string;
    conflictingFiles: string[];
  };
  error?: string;
  timestamp: string;
}

export interface RunCompleteEvent {
  runSlug: string;
  success: boolean;
  message?: string;
  timestamp: string;
}

export interface ConnectionStatusEvent {
  connected: boolean;
  serverTime: string;
}

// Mission-level progress event for one-click Start Mission
export type MissionPhase =
  | "launching"    // Phase 1: Starting lanes
  | "running"      // Phase 2: Lanes are executing
  | "committing"   // Phase 3: Auto-committing completed lanes
  | "merging"      // Phase 4: Merging lanes to integration branch
  | "complete"     // All done
  | "failed"       // Mission failed
  | "stopped";     // User stopped the mission

export interface MissionProgressEvent {
  runSlug: string;
  phase: MissionPhase;
  // Human-readable message for the current phase
  message: string;
  // Progress counts
  lanesLaunched: number;
  lanesRunning: number;
  lanesComplete: number;
  lanesFailed: number;
  totalLanes: number;
  // Merging progress
  lanesMerged: number;
  // Overall percent (0-100)
  overallProgress: number;
  timestamp: string;
}

// Socket data stored per connection
export interface SocketData {
  subscribedRuns: Set<string>;
}
