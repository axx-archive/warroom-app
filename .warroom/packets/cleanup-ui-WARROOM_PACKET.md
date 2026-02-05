# WARROOM PACKET: Cleanup UI Components

## Mission Context
You are implementing the UI for a "Cleanup merged lanes" feature in War Room, a Next.js + React 19 orchestration platform. The backend API will be implemented in a parallel lane - you should build the UI components that will consume it.

## Your Deliverables
1. `src/components/cleanup/CleanupModal.tsx` - Main modal with dry-run preview
2. `src/components/cleanup/CleanupConfirmation.tsx` - Type-to-confirm component
3. Integration point in `src/app/runs/[slug]/RunDetailClient.tsx`

---

## Requirements

### 1. CleanupModal Component

A modal that shows:
1. **Header**: "Cleanup Merged Lanes"
2. **Dry-run preview table** showing:
   - Lane ID
   - Branch name
   - Worktree path (truncated)
   - Why it qualifies (merged, no uncommitted changes, not running)
   - Checkbox to include/exclude from cleanup
3. **Options section**:
   - Checkbox: "Also delete branches after worktree removal"
4. **Warnings section** (if any):
   - Display any warnings from the dry-run response
5. **Action buttons**:
   - "Cancel" - closes modal
   - "Proceed to Confirmation" - only enabled if at least one lane selected

**States:**
- Loading (fetching dry-run)
- Empty (no candidates found - show friendly message)
- Preview (showing candidates)
- Error (API error)

### 2. CleanupConfirmation Component

A confirmation step that requires typing "CLEANUP" to proceed:

```tsx
interface CleanupConfirmationProps {
  selectedLanes: CleanupCandidate[];
  deleteBranches: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isExecuting: boolean;
}
```

**UI Elements:**
1. **Summary**: "You are about to remove X worktrees and Y branches"
2. **Warning banner**: "This action cannot be undone"
3. **List of what will be removed** (collapsible if > 5 items)
4. **Input field**: "Type CLEANUP to confirm"
5. **Buttons**:
   - "Back" - return to preview
   - "Execute Cleanup" - only enabled when input === "CLEANUP", shows spinner when executing

### 3. Integration into RunDetailClient

Add a button to trigger the cleanup flow:
- Location: Near other action buttons (commit, merge, etc.)
- Label: "Cleanup Merged Lanes"
- Icon: Trash or broom icon
- Only visible when run has at least one completed/merged lane
- Opens CleanupModal when clicked

---

## Design Guidelines

Follow existing patterns in the codebase:
- Use Tailwind CSS 4 for styling
- Match the existing modal patterns (look at MergeProposalModal or DiffPreviewModal)
- Use existing UI primitives if available (Button, Modal, etc.)
- Dark mode compatible (use appropriate Tailwind classes)

**Color scheme for status:**
- Safe/success: green tones
- Warning: yellow/amber tones
- Danger: red tones
- The confirmation input should have a red border/focus state

---

## API Contract (Backend will implement)

```typescript
// GET /api/runs/[slug]/cleanup - Dry run
interface DryRunResponse {
  candidates: Array<{
    laneId: string;
    branch: string;
    worktreePath: string;
    reason: string;
    isMerged: boolean;
    hasUncommittedChanges: boolean;
    isRunning: boolean;
  }>;
  warnings: string[];
}

// POST /api/runs/[slug]/cleanup - Execute
interface ExecuteRequest {
  laneIds: string[];
  deleteBranches: boolean;
  confirmationToken: "CLEANUP";
}

interface ExecuteResponse {
  success: boolean;
  report: {
    candidates: CleanupCandidate[];
    cleaned: Array<{
      laneId: string;
      worktreeRemoved: boolean;
      branchDeleted: boolean;
      error?: string;
    }>;
    skipped: Array<{ laneId: string; reason: string }>;
  };
  error?: string;
}
```

---

## Key Files to Reference

1. `src/app/runs/[slug]/RunDetailClient.tsx` - Main run detail page, see how other actions are integrated
2. `src/components/` - Existing component patterns
3. `src/app/runs/[slug]/components/` - Run-specific components
4. Look for existing modals to match the pattern

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
  "summary": "Cleanup UI components implemented with dry-run preview and confirmation flow",
  "filesChanged": ["list of files you created/modified"]
}
```
