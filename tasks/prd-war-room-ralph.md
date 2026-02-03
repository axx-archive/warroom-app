# PRD — War Room (Hybrid Mission Control) — Ralph Workstream

**Project:** War Room (standalone local webapp)

**Repo:** `/Users/ajhart/.openclaw/workspace/warroom-app`

**Goal:** Build a local “Mission Control” UI that can:
- generate/import War Room plans (plan.json + packets)
- stage lanes (git worktrees + Cursor windows + WARROOM_PACKET.md)
- track status/artifacts
- support hybrid kickoff: OpenClaw autonomous + manual Claude Code
- provide merge choreography UX (propose plan → execute merges safely)

**Non-goals (for MVP):**
- No embedded terminal/IDE inside War Room.
- No assumption of a Claude Code OAuth/remote-control API.
- No fully-autonomous Claude Code execution (Cursor extension for auto-terminal is later).

**Constraints:**
- Must be resilient to context resets: **file-backed state** under `~/.openclaw/workspace/warroom/`.
- Must clearly distinguish: **what War Room does automatically** vs **what AJ must do**.
- Must enforce “foundation lane” and “allowed paths” guardrails to prevent lane merge conflicts.

---

## Canonical Artifacts / File Truth

War Room state directory:
- `~/.openclaw/workspace/warroom/`
  - `runs/<runSlug>/plan.json`
  - `runs/<runSlug>/status.json`
  - `runs/<runSlug>/packets/*.md`
  - `runs/<runSlug>/artifacts/**`

Plan schema source of truth:
- `docs/WAR_ROOM_APP_PRD.md` (product spec)
- `docs/HYBRID_MISSION_CONTROL_PLAN.md` (hybrid architecture)

---

## UX: Two Start Modes (must be obvious)

**Mode A: OpenClaw Kickoff (recommended)**
- In War Room: user enters goal → click “Generate Plan (OpenClaw)”

**Mode B: Manual Claude Code Kickoff**
- War Room provides “Copy PM Prompt” → user runs `@pm /warroom-plan` in Claude Code → user imports results via “Import Plan”

Both modes should result in the same run folder structure.

---

## Verification / Quality Gates

Per story:
- `npm run typecheck`
- `npm run lint`
- `npm run build`

Global:
- No `.next/` or `node_modules/` committed.
- Turbopack root stable (no "inferred workspace root" warnings).

---

## User Stories (Ralph)

### Foundation / Repo Hygiene

#### WR-001 — Choose canonical app root
As AJ, I want a single canonical War Room Next.js app (no duplicate scaffolds), so root inference and dependency resolution are deterministic.

**Acceptance Criteria**
- There is exactly one primary Next.js app directory for War Room (recommend: `warroom-app/`).
- Root-level Next scaffolding is removed/archived (no longer used for dev).
- `npm run dev` instructions are updated accordingly.
- Typecheck/lint/build succeed in canonical app.

#### WR-002 — Fix Node/bin-link reliability
As AJ, I want deterministic `tsc/eslint/next` execution so installs don’t randomly break.

**Acceptance Criteria**
- Fresh `npm install` works on AJ’s machine and `npm run typecheck|lint|build` run.
- If Node pinning is used: `.nvmrc` or `.tool-versions` exists and docs explain.
- If postinstall fix is used: it’s minimal and documented.

#### WR-003 — Gitignore baseline
As AJ, I want generated build artifacts ignored so I don’t get “too many changes” or accidental commits.

**Acceptance Criteria**
- `.gitignore` includes `.next/`, `node_modules/`, `dist/`, logs.
- Repo has no tracked `.next/` or `node_modules/`.

---

### Run Model + Dashboard

#### WR-010 — Runs dashboard lists run folders
As AJ, I want War Room to list runs from `~/.openclaw/workspace/warroom/runs/` so I can see what’s happening.

**Acceptance Criteria**
- UI shows list of runs (slug, status, startMode, updatedAt).
- Clicking a run shows plan summary + lane list.

#### WR-011 — Read run folder plan/status
As AJ, I want the UI to render from `plan.json` and `status.json` so UI is always consistent with file truth.

**Acceptance Criteria**
- UI reads plan from disk (server-side) and renders.
- UI reads status from disk and renders lane completion.

#### WR-012 — Status update API
As AJ, I want to mark lanes complete in the UI so progress persists.

**Acceptance Criteria**
- API endpoint updates `status.json` (lanesCompleted, status, updatedAt).
- UI can toggle lane complete.

---

### Plan Generation (M1)

#### WR-020 — Generate plan (stub)
As AJ, I want Generate Plan to write `plan.json + packets` to a run directory.

**Acceptance Criteria**
- POST `/api/generate-plan` returns `{plan, runDir}`.
- Run folder created with correct structure.
- Packets generated per lane.

#### WR-021 — Copy PM Prompt panel
As AJ, I want War Room to generate a copy/paste prompt for Claude Code PM so I can manually kick off planning.

