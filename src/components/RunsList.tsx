"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { StatusJson } from "@/lib/plan-schema";

interface RunSummary {
  runSlug: string;
  runDir: string;
  status: StatusJson | null;
}

interface RunsListProps {
  initialRuns?: RunSummary[];
}

const STATUS_CONFIG: Record<string, { color: string; bgColor: string; borderColor: string }> = {
  draft: {
    color: "var(--muted)",
    bgColor: "transparent",
    borderColor: "var(--border)",
  },
  ready_to_stage: {
    color: "var(--accent-light)",
    bgColor: "rgba(124, 58, 237, 0.15)",
    borderColor: "rgba(124, 58, 237, 0.3)",
  },
  staged: {
    color: "var(--accent)",
    bgColor: "rgba(124, 58, 237, 0.15)",
    borderColor: "rgba(124, 58, 237, 0.3)",
  },
  in_progress: {
    color: "var(--accent-light)",
    bgColor: "rgba(124, 58, 237, 0.15)",
    borderColor: "rgba(124, 58, 237, 0.3)",
  },
  merging: {
    color: "var(--warning)",
    bgColor: "rgba(249, 115, 22, 0.15)",
    borderColor: "rgba(249, 115, 22, 0.3)",
  },
  complete: {
    color: "var(--success)",
    bgColor: "rgba(34, 197, 94, 0.15)",
    borderColor: "rgba(34, 197, 94, 0.3)",
  },
};

function getLaneStatusClass(status?: string): string {
  switch (status) {
    case "complete":
      return "lane-complete";
    case "in_progress":
    case "staged":
      return "lane-in-progress";
    case "merging":
      return "lane-in-progress";
    default:
      return "";
  }
}

export function RunsList({ initialRuns }: RunsListProps) {
  const [runs, setRuns] = useState<RunSummary[]>(initialRuns ?? []);
  const [loading, setLoading] = useState(!initialRuns);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = useCallback(async (runSlug: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (deleteConfirm !== runSlug) {
      setDeleteConfirm(runSlug);
      return;
    }

    setDeleting(runSlug);
    try {
      const response = await fetch(`/api/runs/${runSlug}/delete`, {
        method: "DELETE",
      });

      if (response.ok) {
        setRuns((prev) => prev.filter((r) => r.runSlug !== runSlug));
      } else {
        const data = await response.json();
        console.error("Delete failed:", data.error);
      }
    } catch (err) {
      console.error("Delete error:", err);
    } finally {
      setDeleting(null);
      setDeleteConfirm(null);
    }
  }, [deleteConfirm]);

  const cancelDelete = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteConfirm(null);
  }, []);

  useEffect(() => {
    if (initialRuns) return;

    async function fetchRuns() {
      try {
        const response = await fetch("/api/runs");
        const data = await response.json();

        if (data.success) {
          setRuns(data.runs);
        } else {
          setError(data.error || "Failed to load runs");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch runs");
      } finally {
        setLoading(false);
      }
    }

    fetchRuns();
  }, [initialRuns]);

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {/* Skeleton loading cards */}
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton-card" style={{ animationDelay: `${i * 100}ms` }}>
            <div className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="skeleton-text" style={{ width: "180px" }} />
                <div className="skeleton-badge" />
              </div>
              <div className="skeleton-text skeleton-text--medium" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="card--static p-5" style={{ borderColor: "rgba(239, 68, 68, 0.3)", background: "rgba(239, 68, 68, 0.08)" }}>
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "var(--error)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="small font-medium" style={{ color: "var(--error)" }}>Error Loading Missions</p>
            <p className="small mt-0.5" style={{ color: "var(--muted)" }}>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center" style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
          <svg className="w-8 h-8" style={{ color: "var(--muted)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p className="mono small mb-6" style={{ color: "var(--muted)" }}>
          No missions found. Initialize a new mission to begin.
        </p>
        <Link href="/" className="btn btn--primary">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Mission
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 stagger-children">
      {runs.map((run, index) => {
        const statusConfig = STATUS_CONFIG[run.status?.status || "draft"] || STATUS_CONFIG.draft;
        const statusClass = getLaneStatusClass(run.status?.status);

        return (
          <Link
            key={run.runSlug}
            href={`/runs/${run.runSlug}`}
            className={`lane-card ${statusClass} block group card-hover-glow`}
            style={{ "--stagger-index": index } as React.CSSProperties}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="mono small font-medium group-hover:text-[var(--accent-light)] transition-colors truncate" style={{ color: "var(--text)" }}>
                    {run.runSlug}
                  </h3>
                  <StatusBadge status={run.status?.status} config={statusConfig} />
                </div>
                <p className="mono small truncate" style={{ color: "var(--muted)" }}>
                  {run.runDir}
                </p>
                {run.status && run.status.lanesCompleted && run.status.lanesCompleted.length > 0 && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="indicator-dot indicator-dot-success indicator-dot--sm" />
                    <span className="mono small" style={{ color: "var(--muted)" }}>
                      {run.status.lanesCompleted.length} lane{run.status.lanesCompleted.length !== 1 ? "s" : ""} completed
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 ml-4">
                {run.status?.updatedAt && (
                  <span className="mono small whitespace-nowrap" style={{ color: "var(--muted)" }}>
                    {formatRelativeTime(run.status.updatedAt)}
                  </span>
                )}
                {deleteConfirm === run.runSlug ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleDelete(run.runSlug, e)}
                      disabled={deleting === run.runSlug}
                      className="btn btn--danger btn--sm"
                    >
                      {deleting === run.runSlug ? "..." : "Confirm"}
                    </button>
                    <button
                      onClick={cancelDelete}
                      className="btn btn--ghost btn--sm"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => handleDelete(run.runSlug, e)}
                    className="btn btn--icon opacity-0 group-hover:opacity-100"
                    title="Delete mission"
                    style={{ color: "var(--muted)" }}
                  >
                    <svg className="w-4 h-4 hover:text-[var(--error)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
                <svg className="w-4 h-4 group-hover:text-[var(--accent)] transition-colors" style={{ color: "var(--muted)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function StatusBadge({ status, config }: { status?: string; config: { color: string; bgColor: string; borderColor: string } }) {
  const displayStatus = status ?? "unknown";

  return (
    <span
      className="badge"
      style={{
        color: config.color,
        backgroundColor: config.bgColor,
        borderColor: config.borderColor,
      }}
    >
      {displayStatus.replace(/_/g, " ")}
    </span>
  );
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
