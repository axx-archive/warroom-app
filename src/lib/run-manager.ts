// Run manager - creates and updates run directory structure
// Directory: ~/.openclaw/workspace/warroom/runs/<runId>/

import { promises as fs } from "fs";
import path from "path";
import { WarRoomPlan, StatusJson, RunStatus } from "./plan-schema";
import { generateAllPackets } from "./packet-templates";

export interface RunDirectory {
  runDir: string;
  planPath: string;
  statusPath: string;
  packetsDir: string;
  artifactsDir: string;
}

export async function createRunDirectory(
  plan: WarRoomPlan
): Promise<RunDirectory> {
  const runDir = plan.runDir;
  const packetsDir = path.join(runDir, "packets");
  const artifactsDir = path.join(runDir, "artifacts");

  // Create directory structure
  await fs.mkdir(runDir, { recursive: true });
  await fs.mkdir(packetsDir, { recursive: true });
  await fs.mkdir(artifactsDir, { recursive: true });

  const runDirectory: RunDirectory = {
    runDir,
    planPath: path.join(runDir, "plan.json"),
    statusPath: path.join(runDir, "status.json"),
    packetsDir,
    artifactsDir,
  };

  return runDirectory;
}

export async function writePlan(
  runDirectory: RunDirectory,
  plan: WarRoomPlan
): Promise<void> {
  await fs.writeFile(runDirectory.planPath, JSON.stringify(plan, null, 2));
}

export async function writePackets(
  runDirectory: RunDirectory,
  plan: WarRoomPlan
): Promise<string[]> {
  const packets = generateAllPackets(plan);
  const writtenFiles: string[] = [];

  for (const [, packet] of packets) {
    const filePath = path.join(runDirectory.packetsDir, packet.filename);
    await fs.writeFile(filePath, packet.content);
    writtenFiles.push(filePath);
  }

  return writtenFiles;
}

export async function createStatus(
  runDirectory: RunDirectory,
  plan: WarRoomPlan,
  status: RunStatus = "draft"
): Promise<StatusJson> {
  const statusJson: StatusJson = {
    runId: plan.runId,
    status,
    lanesCompleted: [],
    updatedAt: new Date().toISOString(),
  };

  await fs.writeFile(
    runDirectory.statusPath,
    JSON.stringify(statusJson, null, 2)
  );

  return statusJson;
}

export async function updateStatus(
  runDirectory: RunDirectory,
  updates: Partial<StatusJson>
): Promise<StatusJson> {
  const currentContent = await fs.readFile(runDirectory.statusPath, "utf-8");
  const current: StatusJson = JSON.parse(currentContent);

  const updated: StatusJson = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await fs.writeFile(runDirectory.statusPath, JSON.stringify(updated, null, 2));

  return updated;
}

export async function readStatus(
  runDirectory: RunDirectory
): Promise<StatusJson | null> {
  try {
    const content = await fs.readFile(runDirectory.statusPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export async function readPlan(
  runDirectory: RunDirectory
): Promise<WarRoomPlan | null> {
  try {
    const content = await fs.readFile(runDirectory.planPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export async function listRuns(
  workspacePath: string
): Promise<
  { runSlug: string; runDir: string; status: StatusJson | null }[]
> {
  const runsDir = path.join(workspacePath, "warroom", "runs");

  try {
    const entries = await fs.readdir(runsDir, { withFileTypes: true });
    const runs: {
      runSlug: string;
      runDir: string;
      status: StatusJson | null;
    }[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const runDir = path.join(runsDir, entry.name);
        const statusPath = path.join(runDir, "status.json");

        let status: StatusJson | null = null;
        try {
          const content = await fs.readFile(statusPath, "utf-8");
          status = JSON.parse(content);
        } catch {
          // No status file yet
        }

        runs.push({
          runSlug: entry.name,
          runDir,
          status,
        });
      }
    }

    // Sort by most recent first
    runs.sort((a, b) => {
      const aTime = a.status?.updatedAt ?? "";
      const bTime = b.status?.updatedAt ?? "";
      return bTime.localeCompare(aTime);
    });

    return runs;
  } catch {
    return [];
  }
}

// Full initialization flow: create directory, write plan, write packets, create status
export async function initializeRun(
  plan: WarRoomPlan
): Promise<{ runDirectory: RunDirectory; packetFiles: string[] }> {
  const runDirectory = await createRunDirectory(plan);
  await writePlan(runDirectory, plan);
  const packetFiles = await writePackets(runDirectory, plan);
  await createStatus(runDirectory, plan, "ready_to_stage");

  return { runDirectory, packetFiles };
}
