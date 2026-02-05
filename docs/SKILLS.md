# Required Skills

This app works with Claude Code and requires the `warroom-plan` skill to be installed for full functionality.

## Installation

Copy the skill file to your Claude Code global skills folder:

```bash
mkdir -p ~/.claude/skills/warroom-plan
cp docs/warroom-plan-skill.md ~/.claude/skills/warroom-plan/SKILL.md
```

Then restart Claude Code for the skill to be loaded.

## What the Skill Does

The `warroom-plan` skill generates execution plans that the War Room app can import. These plans include:

- Agent lanes with dependencies
- Git worktrees and branches per lane
- Run packets (WARROOM_PACKET.md) for each agent
- Verification commands and merge strategies

## Usage

Once installed, you can invoke the skill in Claude Code:

```
/warroom-plan
```

Or reference it in prompts to PM or other agents that need to generate execution plans.
