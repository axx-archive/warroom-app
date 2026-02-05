# WARROOM PACKET: Integration & Testing

## Mission Context
You are integrating the worktree cleanup feature after the backend API and UI components have been implemented in parallel lanes. Your job is to wire everything together, add WebSocket events, and verify the feature works end-to-end.

## Prerequisites
This lane depends on:
- `cleanup-backend` - API and git operations
- `cleanup-ui` - Modal and confirmation components

Review their changes before starting integration.

## Your Deliverables
1. Wire the UI to the backend API
2. Add WebSocket events for real-time cleanup progress
3. Ensure history logging works correctly
4. Update any types that need to be shared
5. Manual end-to-end testing verification

---

## Integration Tasks

### 1. Connect UI to API

In the CleanupModal:
- Wire the dry-run fetch to `GET /api/runs/[slug]/cleanup`
- Wire the execute action to `POST /api/runs/[slug]/cleanup`
- Handle loading, error, and success states
- After successful cleanup, refresh the run status

### 2. WebSocket Events for Cleanup Progress

Add to `src/lib/websocket/` (follow existing patterns):

```typescript
// Events to emit during cleanup
interface CleanupProgressEvent {
  type: 'cleanup-progress';
  data: {
    phase: 'started' | 'removing-worktree' | 'deleting-branch' | 'complete';
    laneId?: string;
    total: number;
    completed: number;
    error?: string;
  };
}
```

Emit events from the cleanup API route:
1. When cleanup starts (total count)
2. After each worktree is removed
3. After each branch is deleted
4. When cleanup completes (with summary)

### 3. History Logging Verification

Ensure these events are properly logged to history.jsonl:
- `cleanup_started` - When user initiates cleanup
- `worktree_removed` - For each worktree removed
- `branch_deleted` - For each branch deleted
- `cleanup_complete` - Final summary

The history tab should show these events with appropriate formatting.

### 4. Status Refresh After Cleanup

After cleanup completes:
- Refresh status.json (removed lanes should be reflected)
- Update the UI to reflect removed worktrees
- Consider: Should cleaned-up lanes be removed from status.json or marked with a new state?

### 5. Error Handling

Ensure graceful handling of:
- Partial failures (some worktrees cleaned, others failed)
- Network errors during API call
- Concurrent access (another process modifying worktrees)
- Permission errors

---

## Testing Checklist

Manually verify these scenarios:

### Happy Path
- [ ] Click "Cleanup Merged Lanes" button
- [ ] Dry-run shows correct candidates
- [ ] Can select/deselect individual lanes
- [ ] Confirmation input validation works
- [ ] Cleanup executes successfully
- [ ] History shows cleanup events
- [ ] UI reflects cleaned state

### Edge Cases
- [ ] No candidates available (friendly empty state)
- [ ] Lane with uncommitted changes is NOT shown as candidate
- [ ] Running lane is NOT shown as candidate
- [ ] Partial cleanup (some lanes fail)
- [ ] Cancel at confirmation step
- [ ] API error handling

### Safety
- [ ] Cannot cleanup without typing "CLEANUP"
- [ ] Branches only deleted if merged
- [ ] Only worktrees under run root are removable
- [ ] History logs all actions

---

## Key Files

Review these from the other lanes:
- `src/lib/orchestrator/worktree-cleanup.ts` (from cleanup-backend)
- `src/app/api/runs/[slug]/cleanup/route.ts` (from cleanup-backend)
- `src/components/cleanup/CleanupModal.tsx` (from cleanup-ui)
- `src/components/cleanup/CleanupConfirmation.tsx` (from cleanup-ui)

Existing patterns to follow:
- `src/lib/websocket/` - WebSocket event patterns
- `src/app/runs/[slug]/RunDetailClient.tsx` - How other features are wired up

---

## Verification Commands
```bash
npm run typecheck
npm run lint
npm run build
```

## When Complete
Update your LANE_STATUS.json with:
```json
{
  "status": "complete",
  "summary": "Cleanup feature fully integrated with WebSocket events and history logging",
  "filesChanged": ["list of files you created/modified"],
  "testingNotes": "Manual testing completed - see checklist above"
}
```
