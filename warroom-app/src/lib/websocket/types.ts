// WebSocket event types for War Room real-time updates

import { LaneStatus } from "@/lib/plan-schema";

// Events emitted from server to client
export interface ServerToClientEvents {
  "lane-activity": (data: LaneActivityEvent) => void;
  "lane-status-change": (data: LaneStatusChangeEvent) => void;
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
  type: "file-created" | "file-modified" | "file-deleted" | "commit" | "output";
  path?: string;
  message?: string;
  details?: {
    stream?: "stdout" | "stderr";
    line?: string;
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
