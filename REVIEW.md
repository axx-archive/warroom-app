# Worktree Cleanup Feature - Staff Engineer Review

**Lane:** lane-1 (staff-engineer-reviewer)
**Date:** 2026-02-04
**Reviewer:** Staff Engineer (AI Agent)

---

## Executive Summary

This review analyzes the proposed worktree cleanup feature design before implementation begins. The design is **generally sound** with appropriate safety guardrails, but I've identified several edge cases and security considerations that should be addressed.

**Overall Assessment:** ✅ Proceed with implementation, with the issues below documented as warnings.

---

## Review Checklist Results

### 1. Path Injection Risks in worktreePath Handling

**Status:** ⚠️ MEDIUM RISK - Requires attention

**Current Pattern (from `delete/route.ts`):**
```typescript
await execAsync(`git worktree remove "${lane.worktreePath}" --force`, {
  cwd: plan.repo.path,
});
```

**Issues Identified:**

1. **Path from untrusted source:** The `worktreePath` comes from `plan.json` which is stored on disk. If an attacker can modify `plan.json`, they could inject malicious paths.

2. **Incomplete quoting:** While the path is double-quoted, this doesn't protect against all injection vectors:
   - Paths containing `$()` or backticks could lead to command substitution
   - Paths containing `"` would break the quoting
   - Example: A path like `"/tmp/foo$(rm -rf ~)bar"` would execute the inner command

3. **No path validation:** There's no check that the worktree path is actually under the expected worktree root.

**Recommendations:**

1. **Validate paths are under the run's worktree root:**
   ```typescript
   const resolvedPath = path.resolve(lane.worktreePath);
   const resolvedRoot = path.resolve(expectedWorktreeRoot);
   if (!resolvedPath.startsWith(resolvedRoot + path.sep)) {
     throw new Error(`Invalid worktree path: ${lane.worktreePath}`);
   }
   ```

2. **Use `execFile` instead of `exec` to avoid shell injection:**
   ```typescript
   import { execFile } from 'child_process';
   await execFileAsync('git', ['worktree', 'remove', lane.worktreePath], { cwd: plan.repo.path });
   ```

3. **Sanitize path inputs:** Strip or reject paths containing `$`, backticks, or other shell metacharacters.

---

### 2. Race Conditions with File-Watcher

**Status:** ⚠️ MEDIUM RISK - Design consideration needed

**Scenario:** The orchestrator uses file watchers to monitor `LANE_STATUS.json` in each worktree. If cleanup runs while a watcher is active:

1. File watcher may hold a handle to files in the worktree
2. Removal could fail with "resource busy" errors
3. Watcher may emit spurious events during removal

**Recommendations:**

1. **Stop watchers before cleanup:** Ensure the orchestrator stops file watchers for a lane before attempting cleanup.

2. **Check watcher state in eligibility:** Add `isWatched` check to eligibility criteria:
   ```typescript
   if (fileWatcherService.isWatching(lane.worktreePath)) {
     return { eligible: false, reason: 'Lane is still being monitored' };
   }
   ```

3. **Graceful degradation:** If removal fails with EBUSY, wait and retry rather than failing immediately.

---

### 3. Worktree Open in Editor

**Status:** ℹ️ LOW RISK - User experience concern

**Scenario:** If the worktree directory is open in an IDE (Cursor, VS Code, etc.):

1. Editor may hold file locks
2. User may have unsaved changes in editor buffers (not reflected in git status)
3. Editor may show errors after directory is removed

