"use client";

import { useState, useEffect, useCallback } from "react";
import { HistoryEvent, HistoryEventType } from "@/lib/plan-schema";

interface HistoryTabProps {
  slug: string;
  laneIds: string[];
}

// All available event types for filtering
const EVENT_TYPE_OPTIONS: { value: HistoryEventType; label: string }[] = [
  { value: "lane_launched", label: "Lane Launched" },
  { value: "lane_status_change", label: "Status Change" },
  { value: "commit", label: "Commit" },
  { value: "merge_started", label: "Merge Started" },
  { value: "merge_lane_complete", label: "Merge Lane Complete" },
  { value: "merge_complete", label: "Merge Complete" },
  { value: "merge_conflict", label: "Merge Conflict" },
  { value: "merge_failed", label: "Merge Failed" },
  { value: "push_started", label: "Push Started" },
  { value: "push_complete", label: "Push Complete" },
  { value: "push_failed", label: "Push Failed" },
  { value: "error", label: "Error" },
  { value: "retry_scheduled", label: "Retry Scheduled" },
  { value: "retry_started", label: "Retry Started" },
  { value: "mission_started", label: "Mission Started" },
  { value: "mission_stopped", label: "Mission Stopped" },
  { value: "mission_complete", label: "Mission Complete" },
  { value: "lane_reset", label: "Lane Reset" },
  { value: "lane_added", label: "Lane Added" },
];

// Format timestamp for display
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

// Get icon and color for event type
function getEventIcon(type: HistoryEventType): { icon: React.ReactNode; color: string } {
  switch (type) {
    case "lane_launched":
      return {
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        color: "var(--cyan)",
      };
    case "lane_status_change":
      return {
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        ),
        color: "var(--magenta)",
      };
    case "commit":
      return {
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
        ),
        color: "var(--status-success)",
      };
    case "merge_started":
    case "merge_lane_complete":
    case "merge_complete":
      return {
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
          </svg>
        ),
        color: type === "merge_complete" ? "var(--status-success)" : "var(--cyan)",
      };
    case "merge_conflict":
    case "merge_failed":
      return {
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        ),
        color: "var(--status-danger)",
      };
    case "push_started":
    case "push_complete":
      return {
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        ),
        color: type === "push_complete" ? "var(--status-success)" : "var(--cyan)",
      };
    case "push_failed":
      return {
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        ),
        color: "var(--status-danger)",
      };
    case "error":
      return {
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        color: "var(--status-danger)",
      };
    case "retry_scheduled":
    case "retry_started":
      return {
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        ),
        color: "var(--status-warning)",
      };
    case "mission_started":
    case "mission_stopped":
    case "mission_complete":
      return {
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        ),
        color: type === "mission_complete" ? "var(--status-success)" : type === "mission_stopped" ? "var(--status-warning)" : "var(--cyan)",
      };
    case "lane_reset":
      return {
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        ),
        color: "var(--status-warning)",
      };
    case "lane_added":
      return {
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        ),
        color: "var(--status-success)",
      };
    default:
      return {
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        color: "var(--text-ghost)",
      };
  }
}

