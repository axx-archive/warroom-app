# warroom-plan (Skill)

**Purpose:** Generate a War Room–importable execution plan for AJ's hybrid system.

Output must be deterministic and machine-readable so the War Room app can:
- render an agent chain
- create worktrees/branches
- open Cursor windows per lane
- stage `WARROOM_PACKET.md` per lane

This skill is designed to be used by **PM** (and also usable directly).

---

## Inputs (what you need from the user)

### Required
1) **Repo path** (absolute): e.g. `/Users/ajhart/Desktop/InsideOut`
2) **Goal**: what AJ wants to accomplish (1–5 sentences)

### Optional (defaults allowed)
- **Start mode:** `openclaw` (default) or `claude_code_import`
- **Max parallel lanes:** default 3 (allow up to 5)
- **Autonomy:** whether to recommend `claude --dangerously-skip-permissions` (default OFF)
- **Workstream type:** `quick_task` (default) or `ralph_workstream`
- **If ralph_workstream:** point to `tasks/prd.json` and/or the next story ID
- **Verification commands:** if known; otherwise propose likely and mark as "needs confirmation"
- **Merge strategy:** merge/squash/cherry-pick; default `merge` into an integration branch

If any required input is missing, ask for it as multiple choice.

---

## Output Contract (what you must produce)

You must output **three sections in this exact order**:

1) `## War Room Summary` (human readable)
2) `## War Room Plan JSON` (a single JSON code block)
3) `## Run Packets` (one markdown code block per lane)

The War Room app will parse the JSON and optionally extract packets.

---

## Plan JSON schema (must match)

Produce JSON matching this shape:

```json
{
  "runId": "<uuid>",
  "createdAt": "<ISO-8601>",
  "startMode": "openclaw" | "claude_code_import",
  "repo": { "name": "<string>", "path": "<absolute path>" },
  "goal": "<string>",
  "workstream": {
    "type": "quick_task" | "ralph_workstream",
    "prdPath": "<optional>",
    "prdJsonPath": "<optional>",
    "nextStoryId": "<optional>"
  },
  "integrationBranch": "warroom/integration/<slug>",
  "lanes": [
    {
      "laneId": "lane-1",
      "agent": "pm" | "staff-engineer-reviewer" | "product-owner" | "architect" | "developer" | "ux-designer" | "visual-qa" | "security-reviewer" | "qa-tester" | "doc-updater" | "techdebt",
      "branch": "warroom/<slug>/<agent>",
      "worktreePath": "<absolute path>",
      "packetName": "WARROOM_PACKET.md",
      "dependsOn": ["lane-0"],
      "autonomy": {
        "dangerouslySkipPermissions": true | false
      },
      "verify": {
        "commands": ["<string>"],
        "required": true | false
      }
    }
  ],
  "merge": {
    "proposedOrder": ["lane-1"],
    "method": "merge" | "squash" | "cherry-pick",
    "notes": "<string>",
    "requiresHuman": true
  }
}
```

Rules:
- `runId` must look like a UUID (any valid UUID format).
- `createdAt` must be ISO-8601.
- `worktreePath` must be absolute and should follow a consistent convention, e.g. `../worktrees/<slug>-<agent>`.
- `integrationBranch` must *not* be `main`.
- Use 2–5 lanes. Prefer fewer.

---

## Lane design rules

### Default lane set (recommended)
For most non-trivial work:
1) `staff-engineer-reviewer` — plan review / edge cases / verify gates
2) `developer` — implementation
3) `qa-tester` or `visual-qa` — verification/review depending on task type
4) `techdebt` — endcap cleanup (optional)
5) `doc-updater` — doc-only updates (optional)

### Foundation lane rule (prevents merge conflicts)
If the work involves **creating or changing shared project foundation** (e.g. `create-next-app`, initial app directory structure, global config like `next.config`, Tailwind setup, tsconfig paths), then:

- Create a dedicated **Foundation lane** (usually `developer`) as lane-1.
- All other implementation lanes **must depend on the foundation lane**.
- Do **not** run foundation work in parallel lanes.

In lane packets (non-foundation lanes), include a hard guardrail:
- **DO NOT** scaffold a new app or re-initialize the project.
- If you find yourself about to run `create-next-app` (or equivalent), STOP and ask AJ.

### Guardrails (strongly recommended)
For each lane, define an **Allowed Paths** list (a whitelist) in the packet. Example:
- Lane 2 allowed paths: `warroom-app/src/lib/**`, `warroom-app/src/app/api/**`
- Lane 3 allowed paths: `warroom-app/src/lib/**`, `warroom-app/src/components/**`

Packet must instruct:
- Before committing: run `git diff --stat` and confirm changes are within Allowed Paths.
- If changes spill outside Allowed Paths: STOP and ask AJ.

### UI work: automatically load frontend-design
If the goal includes **building or polishing UI** (pages, components, layout, styling, visual hierarchy), then the **developer lane packet must instruct**:
- Preferred (terminal UX): `/frontend-design`
- Fallback: `cat .claude/skills/frontend-design/SKILL.md`

Also encourage using any project design system reference if present (e.g. `docs/DESIGN-SYSTEM.md` or `Documentation/design-bible.md`).

### Keep lanes non-overlapping
- Assign lanes so they don't fight over the same files.
- Use reviewer lanes that don't modify code when possible.

### Dependencies
- Review lanes depend on implementation lane.
- techdebt depends on implementation + required reviews.
- doc-updater depends on implementation (and often after techdebt).

---

## Run Packet template (per lane)

Each lane must include a packet that:
- names the role
- states the goal
- provides scope boundaries
- points at relevant files
- includes verification commands
- includes stop conditions and A/B/C/D questions

Each packet begins with:

```markdown
# WAR ROOM PACKET

## Lane
- laneId: <lane-1>
- agent: <agent-name>
- branch: <branch>
- worktree: <path>

## Goal
<goal>

## Scope
- DO: ...
- DO NOT: ...

## Inputs
- Repo: <path>
- Relevant docs: ...

## Verification
- Commands: ...

## Stop conditions
- If blocked, ask AJ with options A/B/C/D.
```

---

## Invocation examples

### A) Use from Claude Code PM (manual)

```text
@pm

Read .claude/skills/warroom-plan/SKILL.md and generate a War Room plan.

Repo: /Users/ajhart/Desktop/InsideOut
Goal: Stage DP-003 and DP-004 work with parallel lanes, then merge into an integration branch.
Constraints:
- Max 3 lanes
- Prefer safe autonomy (no dangerously-skip-permissions)
- Require verification
```

### B) Use from OpenClaw (autonomous)
Provide the same inputs.

---

## What to do if inputs are underspecified

If the goal is vague, ask 2–4 multiple-choice questions to pin down:
- workstream type (quick vs ralph)
- what "done" means
- what verification commands exist

Then generate the plan.
