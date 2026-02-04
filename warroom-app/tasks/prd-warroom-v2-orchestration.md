# PRD: War Room v2.0 - Full Orchestration Platform

## Introduction

Transform War Room from a manual mission control interface into a fully autonomous AI agent orchestration platform. The system will launch, monitor, and merge parallel Claude Code agent work with minimal human intervention. Default mode is fully autonomous - the orchestrator handles everything, only stopping for merge conflicts or critical errors.

**Platform:** macOS only (leverages AppleScript for terminal spawning)
**Error Handling:** Auto-retry with exponential backoff
**Default Autonomy:** Fully autonomous (fire and forget)
**Notifications:** In-app only (browser notifications + UI alerts)

## Goals

- Eliminate manual button-clicking for routine operations (launch, monitor, commit, merge)
- Provide real-time visibility into all lane activity without page refreshes
- Enable true parallel agent orchestration with a single "Start Mission" action
- Reduce time from plan creation to merged code by 80%
- Maintain human gates only for critical decisions (merge conflicts, main branch deployment)

## Phases Overview

| Phase | Focus | Effort |
|-------|-------|--------|
| Phase 1 | Enhanced Monitoring & Auto-Updates | Medium |
| Phase 2 | Semi-Autonomous Operations | Medium |
| Phase 3 | Full Orchestrator Agent | High |
| Phase 4 | Quality of Life Features | Medium |

---

## Phase 1: Enhanced Monitoring & Auto-Updates

### US-101: Real-time status polling
**Description:** As a user, I want lane statuses to auto-refresh so I don't have to manually reload the page.

**Acceptance Criteria:**
- [ ] Poll `/api/runs/[slug]/status` every 5 seconds when run page is open
- [ ] Update lane cards, progress counter, and merge readiness without full reload
- [ ] Show subtle "refreshing..." indicator during poll
- [ ] Pause polling when browser tab is hidden (visibility API)
- [ ] Resume polling when tab becomes visible
- [ ] Typecheck passes

### US-102: Uncommitted changes detection
**Description:** As a user, I want to see which lanes have uncommitted work so I know what needs attention.

**Acceptance Criteria:**
- [ ] New API endpoint: `GET /api/runs/[slug]/lane-status` returns uncommitted file counts per lane
- [ ] Display orange badge on lane card: "3 uncommitted files"
- [ ] Badge updates via polling
- [ ] Clicking badge shows list of changed files in tooltip/popover
- [ ] Typecheck passes

### US-103: New commits detection
**Description:** As a user, I want to see when a lane has new commits since launch so I can track progress.

**Acceptance Criteria:**
- [ ] Track "commits at launch" in status.json when lane is launched
- [ ] API returns commits count since launch per lane
- [ ] Display green badge: "+2 commits" when new commits exist
- [ ] Badge links to git log for that lane's branch
- [ ] Typecheck passes

### US-104: "Ready to complete?" smart suggestions
**Description:** As a user, I want the system to suggest when a lane looks complete so I can quickly verify and mark it done.