export function HistoryTab({ slug, laneIds }: HistoryTabProps) {
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const limit = 50;

  // Filter state
  const [selectedEventTypes, setSelectedEventTypes] = useState<HistoryEventType[]>([]);
  const [selectedLaneId, setSelectedLaneId] = useState<string | null>(null);

  // Fetch history events
  const fetchHistory = useCallback(async (append: boolean = false) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("offset", String(append ? offset : 0));

      if (selectedEventTypes.length > 0) {
        params.set("eventTypes", selectedEventTypes.join(","));
      }
      if (selectedLaneId) {
        params.set("laneIds", selectedLaneId);
      }

      const response = await fetch(`/api/runs/${slug}/history?${params}`);
      const data = await response.json();

      if (data.success) {
        if (append) {
          setEvents((prev) => [...prev, ...data.events]);
        } else {
          setEvents(data.events);
        }
        setTotal(data.total);
        setHasMore(data.hasMore);
        setOffset(append ? offset + data.events.length : data.events.length);
      } else {
        setError(data.error || "Failed to load history");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  }, [slug, selectedEventTypes, selectedLaneId, offset]);

  // Initial fetch and refetch when filters change
  useEffect(() => {
    setOffset(0);
    fetchHistory(false);
  }, [slug, selectedEventTypes, selectedLaneId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Export history as JSON
  const handleExport = useCallback(() => {
    window.open(`/api/runs/${slug}/history?format=export`, "_blank");
  }, [slug]);

  // Toggle event type filter
  const toggleEventType = useCallback((type: HistoryEventType) => {
    setSelectedEventTypes((prev) =>
      prev.includes(type)
        ? prev.filter((t) => t !== type)
        : [...prev, type]
    );
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSelectedEventTypes([]);
    setSelectedLaneId(null);
  }, []);

  return (
    <div className="panel-bracketed">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border-dim)]">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded bg-[rgba(6,182,212,0.15)] border border-[rgba(6,182,212,0.3)] flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-[var(--cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-[var(--text-primary)]">
            History
          </h3>
          <span className="text-xs font-mono text-[var(--text-ghost)]">
            ({total} events)
          </span>
        </div>

        <button
          onClick={handleExport}
          className="btn btn-sm btn-ghost"
          title="Export as JSON"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export
        </button>
      </div>

      {/* Filters */}
      <div className="p-4 border-b border-[var(--border-dim)] space-y-3">
        {/* Event type filters */}
        <div className="flex flex-wrap gap-2">
          {EVENT_TYPE_OPTIONS.map((option) => {
            const isSelected = selectedEventTypes.includes(option.value);
            return (
              <button
                key={option.value}
                onClick={() => toggleEventType(option.value)}
                className={`px-2 py-1 text-xs font-mono rounded border transition-colors ${
                  isSelected
                    ? "bg-[rgba(6,182,212,0.15)] border-[rgba(6,182,212,0.3)] text-[var(--cyan)]"
                    : "bg-[var(--bg-tertiary)] border-[var(--border-dim)] text-[var(--text-ghost)] hover:text-[var(--text-secondary)]"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {/* Lane filter and clear */}
        <div className="flex items-center gap-3">
          <select
            value={selectedLaneId || ""}
            onChange={(e) => setSelectedLaneId(e.target.value || null)}
            className="text-xs font-mono bg-[var(--bg-secondary)] border border-[var(--border-dim)] rounded px-2 py-1 text-[var(--text-secondary)] focus:border-[var(--cyan-dim)] focus:outline-none"
          >
            <option value="">All lanes</option>
            {laneIds.map((laneId) => (
              <option key={laneId} value={laneId}>
                {laneId}
              </option>
            ))}
          </select>

          {(selectedEventTypes.length > 0 || selectedLaneId) && (
            <button
              onClick={clearFilters}
              className="text-xs text-[var(--text-ghost)] hover:text-[var(--text-secondary)] underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Events list */}
      <div className="max-h-[500px] overflow-y-auto">
        {error ? (
          <div className="p-4 text-center text-sm text-[var(--status-danger)]">
            {error}
          </div>
        ) : events.length === 0 ? (
          <div className="p-4 text-center text-sm text-[var(--text-ghost)]">
            {loading ? "Loading history..." : "No events found."}
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-dim)]">
            {events.map((event) => {
              const { icon, color } = getEventIcon(event.type);
              return (
                <div
                  key={event.id}
                  className="flex items-start gap-3 p-3 hover:bg-[rgba(255,255,255,0.02)]"
                >
                  {/* Icon */}
                  <div
                    className="flex-shrink-0 mt-0.5"
                    style={{ color }}
                  >
                    {icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {event.laneId && (
                        <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-[rgba(6,182,212,0.1)] text-[var(--cyan)] border border-[rgba(6,182,212,0.2)]">
                          {event.laneId}
                        </span>
                      )}
                      <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-ghost)]">
                        {event.type.replace(/_/g, " ")}
                      </span>
                      <span className="text-xs font-mono text-[var(--text-ghost)]">
                        {formatTimestamp(event.timestamp)}
                      </span>
                    </div>
                    <div className="text-sm text-[var(--text-primary)] break-words">
                      {event.message}
                    </div>
                    {/* Show details for specific event types */}
                    {"details" in event && event.details && (
                      <div className="mt-1 text-xs text-[var(--text-ghost)] font-mono">
                        {JSON.stringify(event.details, null, 2).slice(0, 200)}
                        {JSON.stringify(event.details).length > 200 && "..."}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Load more button */}
        {hasMore && !loading && (
          <div className="p-3 border-t border-[var(--border-dim)]">
            <button
              onClick={() => fetchHistory(true)}
              className="w-full btn btn-sm btn-ghost"
            >
              Load more
            </button>
          </div>
        )}

        {/* Loading indicator */}
        {loading && events.length > 0 && (
          <div className="p-3 text-center text-sm text-[var(--text-ghost)]">
            Loading...
          </div>
        )}
      </div>
    </div>
  );
}