**Observations:**
- `git status --porcelain` will detect uncommitted changes on disk
- It will NOT detect unsaved editor buffers
- Editors typically handle missing directories gracefully (show error, don't crash)

**Recommendations:**

1. **Document the behavior:** Make it clear in UI that unsaved editor buffers are not detected.

2. **Optional enhancement:** Consider checking for common editor lock files:
   - `.vscode/.lock`
   - `.idea/.lock`
   - `*.swp` (vim swap files)

3. **Confirmation UX:** The "type CLEANUP" confirmation gives users a moment to remember if they have unsaved work.

---

### 4. Handling of Partially-Merged States

**Status:** ⚠️ MEDIUM RISK - Edge cases need handling

**Scenarios:**

1. **Branch merged to integration but not main:**
   - `MergeState.mergedLanes` tracks this
   - Branch should be deletable with `git branch -d` (safe, requires ancestor check)
   - ✅ Proposed design handles this correctly

2. **Squash merge:**
   - After squash merge, the original commits don't appear in the integration branch history
   - `git merge-base --is-ancestor` will return FALSE even though content is merged
   - `git branch -d` will refuse to delete

3. **Cherry-pick merge:**
   - Similar to squash - commits won't be ancestors
   - May need `git branch -D` (force delete) which is risky

**Recommendations:**

1. **For squash/cherry-pick merges:** Trust `MergeState.mergedLanes` as the source of truth rather than git ancestry checks:
   ```typescript
   // If lane is in mergedLanes, allow branch deletion even if ancestry check fails
   if (mergeState.mergedLanes.includes(laneId)) {
     // Safe to delete - orchestrator has confirmed merge
     await exec(`git branch -D ${branch}`); // Force delete
   } else {
     // Require ancestry check for safety
     await exec(`git branch -d ${branch}`); // Safe delete
   }
   ```

2. **Log the merge method used:** When logging cleanup, note whether safe or force delete was used.

3. **Make branch deletion optional:** Allow users to cleanup worktree but keep branch (for audit trail).

---

### 5. Error Recovery if Removal Fails Mid-Way

**Status:** ⚠️ MEDIUM RISK - Needs robust handling

**Failure Points:**

1. **`git worktree remove` fails:**
   - Worktree exists but is corrupt
   - Permissions issue
   - File system full

2. **Branch delete fails after worktree removed:**
   - Orphaned branch remains
   - User may be confused about state

3. **Partial success across multiple lanes:**
   - Some lanes cleaned, others failed
   - Need to track partial progress

**Current Pattern (from `delete/route.ts`):**
```typescript
try {
  await execAsync(`git worktree remove "${lane.worktreePath}" --force`);
} catch (error) {
  console.log(`Could not remove worktree for ${lane.laneId}:`, error);
  // Continues to next lane - non-fatal
}
```

**Recommendations:**

1. **Track cleanup results per-lane:**
   ```typescript
   interface CleanupResult {
     laneId: string;
     worktreeRemoved: boolean;
     branchDeleted: boolean;
     error?: string;
   }
   ```

2. **Atomic operations where possible:** Consider cleanup as a transaction:
   - If worktree removal fails, don't attempt branch deletion
   - Report partial success clearly in UI

3. **Recovery mechanism:** Provide a "force cleanup" option that:
   - Runs `git worktree prune` to clean up stale references
   - Manually removes directory with `rm -rf` as last resort
   - Uses `git branch -D` if `-d` fails

4. **Log to history.jsonl:** Add cleanup events to the audit log:
   ```typescript
   logWorktreeCleanup(runDir, laneId, {
     worktreeRemoved: true,
     branchDeleted: false,
     error: 'Branch has unmerged commits'
   });
   ```

---

## Additional Security Considerations

### A. Symlink Attacks

**Risk:** If `worktreePath` is a symlink to a sensitive directory, `git worktree remove` could delete unintended files.

**Recommendation:**
```typescript
const stats = await fs.lstat(worktreePath);
if (stats.isSymbolicLink()) {
  throw new Error('Worktree path is a symlink - refusing to remove');
}
```

### B. Time-of-Check to Time-of-Use (TOCTOU)

**Risk:** Between eligibility check and removal, state could change:
- User makes uncommitted changes
- Another process modifies the worktree

**Recommendation:** Re-check `git status --porcelain` immediately before removal, not just during eligibility check.

### C. Worktree Path Escapes Repo Boundary

**Risk:** A malformed plan could have worktree paths outside the repo or home directory.

**Recommendation:** Validate worktree paths are:
1. Under `~/Desktop/worktrees/` (or configured worktree root)
2. Not equal to or parent of critical directories (`~`, `/`, etc.)

```typescript
const dangerousPaths = [
  os.homedir(),
  '/',
  '/usr',
  '/etc',
  '/var',
  process.cwd(), // Don't delete the repo itself
];
```

---

## Proposed Guardrails Assessment

| Guardrail | Assessment |
|-----------|------------|
| **Lane marked merged in MergeState** | ✅ Good - Source of truth for merge status |
| **No uncommitted changes (git status --porcelain)** | ✅ Good - Standard check |
| **Not currently running/watched** | ⚠️ Need explicit watcher check |
| **Path validation under worktree root** | ⚠️ Not currently implemented - MUST add |
| **Branch deletion only if merged (git merge-base)** | ⚠️ Won't work for squash/cherry-pick |
| **Dry-run preview** | ✅ Good - Shows user what will happen |
| **Confirmation step (type "CLEANUP")** | ✅ Good - Prevents accidental deletion |

---

## Recommended Implementation Order

1. **First:** Implement path validation (security-critical)
2. **Second:** Add file watcher coordination
3. **Third:** Implement dry-run preview
4. **Fourth:** Implement actual cleanup with proper error handling
5. **Fifth:** Add history logging for cleanup events
6. **Last:** Add confirmation UI

---

## Questions for Product/Architecture

1. Should cleanup be reversible? (Could archive to `~/.openclaw/archive/` instead of delete)
2. What's the expected worktree root? Is it configurable or fixed to `~/Desktop/worktrees/`?
3. Should we auto-cleanup lanes after N days post-merge?
4. Should branch deletion be a separate opt-in step from worktree removal?

---

## Files to Watch During Implementation

These files will likely be modified:
- `src/lib/orchestrator/git-operations.ts` - Add cleanup functions
- `src/lib/history.ts` - Add cleanup event types
- `src/lib/plan-schema.ts` - Add cleanup state types
- New: `src/app/api/runs/[slug]/cleanup/route.ts` - Cleanup API endpoint

---

## Conclusion

The proposed worktree cleanup feature design is **viable and mostly secure**. The main areas requiring attention are:

1. **Path validation** - Critical security requirement
2. **Shell injection protection** - Use `execFile` instead of `exec`
3. **Squash/cherry-pick merge handling** - Trust MergeState over git ancestry
4. **File watcher coordination** - Stop watchers before cleanup

With these issues addressed, the implementation can proceed safely.

---

*Review completed by staff-engineer-reviewer agent*
