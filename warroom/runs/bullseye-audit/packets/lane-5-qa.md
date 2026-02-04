# WARROOM PACKET: QA Verification

## Role
You are a **QA Tester** performing end-to-end verification of the Bullseye reliability, SSE, and UX improvements.

## Mission
Verify all audit fixes work correctly: error handling, retry behavior, partial results, SSE resilience, and UX improvements. Ensure no regressions in existing functionality.

## Context
This lane runs AFTER lanes 2, 3, and 4 complete. You are verifying:
- **lane-2**: Rate limiter, retry/backoff, structured errors, fallback models, concurrency control
- **lane-3**: SSE timeouts, keepalive, reconnection, overload status events
- **lane-4**: Run timeline UI, error classification, partial results, upload flow

## Prerequisites
All implementation lanes must be complete:
- lane-2-reliability ✓
- lane-3-sse ✓
- lane-4-ux ✓

## Test Plan

### 1. Rate Limiter Tests

**1.1 Atomic Acquire Under Concurrency**
```typescript
// Test: 10 concurrent acquire() calls should not oversubscribe
test('rate limiter handles concurrent requests atomically', async () => {
  const limiter = new RateLimiter({ maxRequestsPerMinute: 5 });
  const results = await Promise.all(
    Array(10).fill(null).map(() =>
      limiter.acquire({ estimatedInputTokens: 1000, estimatedOutputTokens: 500 })
    )
  );

  const acquired = results.filter(r => 'id' in r);
  const rejected = results.filter(r => 'error' in r);

  expect(acquired.length).toBeLessThanOrEqual(5);
  expect(rejected.length).toBeGreaterThanOrEqual(5);
});
```

**1.2 Timeout Behavior**
```typescript
// Test: maxWaitMs should return error, NOT proceed
test('rate limiter returns error on timeout, never proceeds', async () => {
  const limiter = new RateLimiter({ maxRequestsPerMinute: 1 });
  await limiter.acquire({ estimatedInputTokens: 1000 }); // Exhaust capacity

  const result = await limiter.acquire({
    estimatedInputTokens: 1000,
    maxWaitMs: 100, // Very short timeout
  });

  expect(result).toEqual({ error: 'timeout' });
});
```

**1.3 Output Token Gating**
```typescript
// Test: Output tokens should be reserved and refunded
test('rate limiter gates output tokens', async () => {
  const limiter = new RateLimiter({ maxOutputTokensPerMinute: 1000 });

  // Reserve 1500 estimated (1.5x of 1000)
  const reservation = await limiter.acquire({
    estimatedInputTokens: 100,
    estimatedOutputTokens: 1000,
  });

  // Should be at capacity
  const second = await limiter.acquire({
    estimatedInputTokens: 100,
    estimatedOutputTokens: 100,
    maxWaitMs: 0,
  });
  expect(second).toEqual({ error: 'rate_limited' });

  // Report actual (lower than reserved)
  limiter.report(reservation.id, 100, 500);

  // Now should have capacity again
  const third = await limiter.acquire({
    estimatedInputTokens: 100,
    estimatedOutputTokens: 400,
    maxWaitMs: 0,
  });
  expect('id' in third).toBe(true);
});
```

### 2. Retry/Backoff Tests

**2.1 Retryable Error Classification**
```typescript
test('classifies retryable errors correctly', () => {
  expect(isRetryable({ status: 529 })).toBe(true);  // Overloaded
  expect(isRetryable({ status: 429 })).toBe(true);  // Rate limited
  expect(isRetryable({ status: 500 })).toBe(true);  // Server error
  expect(isRetryable({ status: 503 })).toBe(true);  // Unavailable
  expect(isRetryable({ code: 'ECONNRESET' })).toBe(true);
  expect(isRetryable({ code: 'ETIMEDOUT' })).toBe(true);

  expect(isRetryable({ status: 400 })).toBe(false); // Bad request
  expect(isRetryable({ status: 401 })).toBe(false); // Auth error
  expect(isRetryable({ status: 404 })).toBe(false); // Not found
});
```

