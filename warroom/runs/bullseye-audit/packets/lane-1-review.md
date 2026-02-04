# WARROOM PACKET: Staff Engineer Review

## Role
You are a **Staff Engineer Reviewer** performing a critical review of an audit implementation plan before development begins.

## Mission
Review the Bullseye reliability audit plan and identify edge cases, gaps, risks, and potential issues before implementation lanes begin work.

## Context
Bullseye is an agentic screenplay analysis platform (Next.js 16) that orchestrates Claude AI agents. The current failure mode is transient-provider fragility:
- Anthropic 529/429 overload errors surface as misleading "Claude Code process exited with code 1"
- Rate limiter has race conditions and doesn't gate output tokens
- No proper retry/backoff infrastructure
- SSE timeouts break under provider queuing
- Poor UX for error states and partial results

## Scope of Review

### 1. Rate Limiter Redesign
Current issues:
- Non-atomic capacity check vs reservation → concurrent oversubscription
- Output tokens not gated at all
- report() can update wrong "latest" entry under concurrency
- Wait loop runs ~30 minutes then proceeds anyway (guaranteed bursts)
- Singleton limiter isn't per API key/user

Proposed fix:
- Make acquire() atomic (mutex/queue), return reservationId
- Update with report(reservationId, actualIn, actualOut)
- Gate output tokens (reserve conservatively; refund later)
- Deadline-based maxWaitMs; never proceed after timeout
- Scope limiter per apiKeyHash

**Review questions:**
- Are there edge cases in the atomic acquire pattern?
- How should the "refund" mechanism work for over-reserved output tokens?
- What happens if report() is never called (client crash)?
- Is per-apiKeyHash sufficient, or do we need per-user?

### 2. Retry/Backoff Infrastructure
Proposed: Create src/lib/anthropic/retry.ts + errors.ts with:
- Classify retryable: 529, 429, 5xx, network timeouts/resets
- Respect Retry-After header
- Exponential backoff + jitter; cap retries + max elapsed time
- Structured error: { provider, status, code, requestId?, retryable, retryAfterMs? }

**Review questions:**
- What's the right max retry count and max elapsed time?
- Should we have different retry policies for different operations (quick query vs long analysis)?
- How do we handle partial streaming responses that fail mid-stream?
- Should errors be persisted for debugging/analytics?

### 3. Fallback Models
Proposed: Implement Opus → Sonnet → Haiku chain under overload.

**Review questions:**
- What triggers a fallback? Just 529, or also timeouts?
- Do we need to adjust prompts for smaller models?
- Should fallback be automatic or user-confirmed?
- How do we track/report when fallback was used?

### 4. SSE Timeout Changes
Current: "First message within 60s or error/close"
Proposed: "No activity" timeout + keepalive/ping + overload status events

**Review questions:**
- What's the right keepalive interval?
- How does this interact with the Agent SDK's internal timeout?
- What state needs to be preserved for reconnection?
- Can we resume a partial analysis, or must we restart?

### 5. Merge Conflict Risk
Lane file assignments:
- lane-2 (reliability): src/lib/rate-limiter.ts, src/lib/anthropic/**, src/lib/agents/index.ts
- lane-3 (SSE): src/app/api/scout/route.ts, src/lib/agent-sdk/**
- lane-4 (UX): src/components/**, src/stores/**

**Review questions:**
- Is src/lib/agents/index.ts safe to touch in lane-2 only?
- Should we split agents/index.ts before lane work begins?
- Any shared types that could cause conflicts?

## Deliverables
1. **Review document** with findings organized by area
2. **Risk assessment** for each proposed change
3. **Recommendations** for implementers
4. **Blockers** (if any) that must be resolved before implementation

## Constraints
- This is a review lane - do NOT write implementation code
- Focus on architecture, edge cases, and risks
- Document assumptions that need validation
- Flag anything that could cause production incidents

## Verification
- [ ] Review document produced
- [ ] All 5 areas covered
- [ ] Risks identified with mitigation suggestions
- [ ] Recommendations are actionable
