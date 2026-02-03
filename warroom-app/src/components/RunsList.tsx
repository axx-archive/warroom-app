"use client";

import { useEffect, useState } from "react";
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

export function RunsList({ initialRuns }: RunsListProps) {
  const [runs, setRuns] = useState<RunSummary[]>(initialRuns ?? []);
  const [loading, setLoading] = useState(!initialRuns);
  const [error, setError] = useState<string | null>(null);

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
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-zinc-500">Loading runs...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-red-700 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-500 dark:text-zinc-400 mb-4">
          No runs found. Create a new plan to get started.
        </p>
        <Link
          href="/"
          className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
        >
          + New Plan
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {runs.map((run) => (
        <Link
          key={run.runSlug}
          href={`/runs/${run.runSlug}`}
          className="block p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                {run.runSlug}
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 truncate">
                {run.runDir}
              </p>
            </div>
            <div className="flex items-center gap-3 ml-4">
              <StatusBadge status={run.status?.status} />
              {run.status?.updatedAt && (
                <span className="text-xs text-zinc-400 dark:text-zinc-500 whitespace-nowrap">
                  {formatRelativeTime(run.status.updatedAt)}
                </span>
              )}
            </div>
          </div>
          {run.status && (
            <div className="mt-2 flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
              {run.status.lanesCompleted && (
                <span>
                  {run.status.lanesCompleted.length} lane
                  {run.status.lanesCompleted.length !== 1 ? "s" : ""} completed
                </span>
              )}
            </div>
          )}
        </Link>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const statusColors: Record<string, string> = {
    draft: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    ready_to_stage:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    staged:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    in_progress:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    merging:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    complete:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  };

  const displayStatus = status ?? "unknown";
  const colorClass =
    statusColors[displayStatus] ??
    "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";

  return (
    <span
      className={`px-2 py-0.5 text-xs font-medium rounded-full ${colorClass}`}
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
