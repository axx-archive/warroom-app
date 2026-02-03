# WAR ROOM PACKET

## Lane
- laneId: lane-1
- agent: developer
- branch: warroom/mvp/dashboard-shell
- worktree: /Users/ajhart/.openclaw/worktrees/mvp-dashboard

## Goal
Build the M0 read-only dashboard shell: repo selector, agents/skills viewer, PRD list, and runs dashboard scaffolding.

## Scope
### DO:
- Initialize Next.js 14+ app with TypeScript and Tailwind CSS
- Create repo selector component (path input with file browser)
- Read and display `.claude/agents/*` and `.claude/skills/*` from selected repo
- Read and display `tasks/` directory (PRDs, prd.json, progress.txt)
- Read and display `CLAUDE.md` if present
- Create runs list view (use stub data, structure for later)
- Set up file-backed state directory at `~/.openclaw/workspace/warroom/`
- Create status.json read/write utilities

### DO NOT:
- Implement plan generation (that's lane-2)
- Implement worktree creation or Cursor launching (that's lane-3)
- Add authentication or user management
- Over-engineer state management (file-backed is fine for MVP)

## Inputs
- Repo: /Users/ajhart/.openclaw/workspace
- PRD: docs/WAR_ROOM_APP_PRD.md (requirements R1, R2, R5 partial)
- Reference: The app serves AJ's hybrid OpenClaw/Claude Code workflow

## Key Files to Create
```
src/
  app/
    page.tsx              # Main dashboard
    layout.tsx            # App shell
  components/
    RepoSelector.tsx      # R1: Repo picker
    AgentsList.tsx        # Display .claude/agents/*
    SkillsList.tsx        # Display .claude/skills/*
    PrdList.tsx           # Display tasks/ PRDs
    RunsList.tsx          # R2: Runs dashboard (stub)
  lib/
    fs-utils.ts           # File reading utilities
    state.ts              # ~/.openclaw/workspace/warroom/ state
```

## Verification
Run these commands before marking complete:
```bash
npm run typecheck
npm run lint
npm run build
```

Manual verification:
- App loads at localhost:3000
- Can select a repo path
- Agents and skills display correctly
- PRD files are listed

## Stop Conditions
- If you encounter ambiguity about UI design, prefer minimal/functional over polished
- If blocked on file system APIs (e.g., browser limitations), use Node.js API routes
- If unclear about state format, ask AJ with options:
  - A) JSON files in ~/.openclaw/workspace/warroom/
  - B) SQLite database
  - C) In-memory with periodic flush
  - D) Other (describe)

## Dependencies
- None (can start immediately)

## Notes
- This is the foundation that lane-3 will build on for the Stage Lanes UI
- Keep components simple and composable
- Use server components where possible for file system access
