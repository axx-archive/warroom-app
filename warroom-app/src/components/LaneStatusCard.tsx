"use client";

import { useState, useTransition, useCallback, useRef, useEffect } from "react";
import { Lane, LaneStatus, LaneAutonomy } from "@/lib/plan-schema";
import { LaneUncommittedStatus, UncommittedFile } from "@/hooks/useStatusPolling";

interface LaneStatusCardProps {
  lane: Lane;
  slug: string;
  initialStatus: LaneStatus;
  initialStaged: boolean;
  initialAutonomy: LaneAutonomy;
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
};

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
  completedLanes = [],
  uncommittedStatus,
  onStatusChange,
  onDismissSuggestion,
  onPreviewChanges,
}: LaneStatusCardProps) {
  const [status, setStatus] = useState<LaneStatus>(initialStatus);
  const [staged] = useState(initialStaged);
  const [autonomy, setAutonomy] = useState<LaneAutonomy>(initialAutonomy);
  const [isPending, startTransition] = useTransition();
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchStatus, setLaunchStatus] = useState<"idle" | "copied" | "error">("idle");
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitStatus, setCommitStatus] = useState<"idle" | "success" | "nochanges" | "error">("idle");
  const [showUncommittedPopover, setShowUncommittedPopover] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
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
        packetLength: data.packetContent?.length
      });

      // Update local status to in_progress
      if (status === "pending") {
        setStatus("in_progress");
        onStatusChange?.(lane.laneId, "in_progress");
      }

      // Copy packet content to clipboard
      if (data.packetContent) {
        try {
          await navigator.clipboard.writeText(data.packetContent);
          setLaunchStatus("copied");
          console.log("Copied to clipboard successfully");
        } catch (clipboardError) {
          console.error("Clipboard error:", clipboardError);
          // Fallback: open a prompt with the content
          // This ensures user can still get the content even if clipboard fails
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
        // Reset status after 3 seconds
        setTimeout(() => setLaunchStatus("idle"), 3000);
      } else {
        console.warn("No packet content in response");
        setLaunchStatus("error");
        setTimeout(() => setLaunchStatus("idle"), 3000);
      }
    } catch (error) {
      console.error("Launch error:", error);
      setLaunchStatus("error");
      setTimeout(() => setLaunchStatus("idle"), 3000);
    } finally {
      setIsLaunching(false);
    }
  }, [slug, lane.laneId, autonomy.dangerouslySkipPermissions]);

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

  return (
    <div
      className="task-card"
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
                : "Open in Cursor & copy packet"
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

      {/* Autonomy Toggle */}
      <div className="mt-3 ml-8 flex items-center gap-2">
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
    </div>
  );
}
