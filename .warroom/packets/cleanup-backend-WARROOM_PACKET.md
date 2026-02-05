# WARROOM PACKET: Cleanup Backend API

## Mission Context
You are implementing the backend for a "Cleanup merged lanes" feature in War Room, a Next.js orchestration platform for managing parallel Claude Code agent runs with git worktrees.

## Your Deliverables
1. `src/lib/orchestrator/worktree-cleanup.ts` - Core cleanup logic
2. `src/app/api/runs/[slug]/cleanup/route.ts` - API endpoint
3. Updates to `src/lib/history.ts` for cleanup event types

---

## Requirements

### 1. Core Cleanup Logic (`worktree-cleanup.ts`)

Create a module that provides:

```typescript
interface CleanupCandidate {
  laneId: string;
  branch: string;
  worktreePath: string;
  reason: string; // Why it qualifies for cleanup
  isMerged: boolean;
  hasUncommittedChanges: boolean;
  isRunning: boolean;
}

interface CleanupResult {
  laneId: string;
  worktreeRemoved: boolean;
  branchDeleted: boolean;
  error?: string;
}

interface CleanupReport {
  candidates: CleanupCandidate[];
  cleaned: CleanupResult[];
  skipped: { laneId: string; reason: string }[];
}
```

**Functions to implement:**

1. `getCleanupCandidates(runSlug: string): Promise<CleanupCandidate[]>`
   - Read plan.json and status.json for the run
   - For each lane, check:
     - Is it marked as "complete" or "merged" in status?
     - Does it have uncommitted changes? (`git status --porcelain` in worktree)
     - Is it currently running/watched? (check AgentOrchestrator state)
     - Is the branch merged into main? (`git merge-base --is-ancestor laneBranch main`)
   - Return only lanes that qualify for cleanup

2. `validateWorktreePath(worktreePath: string, runSlug: string): boolean`
   - CRITICAL SAFETY: Only allow paths under the run's worktree root
   - Expected pattern: `~/.openclaw/workspace/warroom/runs/<runSlug>/...` OR relative `.warroom/worktrees/...`
   - Reject any path traversal attempts (../)
   - Reject absolute paths outside the allowed root

3. `cleanupWorktree(worktreePath: string, branch: string, options: { deleteBranch: boolean, force: boolean }): Promise<CleanupResult>`
   - First validate the path
   - Run `git worktree remove <path>` (add --force only if necessary)
   - If deleteBranch is true and branch is merged, run `git branch -d <branch>`
   - Return detailed result

4. `executeCleanup(runSlug: string, laneIds: string[], options: { deleteBranches: boolean }): Promise<CleanupReport>`
   - Validate all lanes are valid candidates
   - Execute cleanup for each
   - Return comprehensive report

### 2. API Endpoint (`/api/runs/[slug]/cleanup/route.ts`)

**GET - Dry Run Preview**
```typescript
// GET /api/runs/[slug]/cleanup
// Returns candidates for cleanup without executing anything

Response: {
  candidates: CleanupCandidate[];
  warnings: string[]; // Any issues found
}
```

**POST - Execute Cleanup**
```typescript
// POST /api/runs/[slug]/cleanup
// Body: {
//   laneIds: string[], // Which lanes to clean (must be subset of candidates)
//   deleteBranches: boolean, // Also delete the branches
//   confirmationToken: string // Must be "CLEANUP" - safety check
// }

Response: {
  success: boolean;
  report: CleanupReport;
  error?: string;
}
```

### 3. History Events

Add to `src/lib/history.ts`:

```typescript
// New event types
type HistoryEventType =
  | ... existing types ...
  | 'cleanup_started'    // User initiated cleanup
  | 'cleanup_complete'   // All cleanup finished
  | 'worktree_removed'   // Individual worktree removed
  | 'branch_deleted'     // Branch deleted after cleanup

// Helper functions
export function logCleanupStarted(runDir: string, laneIds: string[]): Promise<void>
export function logWorktreeRemoved(runDir: string, laneId: string, worktreePath: string): Promise<void>
export function logBranchDeleted(runDir: string, laneId: string, branch: string): Promise<void>
export function logCleanupComplete(runDir: string, report: CleanupReport): Promise<void>
```

---

## Key Files to Reference

Read these files to understand the existing patterns:

1. `src/lib/orchestrator/git-operations.ts` - Existing git operations (commit, merge, push)
2. `src/lib/history.ts` - How history events are structured and logged
3. `src/app/api/runs/[slug]/launch/route.ts` - Example API route pattern
4. `src/lib/schemas/plan-schema.ts` - Plan.json structure
5. `src/lib/schemas/status-schema.ts` - Status.json structure
6. `src/lib/orchestrator/agent-orchestrator.ts` - Check running state

---

## Safety Requirements (CRITICAL)

1. **Path validation is mandatory** - Never remove a worktree outside the run's root
2. **No force by default** - Only use `--force` if the normal remove fails due to untracked files AND user explicitly requests it
3. **Check running state** - Never clean up a worktree that has an active process
4. **Confirmation token required** - POST must include `confirmationToken: "CLEANUP"`
5. **Log everything** - Every removal must be logged to history.jsonl

---

## Verification Commands
```bash
npm run typecheck
npm run lint
```

## When Complete
Update your LANE_STATUS.json with:
```json
{
  "status": "complete",
  "summary": "Backend cleanup API implemented with safety guardrails",
  "filesChanged": ["list of files you created/modified"]
}
```
