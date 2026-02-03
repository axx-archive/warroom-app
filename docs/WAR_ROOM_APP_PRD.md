# War Room App PRD (Standalone, Local Webapp)

## Purpose
Build a standalone local “War Room” webapp that lets AJ run his hybrid system intuitively:

- **Autonomous kickoff (OpenClaw):** AJ can start a run via messaging or via a button in War Room; OpenClaw generates the plan + run packets and stages lanes.
- **Manual kickoff (Claude Code):** AJ can still run `@pm` inside Claude Code and import the resulting plan into War Room.

The UI must make it obvious *who is doing what* and *what you (AJ) need to do next*.

---

## Key UX Goal (reduce confusion)

The app should expose exactly two “ways to start” and label them clearly:

### Start Mode A — **Autonomous (Recommended): OpenClaw Kickoff**
- You click **Generate Plan** in War Room *or* you send a message command.
- OpenClaw produces:
  - agent chain
  - run packets
  - lane/worktree plan
- War Room displays it.
- You click **Stage Lanes** → Cursor windows open.

### Start Mode B — **Manual: Claude Code Kickoff**
- You open Claude Code and run `@pm`.
- You paste or export the output into War Room.
- War Room stages lanes the same way.

**UI must always show which start mode was used** for a run.

---

## Definitions

### Run
A single orchestrated effort (e.g. “DP-003 polish”, “Audit InsideOut for security”, “Prepare merge choreography”).

### Lane
A parallel “agent lane” intended to be executed in isolation:
- 1 lane = 1 **git worktree** + 1 **Cursor window** opened at that folder.

### Run Packet
A markdown prompt to paste into Claude Code in that lane.
Contains role, scope, verification, stop conditions.

---

## Product Requirements

### R1 — Repo Selector
- User can select a repo root (e.g. `~/Desktop/InsideOut`).
- War Room reads:
  - repo `.claude/agents/*` and `.claude/skills/*` if present
  - repo `tasks/` (PRDs, `prd.json`, `progress.txt`) if present
  - repo `CLAUDE.md` if present

### R2 — Runs Dashboard
- List runs (most recent first)
- For each run show:
  - status: Draft Plan / Ready to Stage / Staged / In Progress / Merging / Complete
  - start mode: OpenClaw or Claude Code Import
  - repo, branch/integration branch
  - created time

### R3 — Generate Plan (OpenClaw)
- In the UI: “Describe what you want” textbox + **Generate Plan** button.
- War Room asks OpenClaw (autonomously) to run **PM planning** and return a structured plan artifact.

### R4 — Import Plan (Claude Code)
- UI affordance: **Import Plan**
- Accept:
  - paste JSON
  - upload a file
  - or point at a file path in the repo

### R5 — Plan Viewer
- Show:
  - agent chain table
  - lane list
  - each lane’s packet (expand/copy)
  - recommended parallelization
  - recommended verification gates
- Provide two buttons:
  - **Stage Lanes** (creates worktrees + opens Cursor windows)
  - **Mark Lane Done** (manual toggle; MVP)

### R6 — Stage Lanes (Cursor launcher)
- Create worktrees per lane.
- Open Cursor windows:
  - `/usr/local/bin/cursor -n <worktreePath>`
- Write `WARROOM_PACKET.md` into each worktree.

**MVP assumption:** AJ opens the integrated terminal and runs `claude` manually.

### R7 — Merge Choreography (v1)
- A screen that:
  - shows lanes “ready to merge”
  - shows diffstat/commit list per lane
  - allows “Propose merge plan” (OpenClaw PM) and “Execute merge” (repo-manager lane or backend)
- Safety:
  - default integration branch, not main
  - checkpoint before any merge into main

### R8 — Artifacts & Reports
- A “Artifacts” tab per run that shows:
  - reports from OpenClaw jobs (QA runs, audits)
  - screenshots
  - logs

---

## Shared State Spine (File-backed)

War Room’s own state directory:
- `~/.openclaw/workspace/warroom/`
  - `runs/<runId>/`
    - `plan.json`
    - `packets/<laneId>.md`
    - `status.json`
    - `artifacts/…`

This is what makes it resilient to context resets.

---

## Plan Format (contract between PM and War Room)

War Room should standardize on a JSON plan format.

### `plan.json` (draft)
```json
{
  "runId": "uuid",
  "createdAt": "ISO-8601",
  "startMode": "openclaw" | "claude_code_import",
  "repo": {
    "name": "InsideOut",
    "path": "/Users/ajhart/Desktop/InsideOut"
  },
  "goal": "string",
  "integrationBranch": "warroom/integration/<slug>",
  "lanes": [
    {
      "laneId": "lane-1",
      "agent": "developer" | "staff-engineer-reviewer" | "doc-updater" | "techdebt" | "visual-qa" | "qa-tester" | "security-reviewer" | "architect" | "product-owner",
      "branch": "warroom/<slug>/<agent>",
      "worktreePath": "...",
      "packetPath": "packets/lane-1.md",
      "dependsOn": ["lane-0"],
      "autonomy": {
        "dangerouslySkipPermissions": true
      }
    }
  ],
  "merge": {
    "proposedOrder": ["lane-2", "lane-3"],
    "method": "merge" | "squash" | "cherry-pick",
    "notes": "string"
  },
  "verification": {
    "commands": ["npm test", "npm run typecheck"],
    "required": true
  }
}
```

Packets are stored as markdown files.

---

## The Confusion Resolver (UI copy)

War Room should explicitly separate:

### “Generate Plan” (OpenClaw)
Text in UI:
- “War Room will ask OpenClaw to generate a plan + run packets in the background.”

### “Stage Lanes”
Text in UI:
- “War Room will create git worktrees and open Cursor windows. You’ll run `claude` in each window’s terminal.”

### “Import Plan” (Claude Code)
Text in UI:
- “If you already ran `@pm` in Claude Code, paste the plan output here.”

---

## MVP Milestones

### M0 — Read-only dashboard
- Repo select
- list agents/skills
- list PRDs + Ralph spine files

### M1 — OpenClaw plan generation
- Generate plan button → writes `plan.json` + packets

### M2 — Stage lanes
- Create worktrees
- Open Cursor windows
- Write `WARROOM_PACKET.md`

### M3 — Manual status + artifacts
- lane status toggles
- artifacts list

### M4 — Merge choreography (propose + execute)

---

## Open Questions

1) Cursor command flags:
- confirm: `/usr/local/bin/cursor -n <path>` works for new window (AJ confirmed yes).
- can Cursor be asked to open a terminal tab via CLI? likely needs extension.

2) Where does OpenClaw expose a clean “generate plan” endpoint?
- likely: a message/command into OpenClaw that triggers a planning routine
- returns plan.json + packets

3) Git strategy:
- naming conventions for branches/worktrees
- cleanup/archive policy

---

## Success Criteria

- AJ can:
  - generate a plan from War Room UI
  - click Stage Lanes
  - see 3–5 Cursor windows open
  - paste packets and run Claude Code in each
  - track what’s done and merge with minimal pain

- Confusion is minimized:
  - The app always tells AJ what *it* did vs what *AJ* must do next.
