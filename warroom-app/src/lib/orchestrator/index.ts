// AgentOrchestrator module exports

export {
  getOrchestrator,
  startRun,
  stopRun,
  pauseLane,
  resumeLane,
  getOrchestratorStatus,
  getOrchestratorLaneOutput,
  getOrchestratorRecentOutput,
  getOrchestratorLaneErrors,
  hasOrchestratorLaneErrors,
} from "./agent-orchestrator";

export type {
  LaneProcessState,
  RunOrchestrationState,
  OrchestratorStatus,
} from "./agent-orchestrator";

// Output buffer exports
export {
  getOutputBufferManager,
  addOutputLine,
  getLaneOutput,
  getRecentOutput,
  getRunOutputs,
  clearLaneOutput,
  clearRunOutputs,
  hasLaneErrors,
  getLaneErrors,
  getLaneCostTracking,
  getRunCostTracking,
} from "./output-buffer";

export type {
  OutputLine,
  ProgressIndicator,
  DetectedError,
  LaneOutputState,
} from "./output-buffer";

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

// Git operations exports
export {
  autoCommitLaneWork,
  hasUncommittedChanges,
  getUncommittedFileCount,
  readLaneStatus,
  isLaneStatusComplete,
  autoMergeLanes,
  mergeLaneBranch,
  abortAutoMerge,
  getMainBranch,
  integrationBranchExists,
  // Push operations
  pushBranch,
  pushLaneBranch,
  pushIntegrationBranch,
  hasRemoteTrackingBranch,
  getCurrentBranch,
  isProtectedMainBranch,
} from "./git-operations";

export type {
  AutoCommitResult,
  AutoMergeResult,
  MergeLaneResult,
  PushResult,
} from "./git-operations";
