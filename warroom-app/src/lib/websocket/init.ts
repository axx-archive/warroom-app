// Initialize WebSocket server on Next.js server startup
// This module is imported by API routes that need to emit WebSocket events

import { getSocketServer } from "./server";

// Initialize the WebSocket server when this module is first imported
// Only runs on the server side
let initialized = false;

export function initializeWebSocketServer(): void {
  if (typeof window !== "undefined") {
    return; // Client-side, do nothing
  }

  if (initialized) {
    return; // Already initialized
  }

  // Never start a listener during build/SSR compilation.
  // Next sets NEXT_PHASE=phase-production-build during `next build`.
  if (process.env.NEXT_PHASE === "phase-production-build" || process.env.npm_lifecycle_event === "build") {
    return;
  }

  const server = getSocketServer();
  if (server) {
    initialized = true;
    console.log("[WebSocket] Server initialized");
  }
}

// Auto-initialize when imported on server (but not during build)
if (typeof window === "undefined") {
  initializeWebSocketServer();
}