**Acceptance Criteria:**
- [ ] Detect lane completion signals: REVIEW.md exists, FINDINGS.md exists, specific commit message patterns
- [ ] Show suggestion banner on lane card: "This lane looks complete. Mark as done?"
- [ ] One-click "Mark Complete" button in suggestion banner
- [ ] Suggestion dismissible (don't show again for this lane)
- [ ] Typecheck passes

### US-105: WebSocket layer for live updates
**Description:** As a user, I want instant updates without polling delay so the UI feels responsive.

**Acceptance Criteria:**
- [ ] Add Socket.io server to Next.js app (custom server or API route with upgrade)
- [ ] Emit events: `lane-activity`, `lane-status-change`, `merge-ready`, `run-complete`
- [ ] Client connects on run detail page mount
- [ ] Graceful fallback to polling if WebSocket fails
- [ ] Connection status indicator in UI footer
- [ ] Typecheck passes

### US-106: File watcher service
**Description:** As a system, I need to watch worktree directories for changes to trigger real-time updates.

**Acceptance Criteria:**
- [ ] FileWatcher class that watches all lane worktrees for a run
- [ ] Debounce file change events (100ms)
- [ ] Emit events via WebSocket when files change
- [ ] Start watching when run page opens, stop when closes
- [ ] Handle worktree not existing gracefully
- [ ] Typecheck passes

---

## Phase 2: Semi-Autonomous Operations

### US-201: "Launch All Ready Lanes" button
**Description:** As a user, I want to launch all unblocked lanes at once so I don't have to click each one.

**Acceptance Criteria:**
- [ ] Button in Agent Lanes header: "Launch All Ready"
- [ ] Launches all lanes where dependencies are met and status is pending
- [ ] Sequential launch with 2-second delay between (avoid overwhelming system)
- [ ] Progress indicator: "Launching 3 of 5..."
- [ ] Shows summary when complete: "Launched 4 lanes, 1 blocked"
- [ ] Typecheck passes

### US-202: Auto-detect lane completion
**Description:** As a system, I want to automatically detect when a lane's work is complete so users don't have to manually check.

**Acceptance Criteria:**
- [ ] Completion detection rules (configurable):
  - REVIEW.md or FINDINGS.md exists in worktree root
  - Commit message contains "complete", "done", or "finished"
  - No file changes for 5+ minutes after commits
- [ ] Auto-mark lane as complete when rules match (if autonomy enabled)
- [ ] Log completion detection reason in status.json
- [ ] Typecheck passes

### US-203: Auto-generate merge proposal
**Description:** As a system, I want to automatically generate merge proposals when all lanes are complete so the merge process starts immediately.

**Acceptance Criteria:**
- [ ] Trigger merge proposal generation when last lane marked complete
- [ ] Show notification: "All lanes complete. Merge proposal generated."
- [ ] Auto-scroll to Merge Readiness section
- [ ] If conflicts detected, show warning and stop auto-progression
- [ ] Typecheck passes

### US-204: Diff preview modal
**Description:** As a user, I want to preview all changes in a lane before marking it complete so I can verify the work.

**Acceptance Criteria:**
- [ ] "Preview Changes" button on each lane card
- [ ] Modal showing full diff of all changes in worktree
- [ ] Syntax highlighting for code files
- [ ] File tree navigation in modal sidebar
- [ ] "Approve & Mark Complete" button in modal
- [ ] Typecheck passes

### US-205: Lane activity feed
**Description:** As a user, I want to see a live feed of activity across all lanes so I can monitor progress at a glance.

**Acceptance Criteria:**
- [ ] Collapsible activity feed panel on run detail page
- [ ] Events: file created/modified/deleted, commits, lane status changes
- [ ] Timestamp and lane ID for each event
- [ ] Filter by lane
- [ ] Auto-scroll to newest (with pause on hover)
- [ ] Maximum 100 events retained (older ones pruned)
- [ ] Typecheck passes

### US-206: Launch mode selector per lane
**Description:** As a user, I want to choose whether a lane opens in Cursor (supervised) or Terminal (autonomous) so I can control my workflow.

**Acceptance Criteria:**
- [ ] Dropdown on lane card: "Cursor" | "Terminal (Claude Code)"
- [ ] Default based on run autonomy setting
- [ ] Persist choice in status.json per lane
- [ ] Terminal mode spawns iTerm2 window with Claude Code command
- [ ] Cursor mode works as current implementation
- [ ] Typecheck passes

---

## Phase 3: Full Orchestrator Agent

### US-301: AgentOrchestrator class
**Description:** As a system, I need a singleton orchestrator that manages the lifecycle of all Claude Code processes for a run.

**Acceptance Criteria:**
- [ ] `AgentOrchestrator` class in `src/lib/orchestrator/agent-orchestrator.ts`
- [ ] Methods: `startRun()`, `stopRun()`, `pauseLane()`, `resumeLane()`, `getStatus()`
- [ ] Maintains Map of laneId -> ChildProcess
- [ ] Singleton pattern (one orchestrator per app instance)
- [ ] Graceful shutdown on app termination (SIGTERM handler)
- [ ] Typecheck passes

### US-302: Terminal spawning via AppleScript
**Description:** As a system, I need to spawn iTerm2 or Terminal.app windows with Claude Code running for each lane.

**Acceptance Criteria:**
- [ ] `spawnTerminal(worktreePath: string, command: string)` function
- [ ] Prefer iTerm2 if installed, fall back to Terminal.app
- [ ] Window title set to lane ID for identification
- [ ] Command: `cd ${worktreePath} && claude --dangerously-skip-permissions`
- [ ] Return process handle for monitoring
- [ ] Typecheck passes

### US-303: Process monitoring with stdout capture
**Description:** As a system, I need to capture Claude Code output to track progress and detect completion/errors.

**Acceptance Criteria:**
- [ ] Capture stdout/stderr from spawned processes
- [ ] Parse output for progress indicators (percentage, step names)
- [ ] Detect error patterns (API errors, crashes, rate limits)
- [ ] Store last 1000 lines of output per lane in memory
- [ ] Expose output via API: `GET /api/runs/[slug]/lanes/[laneId]/output`
- [ ] Typecheck passes

### US-304: Structured status protocol (LANE_STATUS.json)
**Description:** As a system, I need a protocol for Claude Code agents to report their progress so the orchestrator can track them.

**Acceptance Criteria:**
- [ ] Update packet template to instruct agents to write `LANE_STATUS.json`
- [ ] Schema: `{ phase: string, completedSteps: string[], currentStep: string, progress: number, blockers: string[] }`
- [ ] File watcher detects LANE_STATUS.json changes
- [ ] Parse and emit status updates via WebSocket
- [ ] Display current step and progress bar on lane card
- [ ] Typecheck passes

### US-305: Auto-retry with exponential backoff
**Description:** As a system, I need to automatically retry failed lanes so transient errors don't require human intervention.

**Acceptance Criteria:**
- [ ] Detect lane failure (process exit code != 0, error in output)
- [ ] Retry up to 3 times with backoff: 30s, 2min, 10min
- [ ] Log retry attempts in status.json
- [ ] Show retry status on lane card: "Retry 2/3 in 1:45..."
- [ ] After max retries, mark lane as failed and alert user
- [ ] Typecheck passes

### US-306: Auto-commit lane work
**Description:** As a system, I need to automatically commit lane work when the agent signals completion so changes are preserved.

**Acceptance Criteria:**
- [ ] Detect completion signal (LANE_STATUS.json phase = "complete" or process exits cleanly)
- [ ] Run `git add -A && git commit -m "feat(laneId): <summary from status>"` in worktree
- [ ] Skip if no uncommitted changes
- [ ] Update lane status to "complete" after successful commit
- [ ] Emit completion event via WebSocket
- [ ] Typecheck passes

### US-307: Auto-merge with human gates
**Description:** As a system, I need to automatically merge completed lanes but stop for conflicts or main branch merges.

**Acceptance Criteria:**
- [ ] When all lanes complete, automatically start merge process
- [ ] Merge each lane to integration branch in dependency order
- [ ] If conflict detected: stop, mark lane as "conflict", alert user
- [ ] Conflict resolution requires human (open in Cursor)
- [ ] After integration branch complete, prompt for main merge (human gate)
- [ ] Typecheck passes

### US-308: Git push automation
**Description:** As a system, I need to push completed work to remote so it's backed up and available.

**Acceptance Criteria:**
- [ ] Option to auto-push lane branches after commit
- [ ] Option to auto-push integration branch after merge
- [ ] Main branch push always requires human confirmation
- [ ] Handle push failures gracefully (auth errors, protected branches)
- [ ] Show push status in UI
- [ ] Typecheck passes

### US-309: One-click "Start Mission"
**Description:** As a user, I want to start an entire run with one click and have the system handle everything.

**Acceptance Criteria:**
- [ ] "Start Mission" button on run detail page (replaces individual launch buttons in autonomous mode)
- [ ] Spawns all lanes respecting dependency order
- [ ] Monitors all processes
- [ ] Auto-commits, auto-merges
- [ ] Shows overall mission progress: "Phase 2/4: Merging lanes..."
- [ ] Completion notification when done
- [ ] Typecheck passes

---

## Phase 4: Quality of Life Features

### US-401: Lane reset/restart mechanism
**Description:** As a user, I want to reset a failed lane to try again with a clean slate.

**Acceptance Criteria:**
- [ ] "Reset Lane" button on failed/complete lanes
- [ ] Resets worktree to branch base: `git checkout . && git clean -fd`
- [ ] Clears LANE_STATUS.json and output files
- [ ] Resets lane status to "pending"
- [ ] Confirmation dialog before reset
- [ ] Typecheck passes

### US-402: Add lane mid-run
**Description:** As a user, I want to add new lanes to an in-progress run without starting over.

**Acceptance Criteria:**
- [ ] "Add Lane" button in Agent Lanes header
- [ ] Modal to configure new lane (agent type, branch name, dependencies)
- [ ] Creates worktree and packet for new lane
- [ ] Updates plan.json with new lane
- [ ] New lane appears in UI immediately
- [ ] Typecheck passes

### US-403: Cost/token tracking
**Description:** As a user, I want to see estimated API costs per lane so I can monitor spending.

**Acceptance Criteria:**
- [ ] Parse Claude Code output for token usage (if available)
- [ ] Estimate cost based on model and token counts
- [ ] Display per-lane cost estimate on lane card
- [ ] Total run cost in header
- [ ] Cost tracking persisted in status.json
- [ ] Typecheck passes

### US-404: Plan templates
**Description:** As a user, I want to save successful plans as templates so I can reuse them for similar projects.

**Acceptance Criteria:**
- [ ] "Save as Template" button on run detail page
- [ ] Template stores: lane configuration, agent types, dependency structure (not repo-specific paths)
- [ ] Templates saved to `~/.openclaw/workspace/warroom/templates/`
- [ ] "New from Template" option on home page
- [ ] Template picker modal with preview
- [ ] Typecheck passes

### US-405: History/audit log
**Description:** As a user, I want a complete log of all actions so I can debug issues and understand what happened.

**Acceptance Criteria:**
- [ ] Log all significant events: lane launched, commits, status changes, merges, errors
- [ ] Store in `history.jsonl` (append-only) in run directory
- [ ] "History" tab on run detail page
- [ ] Filterable by event type and lane
- [ ] Exportable as JSON
- [ ] Typecheck passes

### US-406: Progress timeline view
**Description:** As a user, I want a visual timeline showing lane progress and dependencies so I can see the big picture.

**Acceptance Criteria:**
- [ ] Gantt-chart style visualization
- [ ] Lanes as horizontal bars
- [ ] Dependency arrows between lanes
- [ ] Color coding: pending (gray), in-progress (blue), complete (green), failed (red)
- [ ] Time axis showing elapsed time
- [ ] Hover shows lane details
- [ ] Typecheck passes

### US-407: In-app notifications
**Description:** As a user, I want to receive notifications for important events so I don't have to watch the screen constantly.

**Acceptance Criteria:**
- [ ] Browser Notification API integration (request permission on first run)
- [ ] Notifications for: lane complete, lane failed, all lanes complete, merge conflict
- [ ] Toast notifications in-app (bottom-right corner)
- [ ] Notification center panel showing recent notifications
- [ ] Notification preferences (which events to notify)
- [ ] Typecheck passes

### US-408: Keyboard shortcuts
**Description:** As a user, I want keyboard shortcuts for common actions so I can work faster.

**Acceptance Criteria:**
- [ ] `Cmd+Shift+L` - Launch all ready lanes
- [ ] `Cmd+Shift+M` - Generate merge proposal
- [ ] `Cmd+Shift+R` - Refresh status
- [ ] `Cmd+1-9` - Focus lane N
- [ ] `?` - Show keyboard shortcut help modal
- [ ] Shortcuts shown in tooltips
- [ ] Typecheck passes

---

## Functional Requirements

### Monitoring & Updates
- FR-1: The system must poll for status updates every 5 seconds when the run page is active
- FR-2: The system must detect uncommitted changes in lane worktrees and display counts
- FR-3: The system must track commits made since lane launch and display counts
- FR-4: The system must detect lane completion signals (output files, commit patterns)
- FR-5: The system must provide WebSocket connections for real-time updates
- FR-6: The system must watch worktree directories for file changes

### Semi-Autonomous Operations
- FR-7: The system must support launching all unblocked lanes with a single action
- FR-8: The system must auto-detect lane completion and update status accordingly
- FR-9: The system must auto-generate merge proposals when all lanes complete
- FR-10: The system must provide diff preview for lane changes before completion
- FR-11: The system must display a live activity feed of all lane events
- FR-12: The system must support per-lane launch mode selection (Cursor vs Terminal)

### Full Orchestration
- FR-13: The system must manage multiple Claude Code processes via an AgentOrchestrator
- FR-14: The system must spawn terminal windows using AppleScript (macOS)
- FR-15: The system must capture and parse Claude Code stdout for progress tracking
- FR-16: The system must support a structured status protocol (LANE_STATUS.json)
- FR-17: The system must auto-retry failed lanes with exponential backoff (max 3 retries)
- FR-18: The system must auto-commit lane work when completion is detected
- FR-19: The system must auto-merge lanes to integration branch, stopping only for conflicts
- FR-20: The system must support optional auto-push to remote repositories
- FR-21: The system must support one-click "Start Mission" for full autonomous operation

### Quality of Life
- FR-22: The system must allow resetting lanes to clean state
- FR-23: The system must allow adding new lanes to in-progress runs
- FR-24: The system must track and display estimated API costs per lane
- FR-25: The system must support saving and loading plan templates
- FR-26: The system must maintain a complete audit log of all actions
- FR-27: The system must provide a visual timeline view of lane progress
- FR-28: The system must send browser notifications for important events
- FR-29: The system must support keyboard shortcuts for common actions

---

## Non-Goals (Out of Scope)

- Cross-platform support (Linux, Windows) - macOS only for v2.0
- Email or Slack notifications - in-app only for v2.0
- Multi-user collaboration - single user only
- Cloud deployment of orchestrator - local only
- Integration with CI/CD systems
- Mobile app or responsive mobile view
- Custom agent types beyond the predefined set
- Billing or payment integration for API costs
- Automated testing execution (only verification commands)

---

## Technical Considerations

### Architecture
- WebSocket server: Socket.io integrated with Next.js custom server
- Process management: Node.js `child_process` with spawn/exec
- File watching: `chokidar` or native `fs.watch` with debouncing
- State persistence: Continue using JSON files (plan.json, status.json, history.jsonl)

### Dependencies to Add
- `socket.io` + `socket.io-client` - WebSocket layer
- `chokidar` - Cross-platform file watching
- `diff` or `diff2html` - Diff visualization

### Performance Considerations
- Limit file watchers to active runs only
- Debounce file change events (100ms minimum)
- Cap activity feed at 100 events
- Close WebSocket connections when leaving run page

### Security Considerations
- `--dangerously-skip-permissions` flag is inherently risky
- Ensure worktrees are in expected locations
- Validate all paths before spawning processes
- No user input directly in shell commands (use parameterized execution)

---

## Success Metrics

- **Time to completion:** Reduce average time from plan creation to merged code by 80%
- **Manual actions:** Reduce from ~20 clicks per run to 1 ("Start Mission")
- **Error recovery:** 90% of transient failures recovered via auto-retry
- **User monitoring time:** Users should be able to start mission and return later to see results

---

## Open Questions

1. Should we support running multiple orchestrated runs simultaneously?
2. What should happen if the War Room app is closed while agents are running?
3. Should we add a "dry run" mode that simulates the full flow without actually running agents?
4. How do we handle rate limits from Anthropic when running multiple agents in parallel?
5. Should lane completion detection be configurable per-run or globally?

---

## Implementation Priority

**Recommended order:**

1. **US-101, US-102, US-103** - Basic polling and status detection (foundation)
2. **US-105, US-106** - WebSocket layer (enables real-time features)
3. **US-104** - Smart suggestions (improves UX immediately)
4. **US-201** - Launch all (biggest UX win)
5. **US-206** - Terminal mode selector (prerequisite for orchestrator)
6. **US-301, US-302, US-303** - Orchestrator core (enables automation)
7. **US-304, US-305, US-306** - Status protocol and auto-commit (complete automation loop)
8. **US-307, US-309** - Auto-merge and Start Mission (full autonomy)
9. **Phase 4 features** - QoL improvements based on user feedback
