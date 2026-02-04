"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ActivityEvent } from "@/hooks/useActivityFeed";

interface ActivityFeedProps {
  events: ActivityEvent[];
  laneIds: string[];
  filter: string | null;
  onFilterChange: (laneId: string | null) => void;
  eventCount: number;
}

// Format timestamp for display
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

// Get icon for event type
function getEventIcon(type: ActivityEvent["type"]) {
  switch (type) {
    case "file-created":
      return (
        <svg className="w-3.5 h-3.5 text-[var(--status-success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      );
    case "file-modified":
      return (
        <svg className="w-3.5 h-3.5 text-[var(--status-warning)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      );
    case "file-deleted":
      return (
        <svg className="w-3.5 h-3.5 text-[var(--status-danger)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      );
    case "commit":
      return (
        <svg className="w-3.5 h-3.5 text-[var(--cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      );
    case "status-change":
      return (
        <svg className="w-3.5 h-3.5 text-[var(--magenta)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      );
  }
}

// Get status color
function getStatusColor(status: string | undefined): string {
  switch (status) {
    case "complete":
      return "var(--status-success)";
    case "in_progress":
      return "var(--cyan)";
    case "failed":
      return "var(--status-danger)";
    case "pending":
    default:
      return "var(--text-ghost)";
  }
}

// Format event description
function getEventDescription(event: ActivityEvent): React.ReactNode {
  switch (event.type) {
    case "file-created":
      return (
        <>
          Created <span className="font-mono text-[var(--text-secondary)]">{event.path}</span>
        </>
      );
    case "file-modified":
      return (
        <>
          Modified <span className="font-mono text-[var(--text-secondary)]">{event.path}</span>
        </>
      );
    case "file-deleted":
      return (
        <>
          Deleted <span className="font-mono text-[var(--text-secondary)]">{event.path}</span>
        </>
      );
    case "commit":
      return (
        <>
          Committed: <span className="text-[var(--text-secondary)]">{event.message || "No message"}</span>
        </>
      );
    case "status-change":
      return (
        <>
          Status changed from{" "}
          <span style={{ color: getStatusColor(event.previousStatus) }}>{event.previousStatus}</span>
          {" → "}
          <span style={{ color: getStatusColor(event.newStatus) }}>{event.newStatus}</span>
        </>
      );
  }
}

export function ActivityFeed({
  events,
  laneIds,
  filter,
  onFilterChange,
  eventCount,
}: ActivityFeedProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const prevEventCountRef = useRef(0);

  // Auto-scroll to newest events (unless paused)
  useEffect(() => {
    // Only scroll when new events are added
    if (events.length > prevEventCountRef.current && feedRef.current && !isPaused) {
      feedRef.current.scrollTop = 0; // Events are prepended, so scroll to top
    }
    prevEventCountRef.current = events.length;
  }, [events.length, isPaused]);

  // Pause auto-scroll on hover
  const handleMouseEnter = useCallback(() => {
    setIsPaused(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsPaused(false);
  }, []);

  return (
    <div className="panel-bracketed">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer select-none hover:bg-[rgba(255,255,255,0.02)]"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded bg-[rgba(168,85,247,0.15)] border border-[rgba(168,85,247,0.3)] flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-[var(--magenta)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-[var(--text-primary)]">
            Activity Feed
          </h3>
          <span className="text-xs font-mono text-[var(--text-ghost)]">
            ({eventCount} events)
          </span>
          {isPaused && !isCollapsed && (
            <span className="text-xs text-[var(--text-ghost)] italic">
              (auto-scroll paused)
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Filter dropdown - stop propagation to prevent collapse toggle */}
          <div onClick={(e) => e.stopPropagation()}>
            <select
              value={filter || ""}
              onChange={(e) => onFilterChange(e.target.value || null)}
              className="text-xs font-mono bg-[var(--bg-secondary)] border border-[var(--border-dim)] rounded px-2 py-1 text-[var(--text-secondary)] focus:border-[var(--cyan-dim)] focus:outline-none"
              title="Filter by lane"
            >
              <option value="">All lanes</option>
              {laneIds.map((laneId) => (
                <option key={laneId} value={laneId}>
                  {laneId}
                </option>
              ))}
            </select>
          </div>

          {/* Collapse toggle icon */}
          <svg
            className={`w-4 h-4 text-[var(--text-ghost)] transition-transform duration-200 ${
              isCollapsed ? "" : "rotate-180"
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Feed content */}
      {!isCollapsed && (
        <div
          ref={feedRef}
          className="max-h-64 overflow-y-auto border-t border-[var(--border-dim)]"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {events.length === 0 ? (
            <div className="p-4 text-center text-sm text-[var(--text-ghost)]">
              No activity yet. Events will appear here as lanes change.
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-dim)]">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-3 p-3 hover:bg-[rgba(255,255,255,0.02)]"
                >
                  {/* Icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    {getEventIcon(event.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-[rgba(6,182,212,0.1)] text-[var(--cyan)] border border-[rgba(6,182,212,0.2)]">
                        {event.laneId}
                      </span>
                      <span className="text-xs font-mono text-[var(--text-ghost)]">
                        {formatTimestamp(event.timestamp)}
                      </span>
                    </div>
                    <div className="text-sm text-[var(--text-primary)] break-words">
                      {getEventDescription(event)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
