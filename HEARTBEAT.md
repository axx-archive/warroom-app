# HEARTBEAT.md

## CHECKPOINT LOOP (every 30 min or on trigger)

1. **Context getting full?** → flush summary to `memory/YYYY-MM-DD.md`
2. **Learned something permanent?** → write to `MEMORY.md`
3. **New capability or workflow?** → save to `skills/`
4. **Before restart?** → dump anything important

## TRIGGERS (don't just wait for timer)

- After major learning → write immediately
- After completing task → checkpoint
- Context getting full → forced flush
