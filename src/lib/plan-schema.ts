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

// Push state for tracking auto-push operations
export interface PushState {
  // Current push status
  status: "idle" | "pushing" | "success" | "failed";
  // Last successful push timestamp
  lastPushedAt?: string;
  // Error message if status is "failed"
  error?: string;
  // Whether push was for lane branch, integration branch, or main
  pushType?: "lane" | "integration" | "main";
}

// Auto-push options
export interface AutoPushOptions {
  // Full autonomy mode - enables all auto operations with single toggle
  fullAutonomyMode?: boolean;
  // Auto-push lane branches after commit
  pushLaneBranches: boolean;
  // Auto-push integration branch after merge
  pushIntegrationBranch: boolean;
  // Merge integration branch to main after lanes merge
  mergeToMain?: boolean;
  // Auto-push main branch after merge to main
  pushMainBranch?: boolean;
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
  pushState?: PushState; // Push state for tracking auto-push operations per lane
  costTracking?: CostTracking; // Token usage and cost tracking
}

export interface StatusJson {
  runId: string;
  status: RunStatus;
  currentLane?: string;
  lanesCompleted?: string[];
  lanes?: Record<string, LaneStatusEntry>;
  mergeState?: MergeState;
  autoPushOptions?: AutoPushOptions; // Auto-push options for the run
  integrationBranchPushState?: PushState; // Push state for the integration branch
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

// Token usage tracking for cost estimation
export interface TokenUsage {
  // Input tokens (prompt/context)
  inputTokens: number;
  // Output tokens (completion)
  outputTokens: number;
  // Cache read tokens (if using prompt caching)
  cacheReadTokens: number;
  // Cache write tokens (if using prompt caching)
  cacheWriteTokens: number;
  // Total tokens (input + output)
  totalTokens: number;
  // Timestamp of last update
  updatedAt: string;
}

// Cost tracking per lane
export interface CostTracking {
  // Model used for the lane (e.g., "claude-sonnet-4-20250514")
  model?: string;
  // Token usage breakdown
  tokenUsage: TokenUsage;
  // Estimated cost in USD (calculated from tokens and model pricing)
  estimatedCostUsd: number;
  // Whether the cost is an estimate or exact (some outputs may not provide full details)
  isEstimate: boolean;
}

// Template lane configuration (stripped of repo-specific paths)
export interface TemplateLane {
  // Lane identifier (may be modified when creating from template)
  laneId: string;
  // Agent type for the lane
  agent: AgentType;
  // Dependencies on other lanes (by laneId)
  dependsOn: string[];
  // Autonomy settings
  autonomy: LaneAutonomy;
  // Verification commands (templates, not path-specific)
  verify: LaneVerify;
  // Whether this is a foundation lane
  foundation?: boolean;
  // Allowed paths pattern (optional, can be customized when applying template)
  allowedPaths?: string[];
}

// Plan template for reuse
export interface PlanTemplate {
  // Unique template ID (UUID)
  id: string;
  // Human-readable template name
  name: string;
  // Description of what this template is good for
  description: string;
  // Template lanes (without repo-specific paths)
  lanes: TemplateLane[];
  // Default merge method
  mergeMethod: MergeMethod;
  // Merge notes
  mergeNotes: string;
  // When the template was created
  createdAt: string;
  // Source run slug (for reference)
  sourceRunSlug?: string;
  // Tags for categorization
  tags?: string[];
}

// History/Audit Log Event Types
export type HistoryEventType =
  | "lane_launched"
  | "lane_status_change"
  | "commit"
  | "merge_started"
  | "merge_lane_complete"
  | "merge_complete"
  | "merge_conflict"
  | "merge_failed"
  | "push_started"
  | "push_complete"
  | "push_failed"
  | "error"
  | "retry_scheduled"
  | "retry_started"
  | "mission_started"
  | "mission_stopped"
  | "mission_complete"
  | "lane_reset"
  | "lane_added";

// Base history event
export interface HistoryEventBase {
  // Unique event ID (UUID)
  id: string;
  // Event type
  type: HistoryEventType;
  // Timestamp of the event (ISO-8601)
  timestamp: string;
  // Lane ID if event is lane-specific
  laneId?: string;
  // Human-readable message describing the event
  message: string;
}

// Lane launched event
export interface LaneLaunchedEvent extends HistoryEventBase {
  type: "lane_launched";
  details: {
    launchMode: LaunchMode;
    autonomy: boolean;
  };
}

// Lane status change event
export interface LaneStatusChangeEvent extends HistoryEventBase {
  type: "lane_status_change";
  details: {
    previousStatus: LaneStatus;
    newStatus: LaneStatus;
    reason?: string; // e.g., "auto-completion detected", "user marked complete"
  };
}

// Commit event
export interface CommitEvent extends HistoryEventBase {
  type: "commit";
  details: {
    commitHash: string;
    commitMessage: string;
    filesChanged: number;
    autoCommit: boolean; // True if committed by orchestrator
  };
}

// Merge events
export interface MergeStartedEvent extends HistoryEventBase {
  type: "merge_started";
  details: {
    lanesToMerge: string[];
    integrationBranch: string;
  };
}

export interface MergeLaneCompleteEvent extends HistoryEventBase {
  type: "merge_lane_complete";
  details: {
    mergedLane: string;
    mergedLanes: string[];
    remainingLanes: string[];
  };
}

export interface MergeCompleteEvent extends HistoryEventBase {
  type: "merge_complete";
  details: {
    mergedLanes: string[];
    integrationBranch: string;
  };
}

export interface MergeConflictEvent extends HistoryEventBase {
  type: "merge_conflict";
  details: {
    conflictingLane: string;
    conflictingFiles: string[];
  };
}

export interface MergeFailedEvent extends HistoryEventBase {
  type: "merge_failed";
  details: {
    failedLane?: string;
    error: string;
  };
}

// Push events
export interface PushStartedEvent extends HistoryEventBase {
  type: "push_started";
  details: {
    branch: string;
    pushType: "lane" | "integration" | "main";
  };
}

export interface PushCompleteEvent extends HistoryEventBase {
  type: "push_complete";
  details: {
    branch: string;
    pushType: "lane" | "integration" | "main";
  };
}

export interface PushFailedEvent extends HistoryEventBase {
  type: "push_failed";
  details: {
    branch: string;
    pushType: "lane" | "integration" | "main";
    error: string;
    errorType: "auth" | "protected" | "rejected" | "network" | "unknown";
  };
}

// Error event
export interface ErrorEvent extends HistoryEventBase {
  type: "error";
  details: {
    errorType: string;
    error: string;
    stack?: string;
  };
}

// Retry events
export interface RetryScheduledEvent extends HistoryEventBase {
  type: "retry_scheduled";
  details: {
    attempt: number;
    maxAttempts: number;
    scheduledFor: string; // ISO-8601
    backoffSeconds: number;
  };
}

export interface RetryStartedEvent extends HistoryEventBase {
  type: "retry_started";
  details: {
    attempt: number;
    maxAttempts: number;
  };
}

// Mission events
export interface MissionStartedEvent extends HistoryEventBase {
  type: "mission_started";
  details: {
    totalLanes: number;
    launchMode: LaunchMode;
  };
}

export interface MissionStoppedEvent extends HistoryEventBase {
  type: "mission_stopped";
  details: {
    completedLanes: number;
    totalLanes: number;
    reason: string; // "user_stopped", "error", etc.
  };
}

export interface MissionCompleteEvent extends HistoryEventBase {
  type: "mission_complete";
  details: {
    completedLanes: number;
    totalLanes: number;
    duration: number; // in seconds
  };
}

// Lane modification events
export interface LaneResetEvent extends HistoryEventBase {
  type: "lane_reset";
  details: {
    previousStatus: LaneStatus;
  };
}

export interface LaneAddedEvent extends HistoryEventBase {
  type: "lane_added";
  details: {
    agent: AgentType;
    dependencies: string[];
  };
}

// Union type of all history events
export type HistoryEvent =
  | LaneLaunchedEvent
  | LaneStatusChangeEvent
  | CommitEvent
  | MergeStartedEvent
  | MergeLaneCompleteEvent
  | MergeCompleteEvent
  | MergeConflictEvent
  | MergeFailedEvent
  | PushStartedEvent
  | PushCompleteEvent
  | PushFailedEvent
  | ErrorEvent
  | RetryScheduledEvent
  | RetryStartedEvent
  | MissionStartedEvent
  | MissionStoppedEvent
  | MissionCompleteEvent
  | LaneResetEvent
  | LaneAddedEvent;

// In-app notification types
export type NotificationType = "success" | "warning" | "error" | "info";

// Notification event types that trigger notifications
export type NotificationEventType =
  | "lane_complete"
  | "lane_failed"
  | "all_lanes_complete"
  | "merge_conflict"
  | "mission_complete"
  | "mission_failed"
  | "push_complete"
  | "push_failed";

// A single notification
export interface AppNotification {
  // Unique notification ID
  id: string;
  // Notification type (determines color/icon)
  type: NotificationType;
  // Short title
  title: string;
  // Optional detailed message
  message?: string;
  // Associated lane ID (if lane-specific)
  laneId?: string;
  // Timestamp when notification was created
  createdAt: string;
  // Whether the notification has been read/dismissed
  read: boolean;
  // Whether to show as a toast (auto-dismiss)
  showToast: boolean;
  // Duration before auto-dismiss (ms) - only for toast notifications
  duration?: number;
  // Event type that triggered this notification
  eventType?: NotificationEventType;
}

// Notification preferences - which events to notify for
export interface NotificationPreferences {
  // Lane complete notifications
  laneComplete: boolean;
  // Lane failed notifications
  laneFailed: boolean;
  // All lanes complete notification
  allLanesComplete: boolean;
  // Merge conflict notification
  mergeConflict: boolean;
  // Enable browser notifications (requires permission)
  browserNotifications: boolean;
}
