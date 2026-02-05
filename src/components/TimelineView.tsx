"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Lane, LaneStatus, HistoryEvent } from "@/lib/plan-schema";
import { LaneState } from "@/hooks/useRealtimeStatus";

interface TimelineViewProps {
  slug: string;
  lanes: Lane[];
  laneStates: Record<string, LaneState>;
}

// Lane timing information derived from history events
interface LaneTiming {
  laneId: string;
  startTime: Date | null;
  endTime: Date | null;
  status: LaneStatus;
  dependsOn: string[];
}

// Status color mapping
const STATUS_COLORS: Record<LaneStatus, { bar: string; bg: string; border: string }> = {
  pending: {
    bar: "var(--text-ghost)",
    bg: "rgba(120, 120, 120, 0.15)",
    border: "rgba(120, 120, 120, 0.3)",
  },
  in_progress: {
    bar: "var(--cyan)",
    bg: "rgba(6, 182, 212, 0.15)",
    border: "rgba(6, 182, 212, 0.4)",
  },
  complete: {
    bar: "var(--status-success)",
    bg: "rgba(34, 197, 94, 0.15)",
    border: "rgba(34, 197, 94, 0.4)",
  },
  failed: {
    bar: "var(--status-danger)",
    bg: "rgba(239, 68, 68, 0.15)",
    border: "rgba(239, 68, 68, 0.4)",
  },
  conflict: {
    bar: "var(--status-warning)",
    bg: "rgba(234, 179, 8, 0.15)",
    border: "rgba(234, 179, 8, 0.4)",
  },
};

// Format duration for display
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

// Format time axis label
function formatTimeAxisLabel(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  } else {
    return `${seconds}s`;
  }
}

