# War Room — System Architecture

War Room is a **local orchestration UI** for running and supervising multi-lane Claude Code work against a repository.

At a high level:

- The **Next.js app** provides the UI and a set of API routes.
- The API routes read/write **run state stored on disk** under `~/.openclaw/workspace/warroom/runs/<runSlug>`.
- The backend shells out to **git** (status/diff/log/merge/push) and can spawn **terminal sessions** for lanes.
- Clients get realtime updates via **Socket.io** events (plus polling as a fallback).

This is currently optimized for a single trusted workstation.

---

## 1) Major subsystems

### A) Next.js App (UI)
Primary pages:
- `GET /runs` — list runs
- `GET /runs/[slug]` — run detail: lanes, progress, diffs, merge view, history

UI state is driven by:
- polling endpoints (`/api/runs/[slug]/status`, `/api/runs/[slug]/lane-status`, etc.)
- realtime websocket events (lane activity/progress/merge/mission progress)

### B) API layer (server)
Location: `src/app/api/**`

Categories:
- **Run lifecycle**: initialize/start/stop/launch/reset
- **Lane status**: `git status`, commit counts, error detection
- **Diffs**: per-lane diffs + summaries
- **History**: append-only `history.jsonl` and filtering/pagination
- **Templates**: save/load common run configurations
- **Watcher**: filesystem watcher for lane worktrees

### C) Orchestrator
Location: `src/lib/orchestrator/*`

Core concepts:
- **Run**: identified by `runSlug`
- **Lane**: an independent agent process + worktree + branch

Main implementation:
- `AgentOrchestrator` (`src/lib/orchestrator/agent-orchestrator.ts`)
  - singleton manager of all active runs and lane processes
  - starts/stops lanes, tracks state, schedules retries
  - emits websocket events for UI updates

Supporting modules:
- `git-operations.ts` — commit/merge/push helpers
- `terminal-spawner.ts` — open/send text to iTerm/Terminal sessions
- `output-buffer.ts` — capture + classify lane output (errors, progress, cost)

### D) File watcher
Location: `src/lib/file-watcher/file-watcher.ts`

Watches lane worktrees (recursive fs watch) to:
- emit "lane-activity" events when files change
- detect `LANE_STATUS.json` updates and emit "lane-progress" events

### E) Realtime (Socket.io)
Location: `src/lib/websocket/*`

- `server.ts` starts a dedicated Socket.io server (default `WS_PORT=3001`).
- `init.ts` is imported by server-side modules to initialize the server.
- Clients connect with `socket.io-client` and subscribe to `run:<slug>` rooms.

Event types are defined in `src/lib/websocket/types.ts`.

---

## 2) On-disk run state

Run root:

`~/.openclaw/workspace/warroom/runs/<runSlug>/`

Typical files:
- `plan.json` — canonical definition of lanes, branches, worktrees, prompts, and orchestration settings.
- `status.json` — computed/aggregated status used by the UI.
- `history.jsonl` — append-only audit log of significant events (JSONL).

Each lane may also reference a worktree path (often created via `git worktree`) and can write:
- `LANE_STATUS.json` — lane-side progress/status file consumed by watcher + UI.

---

## 3) Data flow

### Launch
1. UI calls an API endpoint to initialize or start a run.
2. Orchestrator reads `plan.json` and transitions lanes to "starting".
3. Lanes are started (child process + optional terminal window).
4. Orchestrator emits websocket events and appends history events.

### Steady state
- UI polls periodically for `/status` and `/lane-status`.
- Watcher emits activity/progress events.
- Orchestrator emits status changes, merge progress, retry scheduling, etc.

### Merge/push
- Orchestrator or UI triggers merge APIs.
- `git-operations` performs merges and pushes.
- Status/history + websocket events update the UI.

---

## 4) Configuration

Environment variables:
- `WS_PORT` — socket.io listening port (default `3001`)

Hard-coded paths:
- The current implementation derives run roots from `os.homedir()` and `~/.openclaw/workspace/warroom/runs`.
  - Follow-on work should centralize this into `WARROOM_RUNS_DIR`.

---

## 5) Security & operational assumptions (current)

War Room currently assumes a **trusted local workstation**.

Because it reads/writes local files and shells out to git/terminal tooling, it should **not** be exposed to the public internet.

Minimum hardening checklist before any non-local use:
- bind HTTP + websocket servers to localhost (or require auth)
- require auth + CSRF protection on mutation endpoints
- validate `runSlug`, `laneId`, branch names and paths with strict allowlists
- avoid `exec()` string interpolation; prefer `execFile/spawn` with arg arrays
- prevent path traversal by enforcing resolved paths remain under the run base dir
