# warroom-app (repo)

This repository contains the War Room application under `./warroom-app/`.

- App README: `warroom-app/README.md`
- Architecture: `docs/ARCHITECTURE.md`
- Design system: `docs/DESIGN_SYSTEM.md`
- PRDs / planning: `docs/`

## Why is the repo structured this way?

We keep the product code in the `warroom-app/` directory.

Anything that looks like assistant “memory” / personal workspace logs should **never** be committed here (especially for public/open-source repos). Those live in a central private location (e.g. `~/.openclaw/workspace/memory/`).
