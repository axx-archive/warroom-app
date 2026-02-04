// FileWatcher class for monitoring lane worktree directories
// Watches for file changes and emits events via WebSocket
// Also tracks last activity timestamps for auto-completion detection

import { watch, FSWatcher } from "fs";
import { existsSync, statSync, readFileSync, writeFileSync } from "fs";
import * as path from "path";
import * as os from "os";
import { emitLaneActivity } from "@/lib/websocket/server";
import { LaneActivityEvent } from "@/lib/websocket/types";
import { StatusJson } from "@/lib/plan-schema";

interface FileChangeEvent {
  type: "file-created" | "file-modified" | "file-deleted";
  path: string;
  laneId: string;
}

interface WatchedLane {
  laneId: string;
  worktreePath: string;
  watcher: FSWatcher | null;
  debounceTimer: NodeJS.Timeout | null;
  pendingEvents: Map<string, FileChangeEvent>;
}

const DEBOUNCE_MS = 100;

// Patterns to ignore (git internals, node_modules, etc.)
const IGNORE_PATTERNS = [
  /\.git\//,
  /node_modules\//,
  /\.next\//,
  /\.DS_Store$/,
  /\.swp$/,
  /~$/,
];

function shouldIgnore(filePath: string): boolean {
  return IGNORE_PATTERNS.some((pattern) => pattern.test(filePath));
}

export class FileWatcher {
  private runSlug: string;
  private lanes: Map<string, WatchedLane> = new Map();
  private isRunning: boolean = false;

  constructor(runSlug: string) {
    this.runSlug = runSlug;
  }

  /**
   * Add a lane to watch
   */
  addLane(laneId: string, worktreePath: string): void {
    if (this.lanes.has(laneId)) {
      console.log(`[FileWatcher] Lane ${laneId} already being watched`);
      return;
    }

    const lane: WatchedLane = {
      laneId,
      worktreePath,
      watcher: null,
      debounceTimer: null,
      pendingEvents: new Map(),
    };

    this.lanes.set(laneId, lane);
    console.log(`[FileWatcher] Added lane ${laneId} at ${worktreePath}`);

    // If watcher is running, start watching this lane immediately
    if (this.isRunning) {
      this.startWatchingLane(lane);
    }
  }

  /**
   * Remove a lane from watching
   */
  removeLane(laneId: string): void {
    const lane = this.lanes.get(laneId);
    if (lane) {
      this.stopWatchingLane(lane);
      this.lanes.delete(laneId);
      console.log(`[FileWatcher] Removed lane ${laneId}`);
    }
  }

  /**
   * Start watching all added lanes
   */
  start(): void {
    if (this.isRunning) {
      console.log(`[FileWatcher] Already running for run ${this.runSlug}`);
      return;
    }

    this.isRunning = true;
    console.log(`[FileWatcher] Starting watcher for run ${this.runSlug}`);

    for (const lane of this.lanes.values()) {
      this.startWatchingLane(lane);
    }
  }

  /**
   * Stop watching all lanes
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    console.log(`[FileWatcher] Stopping watcher for run ${this.runSlug}`);

    for (const lane of this.lanes.values()) {
      this.stopWatchingLane(lane);
    }

    this.isRunning = false;
  }

  /**
   * Get current status
   */
  getStatus(): { running: boolean; lanes: string[] } {
    return {
      running: this.isRunning,
      lanes: Array.from(this.lanes.keys()),
    };
  }

  private startWatchingLane(lane: WatchedLane): void {
    // Check if worktree exists
    if (!existsSync(lane.worktreePath)) {
      console.log(
        `[FileWatcher] Worktree does not exist for lane ${lane.laneId}: ${lane.worktreePath}`
      );
      return;
    }

    // Verify it's a directory
    try {
      const stats = statSync(lane.worktreePath);
      if (!stats.isDirectory()) {
        console.log(
          `[FileWatcher] Path is not a directory for lane ${lane.laneId}: ${lane.worktreePath}`
        );
        return;
      }
    } catch (error) {
      console.log(
        `[FileWatcher] Cannot stat path for lane ${lane.laneId}: ${lane.worktreePath}`,
        error
      );
      return;
    }

    try {
      lane.watcher = watch(
        lane.worktreePath,
        { recursive: true },
        (eventType, filename) => {
          if (filename) {
            this.handleFileEvent(lane, eventType, filename);
          }
        }
      );

      lane.watcher.on("error", (error) => {
        console.error(
          `[FileWatcher] Error watching lane ${lane.laneId}:`,
          error
        );
        // Try to recover by restarting the watcher
        this.stopWatchingLane(lane);
        setTimeout(() => {
          if (this.isRunning && this.lanes.has(lane.laneId)) {
            this.startWatchingLane(lane);
          }
        }, 1000);
      });

      console.log(
        `[FileWatcher] Started watching lane ${lane.laneId} at ${lane.worktreePath}`
      );
    } catch (error) {
      console.error(
        `[FileWatcher] Failed to start watching lane ${lane.laneId}:`,
        error
      );
    }
  }

