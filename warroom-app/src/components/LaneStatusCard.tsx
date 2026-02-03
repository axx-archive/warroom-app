"use client";

import { useState, useTransition } from "react";
import { Lane, LaneStatus, LaneAutonomy } from "@/lib/plan-schema";

interface LaneStatusCardProps {
  lane: Lane;
  slug: string;
  initialStatus: LaneStatus;
  initialStaged: boolean;
  initialAutonomy: LaneAutonomy;
}

export function LaneStatusCard({
  lane,
  slug,
  initialStatus,
  initialStaged,
  initialAutonomy,
}: LaneStatusCardProps) {
  const [status, setStatus] = useState<LaneStatus>(initialStatus);
  const [staged] = useState(initialStaged);
  const [autonomy, setAutonomy] = useState<LaneAutonomy>(initialAutonomy);
  const [isPending, startTransition] = useTransition();

  const isComplete = status === "complete";

  const handleToggleComplete = () => {
    const newStatus: LaneStatus = isComplete ? "pending" : "complete";

    startTransition(async () => {
      try {
        const response = await fetch(`/api/runs/${slug}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            laneId: lane.laneId,
            laneStatus: newStatus,
          }),
        });

        if (response.ok) {
          setStatus(newStatus);
        } else {
          console.error("Failed to update lane status");
        }
      } catch (error) {
        console.error("Error updating lane status:", error);
      }
    });
  };

  const handleToggleAutonomy = () => {
    const newAutonomy: LaneAutonomy = {
      dangerouslySkipPermissions: !autonomy.dangerouslySkipPermissions,
    };

    startTransition(async () => {
      try {
        const response = await fetch(`/api/runs/${slug}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            laneId: lane.laneId,
            autonomy: newAutonomy,
          }),
        });

        if (response.ok) {
          setAutonomy(newAutonomy);
        } else {
          console.error("Failed to update lane autonomy");
        }
      } catch (error) {
        console.error("Error updating lane autonomy:", error);
      }
    });
  };

  const borderClass =
    status === "complete"
      ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10"
      : status === "in_progress"
        ? "border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/10"
        : status === "failed"
          ? "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10"
          : "border-zinc-200 dark:border-zinc-700";

  return (
    <div className={`p-4 border rounded-lg ${borderClass}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          {/* Completion Checkbox */}
          <button
            onClick={handleToggleComplete}
            disabled={isPending}
            className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
              isPending
                ? "opacity-50 cursor-not-allowed"
                : "cursor-pointer hover:border-green-500"
            } ${
              isComplete
                ? "bg-green-500 border-green-500 text-white"
                : "border-zinc-300 dark:border-zinc-600"
            }`}
            title={isComplete ? "Mark as incomplete" : "Mark as complete"}
          >
            {isComplete && (
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {lane.laneId}
              </span>
              <span className="px-2 py-0.5 text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded">
                {lane.agent}
              </span>
              {staged && (
                <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded">
                  staged
                </span>
              )}
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 font-mono">
              {lane.branch}
            </p>
          </div>
        </div>
        <LaneStatusBadge status={status} />
      </div>
      {lane.dependsOn.length > 0 && (
        <div className="mt-2 ml-8 text-xs text-zinc-500">
          Depends on: {lane.dependsOn.join(", ")}
        </div>
      )}
      {/* Autonomy Toggle */}
      <div className="mt-3 ml-8 flex items-center gap-2">
        <button
          onClick={handleToggleAutonomy}
          disabled={isPending}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
            isPending ? "opacity-50 cursor-not-allowed" : ""
          } ${
            autonomy.dangerouslySkipPermissions
              ? "bg-amber-500"
              : "bg-zinc-200 dark:bg-zinc-700"
          }`}
          role="switch"
          aria-checked={autonomy.dangerouslySkipPermissions}
          title={
            autonomy.dangerouslySkipPermissions
              ? "Disable skip permissions mode"
              : "Enable skip permissions mode"
          }
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              autonomy.dangerouslySkipPermissions
                ? "translate-x-4"
                : "translate-x-0"
            }`}
          />
        </button>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          Skip permissions
          {autonomy.dangerouslySkipPermissions && (
            <span className="ml-1 text-amber-600 dark:text-amber-400 font-medium">
              (enabled)
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

function LaneStatusBadge({ status }: { status: LaneStatus }) {
  const statusConfig: Record<LaneStatus, { color: string; label: string }> = {
    pending: {
      color: "text-zinc-500 dark:text-zinc-400",
      label: "Pending",
    },
    in_progress: {
      color: "text-yellow-600 dark:text-yellow-400",
      label: "In Progress",
    },
    complete: {
      color: "text-green-600 dark:text-green-400",
      label: "Complete",
    },
    failed: {
      color: "text-red-600 dark:text-red-400",
      label: "Failed",
    },
  };

  const config = statusConfig[status];

  return (
    <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
  );
}
