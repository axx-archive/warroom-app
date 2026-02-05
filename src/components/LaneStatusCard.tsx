"use client";

import { useState, useTransition, useCallback, useRef, useEffect } from "react";
import { Lane, LaneStatus, LaneAutonomy, LaunchMode, RetryState, PushState, CostTracking } from "@/lib/plan-schema";
import { LaneUncommittedStatus, UncommittedFile } from "@/hooks/useStatusPolling";
import { DropdownMenu, OverflowMenuTrigger, DropdownMenuGroup } from "./DropdownMenu";

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

const STATUS_CONFIG: Record<LaneStatus, { color: string; bgColor: string; borderColor: string; label: string; cardClass: string }> = {
  pending: {
    color: "var(--text-ghost)",
    bgColor: "var(--bg-elevated)",
    borderColor: "var(--border)",
    label: "Pending",
    cardClass: "lane-card--pending",
  },
  in_progress: {
    color: "var(--accent)",
    bgColor: "var(--accent-subtle)",
    borderColor: "var(--accent-border)",
    label: "Running",
    cardClass: "lane-card--in-progress",
  },
  complete: {
    color: "var(--success)",
    bgColor: "var(--bg-elevated)",
    borderColor: "var(--border)",
    label: "Complete",
    cardClass: "lane-card--complete",
  },
  failed: {
    color: "var(--error)",
    bgColor: "var(--error-dim)",
    borderColor: "rgba(239, 68, 68, 0.3)",
    label: "Failed",
    cardClass: "lane-card--failed",
  },
  conflict: {
    color: "var(--warning)",
    bgColor: "var(--warning-dim)",
    borderColor: "rgba(245, 158, 11, 0.3)",
    label: "Conflict",
    cardClass: "lane-card--conflict",
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
          style={{ color: "var(--error)" }}
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
          <p className="text-sm font-medium" style={{ color: "var(--error)" }}>
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
        return "var(--warning)"; // Orange
      case "A":
        return "var(--success)"; // Green
      case "D":
        return "var(--error)"; // Red
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
        <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
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
  const [launchStatus, setLaunchStatus] = useState<"idle" | "opened" | "error" | "launched">("idle");
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitStatus, setCommitStatus] = useState<"idle" | "success" | "nochanges" | "error">("idle");
  const [showUncommittedPopover, setShowUncommittedPopover] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [settingsExpanded, setSettingsExpanded] = useState(false);
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
        // Terminal mode: Claude Code was spawned with /warroom-run
        setLaunchStatus("launched");
        setTimeout(() => setLaunchStatus("idle"), 3000);
      } else {
        // Cursor mode: Cursor was opened, user runs /warroom-run manually
        setLaunchStatus("opened");
        setTimeout(() => setLaunchStatus("idle"), 3000);
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

  // Build overflow menu items
  const overflowMenuGroups: DropdownMenuGroup[] = [];

  // View group
  const viewItems = [];
  if (hasUncommittedFiles && onPreviewChanges) {
    viewItems.push({
      id: "preview",
      label: "Preview Changes",
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ),
      onClick: () => onPreviewChanges(lane.laneId),
    });
  }
  if (viewItems.length > 0) {
    overflowMenuGroups.push({ items: viewItems });
  }

  // Actions group
  const actionItems = [];
  if (canReset) {
    actionItems.push({
      id: "reset",
      label: "Reset Lane",
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
      onClick: () => setShowResetConfirm(true),
      disabled: isResetting,
      danger: true,
    });
  }
  if (actionItems.length > 0) {
    overflowMenuGroups.push({ items: actionItems });
  }

  return (
    <div
      className={`lane-card lane-card--compact ${config.cardClass}`}
      data-lane-id={lane.laneId}
      tabIndex={-1}
      style={{
        "--lane-color": config.color,
      } as React.CSSProperties}
    >
      {/* Row 1: Checkbox + Lane ID + Agent + Status */}
      <div className="flex items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-3 min-w-0 overflow-hidden">
          {/* Completion Checkbox - refined */}
          <button
            onClick={handleToggleComplete}
            disabled={isPending}
            className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all duration-150 flex-shrink-0 ${
              isPending ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-[var(--accent-border)]"
            }`}
            style={{
              borderColor: isComplete ? "var(--success)" : "var(--border)",
              backgroundColor: isComplete ? "var(--success)" : "transparent",
              boxShadow: isComplete ? "0 0 8px rgba(16, 185, 129, 0.4)" : "none",
            }}
            title={isComplete ? "Mark as incomplete" : "Mark as complete"}
          >
            {isComplete && (
              <svg className="w-3 h-3" style={{ color: "var(--bg)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>

          {/* Lane ID - primary */}
          <span className="font-semibold text-sm text-[var(--text)] truncate">
            {lane.laneId}
          </span>

          {/* Agent badge - refined */}
          <span className="badge badge--muted flex-shrink-0">
            {lane.agent}
          </span>

          {/* Auto mode indicator - inline */}
          {autonomy.dangerouslySkipPermissions && (
            <span className="badge badge--accent flex-shrink-0">
              <span className="status-dot status-dot--sm" style={{ background: "var(--accent)" }} />
              Auto
            </span>
          )}

          {/* Dependencies - inline, smaller - hidden on overflow */}
          {lane.dependsOn.length > 0 && (
            <span className="text-caption text-[var(--text-ghost)] truncate flex-shrink hidden sm:inline" title={`Depends on: ${lane.dependsOn.join(", ")}`}>
              → {lane.dependsOn.join(", ")}
            </span>
          )}
        </div>

        {/* Right: Status + Actions */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Status badge */}
          <span
            className="badge"
            style={{
              color: config.color,
              backgroundColor: status === "in_progress" ? "var(--accent-subtle)" : "transparent",
              borderColor: status === "in_progress" ? "var(--accent-border)" : "transparent",
            }}
          >
            {status === "in_progress" && (
              <span className="badge__dot animate-status-pulse" style={{ background: config.color }} />
            )}
            {config.label}
          </span>

          {/* Launch button - clean, prominent */}
          {!isComplete && (
            <button
              onClick={handleLaunch}
              disabled={isLaunching || isBlocked}
              className={`btn btn--sm transition-all duration-150 ${
                isBlocked
                  ? "btn--ghost opacity-40 cursor-not-allowed"
                  : launchStatus === "opened" || launchStatus === "launched"
                  ? "btn--success"
                  : launchStatus === "error"
                  ? "btn--danger"
                  : "btn--primary"
              }`}
              title={isBlocked ? `Blocked by: ${blockedByLanes.join(", ")}` : launchMode === "cursor" ? "Open in Cursor" : "Open in Terminal"}
            >
              {isLaunching ? (
                <svg className="w-3.5 h-3.5 spinner" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : launchStatus === "opened" || launchStatus === "launched" ? (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : launchStatus === "error" ? (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  </svg>
                  Launch
                </>
              )}
            </button>
          )}

          {/* Commit - subtle secondary action */}
          {(status === "in_progress" || staged) && !isComplete && (
            <button
              onClick={handleCommit}
              disabled={isCommitting}
              className={`btn btn--ghost btn--sm transition-all duration-150 ${
                commitStatus === "success" ? "!text-[var(--success)] !border-[var(--success)]" :
                commitStatus === "error" ? "!text-[var(--error)] !border-[var(--error)]" : ""
              }`}
              title="Commit changes"
            >
              {isCommitting ? (
                <svg className="w-3.5 h-3.5 spinner" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Commit
                </>
              )}
            </button>
          )}

          {/* Overflow menu */}
          {overflowMenuGroups.length > 0 && (
            <DropdownMenu
              trigger={<OverflowMenuTrigger />}
              groups={overflowMenuGroups}
            />
          )}
        </div>
      </div>

      {/* Row 2: Branch + Badges */}
      <div className="flex items-center gap-3 mt-1 pl-8 min-w-0 overflow-hidden">
        {/* Branch path */}
        <code className="text-caption font-mono text-[var(--text-ghost)] truncate min-w-0 flex-shrink" title={lane.branch}>
          {lane.branch}
        </code>

        {/* Badges cluster */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasUncommittedFiles && (
            <div className="relative">
              <button
                ref={uncommittedBadgeRef}
                onClick={() => setShowUncommittedPopover(!showUncommittedPopover)}
                className="badge badge--warning cursor-pointer hover:opacity-80 transition-opacity"
                title={`${uncommittedStatus!.uncommittedCount} uncommitted`}
              >
                {uncommittedStatus!.uncommittedCount} uncommitted
              </button>
              <UncommittedFilesPopover
                files={uncommittedStatus!.uncommittedFiles}
                isOpen={showUncommittedPopover}
                onClose={() => setShowUncommittedPopover(false)}
                triggerRef={uncommittedBadgeRef}
              />
            </div>
          )}
          {hasNewCommits && (
            <button
              onClick={handleViewGitLog}
              className="badge badge--success cursor-pointer hover:opacity-80 transition-opacity"
              title={`${uncommittedStatus!.commitsSinceLaunch} commits since launch`}
            >
              +{uncommittedStatus!.commitsSinceLaunch}
            </button>
          )}
          {staged && !isComplete && (
            <span className="badge badge--accent">
              staged
            </span>
          )}
          {uncommittedStatus?.pushState && <PushStatusBadge pushState={uncommittedStatus.pushState} />}
          {uncommittedStatus?.costTracking && <CostBadge costTracking={uncommittedStatus.costTracking} />}

          {/* Settings toggle */}
          <button
            onClick={() => setSettingsExpanded(!settingsExpanded)}
            className={`lane-settings-toggle ${settingsExpanded ? "lane-settings-toggle--expanded" : ""}`}
            type="button"
          >
            <svg
              className="lane-settings-toggle__icon w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* Settings Panel - refined */}
      {settingsExpanded && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mt-3 ml-8 pt-3 border-t border-[var(--border)]">
          {/* Autonomy Toggle */}
          <label className="flex items-center gap-2 cursor-pointer flex-shrink-0 group">
            <button
              onClick={handleToggleAutonomy}
              disabled={isPending}
              className={`toggle ${autonomy.dangerouslySkipPermissions ? "toggle--active" : ""} ${
                isPending ? "opacity-50 cursor-not-allowed" : ""
              }`}
              role="switch"
              aria-checked={autonomy.dangerouslySkipPermissions}
            />
            <span className="text-caption text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition-colors">
              Skip permissions
            </span>
          </label>

          {/* Launch Mode */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-caption text-[var(--text-muted)]">Launch mode:</span>
            <select
              value={launchMode}
              onChange={(e) => handleLaunchModeChange(e.target.value as LaunchMode)}
              disabled={isPending || isComplete}
              className="input input--sm text-caption cursor-pointer disabled:opacity-50"
              style={{ minWidth: "90px", padding: "4px 8px" }}
            >
              <option value="cursor">Cursor</option>
              <option value="terminal">Terminal</option>
            </select>
          </div>
        </div>
      )}

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
                style={{ color: "var(--warning)" }}
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
                <span className="text-xs font-medium" style={{ color: "var(--warning)" }}>
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
              className="btn btn--sm btn--success"
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
        <div className="modal-backdrop" onClick={() => setShowResetConfirm(false)}>
          <div
            className="modal tech-corners max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-body">
              <div className="flex items-start gap-3">
                <svg
                  className="w-6 h-6 shrink-0 mt-0.5"
                  style={{ color: "var(--warning)" }}
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
                  <h3 className="text-heading" style={{ color: "var(--text)" }}>
                    Reset Lane?
                  </h3>
                  <p className="text-body mt-1" style={{ color: "var(--text-secondary)" }}>
                    This will reset <strong>{lane.laneId}</strong> to its initial state:
                  </p>
                  <ul className="text-body mt-2 ml-4 list-disc" style={{ color: "var(--text-secondary)" }}>
                    <li>Discard all uncommitted changes</li>
                    <li>Remove all untracked files</li>
                    <li>Clear LANE_STATUS.json</li>
                    <li>Reset status to &quot;pending&quot;</li>
                  </ul>
                  <p className="text-body mt-2 font-medium" style={{ color: "var(--warning)" }}>
                    This action cannot be undone.
                  </p>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                onClick={() => setShowResetConfirm(false)}
                disabled={isResetting}
                className="btn btn--ghost"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                disabled={isResetting}
                className="btn btn--danger"
              >
                {isResetting ? (
                  <>
                    <span className="spinner" style={{ width: 14, height: 14 }} />
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
