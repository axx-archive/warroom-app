// API route to get full diff for a lane's worktree
// GET /api/runs/[slug]/lane-diff?laneId=xxx - returns full diff with file tree and content

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import { WarRoomPlan, Lane } from "@/lib/plan-schema";

const execAsync = promisify(exec);

export interface DiffFile {
  path: string;
  status: "modified" | "added" | "deleted" | "renamed" | "untracked";
  oldPath?: string; // For renamed files
  diff: string; // Full diff content for this file
  language: string; // Detected language for syntax highlighting
}

export interface LaneDiffResponse {
  success: boolean;
  laneId: string;
  files: DiffFile[];
  totalAdditions: number;
  totalDeletions: number;
  error?: string;
}

// Map file extensions to language identifiers for syntax highlighting
function getLanguageFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const languageMap: Record<string, string> = {
    ".ts": "typescript",
    ".tsx": "tsx",
    ".js": "javascript",
    ".jsx": "jsx",
    ".json": "json",
    ".md": "markdown",
    ".css": "css",
    ".scss": "scss",
    ".html": "html",
    ".py": "python",
    ".rb": "ruby",
    ".go": "go",
    ".rs": "rust",
    ".java": "java",
    ".c": "c",
    ".cpp": "cpp",
    ".h": "c",
    ".hpp": "cpp",
    ".sh": "bash",
    ".bash": "bash",
    ".zsh": "bash",
    ".yml": "yaml",
    ".yaml": "yaml",
    ".toml": "toml",
    ".sql": "sql",
    ".graphql": "graphql",
    ".gql": "graphql",
    ".swift": "swift",
    ".kt": "kotlin",
    ".vue": "vue",
    ".svelte": "svelte",
    ".astro": "astro",
  };
  return languageMap[ext] || "plaintext";
}

// Parse git status output to determine file status
function parseGitStatus(statusCode: string): DiffFile["status"] {
  switch (statusCode.trim()) {
    case "M":
    case "MM":
      return "modified";
    case "A":
    case "AM":
      return "added";
    case "D":
      return "deleted";
    case "R":
    case "RM":
      return "renamed";
    case "??":
      return "untracked";
    default:
      return "modified";
  }
}

// Get diff for a single file
async function getFileDiff(
  worktreePath: string,
  filePath: string,
  status: DiffFile["status"]
): Promise<string> {
  try {
    if (status === "untracked") {
      // For untracked files, show the full file content as additions
      const fullPath = path.join(worktreePath, filePath);
      try {
        const content = await fs.readFile(fullPath, "utf-8");
        // Format as a pseudo-diff
        const lines = content.split("\n");
        const diffLines = lines.map((line) => `+${line}`);
        return `@@ -0,0 +1,${lines.length} @@\n${diffLines.join("\n")}`;
      } catch {
        return "// Could not read file content";
      }
    }

    if (status === "deleted") {
      // For deleted files, get the content from HEAD
      const { stdout } = await execAsync(
        `git show HEAD:"${filePath}" 2>/dev/null || echo ""`,
        { cwd: worktreePath, maxBuffer: 10 * 1024 * 1024 }
      );
      const lines = stdout.split("\n");
      const diffLines = lines.map((line) => `-${line}`);
      return `@@ -1,${lines.length} +0,0 @@\n${diffLines.join("\n")}`;
    }

    // For modified/added/renamed files, get the actual diff
    const { stdout } = await execAsync(
      `git diff HEAD -- "${filePath}" 2>/dev/null || git diff --cached -- "${filePath}" 2>/dev/null || echo ""`,
      { cwd: worktreePath, maxBuffer: 10 * 1024 * 1024 }
    );

    if (!stdout.trim()) {
      // If no staged/unstaged diff, file might be only in working directory
      // Try to get diff against empty
      try {
        const { stdout: newContent } = await execAsync(
          `git diff --no-index /dev/null "${filePath}" 2>/dev/null || true`,
          { cwd: worktreePath, maxBuffer: 10 * 1024 * 1024 }
        );
        return newContent || "// No diff available";
      } catch {
        return "// No diff available";
      }
    }

    return stdout;
  } catch (error) {
    console.error(`Error getting diff for ${filePath}:`, error);
    return "// Error reading diff";
  }
}

