"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  AppNotification,
  NotificationType,
  NotificationEventType,
  NotificationPreferences,
} from "@/lib/plan-schema";

// Default preferences
const DEFAULT_PREFERENCES: NotificationPreferences = {
  laneComplete: true,
  laneFailed: true,
  allLanesComplete: true,
  mergeConflict: true,
  browserNotifications: false,
};

// Local storage key for preferences
const PREFERENCES_KEY = "warroom_notification_preferences";

// Maximum number of notifications to keep in the center
const MAX_NOTIFICATIONS = 50;

// Default toast duration in ms
const DEFAULT_TOAST_DURATION = 5000;

// Generate unique ID
function generateId(): string {
  return `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export interface UseNotificationsOptions {
  // Run slug for context
  runSlug?: string;
}

export interface UseNotificationsReturn {
  // All notifications (for notification center)
  notifications: AppNotification[];
  // Active toast notifications (currently showing)
  toasts: AppNotification[];
  // Unread count for badge
  unreadCount: number;
  // Notification preferences
  preferences: NotificationPreferences;
  // Add a notification
  addNotification: (
    type: NotificationType,
    title: string,
    options?: {
      message?: string;
      laneId?: string;
      showToast?: boolean;
      duration?: number;
      eventType?: NotificationEventType;
    }
  ) => void;
  // Dismiss a toast
  dismissToast: (id: string) => void;
  // Mark notification as read
  markAsRead: (id: string) => void;
  // Mark all notifications as read
  markAllAsRead: () => void;
  // Clear all notifications
  clearAll: () => void;
  // Update preferences
  updatePreferences: (prefs: Partial<NotificationPreferences>) => void;
  // Request browser notification permission
  requestBrowserPermission: () => Promise<boolean>;
  // Check if browser notifications are supported
  browserNotificationsSupported: boolean;
  // Browser notification permission status
  browserPermissionStatus: NotificationPermission | "unsupported";
  // Helper methods for common notification types
  notifyLaneComplete: (laneId: string, laneName?: string) => void;
  notifyLaneFailed: (laneId: string, laneName?: string, error?: string) => void;
  notifyAllLanesComplete: () => void;
  notifyMergeConflict: (laneId: string, conflictingFiles?: string[]) => void;
}

export function useNotifications(
  options: UseNotificationsOptions = {}
): UseNotificationsReturn {
  const { runSlug } = options;

  // All notifications
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  // Active toasts
  const [toasts, setToasts] = useState<AppNotification[]>([]);
  // Preferences - use lazy initialization to load from localStorage
  const [preferences, setPreferences] = useState<NotificationPreferences>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(PREFERENCES_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          return { ...DEFAULT_PREFERENCES, ...parsed };
        } catch {
          // Ignore invalid JSON
        }
      }
    }
    return DEFAULT_PREFERENCES;
  });
  // Browser permission status - use lazy initialization
  const [browserPermissionStatus, setBrowserPermissionStatus] = useState<
    NotificationPermission | "unsupported"
  >(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission;
    }
    return "unsupported";
  });

  // Toast timers ref
  const toastTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Cleanup toast timers on unmount
  useEffect(() => {
    const timersRef = toastTimersRef.current;
    return () => {
      timersRef.forEach((timer) => clearTimeout(timer));
      timersRef.clear();
    };
  }, []);

  // Check if browser notifications are supported
  const browserNotificationsSupported =
    typeof window !== "undefined" && "Notification" in window;

  // Unread count
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Request browser notification permission
  const requestBrowserPermission = useCallback(async (): Promise<boolean> => {
    if (!browserNotificationsSupported) {
      return false;
    }

    if (Notification.permission === "granted") {
      setBrowserPermissionStatus("granted");
      return true;
    }

    if (Notification.permission === "denied") {
      setBrowserPermissionStatus("denied");
      return false;
    }

    const permission = await Notification.requestPermission();
    setBrowserPermissionStatus(permission);
    return permission === "granted";
  }, [browserNotificationsSupported]);

  // Show browser notification
  const showBrowserNotification = useCallback(
    (title: string, options?: { body?: string; tag?: string }) => {
      if (
        browserNotificationsSupported &&
        Notification.permission === "granted" &&
        preferences.browserNotifications
      ) {
        try {
          new Notification(title, {
            body: options?.body,
            tag: options?.tag || runSlug || "warroom",
            icon: "/favicon.ico",
          });
        } catch (e) {
          console.error("Failed to show browser notification:", e);
        }
      }
    },
    [browserNotificationsSupported, preferences.browserNotifications, runSlug]
  );

  // Dismiss a toast
  const dismissToast = useCallback((id: string) => {
    // Clear the timer if exists
    const timer = toastTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      toastTimersRef.current.delete(id);
    }

    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Add a notification
  const addNotification = useCallback(
    (
      type: NotificationType,
      title: string,
      options?: {
        message?: string;
        laneId?: string;
        showToast?: boolean;
        duration?: number;
        eventType?: NotificationEventType;
      }
    ) => {
      const notification: AppNotification = {
        id: generateId(),
        type,
        title,
        message: options?.message,
        laneId: options?.laneId,
        createdAt: new Date().toISOString(),
        read: false,
        showToast: options?.showToast ?? true,
        duration: options?.duration ?? DEFAULT_TOAST_DURATION,
        eventType: options?.eventType,
      };

      // Add to notifications list
      setNotifications((prev) => {
        const updated = [notification, ...prev];
        // Trim to max notifications
        if (updated.length > MAX_NOTIFICATIONS) {
          return updated.slice(0, MAX_NOTIFICATIONS);
        }
        return updated;
      });

      // Show as toast if enabled
      if (notification.showToast) {
        setToasts((prev) => [...prev, notification]);

        // Set auto-dismiss timer
        const duration = notification.duration || DEFAULT_TOAST_DURATION;
        const timer = setTimeout(() => {
          dismissToast(notification.id);
        }, duration);
        toastTimersRef.current.set(notification.id, timer);
      }

      // Show browser notification for important events
      if (
        preferences.browserNotifications &&
        (type === "error" || type === "warning" || type === "success")
      ) {
        showBrowserNotification(title, { body: options?.message });
      }
    },
    [preferences.browserNotifications, showBrowserNotification, dismissToast]
  );

  // Mark notification as read
  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  // Clear all notifications
  const clearAll = useCallback(() => {
    setNotifications([]);
    setToasts([]);
    toastTimersRef.current.forEach((timer) => clearTimeout(timer));
    toastTimersRef.current.clear();
  }, []);

  // Update preferences
  const updatePreferences = useCallback(
    (prefs: Partial<NotificationPreferences>) => {
      setPreferences((prev) => {
        const updated = { ...prev, ...prefs };
        // Save to localStorage
        if (typeof window !== "undefined") {
          localStorage.setItem(PREFERENCES_KEY, JSON.stringify(updated));
        }
        return updated;
      });
    },
    []
  );

  // Helper: Notify lane complete
  const notifyLaneComplete = useCallback(
    (laneId: string, laneName?: string) => {
      if (!preferences.laneComplete) return;

      addNotification("success", `Lane ${laneName || laneId} complete`, {
        laneId,
        eventType: "lane_complete",
      });
    },
    [preferences.laneComplete, addNotification]
  );

  // Helper: Notify lane failed
  const notifyLaneFailed = useCallback(
    (laneId: string, laneName?: string, error?: string) => {
      if (!preferences.laneFailed) return;

      addNotification("error", `Lane ${laneName || laneId} failed`, {
        message: error,
        laneId,
        eventType: "lane_failed",
        duration: 10000, // Longer duration for errors
      });
    },
    [preferences.laneFailed, addNotification]
  );

  // Helper: Notify all lanes complete
  const notifyAllLanesComplete = useCallback(() => {
    if (!preferences.allLanesComplete) return;

    addNotification("success", "All lanes complete!", {
      message: "Ready to generate merge proposal",
      eventType: "all_lanes_complete",
      duration: 8000,
    });
  }, [preferences.allLanesComplete, addNotification]);

  // Helper: Notify merge conflict
  const notifyMergeConflict = useCallback(
    (laneId: string, conflictingFiles?: string[]) => {
      if (!preferences.mergeConflict) return;

      const message = conflictingFiles?.length
        ? `Conflicts in: ${conflictingFiles.slice(0, 3).join(", ")}${
            conflictingFiles.length > 3
              ? ` (+${conflictingFiles.length - 3} more)`
              : ""
          }`
        : "Manual resolution required";

      addNotification("warning", `Merge conflict in lane ${laneId}`, {
        message,
        laneId,
        eventType: "merge_conflict",
        duration: 0, // Don't auto-dismiss
      });
    },
    [preferences.mergeConflict, addNotification]
  );

  return {
    notifications,
    toasts,
    unreadCount,
    preferences,
    addNotification,
    dismissToast,
    markAsRead,
    markAllAsRead,
    clearAll,
    updatePreferences,
    requestBrowserPermission,
    browserNotificationsSupported,
    browserPermissionStatus,
    notifyLaneComplete,
    notifyLaneFailed,
    notifyAllLanesComplete,
    notifyMergeConflict,
  };
}
