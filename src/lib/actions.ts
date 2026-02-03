"use server";

import {
  getRepoInfo,
  listSubdirectories,
  expandPath,
  pathExists,
  isDirectory,
  type RepoInfo,
  type FileInfo,
} from "./fs-utils";
import {
  listRunSummaries,
  getRunInfo,
  type RunInfo,
  type RunStatus,
  type StartMode,
} from "./state";

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Get repo information by path
 */
export async function fetchRepoInfo(
  repoPath: string
): Promise<ActionResult<RepoInfo>> {
  try {
    const expandedPath = expandPath(repoPath);
    const repoInfo = await getRepoInfo(expandedPath);

    if (!repoInfo) {
      return {
        success: false,
        error: "Invalid repo path or directory does not exist",
      };
    }

    return {
      success: true,
      data: repoInfo,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * List subdirectories for browsing
 */
export async function fetchSubdirectories(
  dirPath: string
): Promise<ActionResult<FileInfo[]>> {
  try {
    const expandedPath = expandPath(dirPath);

    if (!(await pathExists(expandedPath))) {
      return {
        success: false,
        error: "Directory does not exist",
      };
    }

    if (!(await isDirectory(expandedPath))) {
      return {
        success: false,
        error: "Path is not a directory",
      };
    }

    const subdirs = await listSubdirectories(expandedPath);
    return {
      success: true,
      data: subdirs,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Validate a path exists and is a directory
 */
export async function validatePath(
  filePath: string
): Promise<ActionResult<{ valid: boolean; expanded: string }>> {
  try {
    const expandedPath = expandPath(filePath);
    const exists = await pathExists(expandedPath);
    const isDir = exists && (await isDirectory(expandedPath));

    return {
      success: true,
      data: {
        valid: isDir,
        expanded: expandedPath,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Get all runs for the dashboard
 */
export async function fetchRuns(): Promise<
  ActionResult<
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
  >
> {
  try {
    const runs = await listRunSummaries();
    return {
      success: true,
      data: runs,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Get detailed run info
 */
export async function fetchRunInfo(
  runId: string
): Promise<ActionResult<RunInfo>> {
  try {
    const runInfo = await getRunInfo(runId);

    if (!runInfo) {
      return {
        success: false,
        error: "Run not found",
      };
    }

    return {
      success: true,
      data: runInfo,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
