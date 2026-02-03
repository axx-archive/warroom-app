import { promises as fs } from "fs";
import path from "path";
import { pathExists, readFile } from "./fs-utils";

// State directory location
const STATE_DIR = path.join(
  process.env.HOME || "/Users",
  ".openclaw",
  "workspace",
  "warroom"
);

export type RunStatus =
  | "draft_plan"
  | "ready_to_stage"
  | "staged"
  | "in_progress"
  | "merging"
  | "complete";

export type StartMode = "openclaw" | "claude_code_import";

export interface LaneStatus {
  laneId: string;
  status: "pending" | "in_progress" | "completed" | "blocked";
  startedAt?: string;
  completedAt?: string;
  notes?: string;
}

export interface StatusFile {
  runId: string;
  status: RunStatus;
  startMode: StartMode;
  createdAt: string;
  updatedAt: string;
  lanes: LaneStatus[];
  currentPhase?: string;
  notes?: string;
}

export interface PlanFile {
  runId: string;
  createdAt: string;
  startMode: StartMode;
  repo: {
    name: string;
    path: string;
  };
  goal: string;
  integrationBranch?: string;
  lanes: Array<{
    laneId: string;
    agent: string;
    branch: string;
    worktreePath?: string;
    packetPath: string;
    dependsOn?: string[];
    autonomy?: {
      dangerouslySkipPermissions?: boolean;
    };
  }>;
  merge?: {
    proposedOrder?: string[];
    method?: "merge" | "squash" | "cherry-pick";
    notes?: string;
  };
  verification?: {
    commands?: string[];
    required?: boolean;
  };
}

export interface RunInfo {
  runId: string;
  plan: PlanFile | null;
  status: StatusFile | null;
  packets: Array<{ laneId: string; content: string }>;
}

/**
 * Ensure state directory exists
 */
export async function ensureStateDir(): Promise<void> {
  await fs.mkdir(STATE_DIR, { recursive: true });
}

/**
 * Get run directory path
 */
export function getRunDir(runId: string): string {
  return path.join(STATE_DIR, "runs", runId);
}

/**
 * Ensure run directory exists
 */
export async function ensureRunDir(runId: string): Promise<string> {
  const runDir = getRunDir(runId);
  await fs.mkdir(runDir, { recursive: true });
  await fs.mkdir(path.join(runDir, "packets"), { recursive: true });
  await fs.mkdir(path.join(runDir, "artifacts"), { recursive: true });
  return runDir;
}

/**
 * Read status.json for a run
 */
export async function readStatus(runId: string): Promise<StatusFile | null> {
  const statusPath = path.join(getRunDir(runId), "status.json");
  const content = await readFile(statusPath);
  if (!content) return null;
  try {
    return JSON.parse(content) as StatusFile;
  } catch {
    return null;
  }
}

/**
 * Write status.json for a run
 */
export async function writeStatus(
  runId: string,
  status: StatusFile
): Promise<void> {
  await ensureRunDir(runId);
  const statusPath = path.join(getRunDir(runId), "status.json");
  status.updatedAt = new Date().toISOString();
  await fs.writeFile(statusPath, JSON.stringify(status, null, 2));
}

/**
 * Read plan.json for a run
 */
export async function readPlan(runId: string): Promise<PlanFile | null> {
  const planPath = path.join(getRunDir(runId), "plan.json");
  const content = await readFile(planPath);
  if (!content) return null;
  try {
    return JSON.parse(content) as PlanFile;
  } catch {
    return null;
  }
}

/**
 * Write plan.json for a run
 */
export async function writePlan(runId: string, plan: PlanFile): Promise<void> {
  await ensureRunDir(runId);
  const planPath = path.join(getRunDir(runId), "plan.json");
  await fs.writeFile(planPath, JSON.stringify(plan, null, 2));
}

/**
 * Read all packets for a run
 */
export async function readPackets(
  runId: string
): Promise<Array<{ laneId: string; content: string }>> {
  const packetsDir = path.join(getRunDir(runId), "packets");
  if (!(await pathExists(packetsDir))) return [];

  const files = await fs.readdir(packetsDir);
  const packets: Array<{ laneId: string; content: string }> = [];

  for (const file of files) {
    if (file.endsWith(".md")) {
      const content = await readFile(path.join(packetsDir, file));
      if (content) {
        packets.push({
          laneId: file.replace(".md", ""),
          content,
        });
      }
    }
  }

  return packets;
}

/**
 * Write a packet for a lane
 */
export async function writePacket(
  runId: string,
  laneId: string,
  content: string
): Promise<void> {
  await ensureRunDir(runId);
  const packetPath = path.join(getRunDir(runId), "packets", `${laneId}.md`);
  await fs.writeFile(packetPath, content);
}

/**
 * Get full run info
 */
export async function getRunInfo(runId: string): Promise<RunInfo | null> {
  const runDir = getRunDir(runId);
  if (!(await pathExists(runDir))) return null;

  const [plan, status, packets] = await Promise.all([
    readPlan(runId),
    readStatus(runId),
    readPackets(runId),
  ]);

  return {
    runId,
    plan,
    status,
    packets,
  };
}

/**
 * List all runs
 */
export async function listRuns(): Promise<string[]> {
  const runsDir = path.join(STATE_DIR, "runs");
  if (!(await pathExists(runsDir))) return [];

  try {
    const entries = await fs.readdir(runsDir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

/**
 * Get summary info for all runs (for dashboard listing)
 */
export async function listRunSummaries(): Promise<
  Array<{
    runId: string;
    status: RunStatus;
    startMode: StartMode;
    repoName: string;
    repoPath: string;
    goal: string;
    createdAt: string;
    updatedAt: string;
    laneCount: number;
  }>
> {
  const runIds = await listRuns();
  const summaries: Array<{
    runId: string;
    status: RunStatus;
    startMode: StartMode;
    repoName: string;
    repoPath: string;
    goal: string;
    createdAt: string;
    updatedAt: string;
    laneCount: number;
  }> = [];

  for (const runId of runIds) {
    const [plan, status] = await Promise.all([
      readPlan(runId),
      readStatus(runId),
    ]);

    if (plan && status) {
      summaries.push({
        runId,
        status: status.status,
        startMode: status.startMode,
        repoName: plan.repo.name,
        repoPath: plan.repo.path,
        goal: plan.goal,
        createdAt: status.createdAt,
        updatedAt: status.updatedAt,
        laneCount: plan.lanes.length,
      });
    }
  }

  // Sort by createdAt descending (most recent first)
  summaries.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return summaries;
}

/**
 * Generate a new run ID
 */
export function generateRunId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `run-${timestamp}-${random}`;
}

/**
 * Create a new run
 */
export async function createRun(
  plan: Omit<PlanFile, "runId" | "createdAt">,
  startMode: StartMode
): Promise<RunInfo> {
  const runId = generateRunId();
  const createdAt = new Date().toISOString();

  const fullPlan: PlanFile = {
    ...plan,
    runId,
    createdAt,
    startMode,
  };

  const status: StatusFile = {
    runId,
    status: "draft_plan",
    startMode,
    createdAt,
    updatedAt: createdAt,
    lanes: fullPlan.lanes.map((lane) => ({
      laneId: lane.laneId,
      status: "pending",
    })),
  };

  await writePlan(runId, fullPlan);
  await writeStatus(runId, status);

  return {
    runId,
    plan: fullPlan,
    status,
    packets: [],
  };
}

/**
 * Get the state directory path
 */
export function getStateDir(): string {
  return STATE_DIR;
}