**2.2 Retry-After Honoring**
```typescript
test('respects Retry-After header', async () => {
  const delays: number[] = [];
  let attempts = 0;

  await withRetry(
    async () => {
      attempts++;
      if (attempts < 3) {
        const error = new Error('Overloaded');
        (error as any).status = 529;
        (error as any).headers = { 'retry-after': '2' }; // 2 seconds
        throw error;
      }
      return 'success';
    },
    { maxRetries: 5 },
    { onRetry: (_, __, delayMs) => delays.push(delayMs) }
  );

  // Should have waited ~2000ms each time (from Retry-After)
  expect(delays[0]).toBeGreaterThanOrEqual(1800);
  expect(delays[0]).toBeLessThanOrEqual(2500); // With jitter
});
```

**2.3 Exponential Backoff**
```typescript
test('uses exponential backoff', async () => {
  const delays: number[] = [];

  try {
    await withRetry(
      async () => { throw { status: 529 }; },
      { maxRetries: 4, initialDelayMs: 1000 },
      { onRetry: (_, __, delayMs) => delays.push(delayMs) }
    );
  } catch {}

  // Delays should roughly double: 1000, 2000, 4000, 8000 (with jitter)
  expect(delays[1]).toBeGreaterThan(delays[0] * 1.5);
  expect(delays[2]).toBeGreaterThan(delays[1] * 1.5);
});
```

### 3. Fallback Model Tests

**3.1 Fallback on Overload**
```typescript
test('falls back to smaller model on overload', async () => {
  let modelUsed: string = '';

  // Mock that opus returns 529
  const result = await callWithFallback(
    async (model) => {
      modelUsed = model;
      if (model === 'opus') throw { status: 529 };
      return 'success';
    },
    'opus'
  );

  expect(result.modelUsed).toBe('sonnet');
  expect(result.fellBack).toBe(true);
});
```

### 4. SSE Resilience Tests

**4.1 Keepalive Events**
```typescript
test('scout emits keepalive events', async () => {
  const events: any[] = [];

  // Connect to scout SSE
  const response = await fetch('/api/scout', { method: 'POST', body: mockScript });
  const reader = response.body.getReader();

  // Collect events for 20 seconds
  const timeout = setTimeout(() => reader.cancel(), 20000);
  // ... parse events ...

  const keepalives = events.filter(e => e.type === 'keepalive');
  expect(keepalives.length).toBeGreaterThanOrEqual(1); // At least one in 20s
});
```

**4.2 Overload Status Events**
```typescript
test('emits overload status instead of terminal error', async () => {
  // Mock Anthropic to return 529
  mockAnthropicOverload();

  const events = await collectSSEEvents('/api/scout', mockScript);

  const statusEvents = events.filter(e => e.type === 'status' && e.status === 'overloaded');
  expect(statusEvents.length).toBeGreaterThan(0);

  // Should NOT have terminal error event (stream continues)
  const errorEvents = events.filter(e => e.type === 'error');
  expect(errorEvents.length).toBe(0);
});
```

**4.3 Client Reconnection**
```typescript
test('client reconnects on connection loss', async () => {
  const stateChanges: string[] = [];

  const client = new ResilientEventSource({
    url: '/api/scout',
    onReconnecting: () => stateChanges.push('reconnecting'),
    onReconnected: () => stateChanges.push('reconnected'),
  });

  client.connect();
  await waitFor(() => stateChanges.includes('connected'));

  // Simulate network drop
  simulateNetworkDrop();

  await waitFor(() => stateChanges.includes('reconnecting'));
  await waitFor(() => stateChanges.includes('reconnected'));
});
```

### 5. Partial Results Tests

**5.1 Two of Three Readers Complete**
```typescript
test('shows partial results when some readers fail', async () => {
  // Mock: maya and colton succeed, devon fails
  mockReaderResults({
    maya: { success: true, analysis: mockMayaAnalysis },
    colton: { success: true, analysis: mockColtonAnalysis },
    devon: { success: false, error: { status: 529 } },
  });

  render(<ScoutView />);
  await triggerAnalysis();

  // Should show 2 completed readers
  expect(screen.getByText('2/3 readers complete')).toBeInTheDocument();
  expect(screen.getByTestId('reader-maya-card')).toBeInTheDocument();
  expect(screen.getByTestId('reader-colton-card')).toBeInTheDocument();

  // Should show devon with retry button
  expect(screen.getByTestId('reader-devon-failed')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
});
```

