// AgentOrchestrator - Singleton class for managing Claude Code agent processes
// Manages the lifecycle of all Claude Code processes for a run

import { ChildProcess, spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import readline from "readline";
import { LaneStatus, WarRoomPlan, StatusJson, Lane, LaunchMode, RetryState, RetryAttempt, MergeState, PushState, AutoPushOptions } from "../plan-schema";
import { emitLaneStatusChange, emitLaneActivity, emitMergeProgress, emitMergeReady, emitRunComplete } from "../websocket/server";
import {
  spawnTerminal as spawnTerminalWindow,
  isTerminalWindowOpen,
  closeTerminalWindow,
} from "./terminal-spawner";
import {
  addOutputLine,
  getLaneOutput,
  getRecentOutput,
  clearLaneOutput,
  hasLaneErrors,
  getLaneErrors,
  LaneOutputState,
  OutputLine,
  DetectedError,
} from "./output-buffer";
import {
  autoCommitLaneWork,
  autoMergeLanes,
  pushLaneBranch,
  pushIntegrationBranch,
} from "./git-operations";

// Retry configuration constants
const MAX_RETRY_ATTEMPTS = 3;
// Backoff delays in seconds: 30s, 2min, 10min
const RETRY_BACKOFF_SECONDS = [30, 120, 600];

// Calculate backoff delay for a given retry attempt (0-indexed)
function getBackoffDelay(attemptIndex: number): number {
  return RETRY_BACKOFF_SECONDS[Math.min(attemptIndex, RETRY_BACKOFF_SECONDS.length - 1)] * 1000;
}

// Lane process state
export interface LaneProcessState {
  laneId: string;
  process: ChildProcess | null;
  status: "pending" | "starting" | "running" | "paused" | "stopped" | "complete" | "failed" | "retrying";
  startedAt?: string;
  stoppedAt?: string;
  exitCode?: number | null;
  error?: string;
  // Terminal mode properties
  launchMode?: LaunchMode;
  terminal?: "iTerm" | "Terminal.app";
  windowId?: string;
  // Retry state
  retryState?: RetryState;
  retryTimer?: NodeJS.Timeout;
}

// Run orchestration state
export interface RunOrchestrationState {
  runSlug: string;
  status: "idle" | "starting" | "running" | "merging" | "stopping" | "stopped" | "complete" | "failed";
  lanes: Map<string, LaneProcessState>;
  startedAt?: string;
  stoppedAt?: string;
  // Auto-merge state
  mergeState?: MergeState;
}

// Orchestrator status response
export interface OrchestratorStatus {
  isRunning: boolean;
  activeRuns: string[];
  runStatuses: Record<string, {
    status: RunOrchestrationState["status"];
    lanes: Record<string, Omit<LaneProcessState, "process">>;
    startedAt?: string;
    stoppedAt?: string;
  }>;
}

// Singleton orchestrator class
class AgentOrchestrator {
  private static instance: AgentOrchestrator | null = null;
  private runs: Map<string, RunOrchestrationState> = new Map();
  private isShuttingDown = false;

  private constructor() {
    // Register shutdown handlers
    this.registerShutdownHandlers();
  }

  // Get singleton instance
  public static getInstance(): AgentOrchestrator {
    if (!AgentOrchestrator.instance) {
      AgentOrchestrator.instance = new AgentOrchestrator();
    }
    return AgentOrchestrator.instance;
  }

  // Register SIGTERM/SIGINT handlers for graceful shutdown
  private registerShutdownHandlers(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;

      console.log(`[AgentOrchestrator] Received ${signal}, initiating graceful shutdown...`);

      // Stop all active runs
      const stopPromises: Promise<void>[] = [];
      for (const runSlug of this.runs.keys()) {
        stopPromises.push(this.stopRun(runSlug));
      }

      await Promise.all(stopPromises);
      console.log("[AgentOrchestrator] Graceful shutdown complete");
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  }

  // Start a run - launches all ready lanes
  public async startRun(runSlug: string): Promise<{ success: boolean; error?: string }> {
    if (this.runs.has(runSlug)) {
      const existingRun = this.runs.get(runSlug)!;
      if (existingRun.status === "running") {
        return { success: false, error: "Run is already active" };
      }
    }

    try {
      // Load plan.json for the run
      const runDir = path.join(os.homedir(), ".openclaw/workspace/warroom/runs", runSlug);
      const planPath = path.join(runDir, "plan.json");
      const planContent = await fs.readFile(planPath, "utf-8");
      const plan: WarRoomPlan = JSON.parse(planContent);

      // Load status.json
      const statusPath = path.join(runDir, "status.json");
      let statusJson: StatusJson;
      try {
        const statusContent = await fs.readFile(statusPath, "utf-8");
        statusJson = JSON.parse(statusContent);
      } catch {
        statusJson = {
          runId: plan.runId,
          status: "staged",
          lanesCompleted: [],
          lanes: {},
          updatedAt: new Date().toISOString(),
        };
      }

      // Initialize run state
      const runState: RunOrchestrationState = {
        runSlug,
        status: "starting",
        lanes: new Map(),
        startedAt: new Date().toISOString(),
      };

      // Initialize lane states
      for (const lane of plan.lanes) {
        runState.lanes.set(lane.laneId, {
          laneId: lane.laneId,
          process: null,
          status: "pending",
        });
      }

      this.runs.set(runSlug, runState);

      // Start lanes in dependency order
      await this.startReadyLanes(runSlug, plan, statusJson);

      runState.status = "running";

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Start all lanes that have their dependencies met
  private async startReadyLanes(
    runSlug: string,
    plan: WarRoomPlan,
    statusJson: StatusJson
  ): Promise<void> {
    const runState = this.runs.get(runSlug);
    if (!runState) return;

    const completedLanes = new Set(statusJson.lanesCompleted || []);

    // Also check lanes marked complete in lanes object
    if (statusJson.lanes) {
      for (const [laneId, laneStatus] of Object.entries(statusJson.lanes)) {
        if (laneStatus.status === "complete") {
          completedLanes.add(laneId);
        }
      }
    }

    for (const lane of plan.lanes) {
      const laneState = runState.lanes.get(lane.laneId);
      if (!laneState || laneState.status !== "pending") continue;

      // Check if dependencies are met
      const depsComplete = lane.dependsOn.every((dep) => completedLanes.has(dep));
      if (!depsComplete) continue;

      // Start this lane
      await this.startLane(runSlug, plan, lane, statusJson);
    }
  }

  // Start a single lane
  private async startLane(
    runSlug: string,
    plan: WarRoomPlan,
    lane: Lane,
    statusJson: StatusJson
  ): Promise<void> {
    const runState = this.runs.get(runSlug);
    if (!runState) return;

    const laneState = runState.lanes.get(lane.laneId);
    if (!laneState) return;

    laneState.status = "starting";
    laneState.startedAt = new Date().toISOString();

    try {
      // Get autonomy and launch mode settings
      const laneStatusEntry = statusJson.lanes?.[lane.laneId];
      const skipPermissions = laneStatusEntry?.autonomy?.dangerouslySkipPermissions ??
                             lane.autonomy?.dangerouslySkipPermissions ?? false;
      const launchMode: LaunchMode = laneStatusEntry?.launchMode ??
                                     (skipPermissions ? "terminal" : "cursor");

      laneState.launchMode = launchMode;

      // Ensure worktree exists
      const worktreePath = lane.worktreePath;
      try {
        await fs.access(worktreePath);
      } catch {
        // Worktree doesn't exist - it should have been created at launch
        console.error(`[AgentOrchestrator] Worktree not found for ${lane.laneId}: ${worktreePath}`);
        laneState.status = "failed";
        laneState.error = "Worktree not found";
        return;
      }

      // Choose spawn method based on launch mode
      if (launchMode === "terminal") {
        // Terminal mode: spawn iTerm2/Terminal.app window
        await this.spawnLaneInTerminal(laneState, runSlug, lane, skipPermissions);
      } else {
        // Direct process mode (or cursor mode falls back to direct for orchestrator)
        const claudeProcess = await this.spawnClaudeProcess(
          worktreePath,
          lane.laneId,
          runSlug,
          skipPermissions
        );

        laneState.process = claudeProcess;
        this.setupProcessHandlers(laneState, runSlug, lane);
      }

      laneState.status = "running";

      // Emit status change
      emitLaneStatusChange({
        runSlug,
        laneId: lane.laneId,
        previousStatus: "pending" as LaneStatus,
        newStatus: "in_progress" as LaneStatus,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      laneState.status = "failed";
      laneState.error = error instanceof Error ? error.message : String(error);
      console.error(`[AgentOrchestrator] Failed to start lane ${lane.laneId}:`, error);
    }
  }

  // Spawn a lane in a terminal window (iTerm2 or Terminal.app)
  private async spawnLaneInTerminal(
    laneState: LaneProcessState,
    runSlug: string,
    lane: Lane,
    skipPermissions: boolean
  ): Promise<void> {
    const result = await spawnTerminalWindow({
      worktreePath: lane.worktreePath,
      laneId: lane.laneId,
      runSlug,
      skipPermissions,
    });

    if (!result.success) {
      throw new Error(result.error || "Failed to spawn terminal");
    }

    laneState.terminal = result.terminal !== "unknown" ? result.terminal : undefined;
    laneState.windowId = result.windowId;

    console.log(`[AgentOrchestrator] Spawned ${result.terminal} window for ${lane.laneId}, window ID: ${result.windowId}`);

    // For terminal mode, we monitor by polling window status
    // since we don't have a direct process handle
    this.monitorTerminalWindow(laneState, runSlug, lane);
  }

  // Monitor a terminal window for completion
  private monitorTerminalWindow(
    laneState: LaneProcessState,
    runSlug: string,
    lane: Lane
  ): void {
    if (!laneState.terminal || !laneState.windowId) return;

    const terminal = laneState.terminal;
    const windowId = laneState.windowId;

    // Poll every 5 seconds to check if window is still open
    const checkInterval = setInterval(async () => {
      // Skip if lane is no longer running
      if (laneState.status !== "running") {
        clearInterval(checkInterval);
        return;
      }

      try {
        const isOpen = await isTerminalWindowOpen(terminal, windowId);

        if (!isOpen) {
          clearInterval(checkInterval);

          // Window was closed - process completion with auto-commit
          laneState.stoppedAt = new Date().toISOString();
          laneState.exitCode = 0;

          console.log(`[AgentOrchestrator] Terminal window closed for ${lane.laneId}`);

          // Auto-commit lane work and complete
          await this.handleLaneCompletion(runSlug, lane, laneState);
        }
      } catch (error) {
        console.error(`[AgentOrchestrator] Error checking terminal window:`, error);
      }
    }, 5000);
  }

  // Setup process event handlers for direct process spawning
  private setupProcessHandlers(
    laneState: LaneProcessState,
    runSlug: string,
    lane: Lane
  ): void {
    const claudeProcess = laneState.process;
    if (!claudeProcess) return;

    // Clear any previous output buffer for this lane
    clearLaneOutput(runSlug, lane.laneId);

    // Capture stdout using readline for line-by-line processing
    if (claudeProcess.stdout) {
      const stdoutReader = readline.createInterface({
        input: claudeProcess.stdout,
        crlfDelay: Infinity,
      });

      stdoutReader.on("line", (line) => {
        addOutputLine(runSlug, lane.laneId, line, "stdout");

        // Emit lane activity event for real-time updates
        emitLaneActivity({
          runSlug,
          laneId: lane.laneId,
          type: "output",
          details: { stream: "stdout", line },
          timestamp: new Date().toISOString(),
        });
      });
    }

    // Capture stderr using readline for line-by-line processing
    if (claudeProcess.stderr) {
      const stderrReader = readline.createInterface({
        input: claudeProcess.stderr,
        crlfDelay: Infinity,
      });

      stderrReader.on("line", (line) => {
        addOutputLine(runSlug, lane.laneId, line, "stderr");

        // Emit lane activity event for real-time updates
        emitLaneActivity({
          runSlug,
          laneId: lane.laneId,
          type: "output",
          details: { stream: "stderr", line },
          timestamp: new Date().toISOString(),
        });
      });
    }

    // Handle process exit
    claudeProcess.on("exit", async (code) => {
      laneState.exitCode = code;
      laneState.stoppedAt = new Date().toISOString();

      // Check if there were errors detected in output
      const hadErrors = hasLaneErrors(runSlug, lane.laneId);

      // Process failed if exit code non-zero or errors detected in output
      const success = code === 0 && !hadErrors;

      console.log(`[AgentOrchestrator] Lane ${lane.laneId} exited with code ${code}, errors: ${hadErrors}`);

      if (success) {
        // Auto-commit lane work on successful completion
        await this.handleLaneCompletion(runSlug, lane, laneState);
      } else {
        // Handle failure with potential retry
        this.handleLaneFailure(runSlug, lane, laneState, code, hadErrors);
      }
    });

    // Handle process errors
    claudeProcess.on("error", (error) => {
      laneState.status = "failed";
      laneState.error = error.message;

      // Add error to output buffer
      addOutputLine(runSlug, lane.laneId, `Process error: ${error.message}`, "stderr");

      console.error(`[AgentOrchestrator] Lane ${lane.laneId} error:`, error);

      // Handle failure with potential retry
      this.handleLaneFailure(runSlug, lane, laneState, null, true);
    });
  }

  // Handle lane failure with retry logic
  private async handleLaneFailure(
    runSlug: string,
    lane: Lane,
    laneState: LaneProcessState,
    exitCode: number | null,
    hadErrors: boolean
  ): Promise<void> {
    // Initialize retry state if not present
    if (!laneState.retryState) {
      laneState.retryState = {
        attempt: 0,
        maxAttempts: MAX_RETRY_ATTEMPTS,
        history: [],
        status: "waiting",
      };
    }

    const retryState = laneState.retryState;
    const currentAttempt = retryState.attempt;

    // Record this attempt in history
    const attemptRecord: RetryAttempt = {
      attempt: currentAttempt + 1,
      startedAt: laneState.startedAt || new Date().toISOString(),
      endedAt: new Date().toISOString(),
      exitCode: exitCode,
      error: hadErrors ? "Errors detected in output" : `Exit code: ${exitCode}`,
      backoffSeconds: currentAttempt < MAX_RETRY_ATTEMPTS
        ? RETRY_BACKOFF_SECONDS[currentAttempt] || RETRY_BACKOFF_SECONDS[RETRY_BACKOFF_SECONDS.length - 1]
        : 0,
    };
    retryState.history.push(attemptRecord);

    // Check if we can retry
    if (currentAttempt < MAX_RETRY_ATTEMPTS) {
      const backoffMs = getBackoffDelay(currentAttempt);
      const nextRetryAt = new Date(Date.now() + backoffMs);

      retryState.attempt = currentAttempt + 1;
      retryState.nextRetryAt = nextRetryAt.toISOString();
      retryState.status = "waiting";

      laneState.status = "retrying";
      laneState.error = undefined;
      laneState.process = null;

      console.log(`[AgentOrchestrator] Lane ${lane.laneId} failed (attempt ${currentAttempt + 1}/${MAX_RETRY_ATTEMPTS}). Retrying in ${backoffMs / 1000}s...`);

      // Emit lane activity event for retry scheduling
      emitLaneActivity({
        runSlug,
        laneId: lane.laneId,
        type: "status",
        details: {
          retryAttempt: retryState.attempt,
          maxAttempts: MAX_RETRY_ATTEMPTS,
          nextRetryAt: nextRetryAt.toISOString(),
          backoffSeconds: backoffMs / 1000,
        },
        timestamp: new Date().toISOString(),
      });

      // Update status.json with retry state
      await this.updateStatusJsonRetryState(runSlug, lane.laneId, retryState);

      // Schedule retry
      laneState.retryTimer = setTimeout(async () => {
        console.log(`[AgentOrchestrator] Retrying lane ${lane.laneId} (attempt ${retryState.attempt}/${MAX_RETRY_ATTEMPTS})...`);

        retryState.status = "retrying";
        retryState.nextRetryAt = undefined;

        // Update status.json
        await this.updateStatusJsonRetryState(runSlug, lane.laneId, retryState);

        // Reload plan and status to get latest configuration
        try {
          const runDir = path.join(os.homedir(), ".openclaw/workspace/warroom/runs", runSlug);
          const planPath = path.join(runDir, "plan.json");
          const planContent = await fs.readFile(planPath, "utf-8");
          const plan: WarRoomPlan = JSON.parse(planContent);

          const statusPath = path.join(runDir, "status.json");
          const statusContent = await fs.readFile(statusPath, "utf-8");
          const statusJson: StatusJson = JSON.parse(statusContent);

          // Find the lane config from plan
          const laneConfig = plan.lanes.find((l) => l.laneId === lane.laneId);
          if (laneConfig) {
            // Reset lane state for retry
            laneState.status = "pending";
            laneState.startedAt = undefined;
            laneState.stoppedAt = undefined;
            laneState.exitCode = undefined;

            // Restart the lane
            await this.startLane(runSlug, plan, laneConfig, statusJson);
          }
        } catch (error) {
          console.error(`[AgentOrchestrator] Failed to retry lane ${lane.laneId}:`, error);
          this.markLaneAsFailed(runSlug, lane, laneState, "Retry failed");
        }
      }, backoffMs);

    } else {
      // Max retries exhausted - mark as failed
      retryState.status = "exhausted";
      this.markLaneAsFailed(runSlug, lane, laneState, `Max retries (${MAX_RETRY_ATTEMPTS}) exhausted`);
    }
  }

  // Mark lane as permanently failed after max retries
  private async markLaneAsFailed(
    runSlug: string,
    lane: Lane,
    laneState: LaneProcessState,
    reason: string
  ): Promise<void> {
    laneState.status = "failed";
    laneState.error = reason;

    console.log(`[AgentOrchestrator] Lane ${lane.laneId} permanently failed: ${reason}`);

    // Emit status change event
    emitLaneStatusChange({
      runSlug,
      laneId: lane.laneId,
      previousStatus: "in_progress" as LaneStatus,
      newStatus: "failed" as LaneStatus,
      timestamp: new Date().toISOString(),
    });

    // Update status.json
    await this.updateStatusJsonRetryState(runSlug, lane.laneId, laneState.retryState);

    // Continue with normal failure handling
    this.onLaneComplete(runSlug, lane.laneId, false);
  }

  // Update status.json with retry state
  private async updateStatusJsonRetryState(
    runSlug: string,
    laneId: string,
    retryState?: RetryState
  ): Promise<void> {
    try {
      const runDir = path.join(os.homedir(), ".openclaw/workspace/warroom/runs", runSlug);
      const statusPath = path.join(runDir, "status.json");
      const statusContent = await fs.readFile(statusPath, "utf-8");
      const statusJson: StatusJson = JSON.parse(statusContent);

      if (!statusJson.lanes) statusJson.lanes = {};
      if (!statusJson.lanes[laneId]) statusJson.lanes[laneId] = { staged: true, status: "pending" };

      statusJson.lanes[laneId].retryState = retryState;
      statusJson.updatedAt = new Date().toISOString();

      await fs.writeFile(statusPath, JSON.stringify(statusJson, null, 2));
    } catch (error) {
      console.error(`[AgentOrchestrator] Failed to update retry state in status.json:`, error);
    }
  }

  // Spawn a Claude Code process
  private async spawnClaudeProcess(
    worktreePath: string,
    laneId: string,
    runSlug: string,
    skipPermissions: boolean
  ): Promise<ChildProcess> {
    const claudeArgs = skipPermissions ? ["--dangerously-skip-permissions"] : [];

    // Spawn Claude Code in the worktree directory
    const childProcess = spawn("claude", claudeArgs, {
      cwd: worktreePath,
      stdio: ["pipe", "pipe", "pipe"],
      detached: false,
      env: {
        ...process.env,
        // Set window title environment variable for identification
        CLAUDE_LANE_ID: laneId,
        CLAUDE_RUN_SLUG: runSlug,
      },
    });

    console.log(`[AgentOrchestrator] Spawned Claude process for ${laneId}, PID: ${childProcess.pid}`);

    return childProcess;
  }

  // Handle lane completion with auto-commit and optional auto-push
  private async handleLaneCompletion(
    runSlug: string,
    lane: Lane,
    laneState: LaneProcessState
  ): Promise<void> {
    const laneId = lane.laneId;

    console.log(`[AgentOrchestrator] Handling completion for lane ${laneId}`);

    // Auto-commit any uncommitted work
    const commitResult = await autoCommitLaneWork(lane.worktreePath, laneId);

    if (commitResult.success) {
      if (commitResult.committed) {
        console.log(`[AgentOrchestrator] Auto-committed lane ${laneId}: ${commitResult.commitHash}`);

        // Emit commit activity event
        emitLaneActivity({
          runSlug,
          laneId,
          type: "commit",
          message: commitResult.commitMessage,
          details: {
            stream: "stdout",
            line: `Auto-committed ${commitResult.filesChanged} file(s): ${commitResult.commitHash}`,
          },
          timestamp: new Date().toISOString(),
        });

        // Check if auto-push is enabled for lane branches
        await this.autoPushLaneBranch(runSlug, lane);
      } else {
        console.log(`[AgentOrchestrator] No uncommitted changes in lane ${laneId}, skipping commit`);
      }

      // Mark lane as complete
      laneState.status = "complete";

      // Emit status change event
      emitLaneStatusChange({
        runSlug,
        laneId,
        previousStatus: "in_progress" as LaneStatus,
        newStatus: "complete" as LaneStatus,
        timestamp: new Date().toISOString(),
      });

      // Continue with lane completion flow
      this.onLaneComplete(runSlug, laneId, true);
    } else {
      // Commit failed - log but still mark as complete since the work itself succeeded
      console.error(`[AgentOrchestrator] Auto-commit failed for lane ${laneId}: ${commitResult.error}`);

      // Emit activity event about commit failure
      emitLaneActivity({
        runSlug,
        laneId,
        type: "status",
        message: `Auto-commit failed: ${commitResult.error}`,
        timestamp: new Date().toISOString(),
      });

      // Still mark lane as complete - the agent's work succeeded
      laneState.status = "complete";

      // Emit status change event
      emitLaneStatusChange({
        runSlug,
        laneId,
        previousStatus: "in_progress" as LaneStatus,
        newStatus: "complete" as LaneStatus,
        timestamp: new Date().toISOString(),
      });

      // Continue with lane completion flow
      this.onLaneComplete(runSlug, laneId, true);
    }
  }

  // Auto-push lane branch if enabled
  private async autoPushLaneBranch(runSlug: string, lane: Lane): Promise<void> {
    try {
      // Read status.json to check auto-push options
      const runDir = path.join(os.homedir(), ".openclaw/workspace/warroom/runs", runSlug);
      const statusPath = path.join(runDir, "status.json");
      const statusContent = await fs.readFile(statusPath, "utf-8");
      const statusJson: StatusJson = JSON.parse(statusContent);

      // Check if auto-push for lane branches is enabled
      if (!statusJson.autoPushOptions?.pushLaneBranches) {
        console.log(`[AgentOrchestrator] Auto-push disabled for lane branches, skipping push for ${lane.laneId}`);
        return;
      }

      console.log(`[AgentOrchestrator] Auto-pushing lane branch ${lane.branch}`);

      // Emit push started activity
      emitLaneActivity({
        runSlug,
        laneId: lane.laneId,
        type: "status",
        message: `Pushing branch ${lane.branch}...`,
        details: {
          pushType: "lane",
          status: "pushing",
        },
        timestamp: new Date().toISOString(),
      });

      // Push the lane branch
      const pushResult = await pushLaneBranch(lane.worktreePath, lane.branch);

      // Update push state in status.json
      const pushState: PushState = {
        status: pushResult.success ? "success" : "failed",
        lastPushedAt: pushResult.success ? new Date().toISOString() : undefined,
        error: pushResult.error,
        pushType: "lane",
      };

      await this.updateLanePushState(runSlug, lane.laneId, pushState);

      if (pushResult.success) {
        console.log(`[AgentOrchestrator] Successfully pushed lane branch ${lane.branch}`);

        emitLaneActivity({
          runSlug,
          laneId: lane.laneId,
          type: "status",
          message: `Successfully pushed branch ${lane.branch} to origin`,
          details: {
            pushType: "lane",
            status: "success",
          },
          timestamp: new Date().toISOString(),
        });
      } else {
        console.error(`[AgentOrchestrator] Failed to push lane branch ${lane.branch}: ${pushResult.error}`);

        emitLaneActivity({
          runSlug,
          laneId: lane.laneId,
          type: "status",
          message: `Push failed for branch ${lane.branch}: ${pushResult.error}`,
          details: {
            pushType: "lane",
            status: "failed",
            errorType: pushResult.errorType,
          },
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error(`[AgentOrchestrator] Error during auto-push for lane ${lane.laneId}:`, error);
    }
  }

  // Update lane push state in status.json
  private async updateLanePushState(
    runSlug: string,
    laneId: string,
    pushState: PushState
  ): Promise<void> {
    try {
      const runDir = path.join(os.homedir(), ".openclaw/workspace/warroom/runs", runSlug);
      const statusPath = path.join(runDir, "status.json");
      const statusContent = await fs.readFile(statusPath, "utf-8");
      const statusJson: StatusJson = JSON.parse(statusContent);

      if (!statusJson.lanes) statusJson.lanes = {};
      if (!statusJson.lanes[laneId]) statusJson.lanes[laneId] = { staged: true, status: "pending" };

      statusJson.lanes[laneId].pushState = pushState;
      statusJson.updatedAt = new Date().toISOString();

      await fs.writeFile(statusPath, JSON.stringify(statusJson, null, 2));
    } catch (error) {
      console.error(`[AgentOrchestrator] Failed to update lane push state in status.json:`, error);
    }
  }

  // Auto-push integration branch if enabled
  private async autoPushIntegrationBranch(
    runSlug: string,
    repoPath: string,
    integrationBranch: string
  ): Promise<void> {
    try {
      // Read status.json to check auto-push options
      const runDir = path.join(os.homedir(), ".openclaw/workspace/warroom/runs", runSlug);
      const statusPath = path.join(runDir, "status.json");
      const statusContent = await fs.readFile(statusPath, "utf-8");
      const statusJson: StatusJson = JSON.parse(statusContent);

      // Check if auto-push for integration branch is enabled
      if (!statusJson.autoPushOptions?.pushIntegrationBranch) {
        console.log(`[AgentOrchestrator] Auto-push disabled for integration branch, skipping push`);
        return;
      }

      console.log(`[AgentOrchestrator] Auto-pushing integration branch ${integrationBranch}`);

      // Emit push started event
      emitMergeProgress({
        runSlug,
        status: "pushing",
        message: `Pushing integration branch ${integrationBranch}...`,
        mergedLanes: statusJson.mergeState?.mergedLanes || [],
        timestamp: new Date().toISOString(),
      });

      // Push the integration branch
      const pushResult = await pushIntegrationBranch(repoPath, integrationBranch);

      // Update push state in status.json
      const pushState: PushState = {
        status: pushResult.success ? "success" : "failed",
        lastPushedAt: pushResult.success ? new Date().toISOString() : undefined,
        error: pushResult.error,
        pushType: "integration",
      };

      await this.updateIntegrationBranchPushState(runSlug, pushState);

      if (pushResult.success) {
        console.log(`[AgentOrchestrator] Successfully pushed integration branch ${integrationBranch}`);

        emitMergeProgress({
          runSlug,
          status: "pushed",
          message: `Successfully pushed integration branch ${integrationBranch} to origin`,
          mergedLanes: statusJson.mergeState?.mergedLanes || [],
          timestamp: new Date().toISOString(),
        });
      } else {
        console.error(`[AgentOrchestrator] Failed to push integration branch: ${pushResult.error}`);

        emitMergeProgress({
          runSlug,
          status: "push_failed",
          message: `Push failed for integration branch: ${pushResult.error}`,
          error: pushResult.error,
          mergedLanes: statusJson.mergeState?.mergedLanes || [],
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error(`[AgentOrchestrator] Error during auto-push for integration branch:`, error);
    }
  }

  // Update integration branch push state in status.json
  private async updateIntegrationBranchPushState(
    runSlug: string,
    pushState: PushState
  ): Promise<void> {
    try {
      const runDir = path.join(os.homedir(), ".openclaw/workspace/warroom/runs", runSlug);
      const statusPath = path.join(runDir, "status.json");
      const statusContent = await fs.readFile(statusPath, "utf-8");
      const statusJson: StatusJson = JSON.parse(statusContent);

      statusJson.integrationBranchPushState = pushState;
      statusJson.updatedAt = new Date().toISOString();

      await fs.writeFile(statusPath, JSON.stringify(statusJson, null, 2));
    } catch (error) {
      console.error(`[AgentOrchestrator] Failed to update integration branch push state in status.json:`, error);
    }
  }

  // Handle lane completion
  private async onLaneComplete(runSlug: string, laneId: string, success: boolean): Promise<void> {
    const runState = this.runs.get(runSlug);
    if (!runState) return;

    // Update status.json
    try {
      const runDir = path.join(os.homedir(), ".openclaw/workspace/warroom/runs", runSlug);
      const statusPath = path.join(runDir, "status.json");
      const statusContent = await fs.readFile(statusPath, "utf-8");
      const statusJson: StatusJson = JSON.parse(statusContent);

      if (!statusJson.lanes) statusJson.lanes = {};
      if (!statusJson.lanes[laneId]) statusJson.lanes[laneId] = { staged: true, status: "pending" };

      statusJson.lanes[laneId].status = success ? "complete" : "failed";

      if (success) {
        if (!statusJson.lanesCompleted) statusJson.lanesCompleted = [];
        if (!statusJson.lanesCompleted.includes(laneId)) {
          statusJson.lanesCompleted.push(laneId);
        }
      }

      statusJson.updatedAt = new Date().toISOString();
      await fs.writeFile(statusPath, JSON.stringify(statusJson, null, 2));

      // Load plan to check for more lanes to start
      const planPath = path.join(runDir, "plan.json");
      const planContent = await fs.readFile(planPath, "utf-8");
      const plan: WarRoomPlan = JSON.parse(planContent);

      // Try to start more lanes
      await this.startReadyLanes(runSlug, plan, statusJson);

      // Check if all lanes are complete (all successful)
      const allSuccessfullyComplete = Array.from(runState.lanes.values()).every(
        (lane) => lane.status === "complete"
      );

      // Check if all lanes are finished (complete or permanently failed)
      const allFinished = Array.from(runState.lanes.values()).every(
        (lane) => lane.status === "complete" || (lane.status === "failed" && lane.retryState?.status === "exhausted")
      );

      if (allSuccessfullyComplete) {
        console.log(`[AgentOrchestrator] All lanes complete for run ${runSlug}, starting auto-merge`);

        // Emit merge-ready event
        const completedLanes = Array.from(runState.lanes.values())
          .filter((l) => l.status === "complete")
          .map((l) => l.laneId);
        emitMergeReady({
          runSlug,
          lanesComplete: completedLanes,
          timestamp: new Date().toISOString(),
        });

        // Start auto-merge process
        await this.startAutoMerge(runSlug, plan, statusJson);
      } else if (allFinished) {
        // Some lanes failed - mark run as failed
        runState.status = "failed";
        runState.stoppedAt = new Date().toISOString();
        console.log(`[AgentOrchestrator] Run ${runSlug} failed - some lanes could not complete`);

        emitRunComplete({
          runSlug,
          success: false,
          message: "Some lanes failed to complete",
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error(`[AgentOrchestrator] Failed to update status after lane completion:`, error);
    }
  }

  // Start auto-merge process when all lanes are complete
  private async startAutoMerge(
    runSlug: string,
    plan: WarRoomPlan,
    statusJson: StatusJson
  ): Promise<void> {
    const runState = this.runs.get(runSlug);
    if (!runState) return;

    // Initialize merge state
    runState.status = "merging";
    runState.mergeState = {
      status: "in_progress",
      mergedLanes: [],
      updatedAt: new Date().toISOString(),
    };

    console.log(`[AgentOrchestrator] Starting auto-merge for run ${runSlug}`);

    // Emit merge started event
    emitMergeProgress({
      runSlug,
      status: "started",
      mergedLanes: [],
      timestamp: new Date().toISOString(),
    });

    try {
      // Get completed lane info for merging
      const lanesToMerge = plan.lanes
        .filter((lane) => statusJson.lanesCompleted?.includes(lane.laneId))
        .map((lane) => ({
          laneId: lane.laneId,
          branch: lane.branch,
          dependsOn: lane.dependsOn,
        }));

      // Execute auto-merge
      const mergeResult = await autoMergeLanes(
        plan.repo.path,
        plan.integrationBranch,
        lanesToMerge,
        plan.merge.method
      );

      if (mergeResult.success) {
        // All lanes merged successfully
        runState.mergeState = {
          status: "complete",
          mergedLanes: mergeResult.mergedLanes,
          updatedAt: new Date().toISOString(),
        };

        // Update status.json with merge state
        await this.updateMergeStateInStatusJson(runSlug, runState.mergeState);

        // Auto-push integration branch if enabled
        await this.autoPushIntegrationBranch(runSlug, plan.repo.path, plan.integrationBranch);

        // Emit merge complete event
        emitMergeProgress({
          runSlug,
          status: "complete",
          mergedLanes: mergeResult.mergedLanes,
          timestamp: new Date().toISOString(),
        });

        // Run is now waiting for human gate to merge to main
        runState.status = "complete";
        runState.stoppedAt = new Date().toISOString();
        console.log(`[AgentOrchestrator] Auto-merge complete for run ${runSlug}. Awaiting human gate for main merge.`);

        emitRunComplete({
          runSlug,
          success: true,
          message: "All lanes merged to integration branch. Awaiting human approval to merge to main.",
          timestamp: new Date().toISOString(),
        });
      } else if (mergeResult.conflict) {
        // Conflict detected - stop and mark lane as conflict
        console.log(`[AgentOrchestrator] Merge conflict detected in lane ${mergeResult.conflict.laneId}`);

        runState.mergeState = {
          status: "conflict",
          mergedLanes: mergeResult.mergedLanes,
          conflictInfo: mergeResult.conflict,
          updatedAt: new Date().toISOString(),
        };

        // Update the conflicting lane's status
        const conflictingLaneState = runState.lanes.get(mergeResult.conflict.laneId);
        if (conflictingLaneState) {
          conflictingLaneState.status = "failed";
          conflictingLaneState.error = "Merge conflict";
        }

        // Update status.json
        await this.updateMergeStateInStatusJson(runSlug, runState.mergeState);
        await this.updateLaneStatusInStatusJson(
          runSlug,
          mergeResult.conflict.laneId,
          "conflict"
        );

        // Emit conflict event
        emitMergeProgress({
          runSlug,
          status: "conflict",
          mergedLanes: mergeResult.mergedLanes,
          conflictInfo: mergeResult.conflict,
          timestamp: new Date().toISOString(),
        });

        // Emit lane status change for conflict
        emitLaneStatusChange({
          runSlug,
          laneId: mergeResult.conflict.laneId,
          previousStatus: "complete",
          newStatus: "conflict",
          timestamp: new Date().toISOString(),
        });
      } else {
        // Non-conflict failure
        console.error(`[AgentOrchestrator] Auto-merge failed for run ${runSlug}: ${mergeResult.error}`);

        runState.mergeState = {
          status: "failed",
          mergedLanes: mergeResult.mergedLanes,
          error: mergeResult.error,
          updatedAt: new Date().toISOString(),
        };

        await this.updateMergeStateInStatusJson(runSlug, runState.mergeState);

        emitMergeProgress({
          runSlug,
          status: "failed",
          mergedLanes: mergeResult.mergedLanes,
          error: mergeResult.error,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[AgentOrchestrator] Auto-merge error for run ${runSlug}:`, error);

      runState.mergeState = {
        status: "failed",
        mergedLanes: [],
        error: errorMessage,
        updatedAt: new Date().toISOString(),
      };

      await this.updateMergeStateInStatusJson(runSlug, runState.mergeState);

      emitMergeProgress({
        runSlug,
        status: "failed",
        mergedLanes: [],
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Update merge state in status.json
  private async updateMergeStateInStatusJson(
    runSlug: string,
    mergeState: MergeState
  ): Promise<void> {
    try {
      const runDir = path.join(os.homedir(), ".openclaw/workspace/warroom/runs", runSlug);
      const statusPath = path.join(runDir, "status.json");
      const statusContent = await fs.readFile(statusPath, "utf-8");
      const statusJson: StatusJson = JSON.parse(statusContent);

      statusJson.mergeState = mergeState;
      statusJson.updatedAt = new Date().toISOString();

      // Update run status based on merge state
      if (mergeState.status === "complete") {
        statusJson.status = "merging"; // Waiting for human gate to merge to main
      }

      await fs.writeFile(statusPath, JSON.stringify(statusJson, null, 2));
    } catch (error) {
      console.error(`[AgentOrchestrator] Failed to update merge state in status.json:`, error);
    }
  }

  // Update a lane's status in status.json
  private async updateLaneStatusInStatusJson(
    runSlug: string,
    laneId: string,
    status: LaneStatus
  ): Promise<void> {
    try {
      const runDir = path.join(os.homedir(), ".openclaw/workspace/warroom/runs", runSlug);
      const statusPath = path.join(runDir, "status.json");
      const statusContent = await fs.readFile(statusPath, "utf-8");
      const statusJson: StatusJson = JSON.parse(statusContent);

      if (!statusJson.lanes) statusJson.lanes = {};
      if (!statusJson.lanes[laneId]) statusJson.lanes[laneId] = { staged: true, status: "pending" };

      statusJson.lanes[laneId].status = status;
      statusJson.updatedAt = new Date().toISOString();

      await fs.writeFile(statusPath, JSON.stringify(statusJson, null, 2));
    } catch (error) {
      console.error(`[AgentOrchestrator] Failed to update lane status in status.json:`, error);
    }
  }

  // Stop a run - terminates all lane processes
  public async stopRun(runSlug: string): Promise<void> {
    const runState = this.runs.get(runSlug);
    if (!runState) return;

    runState.status = "stopping";
    console.log(`[AgentOrchestrator] Stopping run ${runSlug}...`);

    // Stop all lane processes (both direct processes and terminal windows)
    const stopPromises: Promise<void>[] = [];
    for (const [, laneState] of runState.lanes) {
      // Clear any pending retry timers
      if (laneState.retryTimer) {
        clearTimeout(laneState.retryTimer);
        laneState.retryTimer = undefined;
      }

      // Check for running or retrying lanes with either a process or terminal window
      const hasProcess = laneState.process !== null;
      const hasTerminal = laneState.terminal && laneState.windowId;

      if ((laneState.status === "running" || laneState.status === "retrying") && (hasProcess || hasTerminal)) {
        stopPromises.push(this.stopLaneProcess(laneState));
      }
    }

    await Promise.all(stopPromises);

    runState.status = "stopped";
    runState.stoppedAt = new Date().toISOString();
    console.log(`[AgentOrchestrator] Run ${runSlug} stopped`);
  }

  // Stop a single lane process (handles both direct processes and terminal windows)
  private async stopLaneProcess(laneState: LaneProcessState): Promise<void> {
    // Handle terminal window mode
    if (laneState.launchMode === "terminal" && laneState.terminal && laneState.windowId) {
      try {
        await closeTerminalWindow(laneState.terminal, laneState.windowId);
        laneState.status = "stopped";
        laneState.stoppedAt = new Date().toISOString();
        console.log(`[AgentOrchestrator] Closed terminal window for ${laneState.laneId}`);
      } catch (error) {
        console.error(`[AgentOrchestrator] Failed to close terminal window:`, error);
      }
      return;
    }

    // Handle direct process mode
    if (!laneState.process) return;

    return new Promise((resolve) => {
      const process = laneState.process!;
      const timeout = setTimeout(() => {
        // Force kill if graceful shutdown fails
        process.kill("SIGKILL");
        laneState.status = "stopped";
        resolve();
      }, 5000);

      process.once("exit", () => {
        clearTimeout(timeout);
        laneState.status = "stopped";
        laneState.stoppedAt = new Date().toISOString();
        resolve();
      });

      // Send SIGTERM for graceful shutdown
      process.kill("SIGTERM");
    });
  }

  // Pause a lane - sends SIGSTOP to pause the process
  public async pauseLane(runSlug: string, laneId: string): Promise<{ success: boolean; error?: string }> {
    const runState = this.runs.get(runSlug);
    if (!runState) {
      return { success: false, error: "Run not found" };
    }

    const laneState = runState.lanes.get(laneId);
    if (!laneState) {
      return { success: false, error: "Lane not found" };
    }

    if (laneState.status !== "running") {
      return { success: false, error: "Lane is not running" };
    }

    // Terminal mode doesn't support pause/resume via SIGSTOP
    if (laneState.launchMode === "terminal") {
      return { success: false, error: "Cannot pause terminal mode lanes - close the window to stop" };
    }

    if (!laneState.process) {
      return { success: false, error: "Lane has no process" };
    }

    try {
      laneState.process.kill("SIGSTOP");
      laneState.status = "paused";
      console.log(`[AgentOrchestrator] Paused lane ${laneId}`);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Resume a lane - sends SIGCONT to resume the process
  public async resumeLane(runSlug: string, laneId: string): Promise<{ success: boolean; error?: string }> {
    const runState = this.runs.get(runSlug);
    if (!runState) {
      return { success: false, error: "Run not found" };
    }

    const laneState = runState.lanes.get(laneId);
    if (!laneState) {
      return { success: false, error: "Lane not found" };
    }

    if (laneState.status !== "paused") {
      return { success: false, error: "Lane is not paused" };
    }

    // Terminal mode doesn't support pause/resume
    if (laneState.launchMode === "terminal") {
      return { success: false, error: "Cannot resume terminal mode lanes" };
    }

    if (!laneState.process) {
      return { success: false, error: "Lane has no process" };
    }

    try {
      laneState.process.kill("SIGCONT");
      laneState.status = "running";
      console.log(`[AgentOrchestrator] Resumed lane ${laneId}`);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Get orchestrator status
  public getStatus(): OrchestratorStatus {
    const activeRuns: string[] = [];
    const runStatuses: OrchestratorStatus["runStatuses"] = {};

    for (const [runSlug, runState] of this.runs) {
      if (runState.status === "running" || runState.status === "starting") {
        activeRuns.push(runSlug);
      }

      const laneStatuses: Record<string, Omit<LaneProcessState, "process">> = {};
      for (const [laneId, laneState] of runState.lanes) {
        // Omit the process object from the response (terminal info is kept)
        const { process: _process, ...rest } = laneState;
        laneStatuses[laneId] = rest;
      }

      runStatuses[runSlug] = {
        status: runState.status,
        lanes: laneStatuses,
        startedAt: runState.startedAt,
        stoppedAt: runState.stoppedAt,
      };
    }

    return {
      isRunning: activeRuns.length > 0,
      activeRuns,
      runStatuses,
    };
  }

  // Get status for a specific run
  public getRunStatus(runSlug: string): RunOrchestrationState | null {
    return this.runs.get(runSlug) || null;
  }

  // Check if a run is active
  public isRunActive(runSlug: string): boolean {
    const runState = this.runs.get(runSlug);
    return runState?.status === "running" || runState?.status === "starting";
  }

  // Get output for a specific lane
  public getLaneOutput(runSlug: string, laneId: string): LaneOutputState | null {
    return getLaneOutput(runSlug, laneId);
  }

  // Get recent output lines for a lane
  public getRecentOutput(runSlug: string, laneId: string, count?: number): OutputLine[] {
    return getRecentOutput(runSlug, laneId, count);
  }

  // Get errors detected in lane output
  public getLaneErrors(runSlug: string, laneId: string): DetectedError[] {
    return getLaneErrors(runSlug, laneId);
  }

  // Check if lane has errors in output
  public hasLaneErrors(runSlug: string, laneId: string): boolean {
    return hasLaneErrors(runSlug, laneId);
  }
}

// Export singleton getter
export function getOrchestrator(): AgentOrchestrator {
  return AgentOrchestrator.getInstance();
}

// Export convenience methods
export async function startRun(runSlug: string): Promise<{ success: boolean; error?: string }> {
  return getOrchestrator().startRun(runSlug);
}

export async function stopRun(runSlug: string): Promise<void> {
  return getOrchestrator().stopRun(runSlug);
}

export async function pauseLane(runSlug: string, laneId: string): Promise<{ success: boolean; error?: string }> {
  return getOrchestrator().pauseLane(runSlug, laneId);
}

export async function resumeLane(runSlug: string, laneId: string): Promise<{ success: boolean; error?: string }> {
  return getOrchestrator().resumeLane(runSlug, laneId);
}

export function getOrchestratorStatus(): OrchestratorStatus {
  return getOrchestrator().getStatus();
}

export function getOrchestratorLaneOutput(runSlug: string, laneId: string): LaneOutputState | null {
  return getOrchestrator().getLaneOutput(runSlug, laneId);
}

export function getOrchestratorRecentOutput(runSlug: string, laneId: string, count?: number): OutputLine[] {
  return getOrchestrator().getRecentOutput(runSlug, laneId, count);
}

export function getOrchestratorLaneErrors(runSlug: string, laneId: string): DetectedError[] {
  return getOrchestrator().getLaneErrors(runSlug, laneId);
}

export function hasOrchestratorLaneErrors(runSlug: string, laneId: string): boolean {
  return getOrchestrator().hasLaneErrors(runSlug, laneId);
}
