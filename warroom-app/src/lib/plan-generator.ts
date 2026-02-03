// Core plan generation logic - stubbed template-based approach for MVP
// Future: AI-powered generation via OpenClaw

import { v4 as uuidv4 } from "uuid";
import {
  WarRoomPlan,
  Lane,
  AgentType,
  GeneratePlanRequest,
} from "./plan-schema";

// Default agent chain for a typical development task
const DEFAULT_AGENT_CHAIN: AgentType[] = [
  "architect",
  "developer",
  "qa-tester",
];

// Extended agent chain for larger tasks (reserved for future use)
const _EXTENDED_AGENT_CHAIN: AgentType[] = [
  "product-owner",
  "architect",
  "developer",
  "developer",
  "qa-tester",
  "security-reviewer",
  "doc-updater",
];
void _EXTENDED_AGENT_CHAIN; // Suppress unused warning

// Default verification commands
const DEFAULT_VERIFY_COMMANDS = [
  "npm run typecheck",
  "npm run lint",
  "npm run build",
];

// Foundation/scaffolding keywords that indicate lane-1 should be a foundation lane
const FOUNDATION_KEYWORDS = [
  "scaffold",
  "scaffolding",
  "foundation",
  "setup",
  "initialize",
  "init",
  "create app",
  "create project",
  "new app",
  "new project",
  "boilerplate",
  "starter",
  "bootstrap",
  "from scratch",
  "greenfield",
  "restructure",
  "reorganize",
  "migration",
  "refactor architecture",
  "new architecture",
];

// Default allowed paths by agent type - these define guardrails for each role
// Non-overlapping paths help prevent merge conflicts when lanes run in parallel
const AGENT_ALLOWED_PATHS: Record<AgentType, string[]> = {
  "product-owner": ["docs/", "*.md", "tasks/", "specs/"],
  architect: [
    "docs/architecture/",
    "src/lib/",
    "src/types/",
    "*.config.*",
    "tsconfig*.json",
  ],
  developer: ["src/"], // Generic - will be subdivided for parallel developers
  "staff-engineer-reviewer": ["**/*"], // Reviewers need to see everything
  "doc-updater": ["docs/", "*.md", "README*", "CHANGELOG*"],
  techdebt: ["src/", "tests/", "*.config.*"],
  "visual-qa": ["src/app/", "src/components/", "src/styles/", "*.css"],
  "qa-tester": ["tests/", "src/__tests__/", "*.test.*", "*.spec.*"],
  "security-reviewer": ["src/", "package.json", "package-lock.json", ".env*"],
};

// Subdivided paths for parallel developer lanes to avoid conflicts
const DEVELOPER_PATH_SUBDIVISIONS = [
  ["src/app/", "src/pages/"], // Routes and pages
  ["src/components/", "src/ui/"], // UI components
  ["src/lib/", "src/utils/", "src/helpers/"], // Library code
  ["src/hooks/", "src/context/"], // React hooks and context
  ["src/api/", "src/services/"], // API and services
  ["src/types/", "src/interfaces/"], // Type definitions
];

/**
 * Detects if a goal involves scaffolding/foundation changes
 * that require lane-1 to complete before parallel lanes can start
 */
function needsFoundationLane(goal: string): boolean {
  const lowerGoal = goal.toLowerCase();
  return FOUNDATION_KEYWORDS.some((kw) => lowerGoal.includes(kw));
}

interface PlanGeneratorConfig {
  workspacePath: string;
  worktreesPath: string;
}

const DEFAULT_CONFIG: PlanGeneratorConfig = {
  workspacePath: process.env.HOME
    ? `${process.env.HOME}/.openclaw/workspace`
    : "/tmp/.openclaw/workspace",
  worktreesPath: process.env.HOME
    ? `${process.env.HOME}/.openclaw/worktrees`
    : "/tmp/.openclaw/worktrees",
};

function generateSlug(goal: string): string {
  // Create a URL-safe slug from the goal
  return goal
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .substring(0, 30)
    .replace(/-+$/, "");
}

function selectAgentChain(goal: string, maxLanes?: number): AgentType[] {
  // Simple heuristic for MVP
  // Future: AI-powered chain selection based on goal analysis
  const lowerGoal = goal.toLowerCase();

  // Quick task keywords
  const quickTaskKeywords = ["fix", "bug", "typo", "update", "small", "minor"];
  const isQuickTask = quickTaskKeywords.some((kw) => lowerGoal.includes(kw));

  // Security keywords
  const securityKeywords = ["security", "audit", "vulnerability", "auth"];
  const needsSecurity = securityKeywords.some((kw) => lowerGoal.includes(kw));

  // Documentation keywords
  const docKeywords = ["doc", "readme", "documentation"];
  const needsDocs = docKeywords.some((kw) => lowerGoal.includes(kw));

  let chain: AgentType[] = isQuickTask
    ? ["developer"]
    : [...DEFAULT_AGENT_CHAIN];

  if (needsSecurity && !chain.includes("security-reviewer")) {
    chain.push("security-reviewer");
  }

  if (needsDocs && !chain.includes("doc-updater")) {
    chain.push("doc-updater");
  }

  // Apply max lanes limit if specified
  if (maxLanes && chain.length > maxLanes) {
    chain = chain.slice(0, maxLanes);
  }

  return chain;
}

