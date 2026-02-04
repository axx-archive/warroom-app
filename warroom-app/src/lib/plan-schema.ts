// Plan JSON Schema - TypeScript types for War Room plan.json
// Must match the schema defined in WARROOM_PACKET.md and PRD

export type AgentType =
  | "developer"
  | "staff-engineer-reviewer"
  | "doc-updater"
  | "techdebt"
  | "visual-qa"
  | "qa-tester"
  | "security-reviewer"
  | "architect"
  | "product-owner";

export type StartMode = "openclaw" | "claude_code_import";

export type MergeMethod = "merge" | "squash" | "cherry-pick";

export type WorkstreamType = "quick_task" | "ralph_workstream";

export type RunStatus =
  | "draft"
  | "ready_to_stage"
  | "staged"
  | "in_progress"
  | "merging"
  | "complete";

export interface Repo {
  name: string;
  path: string;
}

export interface Workstream {
  type: WorkstreamType;
  prdPath?: string;
  prdJsonPath?: string;
  nextStoryId?: string;
}

export interface LaneAutonomy {
  dangerouslySkipPermissions: boolean;
}

export interface LaneVerify {
  commands: string[];
  required: boolean;
}

export interface Lane {
  laneId: string;
  agent: AgentType;
  branch: string;
  worktreePath: string;
  packetName: "WARROOM_PACKET.md";
  dependsOn: string[];
  autonomy: LaneAutonomy;
  verify: LaneVerify;
  foundation?: boolean; // True if this lane handles scaffolding/foundation setup
  allowedPaths?: string[]; // Directories/files this lane may modify (guardrail)
}

export interface MergeConfig {
  proposedOrder: string[];
  method: MergeMethod;
  notes: string;
  requiresHuman: true;
}

export interface WarRoomPlan {
  runId: string; // UUID format
  runSlug: string; // Human-readable slug
  runDir: string; // Full path to run directory
  createdAt: string; // ISO-8601
  startMode: StartMode;
  repo: Repo;
  goal: string;
  workstream: Workstream;
  integrationBranch: string; // warroom/integration/<slug>
  lanes: Lane[];
  merge: MergeConfig;
}

export type LaneStatus = "pending" | "in_progress" | "complete" | "failed" | "conflict";

// Auto-merge state tracking
export interface MergeState {
  // Current merge status
  status: "idle" | "in_progress" | "complete" | "conflict" | "failed";
  // Lane currently being merged
  currentLane?: string;
  // Lanes that have been merged successfully
  mergedLanes: string[];
  // Conflict info if status is "conflict"
  conflictInfo?: {
    laneId: string;
    branch: string;
    conflictingFiles: string[];
  };
  // Error message if status is "failed"
  error?: string;
  // Timestamp of last update
  updatedAt: string;
}

// Launch mode determines how the lane is opened
export type LaunchMode = "cursor" | "terminal";

// Auto-completion detection log entry
export interface CompletionDetection {
  detected: boolean;
  reason?: string; // Primary reason for auto-completion
  signals: string[]; // All detected signals
  detectedAt?: string; // ISO-8601 timestamp when completion was auto-detected
  autoMarked?: boolean; // True if lane was automatically marked complete
}

// Auto-retry state for failed lanes
export interface RetryState {
  // Current retry attempt (1-3)
  attempt: number;
  // Maximum retry attempts
  maxAttempts: number;
  // Timestamp when next retry is scheduled (ISO-8601)
  nextRetryAt?: string;
  // History of retry attempts
  history: RetryAttempt[];
  // Status: waiting for retry, retrying, or exhausted
  status: "waiting" | "retrying" | "exhausted";
}

// Record of a single retry attempt
export interface RetryAttempt {
  attempt: number;
  startedAt: string;
  endedAt?: string;
  exitCode?: number | null;
  error?: string;
  backoffSeconds: number;
}

export interface LaneStatusEntry {
  staged: boolean;
  status: LaneStatus;
  autonomy?: LaneAutonomy;
  launchMode?: LaunchMode; // How to launch: 'cursor' for Cursor IDE, 'terminal' for iTerm2/Terminal.app with Claude Code
  commitsAtLaunch?: number; // Track commit count when lane was launched
  suggestionDismissed?: boolean; // True if user dismissed completion suggestion
  lastActivityAt?: string; // ISO-8601 timestamp of last file activity in worktree
  completionDetection?: CompletionDetection; // Auto-completion detection log
  retryState?: RetryState; // Auto-retry state for failed lanes
}

export interface StatusJson {
  runId: string;
  status: RunStatus;
  currentLane?: string;
  lanesCompleted?: string[];
  lanes?: Record<string, LaneStatusEntry>;
  mergeState?: MergeState;
  updatedAt: string;
}

// Generation request types
export interface GeneratePlanRequest {
  goal: string;
  repoPath: string;
  repoName?: string;
  workstreamType?: WorkstreamType;
  prdPath?: string;
  maxLanes?: number;
  autonomy?: boolean;
}

export interface GeneratePlanResponse {
  success: boolean;
  plan?: WarRoomPlan;
  runDir?: string;
  error?: string;
}

// Merge proposal types
export interface MergeProposalLane {
  laneId: string;
  branch: string;
  order: number;
  method: MergeMethod;
  dependsOn: string[];
  commitsAhead: number;
  conflictRisk: "none" | "low" | "medium" | "high";
  overlappingLanes: string[];
  notes: string;
}

export interface MergeProposal {
  runId: string;
  runSlug: string;
  createdAt: string;
  integrationBranch: string;
  mergeOrder: MergeProposalLane[];
  defaultMethod: MergeMethod;
  warnings: string[];
  pmPrompt: string;
}

// LANE_STATUS.json - Structured progress protocol for Claude Code agents
// Agents write this file to report their progress to the orchestrator
export interface LaneAgentStatus {
  // Current phase of work (e.g., "analyzing", "implementing", "testing", "completing")
  phase: string;
  // Steps that have been completed
  completedSteps: string[];
  // Currently executing step
  currentStep: string;
  // Overall progress percentage (0-100)
  progress: number;
  // Any blockers or issues the agent has encountered
  blockers: string[];
  // Timestamp of last update (ISO-8601)
  updatedAt: string;
  // Optional: summary of recent work
  summary?: string;
}
