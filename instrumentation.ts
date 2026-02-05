// Next.js instrumentation file - runs once when the server starts
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  console.log("[Instrumentation] register() called, NEXT_RUNTIME:", process.env.NEXT_RUNTIME);

  // Only run on server-side Node.js runtime (not edge, not build)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.log("[Instrumentation] Initializing WebSocket server...");
    const { initializeWebSocketServer } = await import("@/lib/websocket/init");
    initializeWebSocketServer();
  }
}
