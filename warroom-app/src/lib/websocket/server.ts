// Socket.io server for War Room real-time updates
// This runs as part of the Next.js server using a custom HTTP server

import { Server as HttpServer, createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import {
  ServerToClientEvents,
  ClientToServerEvents,
  SocketData,
  LaneActivityEvent,
  LaneStatusChangeEvent,
  LaneProgressEvent,
  MergeReadyEvent,
  RunCompleteEvent,
} from "./types";

const WS_PORT = parseInt(process.env.WS_PORT || "3001", 10);

// Singleton instance
let io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData> | null = null;
let httpServer: HttpServer | null = null;

// Get or create the Socket.io server
export function getSocketServer(): SocketIOServer<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData> | null {
  // Server-side only
  if (typeof window !== "undefined") {
    return null;
  }

  if (io) {
    return io;
  }

  // Create HTTP server for Socket.io
  httpServer = createServer();

  io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer, {
    cors: {
      origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    console.log(`[WebSocket] Client connected: ${socket.id}`);

    // Initialize socket data
    socket.data.subscribedRuns = new Set();

    // Handle run subscription
    socket.on("subscribe-run", (runSlug: string) => {
      console.log(`[WebSocket] Client ${socket.id} subscribed to run: ${runSlug}`);
      socket.join(`run:${runSlug}`);
      socket.data.subscribedRuns.add(runSlug);
    });

    // Handle run unsubscription
    socket.on("unsubscribe-run", (runSlug: string) => {
      console.log(`[WebSocket] Client ${socket.id} unsubscribed from run: ${runSlug}`);
      socket.leave(`run:${runSlug}`);
      socket.data.subscribedRuns.delete(runSlug);
    });

    // Handle ping for keep-alive
    socket.on("ping", () => {
      socket.emit("connection-status", {
        connected: true,
        serverTime: new Date().toISOString(),
      });
    });

    // Handle disconnect
    socket.on("disconnect", (reason) => {
      console.log(`[WebSocket] Client disconnected: ${socket.id}, reason: ${reason}`);
    });
  });

  // Start listening
  httpServer.listen(WS_PORT, () => {
    console.log(`[WebSocket] Server listening on port ${WS_PORT}`);
  });

  return io;
}

// Emit lane activity event to subscribed clients
export function emitLaneActivity(event: LaneActivityEvent): void {
  const server = getSocketServer();
  if (server) {
    server.to(`run:${event.runSlug}`).emit("lane-activity", event);
  }
}

// Emit lane status change event to subscribed clients
export function emitLaneStatusChange(event: LaneStatusChangeEvent): void {
  const server = getSocketServer();
  if (server) {
    server.to(`run:${event.runSlug}`).emit("lane-status-change", event);
  }
}

// Emit lane progress event (from LANE_STATUS.json changes) to subscribed clients
export function emitLaneProgress(event: LaneProgressEvent): void {
  const server = getSocketServer();
  if (server) {
    server.to(`run:${event.runSlug}`).emit("lane-progress", event);
  }
}

// Emit merge ready event to subscribed clients
export function emitMergeReady(event: MergeReadyEvent): void {
  const server = getSocketServer();
  if (server) {
    server.to(`run:${event.runSlug}`).emit("merge-ready", event);
  }
}

// Emit run complete event to subscribed clients
export function emitRunComplete(event: RunCompleteEvent): void {
  const server = getSocketServer();
  if (server) {
    server.to(`run:${event.runSlug}`).emit("run-complete", event);
  }
}

// Graceful shutdown
export function closeSocketServer(): Promise<void> {
  return new Promise((resolve) => {
    if (io) {
      io.close(() => {
        console.log("[WebSocket] Server closed");
        io = null;
        httpServer = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}
