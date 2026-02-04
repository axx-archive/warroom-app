# WARROOM PACKET: P1 SSE/Execution Resilience

## Role
You are a **Senior Developer** implementing SSE streaming resilience for the Bullseye application.

## Mission
Implement P1 execution resilience: Scout timeout logic, client reconnection, keepalive events, overload status events, and graceful degradation.

## Context
Bullseye uses Server-Sent Events (SSE) for real-time streaming from Claude agents. Current issues:
- Scout route has "first message within 60s" timeout that breaks under provider queuing
- No keepalive/ping events during long waits
- Overload errors cause terminal stream closure instead of retry indication
- Client has no reconnection logic
- Partial transcripts lost on connection failure

## Prerequisites
**lane-2-reliability must complete first.** You will use:
- `AnthropicError` types from `src/lib/anthropic/errors.ts`
- `withRetry` wrapper from `src/lib/anthropic/retry.ts`
- Updated rate limiter from `src/lib/rate-limiter.ts`

## Deliverables

### 1. Scout Route Timeout Logic (`src/app/api/scout/route.ts`)

Current (problematic):
```typescript
// "First message within 60s or error/close"
const timeout = setTimeout(() => {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: 'Timeout' })}\n\n`));
  controller.close();
}, 60000);
```

**Replace with "no activity" timeout:**
```typescript
class ActivityTracker {
  private lastActivity: number = Date.now();
  private timeoutId: NodeJS.Timeout | null = null;

  constructor(
    private onTimeout: () => void,
    private inactivityMs: number = 60000
  ) {}

  touch(): void {
    this.lastActivity = Date.now();
    this.resetTimer();
  }

  start(): void {
    this.resetTimer();
  }

  stop(): void {
    if (this.timeoutId) clearTimeout(this.timeoutId);
  }

  private resetTimer(): void {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    this.timeoutId = setTimeout(() => {
      if (Date.now() - this.lastActivity >= this.inactivityMs) {
        this.onTimeout();
      }
    }, this.inactivityMs);
  }
}
```

### 2. Keepalive Events

**Add periodic keepalive during long operations:**
```typescript
// SSE event types (add to src/lib/agent-sdk/types.ts)
interface KeepaliveEvent {
  type: 'keepalive';
  timestamp: number;
  phase: string; // Current operation phase
}

// In scout route, emit every 15 seconds during processing
const keepaliveInterval = setInterval(() => {
  const event: KeepaliveEvent = {
    type: 'keepalive',
    timestamp: Date.now(),
    phase: currentPhase, // 'analysis', 'focus_group', etc.
  };
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
  activityTracker.touch();
}, 15000);
```

### 3. Overload Status Events

**Instead of terminal error on 529, emit retrying status:**
```typescript
interface OverloadStatusEvent {
  type: 'status';
  status: 'overloaded';
  retryAttempt: number;
  maxRetries: number;
  retryAfterMs: number;
  message: string; // "Anthropic is overloaded—retrying in 8s"
}

// When catching overload error:
if (isOverloaded(error)) {
  const statusEvent: OverloadStatusEvent = {
    type: 'status',
    status: 'overloaded',
    retryAttempt: attempt,
    maxRetries: 3,
    retryAfterMs: error.retryAfterMs || calculateBackoff(attempt),
    message: `Anthropic is overloaded—retrying in ${Math.ceil(retryAfterMs / 1000)}s`,
  };
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(statusEvent)}\n\n`));
  // Continue with retry, don't close stream
}
```

### 4. Client SSE Reconnection (`src/lib/agent-sdk/event-router.ts`)

Current: No reconnection logic.

**Add reconnection with exponential backoff:**
```typescript
interface SSEConnectionConfig {
  url: string;
  maxReconnectAttempts: number; // Default: 5
  initialReconnectDelayMs: number; // Default: 1000
  maxReconnectDelayMs: number; // Default: 30000
  onReconnecting?: (attempt: number, delayMs: number) => void;
  onReconnected?: () => void;
  onMaxRetriesExceeded?: () => void;
}

class ResilientEventSource {
  private eventSource: EventSource | null = null;
  private reconnectAttempts = 0;
  private lastEventId: string | null = null;
  private partialTranscript: string = '';

  constructor(private config: SSEConnectionConfig) {}

  connect(): void {
    const url = new URL(this.config.url);
    if (this.lastEventId) {
      url.searchParams.set('lastEventId', this.lastEventId);
    }

    this.eventSource = new EventSource(url.toString());

    this.eventSource.onopen = () => {
      this.reconnectAttempts = 0;
      this.config.onReconnected?.();
    };

    this.eventSource.onerror = () => {
      this.handleDisconnect();
    };

    this.eventSource.onmessage = (event) => {
      this.lastEventId = event.lastEventId;
      // Process event...
    };
  }

  private handleDisconnect(): void {
    this.eventSource?.close();

    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.config.onMaxRetriesExceeded?.();
      return;
    }

    const delay = Math.min(
      this.config.initialReconnectDelayMs * Math.pow(2, this.reconnectAttempts),
      this.config.maxReconnectDelayMs
    );

    this.config.onReconnecting?.(this.reconnectAttempts + 1, delay);
    this.reconnectAttempts++;

    setTimeout(() => this.connect(), delay);
  }

  getPartialTranscript(): string {
    return this.partialTranscript;
  }

  close(): void {
    this.eventSource?.close();
  }
}
```

### 5. Graceful "Paused, Retrying" State

**Update event router to emit connection state:**
```typescript
interface ConnectionStateEvent {
  type: 'connection_state';
  state: 'connected' | 'disconnected' | 'reconnecting' | 'failed';
  attempt?: number;
  maxAttempts?: number;
  retryInMs?: number;
  partialTranscriptPreserved?: boolean;
}

// Emit to UI when connection state changes
callbacks.onConnectionState?.({
  type: 'connection_state',
  state: 'reconnecting',
  attempt: 2,
  maxAttempts: 5,
  retryInMs: 4000,
  partialTranscriptPreserved: true,
});
```

### 6. Reader Chat Route (`src/app/api/reader-chat/route.ts`)

Apply same patterns:
- Activity-based timeout (not first-message timeout)
- Keepalive events every 15s
- Overload status events instead of terminal errors

## Allowed Paths
- `src/app/api/scout/route.ts`
- `src/app/api/reader-chat/route.ts`
- `src/lib/agent-sdk/event-router.ts`
- `src/lib/agent-sdk/types.ts`

## Constraints
- Do NOT touch rate limiter (lane-2's scope)
- Do NOT touch UI components (lane-4's scope)
- Maintain backward compatibility with existing SSE event consumers
- Add JSDoc comments for new event types
- Ensure keepalive interval is cleared in finally blocks

## Verification
```bash
npm run typecheck
npm run lint
```

Manual testing:
1. Start analysis, verify keepalive events every 15s
2. Simulate 529 error, verify "retrying" status (not terminal error)
3. Kill network, verify reconnection attempt
4. Verify partial transcript preserved after reconnection

## Event Protocol Updates

Add these event types to the SSE protocol:

```typescript
// Add to ScoutSSEEvent union
| { type: 'keepalive'; timestamp: number; phase: string }
| { type: 'status'; status: 'overloaded'; retryAttempt: number; maxRetries: number; retryAfterMs: number; message: string }
| { type: 'connection_state'; state: 'connected' | 'disconnected' | 'reconnecting' | 'failed'; attempt?: number; maxAttempts?: number; retryInMs?: number }
```