export function TimelineView({ slug, lanes, laneStates }: TimelineViewProps) {
  const [laneTimings, setLaneTimings] = useState<LaneTiming[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [hoveredLane, setHoveredLane] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Fetch history events to calculate timings
  const fetchTimings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/runs/${slug}/history?eventTypes=lane_launched,lane_status_change&limit=1000`
      );
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch history");
      }

      const events: HistoryEvent[] = data.events;

      // Calculate timing for each lane
      const timings: LaneTiming[] = lanes.map((lane) => {
        // Find launch event for this lane
        const launchEvent = events.find(
          (e) => e.type === "lane_launched" && e.laneId === lane.laneId
        );

        // Find completion/failure event for this lane
        const completionEvent = events.find(
          (e) =>
            e.type === "lane_status_change" &&
            e.laneId === lane.laneId &&
            "details" in e &&
            (e.details as { newStatus?: string })?.newStatus &&
            ["complete", "failed", "conflict"].includes(
              (e.details as { newStatus: string }).newStatus
            )
        );

        const status = laneStates[lane.laneId]?.status || "pending";

        return {
          laneId: lane.laneId,
          startTime: launchEvent ? new Date(launchEvent.timestamp) : null,
          endTime: completionEvent ? new Date(completionEvent.timestamp) : null,
          status,
          dependsOn: lane.dependsOn,
        };
      });

      setLaneTimings(timings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load timeline");
    } finally {
      setLoading(false);
    }
  }, [slug, lanes, laneStates]);

  useEffect(() => {
    fetchTimings();
  }, [fetchTimings]);

  // Calculate timeline bounds
  const { minTime, totalDuration } = useMemo(() => {
    const startTimes = laneTimings
      .filter((t) => t.startTime)
      .map((t) => t.startTime!.getTime());

    const endTimes = laneTimings
      .filter((t) => t.endTime || t.startTime)
      .map((t) => (t.endTime || new Date()).getTime());

    if (startTimes.length === 0) {
      return { minTime: Date.now(), totalDuration: 0 };
    }

    const min = Math.min(...startTimes);
    const max = Math.max(...endTimes, Date.now());

    return {
      minTime: min,
      totalDuration: max - min,
    };
  }, [laneTimings]);

  // Generate time axis markers
  const timeAxisMarkers = useMemo(() => {
    if (totalDuration === 0) return [];

    const markers: { position: number; label: string }[] = [];

    // Determine appropriate interval
    let interval: number;
    if (totalDuration <= 60000) {
      // Under 1 minute - show every 10 seconds
      interval = 10000;
    } else if (totalDuration <= 300000) {
      // Under 5 minutes - show every 30 seconds
      interval = 30000;
    } else if (totalDuration <= 1800000) {
      // Under 30 minutes - show every 5 minutes
      interval = 300000;
    } else if (totalDuration <= 7200000) {
      // Under 2 hours - show every 15 minutes
      interval = 900000;
    } else {
      // Over 2 hours - show every 30 minutes
      interval = 1800000;
    }

    for (let t = 0; t <= totalDuration; t += interval) {
      markers.push({
        position: totalDuration > 0 ? (t / totalDuration) * 100 : 0,
        label: formatTimeAxisLabel(t),
      });
    }

    return markers;
  }, [totalDuration]);

  // Handle mouse move for tooltip positioning
  const handleMouseMove = useCallback((e: React.MouseEvent, laneId: string) => {
    setHoveredLane(laneId);
    setTooltipPosition({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredLane(null);
    setTooltipPosition(null);
  }, []);

  // Get lane timing for tooltip
  const hoveredTiming = useMemo(() => {
    if (!hoveredLane) return null;
    return laneTimings.find((t) => t.laneId === hoveredLane);
  }, [hoveredLane, laneTimings]);

  // Layout constants
  const LANE_HEIGHT = 32;
  const LANE_GAP = 8;
  const LABEL_WIDTH = 140;
  const BAR_AREA_WIDTH = 600;
  const ARROW_AREA_WIDTH = 40;
  const SVG_PADDING = 16;

  // Calculate lane Y positions
  const laneYPositions = useMemo(() => {
    const positions: Record<string, number> = {};
    lanes.forEach((lane, index) => {
      positions[lane.laneId] = SVG_PADDING + index * (LANE_HEIGHT + LANE_GAP);
    });
    return positions;
  }, [lanes]);

  // Calculate SVG dimensions
  const svgHeight = SVG_PADDING * 2 + lanes.length * (LANE_HEIGHT + LANE_GAP) - LANE_GAP + 30; // Extra 30 for time axis
  const svgWidth = LABEL_WIDTH + ARROW_AREA_WIDTH + BAR_AREA_WIDTH + SVG_PADDING;

  // Calculate bar position and width for a lane
  const getBarPosition = useCallback(
    (timing: LaneTiming) => {
      if (!timing.startTime || totalDuration === 0) {
        return { x: LABEL_WIDTH + ARROW_AREA_WIDTH, width: 0 };
      }

      const startOffset = timing.startTime.getTime() - minTime;
      const duration = (timing.endTime || new Date()).getTime() - timing.startTime.getTime();

      const x = LABEL_WIDTH + ARROW_AREA_WIDTH + (startOffset / totalDuration) * BAR_AREA_WIDTH;
      const width = Math.max(4, (duration / totalDuration) * BAR_AREA_WIDTH); // Minimum 4px width

      return { x, width };
    },
    [minTime, totalDuration]
  );

  // Generate dependency arrows
  const dependencyArrows = useMemo(() => {
    const arrows: Array<{
      fromLane: string;
      toLane: string;
      path: string;
    }> = [];

    lanes.forEach((lane) => {
      lane.dependsOn.forEach((depLaneId) => {
        const fromY = laneYPositions[depLaneId];
        const toY = laneYPositions[lane.laneId];

        if (fromY === undefined || toY === undefined) return;

        // Calculate arrow path
        const startX = LABEL_WIDTH + ARROW_AREA_WIDTH - 10;
        const startY = fromY + LANE_HEIGHT / 2;
        const endX = LABEL_WIDTH + ARROW_AREA_WIDTH - 10;
        const endY = toY + LANE_HEIGHT / 2;
        const controlOffset = Math.abs(toY - fromY) * 0.3;

        // Bezier curve path
        const path = `M ${startX} ${startY}
          C ${startX - controlOffset} ${startY},
            ${endX - controlOffset} ${endY},
            ${endX} ${endY}`;

        arrows.push({
          fromLane: depLaneId,
          toLane: lane.laneId,
          path,
        });
      });
    });

    return arrows;
  }, [lanes, laneYPositions]);

  if (!isExpanded) {
    return (
      <div className="panel-bracketed">
        <button
          onClick={() => setIsExpanded(true)}
          className="w-full flex items-center justify-between p-4 hover:bg-[rgba(255,255,255,0.02)] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded bg-[rgba(6,182,212,0.15)] border border-[rgba(6,182,212,0.3)] flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-[var(--cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-[var(--text-primary)]">
              Progress Timeline
            </h3>
          </div>
          <svg className="w-4 h-4 text-[var(--text-ghost)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="panel-bracketed" ref={containerRef}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(false)}
        className="w-full flex items-center justify-between p-4 border-b border-[var(--border-dim)] hover:bg-[rgba(255,255,255,0.02)] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded bg-[rgba(6,182,212,0.15)] border border-[rgba(6,182,212,0.3)] flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-[var(--cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-[var(--text-primary)]">
            Progress Timeline
          </h3>
          {totalDuration > 0 && (
            <span className="text-xs font-mono text-[var(--text-ghost)]">
              (Total: {formatDuration(totalDuration)})
            </span>
          )}
        </div>
        <svg className="w-4 h-4 text-[var(--text-ghost)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      </button>

      {/* Content */}
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-[var(--text-ghost)]">
            <svg className="w-4 h-4 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading timeline...
          </div>
        ) : error ? (
          <div className="text-sm text-[var(--status-danger)] text-center py-4">
            {error}
          </div>
        ) : lanes.length === 0 ? (
          <div className="text-sm text-[var(--text-ghost)] text-center py-4">
            No lanes to display.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <svg
              ref={svgRef}
              width={svgWidth}
              height={svgHeight}
              className="timeline-svg"
            >
              {/* Background grid */}
              {timeAxisMarkers.map((marker, i) => (
                <line
                  key={`grid-${i}`}
                  x1={LABEL_WIDTH + ARROW_AREA_WIDTH + (marker.position / 100) * BAR_AREA_WIDTH}
                  y1={SVG_PADDING - 5}
                  x2={LABEL_WIDTH + ARROW_AREA_WIDTH + (marker.position / 100) * BAR_AREA_WIDTH}
                  y2={svgHeight - 30}
                  stroke="var(--border-dim)"
                  strokeDasharray="2,4"
                  opacity={0.5}
                />
              ))}

              {/* Time axis labels */}
              {timeAxisMarkers.map((marker, i) => (
                <text
                  key={`time-${i}`}
                  x={LABEL_WIDTH + ARROW_AREA_WIDTH + (marker.position / 100) * BAR_AREA_WIDTH}
                  y={svgHeight - 10}
                  textAnchor="middle"
                  className="text-[10px] fill-[var(--text-ghost)] font-mono"
                >
                  {marker.label}
                </text>
              ))}

              {/* Dependency arrows */}
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="6"
                  markerHeight="6"
                  refX="5"
                  refY="3"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <path d="M0,0 L0,6 L6,3 z" fill="var(--text-ghost)" opacity={0.5} />
                </marker>
              </defs>

              {dependencyArrows.map((arrow, i) => (
                <path
                  key={`arrow-${i}`}
                  d={arrow.path}
                  fill="none"
                  stroke="var(--text-ghost)"
                  strokeWidth={1}
                  opacity={0.4}
                  markerEnd="url(#arrowhead)"
                />
              ))}

              {/* Lane rows */}
              {laneTimings.map((timing) => {
                const y = laneYPositions[timing.laneId];
                const barPos = getBarPosition(timing);
                const colors = STATUS_COLORS[timing.status];
                const isHovered = hoveredLane === timing.laneId;

                return (
                  <g key={timing.laneId}>
                    {/* Lane label */}
                    <text
                      x={SVG_PADDING}
                      y={y + LANE_HEIGHT / 2 + 4}
                      className="text-xs fill-[var(--text-secondary)] font-mono"
                    >
                      {timing.laneId.length > 16
                        ? timing.laneId.slice(0, 14) + "..."
                        : timing.laneId}
                    </text>

                    {/* Lane bar background */}
                    <rect
                      x={LABEL_WIDTH + ARROW_AREA_WIDTH}
                      y={y}
                      width={BAR_AREA_WIDTH}
                      height={LANE_HEIGHT}
                      rx={4}
                      fill="var(--bg-tertiary)"
                      opacity={0.5}
                    />

                    {/* Lane bar */}
                    {barPos.width > 0 && (
                      <rect
                        x={barPos.x}
                        y={y + 4}
                        width={barPos.width}
                        height={LANE_HEIGHT - 8}
                        rx={3}
                        fill={colors.bg}
                        stroke={colors.border}
                        strokeWidth={isHovered ? 2 : 1}
                        onMouseMove={(e) => handleMouseMove(e, timing.laneId)}
                        onMouseLeave={handleMouseLeave}
                        style={{ cursor: "pointer" }}
                      />
                    )}

                    {/* Progress indicator for in_progress lanes */}
                    {timing.status === "in_progress" && barPos.width > 0 && (
                      <rect
                        x={barPos.x + barPos.width - 3}
                        y={y + 4}
                        width={3}
                        height={LANE_HEIGHT - 8}
                        rx={1}
                        fill={colors.bar}
                        className="animate-pulse"
                      />
                    )}

                    {/* Lane bar inner text (for longer bars) */}
                    {barPos.width > 60 && (
                      <text
                        x={barPos.x + 8}
                        y={y + LANE_HEIGHT / 2 + 4}
                        className="text-[10px] font-mono"
                        fill={colors.bar}
                      >
                        {timing.startTime && (timing.endTime || timing.status === "in_progress")
                          ? formatDuration(
                              (timing.endTime || new Date()).getTime() -
                                timing.startTime.getTime()
                            )
                          : ""}
                      </text>
                    )}

                    {/* Status indicator */}
                    <circle
                      cx={LABEL_WIDTH + ARROW_AREA_WIDTH + BAR_AREA_WIDTH + 15}
                      cy={y + LANE_HEIGHT / 2}
                      r={5}
                      fill={colors.bar}
                      className={timing.status === "in_progress" ? "animate-pulse" : ""}
                    />
                  </g>
                );
              })}
            </svg>

            {/* Legend */}
            <div className="flex items-center justify-end gap-4 mt-3 text-xs text-[var(--text-ghost)]">
              <div className="flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: STATUS_COLORS.pending.bar }}
                />
                <span>Pending</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: STATUS_COLORS.in_progress.bar }}
                />
                <span>In Progress</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: STATUS_COLORS.complete.bar }}
                />
                <span>Complete</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: STATUS_COLORS.failed.bar }}
                />
                <span>Failed</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tooltip */}
      {hoveredTiming && tooltipPosition && (
        <div
          className="fixed z-50 px-3 py-2 rounded-lg shadow-lg border"
          style={{
            left: tooltipPosition.x + 12,
            top: tooltipPosition.y + 12,
            backgroundColor: "var(--bg-secondary)",
            borderColor: "var(--border-dim)",
          }}
        >
          <div className="text-sm font-medium text-[var(--text-primary)] mb-1">
            {hoveredTiming.laneId}
          </div>
          <div className="space-y-1 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-ghost)]">Status:</span>
              <span
                style={{ color: STATUS_COLORS[hoveredTiming.status].bar }}
              >
                {hoveredTiming.status}
              </span>
            </div>
            {hoveredTiming.startTime && (
              <div className="flex items-center gap-2">
                <span className="text-[var(--text-ghost)]">Started:</span>
                <span className="text-[var(--text-secondary)]">
                  {hoveredTiming.startTime.toLocaleTimeString()}
                </span>
              </div>
            )}
            {hoveredTiming.endTime && (
              <div className="flex items-center gap-2">
                <span className="text-[var(--text-ghost)]">Ended:</span>
                <span className="text-[var(--text-secondary)]">
                  {hoveredTiming.endTime.toLocaleTimeString()}
                </span>
              </div>
            )}
            {hoveredTiming.startTime && (
              <div className="flex items-center gap-2">
                <span className="text-[var(--text-ghost)]">Duration:</span>
                <span className="text-[var(--text-secondary)]">
                  {formatDuration(
                    (hoveredTiming.endTime || new Date()).getTime() -
                      hoveredTiming.startTime.getTime()
                  )}
                </span>
              </div>
            )}
            {hoveredTiming.dependsOn.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[var(--text-ghost)]">Depends on:</span>
                <span className="text-[var(--text-secondary)]">
                  {hoveredTiming.dependsOn.join(", ")}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
