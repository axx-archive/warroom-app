# warroom-app (repo)

This repository contains the War Room application under `./warroom-app/`.

- App README: `warroom-app/README.md`
- Architecture: `docs/ARCHITECTURE.md`
- Design system: `docs/DESIGN_SYSTEM.md`
- PRDs / planning: `docs/`

## Why is the repo structured this way?

We keep the product code in the `warroom-app/` directory.

Anything that looks like assistant “memory” / personal workspace logs should **never** be committed here (especially for public/open-source repos). Those live in a central private location (e.g. `~/.openclaw/workspace/memory/`).
# War Room App

War Room is a **local mission-control UI** for orchestrating multi-lane Claude Code runs against a repo (launch lanes, watch progress, auto-commit, merge, and push), with an audit/history trail.

This repo is intentionally **workstation-oriented** (it shells out to git/terminal tooling and reads/writes under your home directory). Treat it as **local-only software** unless/until the security hardening + auth model is completed.

## Quick start

### Requirements
- Node.js **20+**
- `git` available in PATH
- macOS recommended (some features integrate with iTerm/Terminal via AppleScript)

### Install + run

```bash
cd warroom-app
npm ci
npm run dev
```

Open: http://localhost:3000

### Build / checks

```bash
cd warroom-app
npm run typecheck
npm run lint
npm run build
```

## Architecture docs

- **System architecture:** `docs/ARCHITECTURE.md`
- **UI design system:** `docs/DESIGN_SYSTEM.md`

## Ports
- App: `3000`
- WebSocket: `WS_PORT` env var (default `3001`)

## Data model (on disk)

Runs are stored under:

- `~/.openclaw/workspace/warroom/runs/<runSlug>/`
  - `plan.json` — run plan (lanes, branches, worktrees, settings)
  - `status.json` — aggregated lane/run state used by the UI
  - `history.jsonl` — append-only audit log
  - lane worktrees / lane artifacts (e.g. `LANE_STATUS.json`)

> The API routes read/write these files and shell out to `git` to compute status/diffs.

## Security note (important)

War Room currently assumes a trusted local environment.

If you expose it beyond localhost (or run it on a shared machine), you must first:
- enforce **localhost-only binding** (including WebSocket server)
- add auth/CSRF protections
- validate all slugs/paths and avoid shell interpolation in command execution

See `docs/ARCHITECTURE.md` for the hardening checklist.
