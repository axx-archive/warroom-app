/**
 * Shared status configuration for consistent styling across the application.
 * This centralizes all lane and run status styling to ensure visual consistency.
 */

import { LaneStatus } from "./plan-schema";

export interface StatusConfig {
  /** CSS color value for text and icons */
  color: string;
  /** CSS background color value */
  bgColor: string;
  /** CSS border color value */
  borderColor: string;
  /** Display label for the status */
  label: string;
  /** CSS class for the lane card */
  cardClass: string;
  /** CSS class for the status dot indicator */
  dotClass: string;
  /** CSS class for the badge */
  badgeClass: string;
}

/**
 * Lane status configuration
 * Used by LaneStatusCard, TimelineView, and other components
 */
export const LANE_STATUS: Record<LaneStatus, StatusConfig> = {
  pending: {
    color: "var(--text-ghost)",
    bgColor: "var(--bg-elevated)",
    borderColor: "var(--border)",
    label: "Pending",
    cardClass: "lane-card--pending",
    dotClass: "status-dot--idle",
    badgeClass: "badge--muted",
  },
  in_progress: {
    color: "var(--accent)",
    bgColor: "var(--accent-subtle)",
    borderColor: "var(--accent-border)",
    label: "Running",
    cardClass: "lane-card--in-progress",
    dotClass: "status-dot--active",
    badgeClass: "badge--running",
  },
  complete: {
    color: "var(--success)",
    bgColor: "var(--bg-elevated)",
    borderColor: "var(--border)",
    label: "Complete",
    cardClass: "lane-card--complete",
    dotClass: "status-dot--success",
    badgeClass: "badge--success",
  },
  failed: {
    color: "var(--error)",
    bgColor: "var(--error-dim)",
    borderColor: "rgba(239, 68, 68, 0.3)",
    label: "Failed",
    cardClass: "lane-card--failed",
    dotClass: "status-dot--error",
    badgeClass: "badge--danger",
  },
  conflict: {
    color: "var(--warning)",
    bgColor: "var(--warning-dim)",
    borderColor: "rgba(245, 158, 11, 0.3)",
    label: "Conflict",
    cardClass: "lane-card--conflict",
    dotClass: "status-dot--warning",
    badgeClass: "badge--warning",
  },
};

/**
 * Run status configuration
 * Used by RunsList and run-level components
 */
export const RUN_STATUS: Record<string, Omit<StatusConfig, "cardClass" | "dotClass">> = {
  draft: {
    color: "var(--text-muted)",
    bgColor: "transparent",
    borderColor: "var(--border)",
    label: "Draft",
    badgeClass: "badge--muted",
  },
  ready_to_stage: {
    color: "var(--accent-light)",
    bgColor: "var(--accent-subtle)",
    borderColor: "var(--accent-border)",
    label: "Ready to Stage",
    badgeClass: "badge--accent",
  },
  staged: {
    color: "var(--accent)",
    bgColor: "var(--accent-subtle)",
    borderColor: "var(--accent-border)",
    label: "Staged",
    badgeClass: "badge--accent",
  },
  in_progress: {
    color: "var(--accent-light)",
    bgColor: "var(--accent-subtle)",
    borderColor: "var(--accent-border)",
    label: "In Progress",
    badgeClass: "badge--running",
  },
  merging: {
    color: "var(--warning)",
    bgColor: "var(--warning-dim)",
    borderColor: "rgba(249, 115, 22, 0.3)",
    label: "Merging",
    badgeClass: "badge--warning",
  },
  complete: {
    color: "var(--success)",
    bgColor: "rgba(34, 197, 94, 0.15)",
    borderColor: "rgba(34, 197, 94, 0.3)",
    label: "Complete",
    badgeClass: "badge--success",
  },
};

/**
 * Get the CSS class suffix for a lane card based on status
 */
export function getLaneStatusClass(status?: string): string {
  switch (status) {
    case "complete":
      return "lane-complete";
    case "in_progress":
    case "staged":
    case "merging":
      return "lane-in-progress";
    default:
      return "";
  }
}

/**
 * Get status config with fallback for unknown statuses
 */
export function getLaneStatusConfig(status: LaneStatus): StatusConfig {
  return LANE_STATUS[status] ?? LANE_STATUS.pending;
}

/**
 * Get run status config with fallback for unknown statuses
 */
export function getRunStatusConfig(status: string): Omit<StatusConfig, "cardClass" | "dotClass"> {
  return RUN_STATUS[status] ?? RUN_STATUS.draft;
}
