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

export type LaneStatus = "pending" | "in_progress" | "complete" | "failed";

export interface LaneStatusEntry {
  staged: boolean;
  status: LaneStatus;
  autonomy?: LaneAutonomy;
  commitsAtLaunch?: number; // Track commit count when lane was launched
  suggestionDismissed?: boolean; // True if user dismissed completion suggestion
}

export interface StatusJson {
  runId: string;
  status: RunStatus;
  currentLane?: string;
  lanesCompleted?: string[];
  lanes?: Record<string, LaneStatusEntry>;
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
