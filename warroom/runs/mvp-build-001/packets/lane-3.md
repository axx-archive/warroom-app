# WAR ROOM PACKET

## Lane
- laneId: lane-3
- agent: developer
- branch: warroom/mvp/lane-stager
- worktree: /Users/ajhart/.openclaw/worktrees/mvp-stager

## Goal
Build the M2 lane staging system: worktree creation, Cursor window launcher, and WARROOM_PACKET.md injection.

## Scope
### DO:
- Create "Stage Lanes" button in Plan Viewer (integrates with lane-1 UI)
- Build worktree creation service: `git worktree add <path> -b <branch>`
- Build Cursor launcher: `/usr/local/bin/cursor -n <worktreePath>`
- Write `WARROOM_PACKET.md` into each worktree root
- Update lane status in status.json (staged: true/false)
- Show staging progress and status in UI
- Handle errors gracefully (worktree exists, git not clean, etc.)

### DO NOT:
- Modify the repo selector or dashboard shell (lane-1 owns that)
- Modify plan generation logic (lane-2 owns that)
- Auto-run claude in the Cursor windows (AJ runs manually per MVP)
- Implement merge choreography (that's M4, future milestone)

## Inputs
- Repo: /Users/ajhart/.openclaw/workspace
- PRD: docs/WAR_ROOM_APP_PRD.md (requirement R6)
- Plan: Reads plan.json from ~/.openclaw/workspace/warroom/runs/<runId>/

## Key Files to Create
```
src/
  app/
    api/
      stage-lanes/
        route.ts          # POST: create worktrees + launch Cursor
  components/
    StageLanesButton.tsx  # Trigger staging
    LaneStatus.tsx        # Show staged/not staged per lane
    StagingProgress.tsx   # Progress indicator during staging
  lib/
    worktree-manager.ts   # Git worktree operations
    cursor-launcher.ts    # Cursor CLI wrapper
    packet-writer.ts      # Write WARROOM_PACKET.md to worktree
```

## Worktree Conventions
```
Base location: /Users/ajhart/.openclaw/worktrees/
Per-lane path: /Users/ajhart/.openclaw/worktrees/<slug>-<agent>/
Branch naming: warroom/<slug>/<agent>

Example:
- worktreePath: /Users/ajhart/.openclaw/worktrees/mvp-dashboard
- branch: warroom/mvp/dashboard-shell
```

## Git Commands to Execute
```bash
# Create worktree with new branch
git worktree add /Users/ajhart/.openclaw/worktrees/mvp-dashboard -b warroom/mvp/dashboard-shell

# Or if branch exists:
git worktree add /Users/ajhart/.openclaw/worktrees/mvp-dashboard warroom/mvp/dashboard-shell
```

## Cursor Launch Command
```bash
/usr/local/bin/cursor -n /Users/ajhart/.openclaw/worktrees/mvp-dashboard
```

## Verification
Run these commands before marking complete:
```bash
npm run typecheck
npm run lint
```

Manual verification:
- Click "Stage Lanes" on a generated plan
- Verify worktrees are created at the specified paths
- Verify Cursor windows open for each lane
- Verify WARROOM_PACKET.md exists in each worktree root
- Verify lane status updates to "staged" in UI

## Stop Conditions
- If worktree path already exists, ask AJ:
  - A) Remove and recreate
  - B) Reuse existing worktree
  - C) Fail and show error
  - D) Use alternate path with suffix
- If Cursor command fails, log error but don't block other lanes
- If git worktree command fails, show detailed error message

## Dependencies
- lane-1 (needs UI shell and components structure)
- Reads plan.json produced by lane-2

## Notes
- This is the "magic moment" where clicking a button opens multiple Cursor windows
- Keep the UX simple: one button, clear progress, obvious success/failure
- Worktrees should be cleaned up separately (future feature)
- Each WARROOM_PACKET.md should be a copy of the packet from packets/<laneId>.md
