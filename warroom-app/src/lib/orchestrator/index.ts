// AgentOrchestrator module exports

export {
  getOrchestrator,
  startRun,
  stopRun,
  pauseLane,
  resumeLane,
  getOrchestratorStatus,
} from "./agent-orchestrator";

export type {
  LaneProcessState,
  RunOrchestrationState,
  OrchestratorStatus,
} from "./agent-orchestrator";

// Terminal spawner exports
export {
  spawnTerminal,
  hasIterm,
  closeTerminalWindow,
  isTerminalWindowOpen,
  getOpenTerminalSessions,
  sendToTerminal,
} from "./terminal-spawner";

export type {
  SpawnTerminalResult,
  SpawnTerminalOptions,
} from "./terminal-spawner";