**Acceptance Criteria**
- UI shows Copy PM Prompt.
- Prompt includes `/warroom-plan` and fallback file path.
- Prompt includes repoPath, goal, constraints.

#### WR-022 — Import plan.json (paste)
As AJ, I want to paste a JSON plan into War Room to create a run.

**Acceptance Criteria**
- Import accepts JSON and writes to new run folder.
- Packets can be provided or auto-generated.

#### WR-023 — Import run folder (path)
As AJ, I want to point War Room at an existing run folder and have it render.

**Acceptance Criteria**
- UI can open an existing runDir and render it.

---

### Stage Lanes (M2)

#### WR-030 — Stage lanes creates worktrees
As AJ, I want War Room to create git worktrees for each lane.

**Acceptance Criteria**
- API endpoint creates worktrees at lane.worktreePath.
- Branches created per lane if missing.
- Errors are handled and surfaced.

#### WR-031 — Stage lanes opens Cursor windows
As AJ, I want War Room to open Cursor windows per lane so it feels like a team.

**Acceptance Criteria**
- War Room runs `/usr/local/bin/cursor -n <worktreePath>` for each lane.
- UI shows “staged” status.

#### WR-032 — Stage lanes writes WARROOM_PACKET.md into each worktree
As AJ, I want each lane worktree to contain a ready-to-paste packet file.

**Acceptance Criteria**
- `WARROOM_PACKET.md` written to each worktree.
- Content matches packet in run folder.

#### WR-033 — Optional autonomy toggle (dangerous skip)
As AJ, I want to toggle “skip permissions prompts” so I don’t click approvals constantly.

**Acceptance Criteria**
- UI toggle sets lane.autonomy.dangerouslySkipPermissions.
- Packets include instruction: run `claude --dangerously-skip-permissions` when enabled.

---

### Guardrails (prevent lane conflicts)

#### WR-040 — Foundation lane enforcement in plan generation
As AJ, I want the plan generator to enforce a foundation lane for scaffolding tasks so later lanes don’t create conflicting app structure.

**Acceptance Criteria**
- If goal indicates scaffolding/foundation changes, lane-1 is foundation.
- Non-foundation lanes depend on foundation.

#### WR-041 — Allowed paths in packets
As AJ, I want packets to include Allowed Paths so each lane stays in its lane.

**Acceptance Criteria**
- Packets include Allowed Paths list.
- Packets include “git diff --stat must stay within allowed paths” rule.

#### WR-042 — Hard ignore of `.next/` in lane commits
As AJ, I want to prevent `.next/` from being committed so merges stay clean.

**Acceptance Criteria**
- `.next/` is ignored.
- Documentation explicitly warns against committing generated artifacts.

---

### OpenClaw Integration (Hybrid)

#### WR-050 — OpenClaw kickoff endpoint (local)
As AJ, I want War Room to request OpenClaw to generate a plan so kickoff can be autonomous.

**Acceptance Criteria**
- War Room can call OpenClaw (design TBD) and receive a plan artifact.
- Run folder is created and rendered.

#### WR-051 — Messaging command: “generate plan”
As AJ, I want to message OpenClaw “generate a War Room plan for X” and see it appear in the War Room UI.

**Acceptance Criteria**
- Messaging command triggers plan generation.
- Run folder written.

#### WR-052 — Messaging command: “stage lanes”
As AJ, I want to message OpenClaw to stage lanes (worktrees + Cursor) so the team is ready when I sit down.

**Acceptance Criteria**
- Message triggers staging for a specified run.

---

### Merge Choreography (v1)

#### WR-060 — Merge screen shows lane readiness
As AJ, I want War Room to show which lanes have commits and are ready to merge.

**Acceptance Criteria**
- UI shows per-lane commit count ahead of integration branch.
- UI highlights conflicts risk (file overlap heuristic).

#### WR-061 — Propose merge plan (PM)
As AJ, I want War Room to ask PM to propose merge order and method.

**Acceptance Criteria**
- UI button triggers proposal.
- Proposal stored in run artifacts.

#### WR-062 — Execute merge (repo-manager/backend)
As AJ, I want War Room to execute merges into integration branch with checkpoints.

**Acceptance Criteria**
- Merges happen in proposed order.
- On conflict: stop and open Cursor for resolution.
- Never merges to main without explicit confirmation.

---

### Polish / UX

#### WR-070 — Improve War Room UI clarity
As AJ, I want the UI to clearly explain what War Room does vs what I do next.

**Acceptance Criteria**
- Plan viewer shows “Next steps” checklist.
- Copy PM Prompt is obvious.
- Stage Lanes explains it opens Cursor windows and writes packets.

---

## Notes
- This PRD intentionally includes both “stubbed” generation and future OpenClaw-powered PM generation. We can ship value early by implementing everything around plan artifacts first.
