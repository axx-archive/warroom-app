"use client";

import { useState } from "react";

interface ProgressIndicatorProps {
  completed: number;
  total: number;
  costUsd?: number;
  lanesRunning?: number;
  lanesFailed?: number;
}

// Format cost for display
function formatCost(cost: number): string {
  if (cost === 0) {
    return "$0.00";
  } else if (cost < 0.001) {
    return "<$0.001";
  } else if (cost < 0.01) {
    return `$${cost.toFixed(3)}`;
  } else if (cost < 1) {
    return `$${cost.toFixed(2)}`;
  } else {
    return `$${cost.toFixed(2)}`;
  }
}

export function ProgressIndicator({
  completed,
  total,
  costUsd = 0,
  lanesRunning = 0,
  lanesFailed = 0,
}: ProgressIndicatorProps) {
  const [showDetails, setShowDetails] = useState(false);
  const isComplete = completed === total && total > 0;
  const pending = total - completed - lanesRunning - lanesFailed;
  const progress = total > 0 ? (completed / total) * 100 : 0;

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowDetails(true)}
      onMouseLeave={() => setShowDetails(false)}
    >
      {/* Main indicator - Bold Instrument Panel */}
      <div className="flex items-center gap-4 px-5 py-3 bg-[var(--bg-deep)] border border-[var(--border-strong)] rounded-lg instrument-panel cursor-default transition-all duration-200 hover:border-[var(--accent-border)]">
        {/* Completion metric */}
        <div className="flex flex-col">
          <span className="telemetry-label">Completion</span>
          <span className="text-xl font-bold text-white leading-none font-mono tabular-nums">
            {completed} <span className="text-[var(--text-ghost)]">/</span> {total}
          </span>
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-[var(--border)]" />

        {/* Cost metric */}
        <div className="flex flex-col">
          <span className="telemetry-label">Resource Burn</span>
          <span className={`text-xl font-bold leading-none font-mono tabular-nums flex items-center gap-1 ${costUsd > 0 ? "text-[var(--success)]" : "text-[var(--text-ghost)]"}`}>
            {formatCost(costUsd)}
            {lanesRunning > 0 && (
              <svg className="w-4 h-4 text-[var(--success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            )}
          </span>
        </div>

        {/* Running indicator */}
        {lanesRunning > 0 && (
          <>
            <div className="w-px h-8 bg-[var(--border)]" />
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--accent)]" />
              </span>
              <span className="text-xs font-mono font-bold text-[var(--accent)] uppercase tracking-tight">
                {lanesRunning} Active
              </span>
            </div>
          </>
        )}
      </div>

      {/* Hover tooltip with details */}
      {showDetails && (
        <div
          className="absolute top-full right-0 mt-2 p-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg shadow-lg z-50 min-w-[180px] animate-scale-in"
          style={{ transformOrigin: "top right" }}
        >
          <div className="space-y-3">
            {/* Complete */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="status-dot status-dot--success status-dot--sm" />
                <span className="text-caption text-[var(--text-secondary)]">Complete</span>
              </div>
              <span className="font-mono text-sm font-semibold text-[var(--success)] tabular-nums">
                {completed}
              </span>
            </div>

            {/* Running */}
            {lanesRunning > 0 && (
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="status-dot status-dot--active status-dot--sm" />
                  <span className="text-caption text-[var(--text-secondary)]">Running</span>
                </div>
                <span className="font-mono text-sm font-semibold text-[var(--accent)] tabular-nums">
                  {lanesRunning}
                </span>
              </div>
            )}

            {/* Pending */}
            {pending > 0 && (
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="status-dot status-dot--idle status-dot--sm" />
                  <span className="text-caption text-[var(--text-secondary)]">Pending</span>
                </div>
                <span className="font-mono text-sm font-semibold text-[var(--text-ghost)] tabular-nums">
                  {pending}
                </span>
              </div>
            )}

            {/* Failed */}
            {lanesFailed > 0 && (
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="status-dot status-dot--error status-dot--sm" />
                  <span className="text-caption text-[var(--text-secondary)]">Failed</span>
                </div>
                <span className="font-mono text-sm font-semibold text-[var(--error)] tabular-nums">
                  {lanesFailed}
                </span>
              </div>
            )}

            {/* Cost */}
            {costUsd > 0 && (
              <>
                <div className="divider" />
                <div className="flex items-center justify-between gap-4">
                  <span className="text-caption text-[var(--text-secondary)]">Est. Cost</span>
                  <span className="font-mono text-sm font-semibold text-[var(--accent)] tabular-nums">
                    {formatCost(costUsd)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
