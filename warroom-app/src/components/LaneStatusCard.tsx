"use client";

import { useState, useTransition, useCallback, useRef, useEffect } from "react";
import { Lane, LaneStatus, LaneAutonomy, LaunchMode, RetryState, PushState, CostTracking } from "@/lib/plan-schema";
import { LaneUncommittedStatus, UncommittedFile } from "@/hooks/useStatusPolling";

interface LaneStatusCardProps {
  lane: Lane;
  slug: string;
  initialStatus: LaneStatus;
  initialStaged: boolean;
  initialAutonomy: LaneAutonomy;
  initialLaunchMode?: LaunchMode; // Initial launch mode preference ('cursor' or 'terminal')
  completedLanes?: string[]; // List of completed lane IDs to check dependencies
  uncommittedStatus?: LaneUncommittedStatus; // Uncommitted files data from polling
  onStatusChange?: (laneId: string, newStatus: LaneStatus) => void; // Callback when status changes
  onDismissSuggestion?: (laneId: string) => void; // Callback when suggestion is dismissed
  onPreviewChanges?: (laneId: string) => void; // Callback to open diff preview modal
}

const STATUS_CONFIG: Record<LaneStatus, { color: string; bgColor: string; borderColor: string; label: string }> = {
  pending: {
    color: "var(--muted)",
    bgColor: "transparent",
    borderColor: "var(--border)",
    label: "Pending",
  },
  in_progress: {
    color: "var(--accent)",
    bgColor: "rgba(124, 58, 237, 0.08)",
    borderColor: "rgba(124, 58, 237, 0.3)",
    label: "In Progress",
  },
  complete: {
    color: "var(--status-success)",
    bgColor: "rgba(34, 197, 94, 0.08)",
    borderColor: "rgba(34, 197, 94, 0.3)",
    label: "Complete",
  },
  failed: {
    color: "var(--status-error)",
    bgColor: "rgba(239, 68, 68, 0.08)",
    borderColor: "rgba(239, 68, 68, 0.3)",
    label: "Failed",
  },
  conflict: {
    color: "var(--status-warning)",
    bgColor: "rgba(234, 179, 8, 0.08)",
    borderColor: "rgba(234, 179, 8, 0.3)",
    label: "Merge Conflict",
  },
};

