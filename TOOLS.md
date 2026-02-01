# TOOLS.md - Local Notes

Skills define *how* tools work. This file is for *your* specifics — the stuff that's unique to your setup.

## QMD (Local Codebase Search)

Hybrid search engine for markdown/code. Combines BM25 + vector search + LLM reranking.

**Setup:**
```bash
export PATH="/Users/ajhart/.bun/bin:$PATH"
```

**Collections:**
- `horizon` — Horizon/InsideOut codebase (Next.js venture studio OS)
  - Path: `~/Desktop/InsideOut`
  - Pattern: `**/*.{ts,tsx,md,json,mjs}`
- `memories` — My workspace (identity, user info, daily logs, tools)
  - Path: `~/.openclaw/workspace`
  - Pattern: `**/*.md`

**Usage:**
```bash
# Fast keyword search
qmd search "authentication" -c horizon

# Semantic search (finds conceptually similar)
qmd vsearch "how does user login work"

# Hybrid search with reranking (best quality, slower)
qmd query "packaging deals with investors"

# Get a specific file
qmd get "horizon/src/app/api/auth/route.ts"

# Get file by docid from search results
qmd get "#abc123"
```

**Maintenance:**
```bash
qmd status              # Check index health
qmd update              # Re-index after code changes
qmd embed               # Regenerate embeddings after update
```

**Adding new collections:**
```bash
qmd collection add ~/path/to/repo --name myrepo --mask "**/*.{ts,tsx,md}"
qmd context add qmd://myrepo "Description of what this codebase does"
qmd embed
```

---

## Claude Code

**Always use `--dangerously-skip-permissions`** when running Claude Code for approved tasks. If the plan/PRD is vetted, no need for per-edit confirmations. Prevents sessions getting killed waiting for approval.

```bash
claude --dangerously-skip-permissions "task here"
```

## What Goes Here

Things like:
- Camera names and locations
- SSH hosts and aliases  
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## Examples

```markdown
### Cameras
- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH
- home-server → 192.168.1.100, user: admin

### TTS
- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

Add whatever helps you do your job. This is your cheat sheet.
