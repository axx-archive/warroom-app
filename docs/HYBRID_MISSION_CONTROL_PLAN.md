# Hybrid Mission Control Plan (OpenClaw + Cursor/Claude Code)

## Thesis
Build a single “control plane” product with two execution backends:

1) **OpenClaw Runtime (autonomous, message-driven)**
- Best for: scheduled jobs, audits, research, QA, report generation, non-interactive automation.
- Entry points: Telegram/Signal/web UI.

2) **Claude Code Runtime (interactive, Cursor-based)**
- Best for: high-quality code edits inside the repo with tight human supervision.
- Entry points: War Room UI launches worktrees + Cursor windows + run packets.

These share a **single state spine** (file truth) so it feels like one system.

---

## Why hybrid beats “Cursor-only”

Cursor-only is great for interactive coding, but hybrid adds:

- **Async kickoff from anywhere:** “run an audit / prepare run packets / open lanes” via messaging.
- **Autonomous background work:** reports, QA, design audits, dependency scans while you’re away.
- **Unified visibility:** a dashboard that tracks both autonomous jobs and interactive lanes.
- **Choreography automation:** merge plans, verification gates, artifact collection.

Cursor remains the *workbench*; OpenClaw becomes the *autopilot + scheduler + router*.

---

## Product Shape

### A) War Room UI (local webapp)
- Repo selector
- Workstreams view (Ralph spine + PRDs)
- Lanes view (worktrees + Cursor windows)
- Merge choreography view (integration branch, lane readiness, conflicts)
- Artifacts view (QA/design audit outputs)

### B) OpenClaw integration
- Messaging commands map to:
  - start audit
  - start QA
  - generate run packets
  - open Cursor windows for lanes
  - morning report

OpenClaw writes outputs into a shared folder structure that War Room reads.

---

## Shared File Truth (state spine)

### In each target repo
- `tasks/prd.json` + `tasks/progress.txt` (Ralph workstreams)
- `tasks/prd-*.md` (PRDs)
- `CLAUDE.md`

### In OpenClaw workspace
- `~/.openclaw/workspace/warroom/`
  - `runs/<timestamp>/` (reports + artifacts)
  - `packets/<timestamp>/` (generated run packets)
  - `state.json` (War Room global state)

---

## Execution choreography

### 1) Kickoff (from message or UI)
- User describes goal
- PM produces:
  - agent chain
  - run packets
  - lane/worktree plan

### 2) Launch lanes
- Create worktrees + branches per lane
- Open Cursor window per worktree via `/usr/local/bin/cursor -n <path>`
- Write `WARROOM_PACKET.md` into each worktree

### 3) Merge choreography
- PM proposes merge order + method
- Repo Manager (or backend) executes merges into integration branch
- Conflicts pause + open in Cursor for resolution

---

## Milestones

### M0: Foundations
- War Room reads repos + lists `.claude` system + Ralph spine files
- State stored locally

### M1: Lane launcher
- Create worktrees + open Cursor windows
- Write run packets

### M2: OpenClaw kickoff
- Messaging command triggers PM output + lane creation + window opening
- Reports written to warroom/runs

### M3: Merge choreography
- UI to merge lanes with verification gates

### M4: Optional Cursor extension
- auto-open terminal
- paste/run packets
- status signals
