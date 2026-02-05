---
name: warroom-merge
description: Execute War Room merge - merge all lanes to integration branch, then to main, then push to GitHub.
---

# warroom-merge (Skill)

**Purpose:** Execute the merge phase of a War Room run autonomously.

This skill reads the run's merge proposal and executes:
1. Merge each lane into the integration branch (in dependency order)
2. Merge integration branch into main
3. Push all branches to GitHub

---

## Context Required

This skill expects to be run from a War Room run directory that contains:
- `plan.json` - the run configuration
- `merge-proposal.json` - the generated merge proposal (optional, will be generated if missing)
- `status.json` - current run status

The skill will look for these files in `~/.openclaw/workspace/warroom/runs/<slug>/`

---

## Execution Steps

### 1. Read Run Context
```bash
# Find the run directory from current worktree or environment
RUN_SLUG=$(cat .warroom-run-slug 2>/dev/null || echo "")
```

### 2. Verify All Lanes Complete
Before merging, verify all lanes have status "complete" in status.json.

### 3. Execute Merges
For each lane in merge order:
```bash
git checkout <integration-branch>
git merge --no-ff <lane-branch> -m "Merge <lane-id> into integration"
```

### 4. Merge to Main
```bash
git checkout main
git merge --no-ff <integration-branch> -m "Merge <integration-branch>: <goal summary>"
```

### 5. Push to GitHub
```bash
git push origin <integration-branch>
git push origin main
```

### 6. Update Status
Write completion status to status.json and history.jsonl.

---

## Conflict Handling

If a merge conflict occurs:
1. Stop the merge process
2. Report the conflicting files
3. Ask the user to resolve:
   - A) Open editor to resolve manually
   - B) Abort and try different merge order
   - C) Skip this lane
   - D) Abort entire merge

---

## Example Invocation

```bash
# From any directory with .warroom-run-slug file
claude -p '/warroom-merge'

# Or with explicit slug
claude -p '/warroom-merge worktree-cleanup'
```

---

## Output

On success, report:
- Lanes merged: [list]
- Integration branch: <branch>
- Main branch updated: yes/no
- Pushed to GitHub: yes/no
- Run complete!

On failure, report:
- Error type
- Suggested resolution
- Current state (which lanes merged, which pending)
