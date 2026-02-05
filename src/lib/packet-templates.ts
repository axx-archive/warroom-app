// Packet markdown generation for War Room lanes
// Each lane gets a WARROOM_PACKET.md file with role, scope, verification, stop conditions

import { Lane, WarRoomPlan, AgentType } from "./plan-schema";

interface AgentConfig {
  role: string;
  defaultScope: string[];
  defaultStopConditions: string[];
}

const AGENT_CONFIGS: Record<AgentType, AgentConfig> = {
  "product-owner": {
    role: "Product Owner - Define requirements, acceptance criteria, and prioritize features",
    defaultScope: [
      "Define clear acceptance criteria for each feature",
      "Prioritize features for MVP scope",
      "Create user stories with clear requirements",
      "Document edge cases and error scenarios",
    ],
    defaultStopConditions: [
      "If requirements are ambiguous, document assumptions",
      "If scope creep detected, flag for human review",
    ],
  },
  architect: {
    role: "Architect - Design system architecture and technical approach",
    defaultScope: [
      "Design component structure and data flow",
      "Define API contracts and interfaces",
      "Document architectural decisions and tradeoffs",
      "Identify potential technical risks",
    ],
    defaultStopConditions: [
      "If multiple valid approaches exist, present options",
      "If breaking changes required, flag for review",
    ],
  },
  developer: {
    role: "Developer - Implement features according to technical design",
    defaultScope: [
      "Implement features following project patterns",
      "Write clean, maintainable code",
      "Add appropriate error handling",
      "Ensure code passes linting and type checks",
    ],
    defaultStopConditions: [
      "If blocked on unclear requirements, ask for clarification",
      "If implementation differs significantly from design, document why",
    ],
  },
  "staff-engineer-reviewer": {
    role: "Staff Engineer Reviewer - Review code quality and architecture",
    defaultScope: [
      "Review code for quality and maintainability",
      "Check adherence to architectural patterns",
      "Identify potential performance issues",
      "Suggest improvements and best practices",
    ],
    defaultStopConditions: [
      "If critical issues found, block merge",
      "If minor issues, document for future improvement",
    ],
  },
  "doc-updater": {
    role: "Documentation Updater - Keep documentation in sync with code",
    defaultScope: [
      "Update README with new features",
      "Document API changes",
      "Update inline code comments",
      "Ensure examples are current",
    ],
    defaultStopConditions: [
      "If code is unclear, flag for developer clarification",
      "Focus on documentation only, do not change behavior",
    ],
  },
  techdebt: {
    role: "Tech Debt - Address technical debt and improve code health",
    defaultScope: [
      "Refactor problematic code patterns",
      "Update deprecated dependencies",
      "Improve test coverage",
      "Clean up dead code",
    ],
    defaultStopConditions: [
      "Do not change external behavior",
      "If refactor too risky, document for later",
    ],
  },
  "visual-qa": {
    role: "Visual QA - Review UI/UX for visual quality and consistency",
    defaultScope: [
      "Check visual consistency across screens",
      "Verify responsive design",
      "Identify spacing and alignment issues",
      "Check for accessibility basics (contrast, focus states)",
    ],
    defaultStopConditions: [
      "If design system missing, document needed components",
      "Focus on visual issues, not functionality",
    ],
  },
  "qa-tester": {
    role: "QA Tester - Validate features against acceptance criteria",
    defaultScope: [
      "Test happy paths for all features",
      "Test edge cases and error scenarios",
      "Verify error handling and messages",
      "Check integration points",
    ],
    defaultStopConditions: [
      "If acceptance criteria unclear, document assumptions",
      "If critical bugs found, block release",
    ],
  },
  "security-reviewer": {
    role: "Security Reviewer - Audit for security vulnerabilities",
    defaultScope: [
      "Check for OWASP top 10 vulnerabilities",
      "Review authentication and authorization",
      "Check input validation and sanitization",
      "Review dependency security",
    ],
    defaultStopConditions: [
      "If critical vulnerability found, block immediately",
      "Document all findings with severity ratings",
    ],
  },
};