// Count additions and deletions from diff
function countChanges(diff: string): { additions: number; deletions: number } {
  const lines = diff.split("\n");
  let additions = 0;
  let deletions = 0;

  for (const line of lines) {
    // Skip diff metadata lines
    if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("@@")) {
      continue;
    }
    if (line.startsWith("+")) {
      additions++;
    } else if (line.startsWith("-")) {
      deletions++;
    }
  }

  return { additions, deletions };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const searchParams = request.nextUrl.searchParams;
    const laneId = searchParams.get("laneId");

    if (!laneId) {
      return NextResponse.json(
        { success: false, error: "laneId is required", laneId: "", files: [], totalAdditions: 0, totalDeletions: 0 },
        { status: 400 }
      );
    }

    const runDir = path.join(
      os.homedir(),
      ".openclaw/workspace/warroom/runs",
      slug
    );

    // Read the plan to get lane info
    let plan: WarRoomPlan;
    try {
      const planContent = await fs.readFile(
        path.join(runDir, "plan.json"),
        "utf-8"
      );
      plan = JSON.parse(planContent);
    } catch {
      return NextResponse.json(
        { success: false, error: "Could not read plan.json", laneId, files: [], totalAdditions: 0, totalDeletions: 0 },
        { status: 404 }
      );
    }

    // Find the lane
    const lane = plan.lanes.find((l: Lane) => l.laneId === laneId);
    if (!lane) {
      return NextResponse.json(
        { success: false, error: "Lane not found", laneId, files: [], totalAdditions: 0, totalDeletions: 0 },
        { status: 404 }
      );
    }

    const worktreePath = lane.worktreePath;

    // Check if worktree exists
    try {
      await fs.access(worktreePath);
    } catch {
      return NextResponse.json(
        { success: false, error: "Worktree does not exist", laneId, files: [], totalAdditions: 0, totalDeletions: 0 },
        { status: 404 }
      );
    }

    // Get list of changed files
    const { stdout: statusOutput } = await execAsync("git status --porcelain", {
      cwd: worktreePath,
    });

    const files: DiffFile[] = [];
    let totalAdditions = 0;
    let totalDeletions = 0;

    if (statusOutput.trim()) {
      const fileLines = statusOutput.trim().split("\n").filter(Boolean);

      for (const line of fileLines) {
        const statusCode = line.substring(0, 2);
        let filePath = line.substring(3);

        // Handle renamed files (format: "R  old -> new")
        let oldPath: string | undefined;
        if (filePath.includes(" -> ")) {
          const [old, newPath] = filePath.split(" -> ");
          oldPath = old;
          filePath = newPath;
        }

        const status = parseGitStatus(statusCode);
        const diff = await getFileDiff(worktreePath, filePath, status);
        const { additions, deletions } = countChanges(diff);

        totalAdditions += additions;
        totalDeletions += deletions;

        files.push({
          path: filePath,
          status,
          oldPath,
          diff,
          language: getLanguageFromPath(filePath),
        });
      }
    }

    // Sort files: directories first (by path depth), then alphabetically
    files.sort((a, b) => a.path.localeCompare(b.path));

    const response: LaneDiffResponse = {
      success: true,
      laneId,
      files,
      totalAdditions,
      totalDeletions,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error getting lane diff:", error);
    return NextResponse.json(
      {
        success: false,
        laneId: "",
        files: [],
        totalAdditions: 0,
        totalDeletions: 0,
        error: error instanceof Error ? error.message : "Failed to get lane diff",
      },
      { status: 500 }
    );
  }
}
