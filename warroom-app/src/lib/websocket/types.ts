// WebSocket event types for War Room real-time updates

import { LaneStatus, LaneAgentStatus } from "@/lib/plan-schema";

// Events emitted from server to client
export interface ServerToClientEvents {
  "lane-activity": (data: LaneActivityEvent) => void;
  "lane-status-change": (data: LaneStatusChangeEvent) => void;
  "lane-progress": (data: LaneProgressEvent) => void;
  "merge-ready": (data: MergeReadyEvent) => void;
  "run-complete": (data: RunCompleteEvent) => void;
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

// Socket data stored per connection
export interface SocketData {
  subscribedRuns: Set<string>;
}
