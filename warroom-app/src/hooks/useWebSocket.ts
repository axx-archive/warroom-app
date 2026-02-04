"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import {
  ServerToClientEvents,
  ClientToServerEvents,
  LaneActivityEvent,
  LaneStatusChangeEvent,
  MergeReadyEvent,
  RunCompleteEvent,
} from "@/lib/websocket/types";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3001";
const RECONNECT_DELAY = 3000;
const PING_INTERVAL = 30000;

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

interface UseWebSocketOptions {
  runSlug: string;
  enabled?: boolean;
  onLaneActivity?: (event: LaneActivityEvent) => void;
  onLaneStatusChange?: (event: LaneStatusChangeEvent) => void;
  onMergeReady?: (event: MergeReadyEvent) => void;
  onRunComplete?: (event: RunCompleteEvent) => void;
}

interface UseWebSocketReturn {
  connectionStatus: ConnectionStatus;
  isConnected: boolean;
  lastError: string | null;
  reconnect: () => void;
}

export function useWebSocket({
  runSlug,
  enabled = true,
  onLaneActivity,
  onLaneStatusChange,
  onMergeReady,
  onRunComplete,
}: UseWebSocketOptions): UseWebSocketReturn {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [lastError, setLastError] = useState<string | null>(null);

  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Use ref to hold the connect function so we can call it from event handlers
  const connectRef = useRef<() => void>(() => {});

  // Store event handlers in refs to avoid stale closures
  const onLaneActivityRef = useRef(onLaneActivity);
  const onLaneStatusChangeRef = useRef(onLaneStatusChange);
  const onMergeReadyRef = useRef(onMergeReady);
  const onRunCompleteRef = useRef(onRunComplete);

  // Update refs when handlers change
  useEffect(() => {
    onLaneActivityRef.current = onLaneActivity;
    onLaneStatusChangeRef.current = onLaneStatusChange;
    onMergeReadyRef.current = onMergeReady;
    onRunCompleteRef.current = onRunComplete;
  }, [onLaneActivity, onLaneStatusChange, onMergeReady, onRunComplete]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  // Connect function - we store the actual logic here
  const connect = useCallback(() => {
    if (!enabled) return;

    cleanup();
    setConnectionStatus("connecting");
    setLastError(null);

    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(WS_URL, {
      transports: ["websocket", "polling"],
      reconnection: false, // We handle reconnection ourselves
      timeout: 10000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[WebSocket] Connected");
      setConnectionStatus("connected");
      setLastError(null);

      // Subscribe to the run
      socket.emit("subscribe-run", runSlug);

      // Start ping interval
      pingIntervalRef.current = setInterval(() => {
        socket.emit("ping");
      }, PING_INTERVAL);
    });

    socket.on("disconnect", (reason) => {
      console.log(`[WebSocket] Disconnected: ${reason}`);
      setConnectionStatus("disconnected");

      // Clear ping interval
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }

      // Attempt reconnect unless it was a manual disconnect
      if (reason !== "io client disconnect") {
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log("[WebSocket] Attempting reconnect...");
          connectRef.current();
        }, RECONNECT_DELAY);
      }
    });

    socket.on("connect_error", (error) => {
      console.error("[WebSocket] Connection error:", error.message);
      setConnectionStatus("error");
      setLastError(error.message);

      // Attempt reconnect
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log("[WebSocket] Attempting reconnect after error...");
        connectRef.current();
      }, RECONNECT_DELAY);
    });

    // Event handlers - use refs to avoid stale closures
    socket.on("lane-activity", (event) => {
      if (event.runSlug === runSlug && onLaneActivityRef.current) {
        onLaneActivityRef.current(event);
      }
    });

    socket.on("lane-status-change", (event) => {
      if (event.runSlug === runSlug && onLaneStatusChangeRef.current) {
        onLaneStatusChangeRef.current(event);
      }
    });

    socket.on("merge-ready", (event) => {
      if (event.runSlug === runSlug && onMergeReadyRef.current) {
        onMergeReadyRef.current(event);
      }
    });

    socket.on("run-complete", (event) => {
      if (event.runSlug === runSlug && onRunCompleteRef.current) {
        onRunCompleteRef.current(event);
      }
    });

    socket.on("connection-status", (event) => {
      if (event.connected) {
        setConnectionStatus("connected");
      }
    });
  }, [enabled, runSlug, cleanup]);

  // Keep connectRef in sync with connect
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  // Reconnect function exposed to consumers
  const reconnect = useCallback(() => {
    connect();
  }, [connect]);

  // Connect on mount, cleanup on unmount
  useEffect(() => {
    if (!enabled) {
      return cleanup;
    }

    // Schedule the connection setup to run after the current render
    // to avoid synchronous setState calls within the effect body
    const connectionSetup = () => {
      cleanup();

      const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(WS_URL, {
        transports: ["websocket", "polling"],
        reconnection: false,
        timeout: 10000,
      });

      socketRef.current = socket;

      socket.on("connect", () => {
        console.log("[WebSocket] Connected");
        setConnectionStatus("connected");
        setLastError(null);
        socket.emit("subscribe-run", runSlug);

        pingIntervalRef.current = setInterval(() => {
          socket.emit("ping");
        }, PING_INTERVAL);
      });

      socket.on("disconnect", (reason) => {
        console.log(`[WebSocket] Disconnected: ${reason}`);
        setConnectionStatus("disconnected");

        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        if (reason !== "io client disconnect") {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log("[WebSocket] Attempting reconnect...");
            connectRef.current();
          }, RECONNECT_DELAY);
        }
      });

      socket.on("connect_error", (error) => {
        console.error("[WebSocket] Connection error:", error.message);
        setConnectionStatus("error");
        setLastError(error.message);

        reconnectTimeoutRef.current = setTimeout(() => {
          console.log("[WebSocket] Attempting reconnect after error...");
          connectRef.current();
        }, RECONNECT_DELAY);
      });

      socket.on("lane-activity", (event) => {
        if (event.runSlug === runSlug && onLaneActivityRef.current) {
          onLaneActivityRef.current(event);
        }
      });

      socket.on("lane-status-change", (event) => {
        if (event.runSlug === runSlug && onLaneStatusChangeRef.current) {
          onLaneStatusChangeRef.current(event);
        }
      });

      socket.on("merge-ready", (event) => {
        if (event.runSlug === runSlug && onMergeReadyRef.current) {
          onMergeReadyRef.current(event);
        }
      });

      socket.on("run-complete", (event) => {
        if (event.runSlug === runSlug && onRunCompleteRef.current) {
          onRunCompleteRef.current(event);
        }
      });

      socket.on("connection-status", (event) => {
        if (event.connected) {
          setConnectionStatus("connected");
        }
      });
    };

    // Set initial connecting status via ref check and start connection
    // The socket events will update the status asynchronously
    connectionSetup();

    return cleanup;
  }, [enabled, runSlug, cleanup]);

  // Resubscribe when runSlug changes
  useEffect(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("subscribe-run", runSlug);
    }
  }, [runSlug]);

  return {
    connectionStatus,
    isConnected: connectionStatus === "connected",
    lastError,
    reconnect,
  };
}
