"use client";

import { useState, useRef, useEffect } from "react";
import {
  AppNotification,
  NotificationType,
  NotificationPreferences,
} from "@/lib/plan-schema";

interface NotificationCenterProps {
  notifications: AppNotification[];
  unreadCount: number;
  preferences: NotificationPreferences;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onUpdatePreferences: (prefs: Partial<NotificationPreferences>) => void;
  onRequestBrowserPermission: () => Promise<boolean>;
  browserNotificationsSupported: boolean;
  browserPermissionStatus: NotificationPermission | "unsupported";
}

// Get icon for notification type
function getIcon(type: NotificationType, small = false) {
  const size = small ? "w-4 h-4" : "w-5 h-5";
  switch (type) {
    case "success":
      return (
        <svg
          className={`${size} text-[var(--status-success)]`}
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
          className={`${size} text-[var(--status-warning)]`}
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
          className={`${size} text-[var(--status-danger)]`}
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
          className={`${size} text-[var(--cyan)]`}
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

// Format relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

export function NotificationCenter({
  notifications,
  unreadCount,
  preferences,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  onUpdatePreferences,
  onRequestBrowserPermission,
  browserNotificationsSupported,
  browserPermissionStatus,
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setShowSettings(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Handle browser notification toggle
  const handleBrowserNotificationToggle = async (enabled: boolean) => {
    if (enabled && browserPermissionStatus !== "granted") {
      const granted = await onRequestBrowserPermission();
      if (granted) {
        onUpdatePreferences({ browserNotifications: true });
      }
    } else {
      onUpdatePreferences({ browserNotifications: enabled });
    }
  };

  return (
    <div className="relative">
      {/* Notification Bell Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
        title={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <svg
          className="w-5 h-5 text-[var(--text-secondary)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {/* Unread badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-bold text-white bg-[var(--status-danger)] rounded-full">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-2 w-96 max-h-[500px] rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] shadow-xl overflow-hidden z-50"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-[var(--text-primary)]">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <span className="text-xs text-[var(--text-ghost)] font-mono">
                  {unreadCount} unread
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {/* Settings button */}
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-1.5 rounded hover:bg-[var(--surface-hover)] transition-colors ${
                  showSettings ? "text-[var(--cyan)]" : "text-[var(--text-ghost)]"
                }`}
                title="Notification settings"
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
                    strokeWidth={1.5}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </button>
              {/* Mark all as read */}
              {unreadCount > 0 && (
                <button
                  onClick={onMarkAllAsRead}
                  className="p-1.5 rounded text-[var(--text-ghost)] hover:text-[var(--cyan)] hover:bg-[var(--surface-hover)] transition-colors"
                  title="Mark all as read"
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
                      strokeWidth={1.5}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </button>
              )}
              {/* Clear all */}
              {notifications.length > 0 && (
                <button
                  onClick={onClearAll}
                  className="p-1.5 rounded text-[var(--text-ghost)] hover:text-[var(--status-danger)] hover:bg-[var(--surface-hover)] transition-colors"
                  title="Clear all notifications"
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
                      strokeWidth={1.5}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="p-3 border-b border-[var(--border-subtle)] bg-[var(--surface-dim)]">
              <h4 className="text-xs font-medium text-[var(--text-ghost)] uppercase tracking-wider mb-3">
                Notification Preferences
              </h4>
              <div className="space-y-2">
                {/* Lane Complete */}
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-[var(--text-secondary)]">
                    Lane complete
                  </span>
                  <input
                    type="checkbox"
                    checked={preferences.laneComplete}
                    onChange={(e) =>
                      onUpdatePreferences({ laneComplete: e.target.checked })
                    }
                    className="toggle-checkbox"
                  />
                </label>
                {/* Lane Failed */}
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-[var(--text-secondary)]">
                    Lane failed
                  </span>
                  <input
                    type="checkbox"
                    checked={preferences.laneFailed}
                    onChange={(e) =>
                      onUpdatePreferences({ laneFailed: e.target.checked })
                    }
                    className="toggle-checkbox"
                  />
                </label>
                {/* All Lanes Complete */}
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-[var(--text-secondary)]">
                    All lanes complete
                  </span>
                  <input
                    type="checkbox"
                    checked={preferences.allLanesComplete}
                    onChange={(e) =>
                      onUpdatePreferences({ allLanesComplete: e.target.checked })
                    }
                    className="toggle-checkbox"
                  />
                </label>
                {/* Merge Conflict */}
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-[var(--text-secondary)]">
                    Merge conflicts
                  </span>
                  <input
                    type="checkbox"
                    checked={preferences.mergeConflict}
                    onChange={(e) =>
                      onUpdatePreferences({ mergeConflict: e.target.checked })
                    }
                    className="toggle-checkbox"
                  />
                </label>
                {/* Browser Notifications */}
                {browserNotificationsSupported && (
                  <div className="pt-2 mt-2 border-t border-[var(--border-subtle)]">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <span className="text-sm text-[var(--text-secondary)]">
                          Browser notifications
                        </span>
                        {browserPermissionStatus === "denied" && (
                          <div className="text-xs text-[var(--status-warning)] mt-0.5">
                            Permission denied in browser settings
                          </div>
                        )}
                      </div>
                      <input
                        type="checkbox"
                        checked={
                          preferences.browserNotifications &&
                          browserPermissionStatus === "granted"
                        }
                        disabled={browserPermissionStatus === "denied"}
                        onChange={(e) =>
                          handleBrowserNotificationToggle(e.target.checked)
                        }
                        className="toggle-checkbox"
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notifications List */}
          <div className="overflow-y-auto max-h-[350px]">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <svg
                  className="w-12 h-12 mx-auto text-[var(--text-ghost)] opacity-50"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                <p className="mt-3 text-sm text-[var(--text-ghost)]">
                  No notifications yet
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-subtle)]">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-3 hover:bg-[var(--surface-hover)] transition-colors cursor-pointer ${
                      !notification.read ? "bg-[rgba(6,182,212,0.05)]" : ""
                    }`}
                    onClick={() => onMarkAsRead(notification.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {getIcon(notification.type, true)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div
                            className={`font-medium text-sm ${
                              !notification.read
                                ? "text-[var(--text-primary)]"
                                : "text-[var(--text-secondary)]"
                            }`}
                          >
                            {notification.title}
                          </div>
                          <div className="flex-shrink-0 text-xs text-[var(--text-ghost)] whitespace-nowrap">
                            {formatRelativeTime(notification.createdAt)}
                          </div>
                        </div>
                        {notification.message && (
                          <div className="text-xs text-[var(--text-ghost)] mt-1 break-words">
                            {notification.message}
                          </div>
                        )}
                        {notification.laneId && (
                          <div className="text-xs text-[var(--text-ghost)] mt-1 font-mono opacity-75">
                            Lane: {notification.laneId}
                          </div>
                        )}
                      </div>
                      {/* Unread indicator */}
                      {!notification.read && (
                        <div className="flex-shrink-0 w-2 h-2 rounded-full bg-[var(--cyan)] mt-2" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toggle checkbox styles */}
      <style jsx>{`
        .toggle-checkbox {
          appearance: none;
          width: 36px;
          height: 20px;
          background: var(--surface-dim);
          border: 1px solid var(--border-subtle);
          border-radius: 10px;
          cursor: pointer;
          position: relative;
          transition: all 0.2s ease;
        }
        .toggle-checkbox::before {
          content: "";
          position: absolute;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          top: 1px;
          left: 1px;
          background: var(--text-ghost);
          transition: all 0.2s ease;
        }
        .toggle-checkbox:checked {
          background: var(--cyan);
          border-color: var(--cyan);
        }
        .toggle-checkbox:checked::before {
          transform: translateX(16px);
          background: white;
        }
        .toggle-checkbox:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
