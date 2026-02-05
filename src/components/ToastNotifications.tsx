"use client";

import { AppNotification, NotificationType } from "@/lib/plan-schema";

interface ToastNotificationsProps {
  toasts: AppNotification[];
  onDismiss: (id: string) => void;
}

// Get icon for notification type
function getIcon(type: NotificationType) {
  switch (type) {
    case "success":
      return (
        <svg
          className="w-5 h-5 text-[var(--status-success)]"
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
          className="w-5 h-5 text-[var(--status-warning)]"
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
          className="w-5 h-5 text-[var(--status-danger)]"
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
          className="w-5 h-5 text-[var(--cyan)]"
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

// Get border/background colors for notification type
function getColors(type: NotificationType) {
  switch (type) {
    case "success":
      return {
        border: "border-[rgba(34,197,94,0.4)]",
        bg: "bg-[rgba(34,197,94,0.1)]",
        title: "text-[var(--status-success)]",
      };
    case "warning":
      return {
        border: "border-[rgba(234,179,8,0.4)]",
        bg: "bg-[rgba(234,179,8,0.1)]",
        title: "text-[var(--status-warning)]",
      };
    case "error":
      return {
        border: "border-[rgba(239,68,68,0.4)]",
        bg: "bg-[rgba(239,68,68,0.1)]",
        title: "text-[var(--status-danger)]",
      };
    case "info":
    default:
      return {
        border: "border-[rgba(6,182,212,0.4)]",
        bg: "bg-[rgba(6,182,212,0.1)]",
        title: "text-[var(--cyan)]",
      };
  }
}

export function ToastNotifications({
  toasts,
  onDismiss,
}: ToastNotificationsProps) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
      {toasts.map((toast) => {
        const colors = getColors(toast.type);
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto animate-slide-in-right rounded-lg border ${colors.border} ${colors.bg} backdrop-blur-sm p-4 shadow-lg transition-all duration-300`}
            style={{
              backgroundColor: "var(--surface-elevated)",
            }}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">{getIcon(toast.type)}</div>
              <div className="flex-1 min-w-0">
                <div className={`font-medium ${colors.title}`}>
                  {toast.title}
                </div>
                {toast.message && (
                  <div className="text-sm text-[var(--text-secondary)] mt-1 break-words">
                    {toast.message}
                  </div>
                )}
                {toast.laneId && (
                  <div className="text-xs text-[var(--text-ghost)] mt-1 font-mono">
                    Lane: {toast.laneId}
                  </div>
                )}
              </div>
              <button
                onClick={() => onDismiss(toast.id)}
                className="flex-shrink-0 p-1 text-[var(--text-ghost)] hover:text-[var(--text-secondary)] transition-colors"
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
          </div>
        );
      })}

      {/* CSS for slide-in animation */}
      <style jsx>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
