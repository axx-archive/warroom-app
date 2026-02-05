"use client";

import { useState, useEffect, useCallback } from "react";
import { WarRoomPlan } from "@/lib/plan-schema";

interface EligibleLane {
  laneId: string;
  worktreePath: string;
  branch: string;
  reason: string;
}

interface IneligibleLane {
  laneId: string;
  worktreePath: string;
  branch: string;
  reason: string;
}

interface CleanupPreview {
  success: boolean;
  eligibleLanes: EligibleLane[];
  ineligibleLanes: IneligibleLane[];
  warnings: string[];
  error?: string;
}

interface LaneCleanupResult {
  laneId: string;
  worktreeRemoved: boolean;
  branchDeleted: boolean;
  error?: string;
}

interface CleanupResult {
  success: boolean;
  results: LaneCleanupResult[];
  lanesRemoved: string[];
  branchesDeleted: string[];
  errors: string[];
  error?: string;
}

interface WorktreeCleanupModalProps {
  plan: WarRoomPlan;
  onClose: () => void;
  onCleanupComplete?: (result: CleanupResult) => void;
}

export function WorktreeCleanupModal({
  plan,
  onClose,
  onCleanupComplete,
}: WorktreeCleanupModalProps) {
  const [preview, setPreview] = useState<CleanupPreview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExecuting, setIsExecuting] = useState(false);
  const [confirmationInput, setConfirmationInput] = useState("");
  const [deleteBranches, setDeleteBranches] = useState(false);
  const [selectedLanes, setSelectedLanes] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<CleanupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch cleanup preview on mount
  useEffect(() => {
    async function fetchPreview() {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/runs/${plan.runSlug}/cleanup-preview`);
        const data: CleanupPreview = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Failed to fetch cleanup preview");
        }

        setPreview(data);
        // Select all eligible lanes by default
        setSelectedLanes(new Set(data.eligibleLanes.map((l) => l.laneId)));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error occurred");
      } finally {
        setIsLoading(false);
      }
    }

    fetchPreview();
  }, [plan.runSlug]);

  const handleLaneToggle = useCallback((laneId: string) => {
    setSelectedLanes((prev) => {
      const next = new Set(prev);
      if (next.has(laneId)) {
        next.delete(laneId);
      } else {
        next.add(laneId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (preview) {
      setSelectedLanes(new Set(preview.eligibleLanes.map((l) => l.laneId)));
    }
  }, [preview]);

  const handleSelectNone = useCallback(() => {
    setSelectedLanes(new Set());
  }, []);

  const handleExecuteCleanup = useCallback(async () => {
    if (confirmationInput !== "CLEANUP" || selectedLanes.size === 0) {
      return;
    }

    try {
      setIsExecuting(true);
      setError(null);

      const response = await fetch(`/api/runs/${plan.runSlug}/cleanup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmationToken: "CLEANUP",
          laneIds: Array.from(selectedLanes),
          deleteBranches,
        }),
      });

      const data: CleanupResult = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to execute cleanup");
      }

      setResult(data);
      if (onCleanupComplete) {
        onCleanupComplete(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setIsExecuting(false);
    }
  }, [confirmationInput, selectedLanes, deleteBranches, plan.runSlug, onCleanupComplete]);

  const isConfirmationValid = confirmationInput === "CLEANUP";
  const canExecute = isConfirmationValid && selectedLanes.size > 0 && !isExecuting;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-[rgba(239,68,68,0.15)] border border-[rgba(239,68,68,0.3)] flex items-center justify-center">
              <svg
                className="w-4 h-4 text-[var(--status-danger)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </div>
            <h2 className="text-lg font-medium text-[var(--text-primary)]">
              Cleanup Merged Worktrees
            </h2>
          </div>
          <button
            onClick={onClose}
            className="btn-ghost p-1.5 text-[var(--text-ghost)] hover:text-[var(--text-secondary)]"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <svg
                className="w-6 h-6 animate-spin text-[var(--text-ghost)]"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <span className="ml-2 text-[var(--text-secondary)]">
                Analyzing worktrees...
              </span>
            </div>
          )}

          {/* Error state */}
          {error && !result && (
            <div className="p-3 rounded border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)] text-[var(--status-danger)] text-sm">
              {error}
            </div>
          )}

          {/* Result state */}
          {result && (
            <div className="space-y-3">
              <div
                className={`p-3 rounded border ${
                  result.success
                    ? "border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.08)] text-[var(--status-success)]"
                    : "border-[rgba(234,179,8,0.3)] bg-[rgba(234,179,8,0.08)] text-[var(--status-warning)]"
                } text-sm`}
              >
                {result.success
                  ? `Successfully cleaned up ${result.lanesRemoved.length} worktrees${
                      result.branchesDeleted.length > 0
                        ? ` and deleted ${result.branchesDeleted.length} branches`
                        : ""
                    }`
                  : `Cleanup completed with some errors`}
              </div>

              {/* Detailed results */}
              <div className="space-y-2">
                {result.results.map((r) => (
                  <div
                    key={r.laneId}
                    className="flex items-center justify-between p-2 rounded bg-[var(--bg-tertiary)] text-sm"
                  >
                    <span className="font-mono text-[var(--text-primary)]">
                      {r.laneId}
                    </span>
                    <div className="flex items-center gap-2">
                      {r.worktreeRemoved ? (
                        <span className="text-[var(--status-success)] text-xs">
                          Worktree removed
                        </span>
                      ) : (
                        <span className="text-[var(--status-danger)] text-xs">
                          Failed
                        </span>
                      )}
                      {deleteBranches && r.branchDeleted && (
                        <span className="text-[var(--status-success)] text-xs">
                          Branch deleted
                        </span>
                      )}
                      {r.error && (
                        <span className="text-[var(--status-danger)] text-xs truncate max-w-[200px]" title={r.error}>
                          {r.error}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-2">
                <button onClick={onClose} className="btn btn--sm btn--primary">
                  Close
                </button>
              </div>
            </div>
          )}

          {/* Preview state */}
          {!isLoading && !result && preview && (
            <>
              {/* Eligible lanes */}
              {preview.eligibleLanes.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-[var(--text-secondary)]">
                      Eligible for cleanup ({selectedLanes.size}/{preview.eligibleLanes.length} selected)
                    </label>
                    <div className="flex gap-2 text-xs">
                      <button
                        type="button"
                        onClick={handleSelectAll}
                        className="text-[var(--cyan)] hover:underline"
                      >
                        Select all
                      </button>
                      <span className="text-[var(--text-ghost)]">|</span>
                      <button
                        type="button"
                        onClick={handleSelectNone}
                        className="text-[var(--cyan)] hover:underline"
                      >
                        Select none
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto p-2 rounded border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]">
                    {preview.eligibleLanes.map((lane) => (
                      <label
                        key={lane.laneId}
                        className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-[var(--bg-secondary)] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedLanes.has(lane.laneId)}
                          onChange={() => handleLaneToggle(lane.laneId)}
                          className="w-4 h-4 rounded border-[var(--border-subtle)] bg-[var(--bg-tertiary)] text-[var(--cyan)] focus:ring-[var(--cyan)]"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-sm text-[var(--text-primary)]">
                              {lane.laneId}
                            </span>
                            <span className="text-xs text-[var(--status-success)]">
                              {lane.reason}
                            </span>
                          </div>
                          <div className="text-xs text-[var(--text-ghost)] truncate">
                            {lane.worktreePath}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* No eligible lanes */}
              {preview.eligibleLanes.length === 0 && (
                <div className="p-4 rounded border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] text-center">
                  <svg
                    className="w-8 h-8 mx-auto text-[var(--text-ghost)] mb-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="text-sm text-[var(--text-secondary)]">
                    No lanes are eligible for cleanup
                  </p>
                  <p className="text-xs text-[var(--text-ghost)] mt-1">
                    Lanes must be merged before they can be cleaned up
                  </p>
                </div>
              )}

              {/* Ineligible lanes */}
              {preview.ineligibleLanes.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    Not eligible ({preview.ineligibleLanes.length})
                  </label>
                  <div className="space-y-1 max-h-32 overflow-y-auto p-2 rounded border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] opacity-70">
                    {preview.ineligibleLanes.map((lane) => (
                      <div
                        key={lane.laneId}
                        className="flex items-center justify-between py-1 text-sm"
                      >
                        <span className="font-mono text-[var(--text-ghost)]">
                          {lane.laneId}
                        </span>
                        <span className="text-xs text-[var(--text-ghost)]">
                          {lane.reason}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Warnings */}
              {preview.warnings.length > 0 && (
                <div className="p-3 rounded border border-[rgba(234,179,8,0.3)] bg-[rgba(234,179,8,0.08)]">
                  <div className="flex items-start gap-2">
                    <svg
                      className="w-4 h-4 text-[var(--status-warning)] flex-shrink-0 mt-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    <div className="space-y-1 text-xs text-[var(--status-warning)]">
                      {preview.warnings.map((warning, i) => (
                        <p key={i}>{warning}</p>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Delete branches option */}
              {preview.eligibleLanes.length > 0 && (
                <label className="flex items-center gap-3 py-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deleteBranches}
                    onChange={(e) => setDeleteBranches(e.target.checked)}
                    className="w-4 h-4 rounded border-[var(--border-subtle)] bg-[var(--bg-tertiary)] text-[var(--cyan)] focus:ring-[var(--cyan)]"
                  />
                  <div>
                    <span className="text-sm text-[var(--text-primary)]">
                      Also delete branches
                    </span>
                    <p className="text-xs text-[var(--text-ghost)]">
                      Remove the git branches after cleaning up worktrees
                    </p>
                  </div>
                </label>
              )}

              {/* Confirmation input */}
              {preview.eligibleLanes.length > 0 && selectedLanes.size > 0 && (
                <div>
                  <label
                    htmlFor="confirmCleanup"
                    className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5"
                  >
                    Type <span className="font-mono text-[var(--status-danger)]">CLEANUP</span> to confirm
                  </label>
                  <input
                    type="text"
                    id="confirmCleanup"
                    value={confirmationInput}
                    onChange={(e) => setConfirmationInput(e.target.value)}
                    placeholder="Type CLEANUP to confirm"
                    className={`w-full px-3 py-2 rounded border bg-[var(--bg-tertiary)] text-[var(--text-primary)] placeholder-[var(--text-ghost)] focus:outline-none focus:ring-1 ${
                      confirmationInput && !isConfirmationValid
                        ? "border-[var(--status-danger)] focus:ring-[var(--status-danger)]"
                        : "border-[var(--border-subtle)] focus:ring-[var(--cyan)]"
                    }`}
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn--sm btn--secondary"
                  disabled={isExecuting}
                >
                  Cancel
                </button>
                {preview.eligibleLanes.length > 0 && (
                  <button
                    type="button"
                    onClick={handleExecuteCleanup}
                    className={`btn btn--sm ${
                      canExecute
                        ? "bg-[var(--status-danger)] text-white hover:bg-[rgba(239,68,68,0.8)]"
                        : "opacity-50 cursor-not-allowed bg-[var(--status-danger)] text-white"
                    }`}
                    disabled={!canExecute}
                  >
                    {isExecuting ? (
                      <>
                        <svg
                          className="w-3 h-3 animate-spin"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                        Cleaning up...
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                        Cleanup {selectedLanes.size} worktree{selectedLanes.size !== 1 ? "s" : ""}
                      </>
                    )}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