**5.2 Downstream Tabs Show Partial Data**
```typescript
test('coverage tab shows partial data with retry option', async () => {
  // Set up partial coverage data
  setPartialCoverageData({ readersComplete: 2, readers: ['maya', 'colton'] });

  render(<CoveragePage />);

  // Should show available data
  expect(screen.getByText(/maya/i)).toBeInTheDocument();
  expect(screen.getByText(/colton/i)).toBeInTheDocument();

  // Should show retry option (not "Go back to Scout")
  expect(screen.queryByText(/go back to scout/i)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /retry failed/i })).toBeInTheDocument();
});
```

### 6. Error UI Tests

**6.1 Human-Readable Error Messages**
```typescript
test.each([
  [529, 'Anthropic is overloaded'],
  [429, 'Rate limit reached'],
  [401, 'API key invalid'],
])('shows human-readable message for %i error', async (status, expectedText) => {
  mockError({ status });
  render(<ScoutView />);
  await triggerAnalysis();

  expect(screen.getByText(new RegExp(expectedText, 'i'))).toBeInTheDocument();
});
```

**6.2 Expandable Details**
```typescript
test('error details are expandable', async () => {
  mockError({ status: 529, details: 'Request ID: abc123' });
  render(<ScoutView />);
  await triggerAnalysis();

  // Details should be collapsed by default
  expect(screen.queryByText(/abc123/)).not.toBeInTheDocument();

  // Click to expand
  fireEvent.click(screen.getByRole('button', { name: /details/i }));
  expect(screen.getByText(/abc123/)).toBeInTheDocument();
});
```

### 7. Upload Flow Tests

**7.1 Drag and Drop**
```typescript
test('drag and drop uploads file', async () => {
  render(<ChatInterface />);

  const dropZone = screen.getByTestId('upload-zone');
  const file = new File(['test content'], 'script.pdf', { type: 'application/pdf' });

  fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

  await waitFor(() => {
    expect(screen.getByText(/script.pdf/)).toBeInTheDocument();
    expect(screen.getByText(/processing/i)).toBeInTheDocument();
  });
});
```

**7.2 Upload Progress States**
```typescript
test('shows upload progress states', async () => {
  render(<ChatInterface />);

  const file = new File(['test'], 'script.pdf', { type: 'application/pdf' });
  uploadFile(file);

  // Should show uploading
  await waitFor(() => expect(screen.getByText(/uploading/i)).toBeInTheDocument());

  // Should show processing
  await waitFor(() => expect(screen.getByText(/processing/i)).toBeInTheDocument());

  // Should show complete
  await waitFor(() => expect(screen.getByText(/complete/i)).toBeInTheDocument());
});
```

### 8. Regression Tests

**8.1 Full Happy Path**
```typescript
test('full analysis workflow completes successfully', async () => {
  render(<ScoutView />);

  // Upload script
  await uploadScript(mockScript);

  // Run analysis
  fireEvent.click(screen.getByRole('button', { name: /run.*evaluation/i }));

  // Wait for completion
  await waitFor(() => {
    expect(screen.getByText(/3\/3 readers complete/i)).toBeInTheDocument();
  }, { timeout: 120000 });

  // Verify results are accessible
  expect(screen.getByTestId('reader-maya-card')).toBeInTheDocument();
  expect(screen.getByTestId('reader-colton-card')).toBeInTheDocument();
  expect(screen.getByTestId('reader-devon-card')).toBeInTheDocument();
});
```

## Allowed Paths
- `src/**`
- `tests/**`
- `__tests__/**`

## Verification
```bash
npm run test
npm run test:e2e
```

## Deliverables
1. All tests passing
2. Test coverage report
3. List of any bugs found
4. Regression confirmation

## Notes
- Use existing test patterns from the codebase
- Mock external services (Anthropic API)
- Test both success and failure paths
- Pay attention to race conditions
- Document any flaky tests
