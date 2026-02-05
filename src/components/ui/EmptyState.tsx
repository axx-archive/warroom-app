"use client";

import Link from "next/link";

type EmptyStateVariant =
  | "no-missions"
  | "no-templates"
  | "no-activity"
  | "no-changes"
  | "no-lanes"
  | "error";

interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "ghost";
}

interface EmptyStateProps {
  variant: EmptyStateVariant;
  title?: string;
  description?: string;
  action?: EmptyStateAction;
  className?: string;
}

const VARIANT_CONFIG: Record<EmptyStateVariant, {
  icon: React.ReactNode;
  defaultTitle: string;
  defaultDescription: string;
  iconBgColor: string;
  iconBorderColor: string;
}> = {
  "no-missions": {
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    defaultTitle: "No missions found",
    defaultDescription: "Initialize a new mission to begin orchestrating your development workflow.",
    iconBgColor: "var(--bg-muted)",
    iconBorderColor: "var(--border)",
  },
  "no-templates": {
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
      </svg>
    ),
    defaultTitle: "No templates yet",
    defaultDescription: "Save a plan as template from any mission run to reuse it later.",
    iconBgColor: "var(--accent-subtle)",
    iconBorderColor: "var(--accent-border)",
  },
  "no-activity": {
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    defaultTitle: "No activity yet",
    defaultDescription: "Activity will appear here as lanes progress and events occur.",
    iconBgColor: "var(--bg-muted)",
    iconBorderColor: "var(--border)",
  },
  "no-changes": {
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    defaultTitle: "No changes detected",
    defaultDescription: "The worktree is clean with no uncommitted changes to preview.",
    iconBgColor: "rgba(34, 197, 94, 0.1)",
    iconBorderColor: "rgba(34, 197, 94, 0.3)",
  },
  "no-lanes": {
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
    defaultTitle: "No lanes configured",
    defaultDescription: "Add lanes to your mission plan to start parallel development.",
    iconBgColor: "var(--accent-subtle)",
    iconBorderColor: "var(--accent-border)",
  },
  "error": {
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    defaultTitle: "Something went wrong",
    defaultDescription: "An error occurred while loading this content. Please try again.",
    iconBgColor: "var(--error-dim)",
    iconBorderColor: "rgba(239, 68, 68, 0.3)",
  },
};

export function EmptyState({
  variant,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  const config = VARIANT_CONFIG[variant];

  return (
    <div className={`text-center py-12 px-4 ${className}`}>
      {/* Icon container with tech corners feel */}
      <div
        className="w-16 h-16 mx-auto mb-6 rounded-lg flex items-center justify-center tech-corners"
        style={{
          background: config.iconBgColor,
          border: `1px solid ${config.iconBorderColor}`,
          color: variant === "error" ? "var(--error)" : "var(--text-muted)"
        }}
      >
        {config.icon}
      </div>

      {/* Title */}
      <h3 className="text-heading mb-2" style={{ color: "var(--text)" }}>
        {title || config.defaultTitle}
      </h3>

      {/* Description */}
      <p className="text-body max-w-md mx-auto mb-6" style={{ color: "var(--text-muted)" }}>
        {description || config.defaultDescription}
      </p>

      {/* Action button */}
      {action && (
        action.href ? (
          <Link
            href={action.href}
            className={`btn ${action.variant === "ghost" ? "btn--ghost" : "btn--primary"}`}
          >
            {action.label}
          </Link>
        ) : (
          <button
            onClick={action.onClick}
            className={`btn ${action.variant === "ghost" ? "btn--ghost" : "btn--primary"}`}
          >
            {action.label}
          </button>
        )
      )}
    </div>
  );
}

/**
 * Compact empty state for smaller containers
 */
export function EmptyStateCompact({
  variant,
  title,
  description,
}: Pick<EmptyStateProps, "variant" | "title" | "description">) {
  const config = VARIANT_CONFIG[variant];

  return (
    <div className="text-center py-6 px-4">
      <div
        className="w-10 h-10 mx-auto mb-3 rounded flex items-center justify-center"
        style={{
          background: config.iconBgColor,
          border: `1px solid ${config.iconBorderColor}`,
          color: variant === "error" ? "var(--error)" : "var(--text-ghost)"
        }}
      >
        <div className="scale-75">
          {config.icon}
        </div>
      </div>
      <p className="text-caption" style={{ color: "var(--text-muted)" }}>
        {title || config.defaultTitle}
      </p>
      {description && (
        <p className="text-caption mt-1" style={{ color: "var(--text-ghost)" }}>
          {description}
        </p>
      )}
    </div>
  );
}
