# SCOUT-BOT (Zoom Meeting Notes Bot) — Brainstorm / Parking Lot

## What it is
A bot that can join Zoom meetings (as “Scout Bot”), capture the conversation, and produce structured notes:
- Summary
- Decisions
- Action items (owner + due date)
- Open questions / risks
- Key quotes + timestamps

Primary goal: reduce friction from meetings → written execution.

---

## MVP options

### Option A — Transcript-first (fastest ship)
**Flow**
1. Zoom meeting ends
2. Zoom cloud recording + transcript completes
3. Webhook fires
4. Bot fetches transcript
5. LLM generates notes + action items
6. Deliver to Slack/Notion/Email + store in DB

**Pros**
- Least engineering effort
- Most reliable (no real-time audio handling)
- Cleaner compliance story (Zoom already indicates recording/transcription)

**Cons**
- Requires transcript/cloud recording enabled
- Not “live” during the meeting


### Option B — Join meeting + capture audio (true Scout Bot)
**Flow**
1. Bot is invited (or auto-joins scheduled meetings)
2. Joins via Zoom Meeting SDK / bot participant
3. Captures audio stream (and optionally video)
4. Streaming STT (Whisper / Deepgram) → live transcript
5. Live note drafting + highlights
6. Final recap + action items posted immediately at end

**Pros**
- Works even without Zoom transcript feature
- Enables live notes, highlights, Q&A

**Cons**
- More complex + higher maintenance
- Harder compliance/consent UX
- Needs stable realtime infrastructure


### Option C — Phone bridge bot (dial-in)
Bot dials into Zoom phone number + meeting PIN and listens.

**Pros**: simplest join story.
**Cons**: lower transcription quality; still consent issues.

---

## Delivery surfaces
- Slack channel/thread: “#meeting-notes” or per-project channels
- Notion database (meeting notes)
- Google Doc per meeting
- Email recap

---

## UX ideas
- “Invite Scout Bot” from a Slack command
- Auto-post agenda template before meeting
- Live capture of decisions (e.g., message “/scout decision …”)
- Post-call: ask “Confirm action items?” and allow quick edits

---

## Data / outputs
- Transcript (raw)
- Notes (structured markdown)
- Action items (JSON): {title, owner, dueDate, confidence, sourceQuote, timestamp}
- Entities: people, companies, projects

---

## Compliance + consent checklist
- Explicit participant notice when recording/transcribing
- Respect org policies (host-only enablement)
- Secure storage + retention policy
- Redaction / PII handling

---

## Open questions
1. Zoom admin access available? (cloud recording + transcript)
2. Live notes required, or post-call is fine?
3. Where should notes land (Slack/Notion/Email)?
4. Who owns action items and how do we assign them?

---

## Next step when we un-shelve
- Decide MVP (A vs B)
- Choose delivery surface (Slack/Notion)
- PRD + spike: Zoom app auth + webhook + transcript fetch
