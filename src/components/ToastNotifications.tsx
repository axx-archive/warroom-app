"use client";

import { AppNotification, NotificationType } from "@/lib/plan-schema";

export interface ToastAction {
  label: string;
  onClick: () => void;
  primary?: boolean;
}

interface ToastNotificationsProps {
  toasts: AppNotification[];
  onDismiss: (id: string) => void;
  // Optional: global action handler for cross-tab navigation
  onAction?: (actionId: string, toastId: string) => void;
}

// Get icon for notification type
function getIcon(type: NotificationType) {
  switch (type) {
    case "success":
      return (
        <svg
          className="w-5 h-5 text-[var(--success)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      );
    case "warning":
      return (
        <svg
          className="w-5 h-5 text-[var(--warning)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      );
    case "error":
      return (
        <svg
          className="w-5 h-5 text-[var(--error)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      );
    case "info":
    default:
      return (
        <svg
          className="w-5 h-5 text-[var(--info)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
  }
}

// Get colors for notification type - Bold Mission Control
function getColors(type: NotificationType) {
  switch (type) {
    case "success":
      return {
        border: "rgba(16, 185, 129, 0.4)",
        accent: "var(--success)",
        shadow: "0 8px 32px rgba(0, 0, 0, 0.4), 0 0 30px rgba(16, 185, 129, 0.15)",
        iconBg: "rgba(16, 185, 129, 0.1)",
      };
    case "warning":
      return {
        border: "rgba(245, 158, 11, 0.4)",
        accent: "var(--warning)",
        shadow: "0 8px 32px rgba(0, 0, 0, 0.4), 0 0 30px rgba(245, 158, 11, 0.15)",
        iconBg: "rgba(245, 158, 11, 0.1)",
      };
    case "error":
      return {
        border: "rgba(239, 68, 68, 0.4)",
        accent: "var(--error)",
        shadow: "0 8px 32px rgba(0, 0, 0, 0.4), 0 0 30px rgba(239, 68, 68, 0.15)",
        iconBg: "rgba(239, 68, 68, 0.1)",
      };
    case "info":
    default:
      return {
        border: "rgba(6, 182, 212, 0.4)",
        accent: "var(--info)",
        shadow: "0 8px 32px rgba(0, 0, 0, 0.4), 0 0 30px rgba(6, 182, 212, 0.15)",
        iconBg: "rgba(6, 182, 212, 0.1)",
      };
  }
}

export function ToastNotifications({
  toasts,
  onDismiss,
  onAction,
}: ToastNotificationsProps) {
  if (toasts.length === 0) {
    return null;
  }

  const handleAction = (actionId: string, toastId: string) => {
    onAction?.(actionId, toastId);
    onDismiss(toastId);
  };

  return (
    <div className="toast-container">
      {toasts.map((toast) => {
        const colors = getColors(toast.type);
        // Check if toast has actions (stored in metadata)
        const actions = (toast as AppNotification & { actions?: ToastAction[] }).actions;

        return (
          <div
            key={toast.id}
            className={`toast toast--${toast.type} toast--dramatic backdrop-blur-xl`}
            style={{
              borderColor: colors.border,
              boxShadow: colors.shadow,
            }}
          >
            <div
              className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: colors.iconBg, border: `1px solid ${colors.border}` }}
            >
              {getIcon(toast.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm uppercase tracking-wide text-white">
                {toast.title}
              </div>
              {toast.message && (
                <div className="text-small text-[var(--text-secondary)] mt-1 break-words">
                  {toast.message}
                </div>
              )}
              {toast.laneId && (
                <div className="text-caption font-mono mt-1">
                  Lane: {toast.laneId}
                </div>
              )}
              {/* Action buttons */}
              {actions && actions.length > 0 && (
                <div className="toast-actions">
                  {actions.map((action, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleAction(action.label, toast.id)}
                      className={`toast-action ${action.primary ? "toast-action--primary" : ""}`}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="btn--icon flex-shrink-0 text-[var(--text-ghost)] hover:text-[var(--text-secondary)]"
              title="Dismiss"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