  private stopWatchingLane(lane: WatchedLane): void {
    if (lane.watcher) {
      lane.watcher.close();
      lane.watcher = null;
    }

    if (lane.debounceTimer) {
      clearTimeout(lane.debounceTimer);
      lane.debounceTimer = null;
    }

    lane.pendingEvents.clear();
  }

  private handleFileEvent(
    lane: WatchedLane,
    eventType: string,
    filename: string
  ): void {
    const fullPath = path.join(lane.worktreePath, filename);

    // Ignore certain patterns
    if (shouldIgnore(filename)) {
      return;
    }

    // Determine event type
    let changeType: FileChangeEvent["type"];

    if (eventType === "rename") {
      // Check if file exists to determine create vs delete
      if (existsSync(fullPath)) {
        changeType = "file-created";
      } else {
        changeType = "file-deleted";
      }
    } else {
      changeType = "file-modified";
    }

    // Add to pending events (using path as key to dedupe rapid changes)
    lane.pendingEvents.set(filename, {
      type: changeType,
      path: filename,
      laneId: lane.laneId,
    });

    // Reset debounce timer
    if (lane.debounceTimer) {
      clearTimeout(lane.debounceTimer);
    }

    lane.debounceTimer = setTimeout(() => {
      this.flushEvents(lane);
    }, DEBOUNCE_MS);
  }

  private flushEvents(lane: WatchedLane): void {
    const events = Array.from(lane.pendingEvents.values());
    lane.pendingEvents.clear();
    lane.debounceTimer = null;

    const timestamp = new Date().toISOString();

    // Update last activity timestamp in status.json
    this.updateLastActivityTimestamp(lane.laneId, timestamp);

    // Emit each event via WebSocket
    for (const event of events) {
      const activityEvent: LaneActivityEvent = {
        runSlug: this.runSlug,
        laneId: event.laneId,
        type: event.type,
        path: event.path,
        timestamp,
      };

      emitLaneActivity(activityEvent);
      console.log(
        `[FileWatcher] Emitted ${event.type} for ${event.path} in lane ${event.laneId}`
      );
    }
  }

  /**
   * Update the lastActivityAt timestamp for a lane in status.json
   * Used for auto-completion detection based on inactivity
   */
  private updateLastActivityTimestamp(laneId: string, timestamp: string): void {
    try {
      const statusPath = path.join(
        os.homedir(),
        ".openclaw/workspace/warroom/runs",
        this.runSlug,
        "status.json"
      );

      // Read current status.json
      let statusJson: StatusJson;
      try {
        const content = readFileSync(statusPath, "utf-8");
        statusJson = JSON.parse(content);
      } catch {
        // No status.json exists yet, can't update
        return;
      }

      // Ensure lanes object exists
      if (!statusJson.lanes) {
        statusJson.lanes = {};
      }

      // Update the lane's lastActivityAt timestamp
      if (statusJson.lanes[laneId]) {
        statusJson.lanes[laneId].lastActivityAt = timestamp;
      } else {
        statusJson.lanes[laneId] = {
          staged: false,
          status: "pending",
          lastActivityAt: timestamp,
        };
      }

      // Write back to status.json
      writeFileSync(statusPath, JSON.stringify(statusJson, null, 2));
      console.log(`[FileWatcher] Updated lastActivityAt for lane ${laneId}`);
    } catch (error) {
      console.error(`[FileWatcher] Failed to update lastActivityAt:`, error);
    }
  }
}

// Singleton map of watchers per run
const watchers: Map<string, FileWatcher> = new Map();

/**
 * Get or create a file watcher for a run
 */
export function getFileWatcher(runSlug: string): FileWatcher {
  let watcher = watchers.get(runSlug);
  if (!watcher) {
    watcher = new FileWatcher(runSlug);
    watchers.set(runSlug, watcher);
  }
  return watcher;
}

/**
 * Stop and remove a file watcher for a run
 */
export function removeFileWatcher(runSlug: string): void {
  const watcher = watchers.get(runSlug);
  if (watcher) {
    watcher.stop();
    watchers.delete(runSlug);
    console.log(`[FileWatcher] Removed watcher for run ${runSlug}`);
  }
}

/**
 * Get all active watchers status
 */
export function getAllWatchersStatus(): Record<
  string,
  { running: boolean; lanes: string[] }
> {
  const status: Record<string, { running: boolean; lanes: string[] }> = {};
  for (const [runSlug, watcher] of watchers) {
    status[runSlug] = watcher.getStatus();
  }
  return status;
}
