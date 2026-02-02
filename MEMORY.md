# MEMORY.md - Long-Term Memory

*Curated insights and habits. Read at start of main sessions.*

---

## Workflows & Habits

### Claude Code + Ralph Loops (Preferred Pattern)
- Use **Claude Code via `claude` CLI** (AJ’s Claude Max account) for Ralph-style autonomous iterations.
- Run with `claude --dangerously-skip-permissions` for unattended edits.
- Use a TTY when launching Claude Code; non-interactive auth/status commands can hang.
- Claude Code is conversational: you can literally say:
  - “Load the prd skill and create a PRD for …”
  - then “Load the ralph skill and convert tasks/prd-… .md to prd.json”
  - Ensure you reference the **exact PRD filename Claude created** under `tasks/`.

### Ralph Workstreams: Don’t Clobber `tasks/prd.json`
- Ralph uses `tasks/prd.json` as the active story list and updates `passes: false → true`.
- If a prior workstream exists, **archive it** (e.g. rename to `tasks/prd-<workstream>.json`) before starting a new PRD.

### Tailwind v4 + Turbopack Root Instability (Fix)
- If dev server starts resolving Tailwind imports relative to `~/Desktop` / `~/node_modules`, force Turbopack root:
  - Prefer `next.config.js` (CJS) with `turbopack: { root: __dirname }`.
- Also: kill stray `next dev` processes and remove `.next/dev/lock` before restarting.

### Before Saying "I Don't Remember" → Search QMD
If you're about to say you don't know something, lost context, or need AJ to repeat — **STOP and search first:**
```bash
qmd vsearch "topic" -c memories    # Search your own notes
qmd vsearch "topic" -c horizon     # Search codebase
```
Your memories are indexed. Use them before asking.

### Codebase Search → Use QMD
When AJ asks about code (especially Horizon/InsideOut), **use qmd first** instead of grep/manual file reading:
```bash
export PATH="/Users/ajhart/.bun/bin:$PATH"
qmd search "keyword" -c horizon      # fast keyword
qmd vsearch "concept question"       # semantic
qmd query "complex question"         # hybrid + reranking (best)
```
See TOOLS.md for full docs.

---

## Projects

### Horizon / InsideOut
- **Location:** `~/Desktop/InsideOut`
- **What:** Next.js venture studio OS for packaging deals
- **Core concept:** Assemble packages (idea + talent + founder + operator + investors) to raise capital
- **Key entities:** Packages, Investors, Talent, Founders, Organizations

---

## RALPH Loops - How to Run

### Canonical Ralph docs (source of truth)
- Repo: https://github.com/snarktank/ralph
- The upstream README’s **Workflow / Run Ralph** section is the canonical contract.

Key upstream expectations:
- Default `max_iterations` is **10**.
- Script lives at `./scripts/ralph/ralph.sh` (if you copied it into a project).
- Run forms:
  - Amp: `./scripts/ralph/ralph.sh [max_iterations]`
  - Claude Code: `./scripts/ralph/ralph.sh --tool claude [max_iterations]`
- Critical concepts:
  - Each iteration = fresh context; only memory is git history + `progress.txt` + `prd.json`.
  - Tasks must be right-sized.
  - AGENTS.md updates are critical; feedback loops required.

### Horizon (InsideOut) local runner notes
Our repo uses `tasks/ralph.sh` (not `scripts/ralph/ralph.sh`), and its arg parsing differs from upstream.

### Quick Start (InsideOut)
```bash
# IMPORTANT:
# - tasks/ralph.sh expects the *first positional arg* to be the iteration count.
# - The script stops after N iterations even if stories remain.
#   Set iterations >= remaining stories if you want it to run to completion.

# Example: ~25 story workstream
./tasks/ralph.sh 25 --tool claude

# Example: intentionally run a short batch
./tasks/ralph.sh 5 --tool claude
```

### What It Does (Each Iteration)
1. Picks highest priority story where `passes: false`
2. Implements that single story
3. Runs quality checks (typecheck, tests)
4. Commits if checks pass
5. Updates `prd.json` → `passes: true`
6. Appends learnings to `progress.txt`
7. Repeat until all done or max iterations

### Manual Ralph Mode (When Loops Get SIGKILL’d)
If the Ralph loop (or Claude Code) gets **SIGKILL (signal 9)**, it can commit code but fail to flip `passes:true` in `tasks/prd.json`.

Switch to **Manual Ralph** (story-by-story, checkpointed):
1. Pick the next `passes:false` story (in dependency order).
2. Implement (keep runs short; Claude Code can be used as a tool).
3. Run `npx tsc --noEmit`.
4. Commit the feature.
5. Immediately update + commit bookkeeping:
   - `tasks/prd.json` → set `passes:true`
   - `tasks/progress.txt` → append notes

