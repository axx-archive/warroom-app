# WARROOM PACKET: P0 Reliability Core

## Role
You are a **Senior Developer** implementing critical reliability infrastructure for the Bullseye application.

## Mission
Implement P0 reliability fixes: rate limiter rewrite, retry/backoff infrastructure, structured errors, fallback models, and concurrency control.

## Context
Bullseye is an agentic screenplay analysis platform (Next.js 16, TypeScript) that orchestrates Claude AI agents. Current failure modes:
- Rate limiter has race conditions (non-atomic acquire)
- No retry/backoff for 529/429/5xx errors
- No Retry-After header support
- MODELS all map to same Opus model (no real fallback)
- Promise.all causes bursty parallel requests with no concurrency cap

## Deliverables

### 1. Rate Limiter Rewrite (`src/lib/rate-limiter.ts`)

Current state (139 lines):
- Sliding window: 50 req/min, 30K input tokens/min, 8K output tokens/min
- Non-atomic acquire() with race conditions
- No output token gating
- Wait loop can run 30+ minutes then proceed anyway

**Implement:**
```typescript
interface Reservation {
  id: string;
  inputTokens: number;
  outputTokensReserved: number; // Conservative estimate
  acquiredAt: number;
}

class RateLimiter {
  // Atomic acquire with mutex
  async acquire(options: {
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
    maxWaitMs?: number; // Default 30000, never proceed after timeout
    apiKeyHash?: string; // Scope per key
    onQueued?: () => void;
    onProcessing?: () => void;
  }): Promise<Reservation | { error: 'timeout' | 'rate_limited' }>;

  // Report actual usage, refund over-reserved tokens
  report(reservationId: string, actualInput: number, actualOutput: number): void;

  // Cancel reservation (client crash cleanup)
  cancel(reservationId: string): void;
}
```

**Key changes:**
- Use mutex/queue for atomic capacity check + reservation
- Gate output tokens (reserve 1.5x estimate, refund on report)
- Deadline-based maxWaitMs - return error, NEVER proceed after timeout
- Scope per apiKeyHash (at least in-process)
- Add cleanup for orphaned reservations (>5 min without report)

### 2. Retry Infrastructure (`src/lib/anthropic/retry.ts`)

**Create new file:**
```typescript
export interface RetryConfig {
  maxRetries: number;        // Default: 3
  maxElapsedMs: number;      // Default: 60000
  initialDelayMs: number;    // Default: 1000
  maxDelayMs: number;        // Default: 30000
  jitterFactor: number;      // Default: 0.2
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  config?: Partial<RetryConfig>,
  options?: {
    onRetry?: (attempt: number, error: AnthropicError, delayMs: number) => void;
    shouldRetry?: (error: AnthropicError) => boolean;
  }
): Promise<T>;

// Classify errors
export function isRetryable(error: unknown): boolean;
// 529, 429, 5xx, ECONNRESET, ETIMEDOUT, ENOTFOUND
```

### 3. Structured Errors (`src/lib/anthropic/errors.ts`)

**Create new file:**
```typescript
export interface AnthropicError {
  provider: 'anthropic';
  status: number;
  code: string; // 'overloaded', 'rate_limited', 'auth_error', 'server_error', 'network_error', 'timeout'
  message: string;
  requestId?: string;
  retryable: boolean;
  retryAfterMs?: number; // From Retry-After header
  raw?: unknown;
}

export function parseAnthropicError(error: unknown): AnthropicError;
export function isOverloaded(error: AnthropicError): boolean;
export function isAuthError(error: AnthropicError): boolean;
export function isRateLimited(error: AnthropicError): boolean;
```

### 4. Fallback Models (`src/lib/agents/index.ts`)

Current state:
```typescript
const MODELS = {
  sonnet: 'claude-opus-4-5-20251101',
  haiku: 'claude-opus-4-5-20251101',
  opus: 'claude-opus-4-5-20251101',
};
```

**Fix to real model IDs:**
```typescript
const MODELS = {
  opus: 'claude-opus-4-5-20251101',
  sonnet: 'claude-sonnet-4-20250514',
  haiku: 'claude-haiku-3-5-20241022',
};

const FALLBACK_CHAIN = ['opus', 'sonnet', 'haiku'] as const;

// Default reader model (faster, less scarce)
const READER_MODEL = 'sonnet';

// Implement fallback on overload/timeout
async function callWithFallback<T>(
  fn: (model: string) => Promise<T>,
  preferredModel: string = 'opus'
): Promise<{ result: T; modelUsed: string; fellBack: boolean }>;
```

### 5. Concurrency Control (`src/lib/agents/index.ts`)

Current `runParallelReaderAnalysis()` uses `Promise.all` with no cap.

**Replace with p-limit:**
```typescript
import pLimit from 'p-limit';

const READER_CONCURRENCY = 2;

export async function runParallelReaderAnalysis(
  scriptContent: string,
  context: AnalysisContext
): Promise<{
  results: Map<string, ReaderAnalysis | null>;
  errors: Map<string, AnthropicError>;
  partialSuccess: boolean;
}> {
  const limit = pLimit(READER_CONCURRENCY);
  const readers = ['maya', 'colton', 'devon'];

  const results = await Promise.allSettled(
    readers.map(reader =>
      limit(() => runReaderAnalysis(reader, scriptContent, context))
    )
  );

  // Return partial results even if some failed
  // ...
}
```

## Allowed Paths
- `src/lib/rate-limiter.ts`
- `src/lib/anthropic/**` (create new directory)
- `src/lib/agents/index.ts`
- `src/lib/agents/types.ts`

## Constraints
- Do NOT touch SSE routes (lane-3's scope)
- Do NOT touch UI components (lane-4's scope)
- Maintain backward compatibility for existing callers
- Add JSDoc comments for new public APIs
- Use strict TypeScript (no `any`)

## Verification
```bash
npm run typecheck
npm run lint
npm run test -- --grep "rate-limiter"
npm run test -- --grep "retry"
```

## Dependencies
- Install p-limit: `npm install p-limit`
- lane-1-review must complete first (check for review findings)

## Testing Notes
Write unit tests for:
- Rate limiter atomic acquire under concurrent calls
- Rate limiter timeout behavior (should error, not proceed)
- Retry wrapper exponential backoff timing
- Error classification for all error types
- Fallback chain behavior on 529
- Partial success in parallel reader analysis
