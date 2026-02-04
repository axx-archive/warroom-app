# WARROOM PACKET: P1/P2 UX Improvements

## Role
You are a **Senior Developer** with **frontend-design skill** implementing UX improvements for the Bullseye application.

## Mission
Implement P1/P2 UX improvements: Scout run status surface, error classification UI, partial results handling, upload flow improvements, and visual hierarchy enhancements.

## Context
Bullseye has functional UX but poor error state handling:
- Errors show raw strings ("Claude Code process exited with code 1")
- No run timeline/progress visualization
- Downstream tabs show "Go back to Scout" instead of actionable options
- Partial results (2/3 readers complete) aren't visible
- Upload flow lacks drag-and-drop visibility

## Prerequisites
**lane-2-reliability must complete first.** You will use:
- `AnthropicError` types from `src/lib/anthropic/errors.ts`
- Error classification helpers (`isOverloaded`, `isAuthError`, etc.)

## Deliverables

### 1. Scout Run Timeline UI (`src/components/scout/scout-view.tsx`)

**Add run status surface showing:**
```
Queued → Running → Retrying (Overloaded) → Partial Results → Complete
```

**Component structure:**
```typescript
interface RunTimeline {
  status: 'idle' | 'queued' | 'running' | 'retrying' | 'partial' | 'complete' | 'failed';
  phase?: 'analysis' | 'focus_group' | 'reader_chat' | 'executive';
  readers: {
    maya: ReaderStatus;
    colton: ReaderStatus;
    devon: ReaderStatus;
  };
  retryInfo?: {
    attempt: number;
    maxAttempts: number;
    retryInSeconds: number;
  };
  error?: {
    type: 'overloaded' | 'auth' | 'crash' | 'network' | 'unknown';
    message: string;
    details?: string;
    actionable?: string; // "Check your API key", "Wait and retry", etc.
  };
}

interface ReaderStatus {
  status: 'pending' | 'running' | 'complete' | 'failed';
  startedAt?: number;
  completedAt?: number;
  error?: string;
}
```

**Visual design:**
- Horizontal timeline with status dots
- Current phase highlighted
- Reader cards below with individual status pills
- Error state shows human-readable message + expandable "Details"

### 2. Error Classification UI

**Map error types to user-friendly messages:**

| Error Type | UI Message | Action |
|------------|------------|--------|
| 529 overloaded | "Anthropic is overloaded—retrying in Xs" | Countdown timer, auto-retry |
| 429 rate limited | "Rate limit reached—waiting Xs" | Countdown timer, auto-retry |
| Auth error | "API key invalid or missing" | Link to settings |
| Network error | "Connection lost—reconnecting..." | Auto-reconnect indicator |
| Local crash | "Claude Code terminated unexpectedly" | Link to logs, retry button |
| Unknown | "Something went wrong" | Details expandable, retry button |

**Error component:**
```typescript
interface ErrorDisplay {
  type: ErrorType;
  message: string; // Human-readable
  details?: string; // Technical details (collapsed by default)
  actions: Array<{
    label: string;
    onClick: () => void;
    primary?: boolean;
  }>;
  countdown?: {
    seconds: number;
    onComplete: () => void;
  };
}
```

### 3. Partial Results Handling

**When 2/3 readers complete, show results anyway:**

In `src/components/scout/reader-analysis-panel.tsx`:
```typescript
// Show completed readers even if some failed
{completedReaders.map(reader => (
  <ReaderCard key={reader.id} analysis={reader.analysis} />
))}

// Show failed readers with retry option
{failedReaders.map(reader => (
  <ReaderFailedCard
    key={reader.id}
    reader={reader}
    error={reader.error}
    onRetry={() => retryReader(reader.id)}
  />
))}

// Status badge
<Badge variant={allComplete ? 'success' : 'warning'}>
  {completedCount}/{totalCount} readers complete
  {failedCount > 0 && ` • ${failedCount} failed`}
</Badge>
```

**Propagate to downstream tabs:**

In Coverage/Focus/Pitch pages, check for partial data:
```typescript
// Instead of "Go back to Scout"
if (hasPartialData) {
  return (
    <PartialResultsView
      availableData={partialData}
      missingReaders={failedReaders}
      onRetryMissing={() => retryFailedReaders()}
    />
  );
}
```