// Helper function to calculate time remaining
function calculateTimeRemaining(nextRetryAt: string | undefined): { timeRemaining: string; secondsLeft: number } {
  if (!nextRetryAt) {
    return { timeRemaining: "", secondsLeft: 0 };
  }

  const now = Date.now();
  const nextRetry = new Date(nextRetryAt).getTime();
  const diff = Math.max(0, Math.floor((nextRetry - now) / 1000));

  let timeRemaining: string;
  if (diff <= 0) {
    timeRemaining = "retrying...";
  } else if (diff < 60) {
    timeRemaining = `${diff}s`;
  } else {
    const minutes = Math.floor(diff / 60);
    const seconds = diff % 60;
    timeRemaining = `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  return { timeRemaining, secondsLeft: diff };
}

// Retry countdown component with live timer
function RetryCountdown({
  retryState,
}: {
  retryState: RetryState;
}) {
  // Calculate initial values synchronously to avoid the ESLint warning
  const initialCalc = retryState.nextRetryAt && retryState.status === "waiting"
    ? calculateTimeRemaining(retryState.nextRetryAt)
    : { timeRemaining: "", secondsLeft: 0 };
  const [timeRemaining, setTimeRemaining] = useState<string>(initialCalc.timeRemaining);
  const [secondsLeft, setSecondsLeft] = useState<number>(initialCalc.secondsLeft);

  useEffect(() => {
    if (!retryState.nextRetryAt || retryState.status !== "waiting") {
      // Don't reset state here - rely on component re-mount
      return;
    }

    const updateCountdown = () => {
      const { timeRemaining: newTime, secondsLeft: newSeconds } = calculateTimeRemaining(retryState.nextRetryAt);
      setTimeRemaining(newTime);
      setSecondsLeft(newSeconds);
    };

    // Start interval for countdown updates
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [retryState.nextRetryAt, retryState.status]);

  if (!retryState.nextRetryAt && retryState.status !== "retrying") {
    return null;
  }

  const isRetrying = retryState.status === "retrying" || secondsLeft <= 0;

  return (
    <div
      className="mt-3 ml-8 p-3 rounded-lg"
      style={{
        backgroundColor: "rgba(249, 115, 22, 0.1)",
        border: "1px solid rgba(249, 115, 22, 0.3)",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <svg
            className={`w-4 h-4 shrink-0 ${isRetrying ? "spinner" : ""}`}
            style={{ color: "#f97316" }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          <div>
            <p className="text-sm font-medium" style={{ color: "#f97316" }}>
              {isRetrying ? "Retrying..." : `Retry ${retryState.attempt}/${retryState.maxAttempts} in ${timeRemaining}`}
            </p>
            {retryState.history.length > 0 && (
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                Last error: {retryState.history[retryState.history.length - 1].error}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-xs px-2 py-1 rounded-full tabular-nums"
            style={{
              backgroundColor: "rgba(249, 115, 22, 0.2)",
              color: "#f97316",
            }}
          >
            {isRetrying ? "Retrying" : timeRemaining}
          </span>
        </div>
      </div>
    </div>
  );
}

// Retry exhausted banner component
function RetryExhaustedBanner({
  retryState,
}: {
  retryState: RetryState;
}) {
  return (
    <div
      className="mt-3 ml-8 p-3 rounded-lg"
      style={{
        backgroundColor: "rgba(239, 68, 68, 0.1)",
        border: "1px solid rgba(239, 68, 68, 0.3)",
      }}
    >
      <div className="flex items-start gap-2">
        <svg
          className="w-4 h-4 shrink-0 mt-0.5"
          style={{ color: "var(--status-error)" }}
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
        <div className="min-w-0">
          <p className="text-sm font-medium" style={{ color: "var(--status-error)" }}>
            Max retries ({retryState.maxAttempts}) exhausted
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
            {retryState.history.length > 0 && (
              <>Last error: {retryState.history[retryState.history.length - 1].error}</>
            )}
          </p>
          {retryState.history.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                Retry history:
              </p>
              <ul className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                {retryState.history.map((attempt, idx) => (
                  <li key={idx}>
                    Attempt {attempt.attempt}: {attempt.error} (backoff: {attempt.backoffSeconds}s)
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Uncommitted files popover component
function UncommittedFilesPopover({
  files,
  isOpen,
  onClose,
  triggerRef,
}: {
  files: UncommittedFile[];
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen) return null;

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "M":
        return "Modified";
      case "A":
        return "Added";
      case "D":
        return "Deleted";
      case "??":
        return "Untracked";
      case "R":
        return "Renamed";
      case "C":
        return "Copied";
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "M":
        return "var(--status-warning)"; // Orange
      case "A":
        return "var(--status-success)"; // Green
      case "D":
        return "var(--status-error)"; // Red
      case "??":
        return "var(--text-muted)"; // Gray
      default:
        return "var(--text-secondary)";
    }
  };

  return (
    <div
      ref={popoverRef}
      className="absolute z-50 mt-2 right-0 w-80 max-h-64 overflow-auto rounded-lg shadow-lg border"
      style={{
        backgroundColor: "var(--panel)",
        borderColor: "var(--border)",
      }}
    >
      <div
        className="px-3 py-2 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Uncommitted Files
        </span>
      </div>
      <div className="py-1">
        {files.map((file, idx) => (
          <div
            key={idx}
            className="px-3 py-1.5 flex items-center gap-2 hover:bg-[var(--bg-hover)]"
          >
            <span
              className="text-xs font-mono w-16 shrink-0"
              style={{ color: getStatusColor(file.status) }}
            >
              {getStatusLabel(file.status)}
            </span>
            <span
              className="text-xs font-mono truncate"
              style={{ color: "var(--text-secondary)" }}
              title={file.path}
            >
              {file.path}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LaneStatusCard({
  lane,
  slug,
  initialStatus,
  initialStaged,
  initialAutonomy,
  initialLaunchMode,
  completedLanes = [],
  uncommittedStatus,
  onStatusChange,
  onDismissSuggestion,
  onPreviewChanges,
}: LaneStatusCardProps) {
  const [status, setStatus] = useState<LaneStatus>(initialStatus);
  const [staged] = useState(initialStaged);
  const [autonomy, setAutonomy] = useState<LaneAutonomy>(initialAutonomy);
  // Default launch mode based on autonomy setting: terminal when skip permissions enabled, cursor otherwise
  const defaultLaunchMode: LaunchMode = autonomy.dangerouslySkipPermissions ? "terminal" : "cursor";
  const [launchMode, setLaunchMode] = useState<LaunchMode>(initialLaunchMode ?? defaultLaunchMode);
  const [isPending, startTransition] = useTransition();
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchStatus, setLaunchStatus] = useState<"idle" | "copied" | "error" | "launched">("idle");
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitStatus, setCommitStatus] = useState<"idle" | "success" | "nochanges" | "error">("idle");
  const [showUncommittedPopover, setShowUncommittedPopover] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const uncommittedBadgeRef = useRef<HTMLButtonElement>(null);

  const isComplete = status === "complete";
  const config = STATUS_CONFIG[status];
  const hasUncommittedFiles = uncommittedStatus && uncommittedStatus.uncommittedCount > 0;
  const hasNewCommits = uncommittedStatus && uncommittedStatus.commitsSinceLaunch && uncommittedStatus.commitsSinceLaunch > 0;

  // Completion suggestion
  const suggestion = uncommittedStatus?.completionSuggestion;
  const showSuggestion = suggestion?.suggested && !suggestion?.dismissed && !isComplete;

  // Check if all dependencies are complete
  const dependenciesMet = lane.dependsOn.length === 0 ||
    lane.dependsOn.every(depId => completedLanes.includes(depId));
  const isBlocked = !dependenciesMet && !isComplete;
  const blockedByLanes = isBlocked
    ? lane.dependsOn.filter(depId => !completedLanes.includes(depId))
    : [];

  // Handle launch mode change
  const handleLaunchModeChange = useCallback(async (newMode: LaunchMode) => {
    setLaunchMode(newMode);

    // Persist to status.json
    try {
      await fetch(`/api/runs/${slug}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          laneId: lane.laneId,
          launchMode: newMode,
        }),
      });
    } catch (error) {
      console.error("Error saving launch mode:", error);
    }
  }, [slug, lane.laneId]);

  const handleLaunch = useCallback(async () => {
    setIsLaunching(true);
    setLaunchStatus("idle");

    try {
      const response = await fetch(`/api/runs/${slug}/launch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          laneId: lane.laneId,
          skipPermissions: autonomy.dangerouslySkipPermissions,
          launchMode: launchMode,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Launch API error:", errorData);
        throw new Error(errorData.error || "Failed to launch");
      }

      const data = await response.json();
      console.log("Launch response:", {
        success: data.success,
        hasPacket: !!data.packetContent,
        packetLength: data.packetContent?.length,
        launchMode: data.launchMode,
      });

      // Update local status to in_progress
      if (status === "pending") {
        setStatus("in_progress");
        onStatusChange?.(lane.laneId, "in_progress");
      }

      // Handle based on launch mode
      if (launchMode === "terminal") {
        // Terminal mode: Claude Code was spawned in iTerm2/Terminal
        setLaunchStatus("launched");
        setTimeout(() => setLaunchStatus("idle"), 3000);
      } else {
        // Cursor mode: copy packet to clipboard
        if (data.packetContent) {
          try {
            await navigator.clipboard.writeText(data.packetContent);
            setLaunchStatus("copied");
            console.log("Copied to clipboard successfully");
          } catch (clipboardError) {
            console.error("Clipboard error:", clipboardError);
            // Fallback: use execCommand
            const textarea = document.createElement("textarea");
            textarea.value = data.packetContent;
            textarea.style.position = "fixed";
            textarea.style.opacity = "0";
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand("copy");
            document.body.removeChild(textarea);
            setLaunchStatus("copied");
            console.log("Copied using fallback method");
          }
          setTimeout(() => setLaunchStatus("idle"), 3000);
        } else {
          console.warn("No packet content in response");
          setLaunchStatus("error");
          setTimeout(() => setLaunchStatus("idle"), 3000);
        }
      }
    } catch (error) {
      console.error("Launch error:", error);
      setLaunchStatus("error");
      setTimeout(() => setLaunchStatus("idle"), 3000);
    } finally {
      setIsLaunching(false);
    }
  }, [slug, lane.laneId, autonomy.dangerouslySkipPermissions, launchMode, status, onStatusChange]);

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
          // Notify parent of status change
          onStatusChange?.(lane.laneId, newStatus);
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

  const handleCommit = useCallback(async () => {
    setIsCommitting(true);
    setCommitStatus("idle");

    try {
      const response = await fetch(`/api/runs/${slug}/commit-lane`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ laneId: lane.laneId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to commit");
      }

      if (data.committed) {
        setCommitStatus("success");
        console.log("Committed:", data.commitHash, data.changedFiles);
      } else {
        setCommitStatus("nochanges");
      }

      setTimeout(() => setCommitStatus("idle"), 3000);
    } catch (error) {
      console.error("Commit error:", error);
      setCommitStatus("error");
      setTimeout(() => setCommitStatus("idle"), 3000);
    } finally {
      setIsCommitting(false);
    }
  }, [slug, lane.laneId]);

  const handleViewGitLog = useCallback(async () => {
    try {
      // Call API to open git log in terminal
      await fetch(`/api/runs/${slug}/git-log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          laneId: lane.laneId,
          worktreePath: lane.worktreePath,
          commitCount: uncommittedStatus?.commitsSinceLaunch || 10,
        }),
      });
    } catch (error) {
      console.error("Error opening git log:", error);
    }
  }, [slug, lane.laneId, lane.worktreePath, uncommittedStatus?.commitsSinceLaunch]);

  // Handle dismissing the completion suggestion
  const handleDismissSuggestion = useCallback(async () => {
    setIsDismissing(true);
    try {
      const response = await fetch(`/api/runs/${slug}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          laneId: lane.laneId,
          suggestionDismissed: true,
        }),
      });

      if (response.ok) {
        onDismissSuggestion?.(lane.laneId);
      } else {
        console.error("Failed to dismiss suggestion");
      }
    } catch (error) {
      console.error("Error dismissing suggestion:", error);
    } finally {
      setIsDismissing(false);
    }
  }, [slug, lane.laneId, onDismissSuggestion]);

  // Handle quick "Mark Complete" from suggestion banner
  const handleMarkComplete = useCallback(async () => {
    const newStatus: LaneStatus = "complete";

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
          onStatusChange?.(lane.laneId, newStatus);
        } else {
          console.error("Failed to mark lane as complete");
        }
      } catch (error) {
        console.error("Error marking lane as complete:", error);
      }
    });
  }, [slug, lane.laneId, onStatusChange]);

  // Handle resetting the lane to initial state
  const handleReset = useCallback(async () => {
    setIsResetting(true);
    try {
      const response = await fetch(`/api/runs/${slug}/reset-lane`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ laneId: lane.laneId }),
      });

      if (response.ok) {
        setStatus("pending");
        onStatusChange?.(lane.laneId, "pending");
        setShowResetConfirm(false);
      } else {
        const data = await response.json();
        console.error("Failed to reset lane:", data.error);
      }
    } catch (error) {
      console.error("Error resetting lane:", error);
    } finally {
      setIsResetting(false);
    }
  }, [slug, lane.laneId, onStatusChange]);

  // Show reset button for failed or complete lanes
  const canReset = status === "failed" || status === "complete" || status === "conflict";

  return (
    <div
      className="task-card"
      data-lane-id={lane.laneId}
      tabIndex={-1}
      style={{
        backgroundColor: config.bgColor,
        borderColor: config.borderColor,
        borderLeftWidth: "3px",
        borderLeftColor: config.color,
      }}
    >
      <div className="flex items-start justify-between w-full">
        <div className="flex items-start gap-3">
          {/* Completion Checkbox */}
          <button
            onClick={handleToggleComplete}
            disabled={isPending}
            className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
              isPending ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
            }`}
            style={{
              borderColor: isComplete ? "var(--status-success)" : "var(--border)",
              backgroundColor: isComplete ? "var(--status-success)" : "transparent",
            }}
            title={isComplete ? "Mark as incomplete" : "Mark as complete"}
          >
            {isComplete && (
              <svg className="w-3 h-3" style={{ color: "var(--bg)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium" style={{ color: "var(--text)" }}>
                {lane.laneId}
              </span>
              <span className="badge badge--idle">
                {lane.agent}
              </span>
              {staged && !isComplete && (
                <span className="badge badge--running">
                  staged
                </span>
              )}
              {/* Uncommitted files badge */}
              {hasUncommittedFiles && (
                <div className="relative">
                  <button
                    ref={uncommittedBadgeRef}
                    onClick={() => setShowUncommittedPopover(!showUncommittedPopover)}
                    className="badge cursor-pointer hover:opacity-80 transition-opacity"
                    style={{
                      backgroundColor: "rgba(249, 115, 22, 0.15)",
                      color: "#f97316",
                      borderColor: "rgba(249, 115, 22, 0.4)",
                    }}
                    title={`${uncommittedStatus!.uncommittedCount} uncommitted file${uncommittedStatus!.uncommittedCount === 1 ? "" : "s"} - click to view`}
                  >
                    {uncommittedStatus!.uncommittedCount} uncommitted file{uncommittedStatus!.uncommittedCount === 1 ? "" : "s"}
                  </button>
                  <UncommittedFilesPopover
                    files={uncommittedStatus!.uncommittedFiles}
                    isOpen={showUncommittedPopover}
                    onClose={() => setShowUncommittedPopover(false)}
                    triggerRef={uncommittedBadgeRef}
                  />
                </div>
              )}
              {/* New commits since launch badge */}
              {hasNewCommits && (
                <button
                  onClick={handleViewGitLog}
                  className="badge cursor-pointer hover:opacity-80 transition-opacity"
                  style={{
                    backgroundColor: "rgba(34, 197, 94, 0.15)",
                    color: "#22c55e",
                    borderColor: "rgba(34, 197, 94, 0.4)",
                  }}
                  title={`${uncommittedStatus!.commitsSinceLaunch} commit${uncommittedStatus!.commitsSinceLaunch === 1 ? "" : "s"} since launch - click to view git log`}
                >
                  +{uncommittedStatus!.commitsSinceLaunch} commit{uncommittedStatus!.commitsSinceLaunch === 1 ? "" : "s"}
                </button>
              )}
              {/* Push status badge */}
              {uncommittedStatus?.pushState && <PushStatusBadge pushState={uncommittedStatus.pushState} />}
              {/* Cost tracking badge */}
              {uncommittedStatus?.costTracking && <CostBadge costTracking={uncommittedStatus.costTracking} />}
            </div>
            <p className="mono small mt-1" style={{ color: "var(--muted)" }}>
              {lane.branch}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleLaunch}
            disabled={isLaunching || isComplete || isBlocked}
            className={`btn btn--primary btn--sm ${
              isLaunching ? "opacity-50 cursor-wait" : ""
            } ${isComplete || isBlocked ? "opacity-30 cursor-not-allowed" : ""}`}
            title={
              isComplete
                ? "Lane is complete"
                : isBlocked
                ? `Blocked by: ${blockedByLanes.join(", ")}`
                : launchMode === "cursor"
                ? "Open in Cursor & copy packet"
                : "Open in Terminal with Claude Code"
            }
          >
            {isLaunching ? (
              <>
                <svg className="w-3 h-3 spinner" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Launching...
              </>
            ) : launchStatus === "copied" ? (
              <>
                <svg className="w-3 h-3" style={{ color: "var(--status-success)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : launchStatus === "launched" ? (
              <>
                <svg className="w-3 h-3" style={{ color: "var(--status-success)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Launched!
              </>
            ) : launchStatus === "error" ? (
              <>
                <svg className="w-3 h-3" style={{ color: "var(--status-error)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Error
              </>
            ) : isBlocked ? (
              <>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Blocked
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Launch
              </>
            )}
          </button>
          {/* Commit Button - show when lane is in progress or staged */}
          {(status === "in_progress" || staged) && !isComplete && (
            <button
              onClick={handleCommit}
              disabled={isCommitting}
              className={`btn btn--sm ${
                commitStatus === "success" ? "btn--success" :
                commitStatus === "error" ? "btn--danger" :
                "btn--secondary"
              } ${isCommitting ? "opacity-50 cursor-wait" : ""}`}
              title="Commit uncommitted changes in worktree"
            >
              {isCommitting ? (
                <>
                  <svg className="w-3 h-3 spinner" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Committing...
                </>
              ) : commitStatus === "success" ? (
                <>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Committed!
                </>
              ) : commitStatus === "nochanges" ? (
                <>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  No Changes
                </>
              ) : commitStatus === "error" ? (
                <>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Error
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={2} fill="none" />
                  </svg>
                  Commit
                </>
              )}
            </button>
          )}
          {/* Preview Changes Button - show when lane has changes */}
          {hasUncommittedFiles && onPreviewChanges && (
            <button
              onClick={() => onPreviewChanges(lane.laneId)}
              className="btn btn--sm btn--secondary"
              title="Preview all changes in this lane"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Preview
            </button>
          )}
          {/* Reset Lane Button - show for failed or complete lanes */}
          {canReset && (
            <button
              onClick={() => setShowResetConfirm(true)}
              disabled={isResetting}
              className={`btn btn--sm btn--secondary ${isResetting ? "opacity-50 cursor-wait" : ""}`}
              title="Reset lane to initial state"
            >
              {isResetting ? (
                <>
                  <svg className="w-3 h-3 spinner" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Resetting...
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Reset
                </>
              )}
            </button>
          )}
          <span
            className="label"
            style={{ color: config.color }}
          >
            {config.label}
          </span>
        </div>
      </div>

      {lane.dependsOn.length > 0 && (
        <div className="mt-2 ml-8 small" style={{ color: "var(--muted)" }}>
          Depends on: {lane.dependsOn.join(", ")}
        </div>
      )}

      {/* Autonomy Toggle and Launch Mode */}
      <div className="mt-3 ml-8 flex items-center gap-4 flex-wrap">
        {/* Autonomy Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleAutonomy}
            disabled={isPending}
            className={`toggle ${autonomy.dangerouslySkipPermissions ? "active" : ""} ${isPending ? "opacity-50 cursor-not-allowed" : ""}`}
            role="switch"
            aria-checked={autonomy.dangerouslySkipPermissions}
            title={
              autonomy.dangerouslySkipPermissions
                ? "Disable skip permissions mode"
                : "Enable skip permissions mode"
            }
            style={{
              width: "32px",
              height: "18px",
            }}
          />
          <span className="small" style={{ color: "var(--muted)" }}>
            Skip permissions
            {autonomy.dangerouslySkipPermissions && (
              <span className="ml-1.5 font-medium" style={{ color: "var(--accent)" }}>
                (enabled)
              </span>
            )}
          </span>
        </div>

        {/* Launch Mode Selector */}
        <div className="flex items-center gap-2">
          <span className="small" style={{ color: "var(--muted)" }}>
            Launch:
          </span>
          <select
            value={launchMode}
            onChange={(e) => handleLaunchModeChange(e.target.value as LaunchMode)}
            disabled={isPending || isComplete}
            className="text-xs px-2 py-1 rounded border bg-transparent cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              borderColor: "var(--border)",
              color: "var(--text)",
              minWidth: "140px",
            }}
            title={
              launchMode === "cursor"
                ? "Open in Cursor IDE and copy packet to clipboard"
                : "Open iTerm2/Terminal with Claude Code (autonomous)"
            }
          >
            <option value="cursor">Cursor</option>
            <option value="terminal">Terminal (Claude Code)</option>
          </select>
        </div>
      </div>

      {/* Agent Progress (from LANE_STATUS.json) */}
      {uncommittedStatus?.agentStatus && status === "in_progress" && (
        <div className="mt-3 ml-8">
          {/* Current Step */}
          <div className="flex items-center gap-2 mb-2">
            <svg
              className="w-3 h-3 shrink-0"
              style={{ color: "var(--accent)" }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            <span className="text-xs font-medium" style={{ color: "var(--text)" }}>
              {uncommittedStatus.agentStatus.currentStep}
            </span>
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: "rgba(124, 58, 237, 0.15)",
                color: "var(--accent)",
              }}
            >
              {uncommittedStatus.agentStatus.phase}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="flex items-center gap-2">
            <div
              className="flex-1 h-1.5 rounded-full overflow-hidden"
              style={{ backgroundColor: "var(--border)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(100, Math.max(0, uncommittedStatus.agentStatus.progress))}%`,
                  backgroundColor: "var(--accent)",
                }}
              />
            </div>
            <span className="text-xs tabular-nums" style={{ color: "var(--muted)", minWidth: "32px" }}>
              {uncommittedStatus.agentStatus.progress}%
            </span>
          </div>

          {/* Blockers - show if any */}
          {uncommittedStatus.agentStatus.blockers.length > 0 && (
            <div className="mt-2 flex items-start gap-2">
              <svg
                className="w-3 h-3 shrink-0 mt-0.5"
                style={{ color: "var(--status-warning)" }}
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
              <div className="flex-1">
                <span className="text-xs font-medium" style={{ color: "var(--status-warning)" }}>
                  Blockers:
                </span>
                <ul className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                  {uncommittedStatus.agentStatus.blockers.map((blocker, idx) => (
                    <li key={idx} className="truncate" title={blocker}>
                      • {blocker}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Completion Suggestion Banner */}
      {showSuggestion && (
        <div
          className="mt-3 ml-8 p-3 rounded-lg flex items-center justify-between gap-3"
          style={{
            backgroundColor: "rgba(34, 197, 94, 0.1)",
            borderColor: "rgba(34, 197, 94, 0.3)",
            border: "1px solid rgba(34, 197, 94, 0.3)",
          }}
        >
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <svg
              className="w-4 h-4 shrink-0 mt-0.5"
              style={{ color: "#22c55e" }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="min-w-0">
              <p className="text-sm font-medium" style={{ color: "#22c55e" }}>
                This lane looks complete
              </p>
              <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-secondary)" }} title={suggestion?.reason}>
                {suggestion?.reason}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleMarkComplete}
              disabled={isPending}
              className="btn btn--sm"
              style={{
                backgroundColor: "#22c55e",
                color: "white",
                border: "none",
              }}
            >
              {isPending ? "..." : "Mark Complete"}
            </button>
            <button
              onClick={handleDismissSuggestion}
              disabled={isDismissing}
              className="btn btn--sm btn--ghost"
              title="Dismiss suggestion"
              style={{ padding: "4px 8px" }}
            >
              {isDismissing ? (
                <svg className="w-3 h-3 spinner" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Retry Status Banner */}
      {uncommittedStatus?.retryState && uncommittedStatus.retryState.status === "waiting" && (
        <RetryCountdown retryState={uncommittedStatus.retryState} />
      )}

      {/* Retry Exhausted Banner */}
      {uncommittedStatus?.retryState && uncommittedStatus.retryState.status === "exhausted" && (
        <RetryExhaustedBanner retryState={uncommittedStatus.retryState} />
      )}

      {/* Reset Confirmation Dialog */}
      {showResetConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
        >
          <div
            className="p-6 rounded-lg shadow-xl max-w-md w-full mx-4"
            style={{
              backgroundColor: "var(--panel)",
              border: "1px solid var(--border)",
            }}
          >
            <div className="flex items-start gap-3 mb-4">
              <svg
                className="w-6 h-6 shrink-0 mt-0.5"
                style={{ color: "var(--status-warning)" }}
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
              <div>
                <h3 className="text-lg font-semibold" style={{ color: "var(--text)" }}>
                  Reset Lane?
                </h3>
                <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                  This will reset <strong>{lane.laneId}</strong> to its initial state:
                </p>
                <ul className="text-sm mt-2 ml-4 list-disc" style={{ color: "var(--text-secondary)" }}>
                  <li>Discard all uncommitted changes</li>
                  <li>Remove all untracked files</li>
                  <li>Clear LANE_STATUS.json</li>
                  <li>Reset status to &quot;pending&quot;</li>
                </ul>
                <p className="text-sm mt-2 font-medium" style={{ color: "var(--status-warning)" }}>
                  This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowResetConfirm(false)}
                disabled={isResetting}
                className="btn btn--secondary btn--sm"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                disabled={isResetting}
                className={`btn btn--sm ${isResetting ? "opacity-50 cursor-wait" : ""}`}
                style={{
                  backgroundColor: "var(--status-error)",
                  color: "white",
                  border: "none",
                }}
              >
                {isResetting ? (
                  <>
                    <svg className="w-3 h-3 spinner" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Resetting...
                  </>
                ) : (
                  "Reset Lane"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Cost display badge component
function CostBadge({ costTracking }: { costTracking: CostTracking }) {
  // Don't show if no tokens have been used
  if (costTracking.tokenUsage.totalTokens === 0) {
    return null;
  }

  // Format cost display
  const formatCost = (cost: number): string => {
    if (cost < 0.001) {
      return "<$0.001";
    } else if (cost < 0.01) {
      return `$${cost.toFixed(3)}`;
    } else if (cost < 1) {
      return `$${cost.toFixed(2)}`;
    } else {
      return `$${cost.toFixed(2)}`;
    }
  };

  // Format token count
  const formatTokens = (count: number): string => {
    if (count >= 1_000_000) {
      return `${(count / 1_000_000).toFixed(1)}M`;
    } else if (count >= 1_000) {
      return `${(count / 1_000).toFixed(1)}K`;
    }
    return count.toString();
  };

  const tokenDetails = [
    `Input: ${formatTokens(costTracking.tokenUsage.inputTokens)}`,
    `Output: ${formatTokens(costTracking.tokenUsage.outputTokens)}`,
  ];
  if (costTracking.tokenUsage.cacheReadTokens > 0) {
    tokenDetails.push(`Cache read: ${formatTokens(costTracking.tokenUsage.cacheReadTokens)}`);
  }
  if (costTracking.tokenUsage.cacheWriteTokens > 0) {
    tokenDetails.push(`Cache write: ${formatTokens(costTracking.tokenUsage.cacheWriteTokens)}`);
  }
  if (costTracking.model) {
    tokenDetails.push(`Model: ${costTracking.model}`);
  }

  return (
    <span
      className="badge flex items-center gap-1"
      style={{
        backgroundColor: "rgba(168, 85, 247, 0.15)", // Purple for cost
        color: "#a855f7",
        borderColor: "rgba(168, 85, 247, 0.4)",
      }}
      title={`${tokenDetails.join("\n")}\nTotal: ${formatTokens(costTracking.tokenUsage.totalTokens)} tokens${costTracking.isEstimate ? " (estimated)" : ""}`}
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {formatCost(costTracking.estimatedCostUsd)}
    </span>
  );
}

// Push status badge component
function PushStatusBadge({ pushState }: { pushState: PushState }) {
  const getStatusConfig = () => {
    switch (pushState.status) {
      case "pushing":
        return {
          color: "#06b6d4", // cyan
          bgColor: "rgba(6, 182, 212, 0.15)",
          borderColor: "rgba(6, 182, 212, 0.4)",
          label: "Pushing...",
          icon: (
            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ),
        };
      case "success":
        return {
          color: "#22c55e", // green
          bgColor: "rgba(34, 197, 94, 0.15)",
          borderColor: "rgba(34, 197, 94, 0.4)",
          label: "Pushed",
          icon: (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ),
        };
      case "failed":
        return {
          color: "#ef4444", // red
          bgColor: "rgba(239, 68, 68, 0.15)",
          borderColor: "rgba(239, 68, 68, 0.4)",
          label: "Push Failed",
          icon: (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ),
        };
      default:
        return null;
    }
  };

  const config = getStatusConfig();
  if (!config || pushState.status === "idle") return null;

  return (
    <span
      className="badge flex items-center gap-1"
      style={{
        backgroundColor: config.bgColor,
        color: config.color,
        borderColor: config.borderColor,
      }}
      title={pushState.error || (pushState.lastPushedAt ? `Pushed at ${new Date(pushState.lastPushedAt).toLocaleString()}` : config.label)}
    >
      {config.icon}
      {config.label}
    </span>
  );
}
