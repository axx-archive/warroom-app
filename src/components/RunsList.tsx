"use client";

import { useEffect, useState } from "react";
import { fetchRuns } from "@/lib/actions";
import type { RunStatus, StartMode } from "@/lib/state";

interface RunSummary {
  runId: string;
  status: RunStatus;
  startMode: StartMode;
  repoName: string;
  repoPath: string;
  goal: string;
  createdAt: string;
  updatedAt: string;
  laneCount: number;
}

// Stub data for development
const STUB_RUNS: RunSummary[] = [
  {
    runId: "run-demo-001",
    status: "in_progress",
    startMode: "openclaw",
    repoName: "InsideOut",
    repoPath: "/Users/ajhart/Desktop/InsideOut",
    goal: "Add user authentication flow with OAuth providers",
    createdAt: "2025-02-02T10:00:00Z",
    updatedAt: "2025-02-02T14:30:00Z",
    laneCount: 3,
  },
  {
    runId: "run-demo-002",
    status: "complete",
    startMode: "claude_code_import",
    repoName: "Shareability",
    repoPath: "/Users/ajhart/Desktop/Shareability",
    goal: "Refactor data layer for better performance",
    createdAt: "2025-02-01T09:00:00Z",
    updatedAt: "2025-02-01T18:00:00Z",
    laneCount: 2,
  },
  {
    runId: "run-demo-003",
    status: "draft_plan",
    startMode: "openclaw",
    repoName: "InsideOut",
    repoPath: "/Users/ajhart/Desktop/InsideOut",
    goal: "Security audit and vulnerability patching",
    createdAt: "2025-02-02T15:00:00Z",
    updatedAt: "2025-02-02T15:00:00Z",
    laneCount: 4,
  },
];

function getStatusColor(status: RunStatus): string {
  switch (status) {
    case "draft_plan":
      return "text-gray-600 bg-gray-100";
    case "ready_to_stage":
      return "text-blue-600 bg-blue-100";
    case "staged":
      return "text-purple-600 bg-purple-100";
    case "in_progress":
      return "text-yellow-700 bg-yellow-100";
    case "merging":
      return "text-orange-600 bg-orange-100";
    case "complete":
      return "text-green-600 bg-green-100";
    default:
      return "text-gray-600 bg-gray-100";
  }
}

function getStatusLabel(status: RunStatus): string {
  switch (status) {
    case "draft_plan":
      return "Draft Plan";
    case "ready_to_stage":
      return "Ready to Stage";
    case "staged":
      return "Staged";
    case "in_progress":
      return "In Progress";
    case "merging":
      return "Merging";
    case "complete":
      return "Complete";
    default:
      return status;
  }
}

function getStartModeLabel(mode: StartMode): string {
  return mode === "openclaw" ? "OpenClaw" : "Claude Code Import";
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface RunsListProps {
  useStubData?: boolean;
}

export function RunsList({ useStubData = true }: RunsListProps) {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRuns() {
      if (useStubData) {
        // Use stub data for now
        setRuns(STUB_RUNS);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const result = await fetchRuns();

      if (result.success && result.data) {
        setRuns(result.data);
      } else {
        setError(result.error || "Failed to load runs");
      }

      setIsLoading(false);
    }

    loadRuns();
  }, [useStubData]);

  if (isLoading) {
    return (
      <div className="text-sm text-gray-500">Loading runs...</div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-600">Error: {error}</div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-sm">No runs yet</p>
        <p className="text-xs mt-1">
          Runs will appear here when you generate or import a plan
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {runs.map((run) => (
        <div
          key={run.runId}
          className="border border-gray-200 rounded-md p-3 hover:border-gray-300 transition-colors"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`text-xs px-2 py-0.5 rounded ${getStatusColor(run.status)}`}
                >
                  {getStatusLabel(run.status)}
                </span>
                <span className="text-xs text-gray-400">
                  {getStartModeLabel(run.startMode)}
                </span>
              </div>

              <p className="text-sm font-medium text-gray-900 truncate">
                {run.goal}
              </p>

              <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                <span>{run.repoName}</span>
                <span>{run.laneCount} lane{run.laneCount !== 1 ? "s" : ""}</span>
                <span>{formatDate(run.createdAt)}</span>
              </div>
            </div>

            <button
              className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
              onClick={() => {
                // TODO: Navigate to run details
                console.log("View run:", run.runId);
              }}
            >
              View
            </button>
          </div>
        </div>
      ))}

      {useStubData && (
        <div className="text-center py-2 text-xs text-gray-400 italic">
          (Showing stub data for development)
        </div>
      )}
    </div>
  );
}