### 4. Tab Actions (Reduce Navigation Loops)

Each tab should offer contextual actions instead of "Go back to Scout":

**Coverage tab:**
```typescript
<EmptyOrPartialState
  hasData={!!coverageData}
  isPartial={coverageData?.readersComplete < 3}
  actions={[
    { label: 'Run Coverage Analysis', onClick: runCoverageAnalysis, primary: true },
    { label: 'Retry Failed Readers', onClick: retryFailed, show: hasFailedReaders },
    { label: 'Import Results', onClick: openImportModal },
  ]}
/>
```

**Apply to:** Coverage, Focus, Revisions, Pitch tabs.

### 5. Upload Flow Improvements (`src/components/chat/chat-interface.tsx`)

**Make drag-and-drop always visible:**
```typescript
// Always-visible drop zone (not just on drag)
<div className="upload-zone">
  <DropZone
    onDrop={handleFileDrop}
    accept={['.pdf', '.fdx', '.txt']}
    maxSize={10 * 1024 * 1024} // 10MB
  >
    <UploadIcon />
    <span>Drop screenplay here or click to browse</span>
    <span className="text-muted">PDF, Final Draft, or plain text • Max 10MB</span>
  </DropZone>

  {uploadProgress !== null && (
    <UploadProgress
      progress={uploadProgress}
      status={uploadStatus} // 'uploading' | 'processing' | 'complete' | 'error'
    />
  )}
</div>
```

**Distinct states:**
- Idle: Visible drop zone with instructions
- Dragging: Highlighted border, "Drop to upload"
- Uploading: Progress bar with percentage
- Processing: "Extracting text..." spinner
- Complete: Success message, file name shown
- Error: Error message with retry button

### 6. Visual Hierarchy - Reader Cards (`src/components/scout/scout-view.tsx`)

**Reader cards with status pills:**
```typescript
<ReaderCard
  reader={reader}
  status={readerStatus} // 'pending' | 'running' | 'complete' | 'failed'
  analysis={analysis}
  lastUpdated={lastUpdated}
  onRetry={status === 'failed' ? () => retryReader(reader.id) : undefined}
>
  <StatusPill status={status} />
  <Timestamp time={lastUpdated} />
  {status === 'running' && <Spinner />}
  {status === 'failed' && <RetryButton onClick={onRetry} />}
</ReaderCard>
```

### 7. Token/Time Estimate Display

**Before running expensive operations:**
```typescript
<RunAnalysisButton
  onClick={runAnalysis}
  estimate={{
    inputTokens: estimatedInputTokens,
    outputTokens: estimatedOutputTokens,
    costUsd: estimatedCost,
    timeRange: '2-5 minutes', // Based on script length
  }}
  showEstimate={userPreference.showEstimates}
>
  Run Reader Evaluation
  {showEstimate && (
    <EstimateTooltip>
      ~{formatTokens(inputTokens)} input • ~{formatTokens(outputTokens)} output
      Est. cost: ${costUsd.toFixed(2)} • {timeRange}
    </EstimateTooltip>
  )}
</RunAnalysisButton>
```

## Allowed Paths
- `src/components/**`
- `src/app/(dashboard)/**`
- `src/stores/**`
- `src/lib/errors.ts` (UI error types only)

## Constraints
- Do NOT touch SSE routes (lane-3's scope)
- Do NOT touch rate limiter (lane-2's scope)
- Use existing shadcn/ui components where possible
- Maintain Tailwind CSS 4 patterns
- Use Framer Motion for animations (already installed)
- Ensure accessibility (ARIA labels, keyboard navigation)

## Verification
```bash
npm run typecheck
npm run lint
```

Manual testing:
1. Trigger 529 error, verify human-readable message + countdown
2. Complete 2/3 readers, verify partial results visible
3. Visit Coverage tab with partial data, verify actions available
4. Test drag-and-drop upload, verify all states
5. Verify reader cards show status pills + timestamps

## Design Guidelines
- Use existing color tokens from the design system
- Status colors: success (green), warning (amber), error (red), info (blue)
- Animations should be subtle (150-300ms)
- Error messages should be empathetic, not technical
- Always provide a clear next action
