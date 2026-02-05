# warroom-merge (Skill)

**Purpose:** Execute the merge phase of a War Room run autonomously.

This skill reads the run's plan and executes:
1. Merge each complete lane into the integration branch (in dependency order)
2. Merge integration branch into main
3. Push all branches to GitHub
4. Update status files

---

## Inputs

The skill expects either:
- **Run slug** provided in the prompt (e.g., `/warroom-merge my-run-slug`)
- **Context from current directory** - looks for `.warroom-run-slug` file or `plan.json`

Run data is stored at: `~/.openclaw/workspace/warroom/runs/<slug>/`

Required files:
- `plan.json` - the run configuration
- `status.json` - current run status with lane completion info

---

## Execution Steps

### 1. Locate Run Context

```bash
# Option A: Slug provided in prompt
RUN_DIR="$HOME/.openclaw/workspace/warroom/runs/<slug>"

# Option B: Find from current directory
RUN_SLUG=$(cat .warroom-run-slug 2>/dev/null)
```

### 2. Read Plan and Status

```bash
# Read the plan
cat "$RUN_DIR/plan.json"

# Read current status
cat "$RUN_DIR/status.json"
```

Extract:
- `integrationBranch` from plan
- `repo.path` from plan
- `lanes` array from plan
- Lane completion status from `status.json`

### 3. Verify All Lanes Complete

Before merging, verify all lanes have status "complete" in status.json.

If any lane is not complete:
- Report which lanes are incomplete
- Ask user: A) Wait for completion, B) Merge only complete lanes, C) Abort

### 4. Execute Merges (in dependency order)

For each complete lane, in the order specified by `merge.proposedOrder`:

```bash
cd <repo-path>
git checkout <integration-branch>
git merge --no-ff <lane-branch> -m "Merge <lane-id>: <agent> implementation"
```

If a merge conflict occurs:
- Stop immediately
- Report the conflicting files
- Ask user to resolve manually
- Provide command to continue after resolution

### 5. Merge to Main

```bash
git checkout main
git merge --no-ff <integration-branch> -m "Merge <integration-branch>: <goal summary>"
```

### 6. Push to GitHub

```bash
# Push integration branch
git push origin <integration-branch>

# Push main
git push origin main
```

### 7. Update Status

Update `status.json`:
```json
{
  "status": "complete",
  "mergeState": {
    "status": "complete",
    "mergedLanes": ["lane-1", "lane-2", ...],
    "updatedAt": "<ISO-8601>"
  }
}
```

Append to `history.jsonl`:
```json
{"type": "merge_complete", "timestamp": "<ISO-8601>", "message": "All lanes merged to main"}
```

---

## Conflict Handling

If a merge conflict occurs:

1. Stop the merge process
2. Report the conflicting files:
   ```
   CONFLICT: Merge conflict in <lane-id>
   Files with conflicts:
   - src/file1.ts
   - src/file2.ts
   ```
3. Ask the user:
   - A) I'll resolve manually - wait for me to run `git add . && git commit`
   - B) Abort this merge and skip this lane
   - C) Abort entire merge operation

4. If user resolves and continues, proceed with remaining lanes

---

## Output

On success, report:
```
War Room Merge Complete!

Lanes merged: lane-1 (developer), lane-2 (qa-tester), lane-3 (doc-updater)
Integration branch: warroom/integration/my-feature
Main branch updated: Yes
Pushed to GitHub: Yes

Run complete! The changes are now on main and pushed to origin.
```

On failure, report:
```
War Room Merge Failed

Error: <description>
Current state:
- Merged: lane-1
- Pending: lane-2, lane-3
- Conflict in: lane-2

To retry: /warroom-merge <slug>
To abort: git merge --abort
```

---

## Example Invocations

### Direct invocation with slug
```
/warroom-merge worktree-cleanup
```

### Invocation from prompt
```
/warroom-merge - Repository: /Users/ajhart/Desktop/warroom-app, Integration branch: warroom/integration/worktree-cleanup. Execute merge autonomously.
```

### From run directory (with .warroom-run-slug file)
```
/warroom-merge
```
