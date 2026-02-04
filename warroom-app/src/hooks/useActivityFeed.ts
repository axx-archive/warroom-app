"use client";

import { useState, useCallback, useRef } from "react";
import { LaneActivityEvent, LaneStatusChangeEvent } from "@/lib/websocket/types";
import { LaneStatus } from "@/lib/plan-schema";

// Maximum number of events to retain in the feed
const MAX_EVENTS = 100;

// Unified activity event type for the feed
export interface ActivityEvent {
  id: string;
  laneId: string;
  type: "file-created" | "file-modified" | "file-deleted" | "commit" | "status-change" | "output";
  timestamp: string;
  // For file events
  path?: string;
  // For commit events
  message?: string;
  // For status change events
  previousStatus?: LaneStatus;
  newStatus?: LaneStatus;
  // For output events
  details?: {
    stream?: "stdout" | "stderr";
    line?: string;
  };
}

interface UseActivityFeedOptions {
  maxEvents?: number;
}

export function useActivityFeed(options: UseActivityFeedOptions = {}) {
  const { maxEvents = MAX_EVENTS } = options;
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [filter, setFilter] = useState<string | null>(null); // laneId filter
  const eventIdCounter = useRef(0);

  // Generate unique event ID
  const generateEventId = useCallback(() => {
    eventIdCounter.current += 1;
    return `event-${Date.now()}-${eventIdCounter.current}`;
  }, []);

  // Add a lane activity event (file change, commit, or output)
  const addLaneActivityEvent = useCallback((event: LaneActivityEvent) => {
    const activityEvent: ActivityEvent = {
      id: generateEventId(),
      laneId: event.laneId,
      type: event.type,
      timestamp: event.timestamp,
      path: event.path,
      message: event.message,
      details: event.details,
    };

    setEvents((prev) => {
      const updated = [activityEvent, ...prev];
      // Prune older events if we exceed maxEvents
      return updated.slice(0, maxEvents);
    });
  }, [generateEventId, maxEvents]);

  // Add a lane status change event
  const addStatusChangeEvent = useCallback((event: LaneStatusChangeEvent) => {
    const activityEvent: ActivityEvent = {
      id: generateEventId(),
      laneId: event.laneId,
      type: "status-change",
      timestamp: event.timestamp,
      previousStatus: event.previousStatus,
      newStatus: event.newStatus,
    };

    setEvents((prev) => {
      const updated = [activityEvent, ...prev];
      // Prune older events if we exceed maxEvents
      return updated.slice(0, maxEvents);
    });
  }, [generateEventId, maxEvents]);

  // Get filtered events
  const filteredEvents = filter
    ? events.filter((e) => e.laneId === filter)
    : events;

  // Clear all events
  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  // Get unique lane IDs from events (for filter dropdown)
  const laneIds = Array.from(new Set(events.map((e) => e.laneId)));

  return {
    events: filteredEvents,
    allEvents: events,
    filter,
    setFilter,
    addLaneActivityEvent,
    addStatusChangeEvent,
    clearEvents,
    laneIds,
    eventCount: events.length,
  };
}
