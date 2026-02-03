import { promises as fs } from "fs";
import path from "path";

export interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
}

export interface AgentInfo {
  name: string;
  path: string;
  content: string;
}

export interface SkillInfo {
  name: string;
  path: string;
  hasSkillFile: boolean;
  content?: string;
}

export interface PrdInfo {
  name: string;
  path: string;
  type: "json" | "markdown" | "text" | "unknown";
  content?: string;
}

export interface RepoInfo {
  path: string;
  name: string;
  hasClaudeDir: boolean;
  hasTasksDir: boolean;
  hasClaudeMd: boolean;
  agents: AgentInfo[];
  skills: SkillInfo[];
  prds: PrdInfo[];
  claudeMdContent?: string;
}

/**
 * Check if a path exists
 */
export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if path is a directory
 */
export async function isDirectory(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Read a file's contents
 */
export async function readFile(filePath: string): Promise<string | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return content;
  } catch {
    return null;
  }
}

/**
 * List files in a directory
 */
export async function listDirectory(dirPath: string): Promise<FileInfo[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.map((entry) => ({
      name: entry.name,
      path: path.join(dirPath, entry.name),
      isDirectory: entry.isDirectory(),
    }));
  } catch {
    return [];
  }
}

/**
 * Get agents from a repo's .claude/agents directory
 */
export async function getAgents(repoPath: string): Promise<AgentInfo[]> {
  const agentsDir = path.join(repoPath, ".claude", "agents");

  if (!(await pathExists(agentsDir))) {
    return [];
  }

  const entries = await listDirectory(agentsDir);
  const agents: AgentInfo[] = [];

  for (const entry of entries) {
    if (entry.isDirectory) {
      // Look for AGENT.md or similar in the directory
      const agentFile = path.join(entry.path, "AGENT.md");
      const content = await readFile(agentFile);
      agents.push({
        name: entry.name,
        path: entry.path,
        content: content || "",
      });
    } else if (entry.name.endsWith(".md")) {
      // Agent defined as a single file
      const content = await readFile(entry.path);
      agents.push({
        name: entry.name.replace(".md", ""),
        path: entry.path,
        content: content || "",
      });
    }
  }

  return agents;
}

/**
 * Get skills from a repo's .claude/skills directory
 */
export async function getSkills(repoPath: string): Promise<SkillInfo[]> {
  const skillsDir = path.join(repoPath, ".claude", "skills");

  if (!(await pathExists(skillsDir))) {
    return [];
  }

  const entries = await listDirectory(skillsDir);
  const skills: SkillInfo[] = [];

  for (const entry of entries) {
    if (entry.isDirectory) {
      // Look for SKILL.md in the directory
      const skillFile = path.join(entry.path, "SKILL.md");
      const hasSkillFile = await pathExists(skillFile);
      const content = hasSkillFile ? await readFile(skillFile) : null;
      skills.push({
        name: entry.name,
        path: entry.path,
        hasSkillFile,
        content: content || undefined,
      });
    } else if (entry.name.endsWith(".md")) {
      // Skill defined as a single file
      const content = await readFile(entry.path);
      skills.push({
        name: entry.name.replace(".md", ""),
        path: entry.path,
        hasSkillFile: true,
        content: content || undefined,
      });
    }
  }

  return skills;
}

/**
 * Get PRDs from a repo's tasks directory
 */
export async function getPrds(repoPath: string): Promise<PrdInfo[]> {
  const tasksDir = path.join(repoPath, "tasks");

  if (!(await pathExists(tasksDir))) {
    return [];
  }

  const entries = await listDirectory(tasksDir);
  const prds: PrdInfo[] = [];

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    let type: PrdInfo["type"] = "unknown";
    if (entry.name.endsWith(".json")) {
      type = "json";
    } else if (entry.name.endsWith(".md")) {
      type = "markdown";
    } else if (entry.name.endsWith(".txt")) {
      type = "text";
    }

    const content = await readFile(entry.path);
    prds.push({
      name: entry.name,
      path: entry.path,
      type,
      content: content || undefined,
    });
  }

  return prds;
}

/**
 * Get CLAUDE.md content from a repo
 */
export async function getClaudeMd(repoPath: string): Promise<string | null> {
  const claudeMdPath = path.join(repoPath, "CLAUDE.md");
  return readFile(claudeMdPath);
}

/**
 * Get full repo info
 */
export async function getRepoInfo(repoPath: string): Promise<RepoInfo | null> {
  if (!(await pathExists(repoPath)) || !(await isDirectory(repoPath))) {
    return null;
  }

  const claudeDir = path.join(repoPath, ".claude");
  const tasksDir = path.join(repoPath, "tasks");
  const claudeMdPath = path.join(repoPath, "CLAUDE.md");

  const [hasClaudeDir, hasTasksDir, hasClaudeMd, agents, skills, prds, claudeMdContent] =
    await Promise.all([
      pathExists(claudeDir),
      pathExists(tasksDir),
      pathExists(claudeMdPath),
      getAgents(repoPath),
      getSkills(repoPath),
      getPrds(repoPath),
      getClaudeMd(repoPath),
    ]);

  return {
    path: repoPath,
    name: path.basename(repoPath),
    hasClaudeDir,
    hasTasksDir,
    hasClaudeMd,
    agents,
    skills,
    prds,
    claudeMdContent: claudeMdContent || undefined,
  };
}

/**
 * List subdirectories in a path (for repo browsing)
 */
export async function listSubdirectories(dirPath: string): Promise<FileInfo[]> {
  const entries = await listDirectory(dirPath);
  return entries.filter((e) => e.isDirectory && !e.name.startsWith("."));
}

/**
 * Expand ~ to home directory
 */
export function expandPath(filePath: string): string {
  if (filePath.startsWith("~/")) {
    const home = process.env.HOME || "/Users";
    return path.join(home, filePath.slice(2));
  }
  return filePath;
}
