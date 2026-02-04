// AgentOrchestrator - Singleton class for managing Claude Code agent processes
// Manages the lifecycle of all Claude Code processes for a run

import { ChildProcess, spawn, exec } from "child_process";
import { promisify } from "util";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { LaneStatus, WarRoomPlan, StatusJson, Lane } from "../plan-schema";
import { emitLaneStatusChange } from "../websocket/server";

const execAsync = promisify(exec);

// Lane process state
export interface LaneProcessState {
  laneId: string;
  process: ChildProcess | null;
  status: "pending" | "starting" | "running" | "paused" | "stopped" | "complete" | "failed";
  startedAt?: string;
  stoppedAt?: string;
  exitCode?: number | null;
  error?: string;
}

// Run orchestration state
export interface RunOrchestrationState {
  runSlug: string;
  status: "idle" | "starting" | "running" | "stopping" | "stopped" | "complete" | "failed";
  lanes: Map<string, LaneProcessState>;
  startedAt?: string;
  stoppedAt?: string;
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

// Check if iTerm2 is installed
async function hasIterm(): Promise<boolean> {
  try {
    await fs.access("/Applications/iTerm.app");
    return true;
  } catch {
    return false;
  }
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
      // Get autonomy settings
      const laneStatusEntry = statusJson.lanes?.[lane.laneId];
      const skipPermissions = laneStatusEntry?.autonomy?.dangerouslySkipPermissions ??
                             lane.autonomy?.dangerouslySkipPermissions ?? false;

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

      // Spawn the Claude Code process
      const claudeProcess = await this.spawnClaudeProcess(
        worktreePath,
        lane.laneId,
        runSlug,
        skipPermissions
      );

      laneState.process = claudeProcess;
      laneState.status = "running";

      // Emit status change
      emitLaneStatusChange({
        runSlug,
        laneId: lane.laneId,
        previousStatus: "pending" as LaneStatus,
        newStatus: "in_progress" as LaneStatus,
        timestamp: new Date().toISOString(),
      });

      // Handle process exit
      claudeProcess.on("exit", (code) => {
        laneState.exitCode = code;
        laneState.stoppedAt = new Date().toISOString();
        laneState.status = code === 0 ? "complete" : "failed";

        console.log(`[AgentOrchestrator] Lane ${lane.laneId} exited with code ${code}`);

        // Emit status change event
        emitLaneStatusChange({
          runSlug,
          laneId: lane.laneId,
          previousStatus: "in_progress" as LaneStatus,
          newStatus: (laneState.status === "complete" ? "complete" : "failed") as LaneStatus,
          timestamp: new Date().toISOString(),
        });

        // Check if we should start more lanes
        this.onLaneComplete(runSlug, lane.laneId, code === 0);
      });

      // Handle process errors
      claudeProcess.on("error", (error) => {
        laneState.status = "failed";
        laneState.error = error.message;
        console.error(`[AgentOrchestrator] Lane ${lane.laneId} error:`, error);
      });

    } catch (error) {
      laneState.status = "failed";
      laneState.error = error instanceof Error ? error.message : String(error);
      console.error(`[AgentOrchestrator] Failed to start lane ${lane.laneId}:`, error);
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

      // Check if all lanes are complete
      const allComplete = Array.from(runState.lanes.values()).every(
        (lane) => lane.status === "complete" || lane.status === "failed"
      );

      if (allComplete) {
        runState.status = "complete";
        runState.stoppedAt = new Date().toISOString();
        console.log(`[AgentOrchestrator] Run ${runSlug} complete`);
      }
    } catch (error) {
      console.error(`[AgentOrchestrator] Failed to update status after lane completion:`, error);
    }
  }

  // Stop a run - terminates all lane processes
  public async stopRun(runSlug: string): Promise<void> {
    const runState = this.runs.get(runSlug);
    if (!runState) return;

    runState.status = "stopping";
    console.log(`[AgentOrchestrator] Stopping run ${runSlug}...`);

    // Stop all lane processes
    const stopPromises: Promise<void>[] = [];
    for (const [laneId, laneState] of runState.lanes) {
      if (laneState.process && laneState.status === "running") {
        stopPromises.push(this.stopLaneProcess(laneState));
      }
    }

    await Promise.all(stopPromises);

    runState.status = "stopped";
    runState.stoppedAt = new Date().toISOString();
    console.log(`[AgentOrchestrator] Run ${runSlug} stopped`);
  }

  // Stop a single lane process
  private async stopLaneProcess(laneState: LaneProcessState): Promise<void> {
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

    if (!laneState.process || laneState.status !== "running") {
      return { success: false, error: "Lane is not running" };
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

    if (!laneState.process || laneState.status !== "paused") {
      return { success: false, error: "Lane is not paused" };
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
        // Omit the process object from the response
        const { process, ...rest } = laneState;
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