export function generatePacketMarkdown(
  lane: Lane,
  plan: WarRoomPlan,
  options?: { dangerouslySkipPermissions?: boolean }
): string {
  const config = AGENT_CONFIGS[lane.agent];
  const dependsOnText =
    lane.dependsOn.length > 0
      ? `Depends on: ${lane.dependsOn.join(", ")}`
      : "None (can start immediately)";

  // Use options override, or fall back to lane autonomy setting
  const skipPermissions =
    options?.dangerouslySkipPermissions ?? lane.autonomy.dangerouslySkipPermissions;

  const autonomySection = skipPermissions
    ? `
## How to Start
**IMPORTANT:** This lane has autonomy mode enabled. Run Claude Code with:
\`\`\`bash
claude --dangerously-skip-permissions
\`\`\`
This skips permission prompts for faster autonomous execution. Use with caution.
`
    : "";

  return `# WAR ROOM PACKET
${autonomySection}
## Lane
- laneId: ${lane.laneId}
- agent: ${lane.agent}
- branch: ${lane.branch}
- worktree: ${lane.worktreePath}

## Goal
${plan.goal}

## Scope
### DO:
${config.defaultScope.map((s) => `- ${s}`).join("\n")}

### DO NOT:
- Make changes outside your designated scope
- Make changes outside your Allowed Paths (see below)
- Commit directly to main or integration branch
- Skip verification commands
- **Never commit \`.next/\`, \`node_modules/\`, \`dist/\`, or other generated artifacts** - these should be in .gitignore

## Inputs
- Repo: ${plan.repo.path}
${plan.workstream.prdPath ? `- PRD: ${plan.workstream.prdPath}` : ""}
- Integration Branch: ${plan.integrationBranch}

## Key Files to Review
\`\`\`
(Context-specific files will be identified during execution)
\`\`\`

## Allowed Paths
**IMPORTANT:** Your changes MUST stay within these paths. Before committing, verify:
\`\`\`bash
git diff --stat
\`\`\`
All modified files must match one of these patterns:
${
  lane.allowedPaths && lane.allowedPaths.length > 0
    ? lane.allowedPaths.map((p) => `- \`${p}\``).join("\n")
    : "- `**/*` (unrestricted - use good judgment)"
}

**Guardrail Rule:** If \`git diff --stat\` shows files outside your allowed paths, you MUST:
1. Stash or revert those changes
2. Document why you needed to touch them
3. Request path expansion from War Room operator

## Verification
Run these commands before marking complete:
\`\`\`bash
${lane.verify.commands.join("\n")}
\`\`\`

## Stop Conditions
${config.defaultStopConditions.map((s) => `- ${s}`).join("\n")}
- If unclear about scope, ask for clarification

## Dependencies
- ${dependsOnText}

## Progress Reporting (LANE_STATUS.json)
**IMPORTANT:** Throughout your work, you MUST maintain a \`LANE_STATUS.json\` file in the worktree root to report your progress:

\`\`\`json
{
  "phase": "implementing",
  "completedSteps": ["Analyzed requirements", "Designed solution"],
  "currentStep": "Implementing core functionality",
  "progress": 45,
  "blockers": [],
  "updatedAt": "2024-01-15T10:30:00Z",
  "summary": "Currently implementing the main feature logic"
}
\`\`\`

**Update this file:**
- When starting a new phase of work
- After completing significant steps
- When encountering blockers
- Every few minutes during active work

**Phase values:** "analyzing", "designing", "implementing", "testing", "reviewing", "completing"

## Completion Checklist
**IMPORTANT:** When your work is complete, you MUST follow these steps IN ORDER:

1. **Run verification commands** (see Verification section above)
2. **Stage and commit your changes:**
   \`\`\`bash
   git add -A
   git status  # Verify only your files are staged
   git commit -m "feat(${lane.laneId}): <brief description of work done>"
   \`\`\`
3. **Create an output summary** (if applicable):
   - For reviews: Create \`REVIEW.md\` with findings
   - For implementations: Document key changes made
   - For QA: Create \`FINDINGS.md\` with test results
4. **Update LANE_STATUS.json** with phase: "complete" and progress: 100
5. **CREATE THE COMPLETION TRIGGER FILE:**
   \`\`\`bash
   cat > LANE_COMPLETE.md << 'EOF'
   # Lane Complete

   ## Summary
   <Brief summary of what was accomplished>

   ## Changes Made
   - <List of key changes>

   ## Verification
   - All verification commands passed: Yes/No
   - Tests passing: Yes/No/N/A

   ## Notes
   <Any notes for downstream lanes or reviewers>
   EOF
   git add LANE_COMPLETE.md && git commit -m "chore(${lane.laneId}): mark lane complete"
   \`\`\`

**CRITICAL:** The \`LANE_COMPLETE.md\` file triggers automatic lane completion. The War Room will:
- Mark this lane as complete
- Auto-release any blocked lanes that depend on this one
- Start the next lanes in the dependency chain

**DO NOT:**
- Leave uncommitted changes
- Commit to main or integration branch
- Commit node_modules, .next, or generated files
- Forget to create LANE_COMPLETE.md when you're done

## Notes
- Run ID: ${plan.runId}
- Created: ${plan.createdAt}
- Start Mode: ${plan.startMode}
`;
}

export function generateAllPackets(
  plan: WarRoomPlan,
  autonomyOverrides?: Record<string, { dangerouslySkipPermissions: boolean }>
): Map<string, { filename: string; content: string }> {
  const packets = new Map<string, { filename: string; content: string }>();

  for (const lane of plan.lanes) {
    const autonomyOption = autonomyOverrides?.[lane.laneId];
    const content = generatePacketMarkdown(lane, plan, autonomyOption);
    packets.set(lane.laneId, {
      filename: `${lane.laneId}.md`,
      content,
    });
  }

  return packets;
}
