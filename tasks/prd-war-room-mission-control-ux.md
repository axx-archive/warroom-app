# PRD — War Room “Mission Control” UX Upgrade (Ralph)

**Project:** War Room (Hybrid Mission Control)

**Repo:** `/Users/ajhart/.openclaw/workspace/warroom-app`

**Objective:** Make War Room *feel* like a real multi-agent control plane (inspired by “Mission Control” systems) by adding high-signal UX surfaces:
- Ops Board (runs pipeline)
- Agent roster + presence
- Run packet console (copy/paste UX)
- Merge choreography as a guided ritual (go/no-go)
- Artifacts wall

**Non-goals:**
- No embedded IDE/terminal.
- No full automation of Claude Code sessions.

---

## Success Criteria

- AJ can understand “what’s happening” in <10 seconds on opening War Room.
- AJ can stage lanes + copy packets with minimal friction.
- Merging feels like a controlled go/no-go ritual, not manual git guessing.
- Artifacts are visible and tied to runs.

---

## User Stories

### UX-001 — Ops Board home screen
As AJ, I want a pipeline-style board showing run states (draft → staged → in progress → ready to merge → done) so I can see the whole org at a glance.

**Acceptance Criteria**
- Home screen displays columns:
  - Draft Plan
  - Ready to Stage
  - Staged
  - In Progress
  - Ready to Merge
  - Done/Archived
- Each run card shows: runSlug, goal, startMode, last updated, lane count.
- Each card has quick actions: Open, Stage, View Packets.

### UX-002 — Run detail: Agent roster + presence
As AJ, I want a roster view for a run that shows each lane as a “teammate” with status so it feels like a squad.

**Acceptance Criteria**
- Run detail page shows a roster list/grid of lanes.
- Each lane shows:
  - laneId + agent label
  - status (Not started / Running / Waiting on AJ / Done)
  - branch + worktree path
  - verification gate state (Unknown/Pass/Fail)
  - Open Cursor Window button (launch `/usr/local/bin/cursor -n <worktreePath>`)

### UX-003 — Run packets console
As AJ, I want the best-possible copy/paste experience for packets so running Claude Code is frictionless.

**Acceptance Criteria**
- For each lane, show:
  - Copy Packet
  - Copy Packet + Launch Command (prepends `claude` command; respects autonomy toggle)
  - “Next steps” checklist:
    1) Open Cursor window
    2) Open terminal
    3) Run claude
    4) Paste packet
- Provide Copy PM Prompt on plan pages.

### UX-004 — Merge choreography screen
As AJ, I want merging to feel like a guided go/no-go ritual so I don’t forget steps or merge too early.

**Acceptance Criteria**
- Merge screen shows per-lane readiness:
  - commits ahead of integration
  - changed files list (summary)
  - conflict risk indicator (file overlap heuristic)
- Buttons:
  - Propose merge plan (PM)
  - Execute merge into integration (manual hook or placeholder)
  - Go/No-Go to main (explicit confirmation)
- On conflict, show conflicted files and Open in Cursor action.

### UX-005 — Artifacts wall
As AJ, I want an artifacts view that shows evidence (plans, packets, reports, screenshots) tied to each run.

**Acceptance Criteria**
- Artifacts tab lists:
  - plan.json, status.json
  - packets/*.md
  - artifacts/** files (screenshots, logs, reports)
- Clicking an artifact opens a viewer (text preview for .md/.json, image preview for screenshots).

### UX-006 — UI copy that clarifies responsibilities
As AJ, I want the UI to clearly state what War Room does automatically vs what I must do next.

**Acceptance Criteria**
- Every run screen includes a small “What happens next” panel.
- Start mode is always visible (OpenClaw vs Claude Code import).
- Stage Lanes copy explicitly states “this opens Cursor windows and writes packets; you run claude in terminal.”

---

## Implementation Notes

- These stories should build on the existing run folder spine: `~/.openclaw/workspace/warroom/runs/<runSlug>/`.
- For MVP, presence/status can be manual toggles stored in `status.json`. Automatic detection can come later.
- Keep UX bold and readable. Avoid “generic dashboard” aesthetics.
