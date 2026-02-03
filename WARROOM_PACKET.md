# WAR ROOM PACKET

## Lane
- laneId: lane-2
- agent: developer
- branch: warroom/mvp/plan-generator
- worktree: /Users/ajhart/.openclaw/worktrees/mvp-plangen

## Goal
Build the M1 OpenClaw plan generation service: goal input, plan.json generation, and packet file writing.

## Scope
### DO:
- Create "Generate Plan" UI with goal text input
- Build plan generation API route that produces plan.json
- Generate plan.json conforming exactly to the schema in SKILL.md
- Write run packets to `packets/<laneId>.md` files
- Create run directory structure: `~/.openclaw/workspace/warroom/runs/<runId>/`
- Update status.json with run state (draft → ready_to_stage)
- Show generated plan in Plan Viewer UI (agent chain table, lane list)

### DO NOT:
- Implement worktree creation (that's lane-3)
- Implement Cursor launching (that's lane-3)
- Call external OpenClaw API (stub the generation logic for MVP)
- Touch the repo selector or agents list (that's lane-1)

## Inputs
- Repo: /Users/ajhart/.openclaw/workspace
- PRD: docs/WAR_ROOM_APP_PRD.md (requirements R3, R5)
- Schema: .claude/skills/warroom-plan/SKILL.md (plan.json schema)

## Key Files to Create
```
src/
  app/
    api/
      generate-plan/
        route.ts          # POST: generate plan.json + packets
  components/
    PlanGenerator.tsx     # Goal input + Generate button
    PlanViewer.tsx        # Display plan.json contents
    LaneCard.tsx          # Individual lane display
    PacketPreview.tsx     # Expandable packet markdown
  lib/
    plan-generator.ts     # Core plan generation logic
    plan-schema.ts        # TypeScript types for plan.json
    packet-templates.ts   # Packet markdown generation
    run-manager.ts        # Create/update runs directory
```

## Plan JSON Schema (must match exactly)
```typescript
interface WarRoomPlan {
  runId: string;                    // UUID format
  createdAt: string;                // ISO-8601
  startMode: "openclaw" | "claude_code_import";
  repo: { name: string; path: string };
  goal: string;
  workstream: {
    type: "quick_task" | "ralph_workstream";
    prdPath?: string;
    prdJsonPath?: string;
    nextStoryId?: string;
  };
  integrationBranch: string;        // warroom/integration/<slug>
  lanes: Lane[];
  merge: {
    proposedOrder: string[];
    method: "merge" | "squash" | "cherry-pick";
    notes: string;
    requiresHuman: true;
  };
}

interface Lane {
  laneId: string;
  agent: AgentType;
  branch: string;
  worktreePath: string;
  packetName: "WARROOM_PACKET.md";
  dependsOn: string[];
  autonomy: { dangerouslySkipPermissions: boolean };
  verify: { commands: string[]; required: boolean };
}
```

## Verification
Run these commands before marking complete:
```bash
npm run typecheck
npm run lint
```

Manual verification:
- Enter a goal and click Generate Plan
- Verify plan.json is written to ~/.openclaw/workspace/warroom/runs/<runId>/
- Verify packets/ directory contains lane markdown files
- Plan Viewer displays the generated plan correctly

## Stop Conditions
- If unclear about lane selection heuristics, use the default set from SKILL.md
- If blocked on goal parsing, stub with a simple template-based approach
- If unclear about verification commands, ask AJ:
  - A) Detect from package.json scripts
  - B) Use hardcoded defaults (typecheck, lint, build)
  - C) Ask user to specify per plan
  - D) Skip verification for MVP

## Dependencies
- None (can start immediately, parallel with lane-1)

## Notes
- This lane produces the plan artifacts that lane-3 will consume
- Plan generation can be a simple template for MVP; AI-powered generation is future work
- Status flow: draft → ready_to_stage → staged → in_progress → complete
