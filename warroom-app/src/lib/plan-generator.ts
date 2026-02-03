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
  autonomy: boolean
): Lane {
  const laneId = `lane-${index + 1}`;
  const branchName = `warroom/${slug}/${agent}${
    index > 0 && agent === "developer" ? `-${index}` : ""
  }`;

  return {
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
  };
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

  // Build lanes with dependencies
  // For MVP: simple linear dependencies
  // Future: AI-powered dependency analysis
  const lanes: Lane[] = agentChain.map((agent, index) => {
    // Developers can run in parallel, others depend on previous
    let dependsOn: string[] = [];

    if (index > 0) {
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

    return createLane(
      index,
      agent,
      slug,
      request.repoPath,
      config.worktreesPath,
      dependsOn,
      request.autonomy ?? false
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
