import { promises as fs } from "fs";
import path from "path";

const PACKET_FILENAME = "WARROOM_PACKET.md";

export interface PacketWriteResult {
  success: boolean;
  laneId: string;
  packetPath: string;
  error?: string;
}

/**
 * Read a packet file from the run directory
 */
export async function readPacket(
  runDir: string,
  laneId: string
): Promise<string | null> {
  const packetPath = path.join(runDir, "packets", `${laneId}.md`);

  try {
    const content = await fs.readFile(packetPath, "utf-8");
    return content;
  } catch (err) {
    console.error(`Error reading packet for ${laneId}:`, err);
    return null;
  }
}

/**
 * Write a WARROOM_PACKET.md to a worktree root
 */
export async function writePacketToWorktree(
  worktreePath: string,
  content: string
): Promise<{ success: boolean; error?: string }> {
  const packetPath = path.join(worktreePath, PACKET_FILENAME);

  try {
    await fs.writeFile(packetPath, content, "utf-8");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Read packet from run dir and write to worktree
 * This is the main function used by the staging process
 */
export async function transferPacket(
  runDir: string,
  laneId: string,
  worktreePath: string
): Promise<PacketWriteResult> {
  const packetDest = path.join(worktreePath, PACKET_FILENAME);

  try {
    // Read packet from run directory
    const content = await readPacket(runDir, laneId);

    if (!content) {
      return {
        success: false,
        laneId,
        packetPath: packetDest,
        error: `Could not read packet for lane ${laneId} from ${runDir}/packets/`,
      };
    }

    // Write to worktree
    const writeResult = await writePacketToWorktree(worktreePath, content);

    if (!writeResult.success) {
      return {
        success: false,
        laneId,
        packetPath: packetDest,
        error: writeResult.error,
      };
    }

    return {
      success: true,
      laneId,
      packetPath: packetDest,
    };
  } catch (err) {
    return {
      success: false,
      laneId,
      packetPath: packetDest,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Check if a packet file exists in a worktree
 */
export async function packetExistsInWorktree(
  worktreePath: string
): Promise<boolean> {
  const packetPath = path.join(worktreePath, PACKET_FILENAME);

  try {
    await fs.access(packetPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * List all available packets in a run directory
 */
export async function listPackets(
  runDir: string
): Promise<Array<{ laneId: string; path: string }>> {
  const packetsDir = path.join(runDir, "packets");

  try {
    const files = await fs.readdir(packetsDir);
    return files
      .filter((f) => f.endsWith(".md"))
      .map((f) => ({
        laneId: f.replace(".md", ""),
        path: path.join(packetsDir, f),
      }));
  } catch {
    return [];
  }
}
