# WAR ROOM / MISSION CONTROL — Product Plan (v0)

**Goal:** A local “team cockpit” for AJ to run his Claude Code system like a coordinated org: PM routes work → sub-agents execute in isolated worktrees → results + verification + artifacts are visible in one place.

This product is **for AJ**, not for Axx-as-chat. It should feel like *a team working together*.

---

## North Star

- AJ can type a goal into a **War Room UI**.
- War Room uses **PM** to produce a proposed agent chain and a set of **run packets**.
- War Room can then **launch** Claude Code sessions (preferably inside Cursor) for each run packet in isolated worktrees.
- War Room tracks state outside any single context window: what’s running, what’s blocked, what’s done, what artifacts exist.

---

## Reality Constraints (be honest)

- We should **not** assume a stable Claude Code “remote control API” or OAuth surface.
- We can still get 80% of the value by:
  - generating consistent prompts (“run packets”)
  - creating separate worktrees per agent/session
  - launching terminals (or Cursor windows) per worktree
  - saving state + outputs to files

Autonomy levers (optional):
- Launch sessions with `claude --dangerously-skip-permissions` when desired.
- Use hooks to enforce verification and to surface “needs input” moments.

---

## Key Concepts

### 1) Run Packet
A run packet is a **copy/paste-ready** prompt template with:
- role (PM / architect / developer / staff-reviewer / doc-updater / techdebt)
- scope boundaries
- required inputs
- verification commands
- stop conditions + questions (A/B/C/D)
- file truth pointers (PRD, prd.json, progress.txt, CLAUDE.md)

Run packets are the unit of orchestration.

### 2) Agent Session = Worktree + Terminal
A “sub-agent” execution context should map to:
- a git worktree folder
- a terminal running `claude`
- a run packet

This prevents file collisions and makes parallelism real.

### 3) System Truth
War Room should treat these as canonical:
- Repo: `tasks/prd.json`, `tasks/progress.txt` (Ralph workstreams)
- Claude system: `.claude/agents/*`, `.claude/skills/*`, `CLAUDE.md`
- Git history
- QA artifacts folders (Playwright, screenshots)

---

## UX Flow (MVP)

### Step 0 — Select Repo
- choose a repo root (e.g., `~/Desktop/InsideOut`)
- War Room reads:
  - `.claude/agents/*`
  - `.claude/skills/*`
  - `tasks/*` (if present)

### Step 1 — Ask PM
Input box:
- “I want to [goal]”

War Room runs **PM** (agent) in a controlled mode to output:
- recommended agent chain
- run packets per agent
- recommended parallelization lanes

### Step 2 — Review + Approve
War Room shows:
- agent chain table
- run packets (expandable)
- toggles:
  - use worktrees? (default ON)
  - autonomous launch flag? (`--dangerously-skip-permissions`)

User clicks **Launch**.

### Step 3 — Launch Sessions
War Room:
1) creates worktrees per agent lane
2) opens **Cursor windows** per worktree (preferred) OR Terminal windows if Cursor automation is hard
3) in each session, starts `claude` (optionally with dangerous skip)
4) stages the run packet:
   - simplest: saves `WARROOM_PACKET.md` in the worktree and copies it to clipboard
   - optional: auto-paste into terminal (fragile; v2)

### Step 4 — Track State
MVP tracking can be manual toggles:
- Running / Waiting / Done

v1.5 can parse:
- presence of “waiting for input” patterns in logs
- git commits created

---

## Implementation Plan (practical)

### Architecture
- Local webapp UI (Next.js/React) + small local backend runner.
- Backend responsibilities:
  - file read/write
  - git worktree operations
  - launching external apps (Cursor/Terminal)
  - storing run session state in a local sqlite/json

### Cursor Integration (assumption)
Cursor is VSCode-like. Likely options:
- open new window for folder using `code -n <path>` or `cursor -n <path>` (needs confirmation on AJ’s machine)
- within each window, AJ uses the integrated terminal.

If auto-creating terminals inside Cursor is too hard, opening the window is still enough.

### Git Worktree conventions
- create under: `<repo>/../worktrees/<slug>-<agent>` OR `../worktrees/<agent>-<slug>`
- ensure branch naming is consistent (e.g. `warroom/<slug>/<agent>` or reuse an existing branch).

### Staging run packets
- Write `WARROOM_PACKET.md` into each worktree.
- Provide a “copy packet” button in UI.

---

## What PM should do vs what War Room should do

### PM (agent responsibility)
PM should:
- decide which orchestrator/agent to call
- propose an agent chain
- output run packets
- flag missing skills
- recommend staff-engineer-reviewer for high-stakes plan/diff critique
- recommend techdebt and doc-updater as endcaps

PM should NOT:
- try to launch terminals or create worktrees

### War Room (app responsibility)
War Room should:
- manage worktrees
- manage launching windows
- store state
- render dashboards
- keep artifacts organized

War Room should NOT:
- invent agent logic (it should ask PM)

---

## MVP Deliverables

1) Repo selector + dashboard skeleton
2) “Ask PM” action that returns:
   - chain + packets
3) Worktree creation + open Cursor window per worktree
4) Save `WARROOM_PACKET.md` in each worktree
5) Basic session list UI with manual status

---

## Open Questions

1) What CLI command opens Cursor?
   - `cursor`? `code`? something else?
2) Should War Room default to opening new **Cursor windows** or **Terminal windows**?
3) How do we identify “agent waiting for input” reliably?
4) Where should War Room persist state (json vs sqlite)?

---

## Success Criteria

- AJ can spin up 3–5 parallel “agent lanes” (worktrees + Cursor windows) in < 60 seconds.
- Each lane has a clear run packet and boundaries.
- Work doesn’t collide (worktree isolation works).
- State is visible even after Claude context resets.