function createLane(
  index: number,
  agent: AgentType,
  slug: string,
  repoPath: string,
  worktreesPath: string,
  dependsOn: string[],
  autonomy: boolean,
  foundation: boolean = false,
  allowedPaths?: string[]
): Lane {
  const laneId = `lane-${index + 1}`;
  const branchName = `warroom/${slug}/${agent}${
    index > 0 && agent === "developer" ? `-${index}` : ""
  }`;

  const lane: Lane = {
    laneId,
    agent,
    branch: branchName,
    worktreePath: `${worktreesPath}/${slug}-${laneId}`,
    packetName: "WARROOM_PACKET.md",
    dependsOn,
    autonomy: {
      dangerouslySkipPermissions: autonomy,
    },
    verify: {
      commands: [...DEFAULT_VERIFY_COMMANDS],
      required: true,
    },
    allowedPaths: allowedPaths ?? AGENT_ALLOWED_PATHS[agent],
  };

  if (foundation) {
    lane.foundation = true;
  }

  return lane;
}

export function generatePlan(
  request: GeneratePlanRequest,
  config: PlanGeneratorConfig = DEFAULT_CONFIG
): WarRoomPlan {
  const runId = uuidv4();
  const slug = generateSlug(request.goal);
  const runSlug = `${slug}-${Date.now().toString(36)}`;
  const runDir = `${config.workspacePath}/warroom/runs/${runSlug}`;

  const agentChain = selectAgentChain(request.goal, request.maxLanes);

  // Detect if this goal involves scaffolding/foundation changes
  const hasFoundation = needsFoundationLane(request.goal);

  // Build lanes with dependencies
  // For MVP: simple linear dependencies
  // Future: AI-powered dependency analysis

  // Track developer index for path subdivision
  let developerIndex = 0;

  const lanes: Lane[] = agentChain.map((agent, index) => {
    // Developers can run in parallel, others depend on previous
    let dependsOn: string[] = [];

    // First lane (lane-1) is the foundation lane if scaffolding is needed
    const isFoundationLane = hasFoundation && index === 0;

    // Assign non-overlapping paths for parallel developer lanes
    let allowedPaths: string[] | undefined;
    if (agent === "developer") {
      // Count how many developers are in the chain
      const developerCount = agentChain.filter((a) => a === "developer").length;

      if (developerCount > 1) {
        // Multiple developers - assign subdivided paths to avoid conflicts
        const subdivisionIndex =
          developerIndex % DEVELOPER_PATH_SUBDIVISIONS.length;
        allowedPaths = DEVELOPER_PATH_SUBDIVISIONS[subdivisionIndex];
      }
      // else: single developer gets default AGENT_ALLOWED_PATHS["developer"]

      developerIndex++;
    }

    if (index > 0) {
      // If we have a foundation lane, ALL other lanes must depend on lane-1
      if (hasFoundation) {
        // Always include lane-1 (foundation) in dependencies
        dependsOn = ["lane-1"];

        // Additionally, maintain other sequential dependencies
        // If previous agent was also a developer, they can run in parallel after foundation
        const prevAgent = agentChain[index - 1];
        if (agent === "developer" && prevAgent === "developer" && index > 1) {
          // Parallel developers only depend on foundation, not each other
          // dependsOn already has lane-1
        } else if (index > 1) {
          // Non-parallel lanes also depend on their predecessor
          dependsOn.push(`lane-${index}`);
        }
      } else {
        // No foundation - use original logic
        // If previous agent was also a developer, they can run in parallel
        const prevAgent = agentChain[index - 1];
        if (agent === "developer" && prevAgent === "developer") {
          // Find the last non-developer lane to depend on
          for (let i = index - 1; i >= 0; i--) {
            if (agentChain[i] !== "developer") {
              dependsOn = [`lane-${i + 1}`];
              break;
            }
          }
        } else {
          dependsOn = [`lane-${index}`];
        }
      }
    }

    return createLane(
      index,
      agent,
      slug,
      request.repoPath,
      config.worktreesPath,
      dependsOn,
      request.autonomy ?? false,
      isFoundationLane,
      allowedPaths
    );
  });

  // Determine merge order - QA/security first, then developers, then docs
  const mergeOrder = [...lanes]
    .sort((a, b) => {
      const priority: Record<AgentType, number> = {
        "product-owner": 0,
        architect: 1,
        developer: 2,
        "staff-engineer-reviewer": 3,
        "qa-tester": 4,
        "security-reviewer": 5,
        "visual-qa": 6,
        techdebt: 7,
        "doc-updater": 8,
      };
      return priority[a.agent] - priority[b.agent];
    })
    .map((lane) => lane.laneId);

  const plan: WarRoomPlan = {
    runId,
    runSlug,
    runDir,
    createdAt: new Date().toISOString(),
    startMode: "openclaw",
    repo: {
      name: request.repoName ?? request.repoPath.split("/").pop() ?? "repo",
      path: request.repoPath,
    },
    goal: request.goal,
    workstream: {
      type: request.workstreamType ?? "quick_task",
      prdPath: request.prdPath,
      prdJsonPath: undefined,
      nextStoryId: undefined,
    },
    integrationBranch: `warroom/integration/${slug}`,
    lanes,
    merge: {
      proposedOrder: mergeOrder,
      method: "merge",
      notes:
        "Merge sequentially to integration branch. Final merge to main requires human review.",
      requiresHuman: true,
    },
  };

  return plan;
}

export { DEFAULT_CONFIG, type PlanGeneratorConfig };