This prevents rework from “committed but not marked complete” drift.

### Key Files
- `prd.json` — task list with pass/fail status
- `progress.txt` — append-only learnings (memory between iterations)
- `CLAUDE.md` or `prompt.md` — prompt template

### Debugging
```bash
# Check story status
cat prd.json | jq '.userStories[] | {id, title, passes}'

# See learnings
cat progress.txt

# Recent commits
git log --oneline -10
```

### Critical Rules
- **Small tasks only** — each story must fit in one context window
- **Fresh context each iteration** — only git, progress.txt, prd.json persist
- **AGENTS.md updates matter** — learnings help future iterations
- **Feedback loops required** — typecheck/tests must catch errors
- **Stop condition:** All stories `passes: true` → outputs `<promise>COMPLETE</promise>`

### Archiving
Ralph auto-archives when starting a new feature (different branchName) → `archive/YYYY-MM-DD-feature-name/`

### PRD → prd.json Workflow

**Step 1: Create PRD** (or use existing)
```
Load the prd skill and create a PRD for [feature description]
```
→ Saves to `tasks/prd-[feature-name].md`

**Step 2: Convert to RALPH format**
```
Load the ralph skill and convert tasks/prd-[feature-name].md to prd.json
```

**prd.json structure:**
```json
{
  "project": "ProjectName",
  "branchName": "ralph/feature-name",
  "description": "What this does",
  "userStories": [
    {
      "id": "US-001",
      "title": "Small task title",
      "description": "As a [user], I want [X] so that [Y]",
      "acceptanceCriteria": [
        "Specific verifiable thing",
        "Typecheck passes",
        "Verify in browser using dev-browser skill"
      ],
      "priority": 1,
      "passes": false,
      "notes": ""
    }
  ]
}
```

**Story sizing rules:**
- ✅ Right size: Add DB column, add UI component, update server action
- ❌ Too big: "Build entire dashboard", "Add authentication", "Refactor API"
- Rule of thumb: If you can't describe it in 2-3 sentences, split it

**Story ordering:**
1. Schema/database changes (migrations)
2. Server actions / backend logic
3. UI components that use backend
4. Dashboard/summary views

**Acceptance criteria rules:**
- Must be VERIFIABLE (not vague)
- Always include: `"Typecheck passes"`
- UI stories: `"Verify in browser using dev-browser skill"`
- Bad: "Works correctly" / Good: "Button shows confirmation dialog"

---

## Active Work

### RALPH Loop - Horizon v2 Build
**Status:** ACTIVE (7/25 stories complete, currently on 2.4)
**Location:** `~/Desktop/InsideOut/tasks/`
**Branch:** Check `git branch` in InsideOut

Progress tracking:
- `prd.json` — story status (passes: true/false)
- `progress.txt` — learnings from each iteration
- Git commits — the actual work

**Next up:** Stories 2.4-2.6 (Network page), then Package assembly (3.x), Dashboard (4.x), Scout enhancements (5.x), Polish (6.x)

**To resume:** Run `./tasks/ralph.sh` or manually pick up from prd.json

---

## Frontend Design — Claude Code Plugin Pattern

### The `frontend-design` Plugin
- **Source:** `anthropics/claude-plugins-official`
- **Purpose:** Teaches Claude Code *how to think about frontend design* — aesthetic philosophy, avoiding generic "AI slop", bold choices
- **Key principle:** Don't customize the skill. Call it with directives.

### How to Use It
The skill is a framework, not a template. Pass project-specific context alongside:
```
"Create a dashboard for a music streaming app — brutalist aesthetic, 
monospace fonts, high contrast black/white with neon accents"
```

The skill handles the "how" (typography choices, motion, spatial composition). Your directives handle the "what" (specific aesthetic, colors, vibe).

### Project Design Systems
When discussing design for any project:
1. **Check for `docs/DESIGN-SYSTEM.md`** — project-specific colors, typography, component patterns
2. **If it doesn't exist** → discuss creating one with AJ before diving into UI work
3. **Keep it named consistently:** `docs/DESIGN-SYSTEM.md` across all projects

### What Goes Where
| File | Contains |
|------|----------|
| `frontend-design` plugin | Generic design thinking framework |
| `docs/DESIGN-SYSTEM.md` | Project-specific: colors, fonts, component specs, anti-patterns |
| `CLAUDE.md` | Commands, architecture, gotchas — NOT design specs |

### Anti-pattern (Don't Do This)
❌ Forking `frontend-design` into `.claude/skills/` with project-specific content baked in
✅ Use generic plugin + separate design system doc

---

## About AJ

*(See USER.md for basics — this section is for deeper insights learned over time)*

---

*Last updated: 2026-02-01*
