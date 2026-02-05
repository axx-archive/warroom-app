"use client";

import { ConnectionStatus } from "@/hooks/useWebSocket";

interface ConnectionStatusIndicatorProps {
  status: ConnectionStatus;
  usingWebSocket: boolean;
  onReconnect?: () => void;
}

export function ConnectionStatusIndicator({
  status,
  usingWebSocket,
  onReconnect,
}: ConnectionStatusIndicatorProps) {
  const getStatusConfig = () => {
    switch (status) {
      case "connected":
        return {
          color: "#22c55e",
          bgColor: "rgba(34, 197, 94, 0.15)",
          label: "Live",
          pulse: true,
        };
      case "connecting":
        return {
          color: "#f59e0b",
          bgColor: "rgba(245, 158, 11, 0.15)",
          label: "Connecting...",
          pulse: true,
        };
      case "disconnected":
        return {
          color: "#6b7280",
          bgColor: "rgba(107, 114, 128, 0.15)",
          label: "Polling",
          pulse: false,
        };
      case "error":
        return {
          color: "#ef4444",
          bgColor: "rgba(239, 68, 68, 0.15)",
          label: "Connection Error",
          pulse: false,
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-lg border font-mono text-xs"
      style={{
        backgroundColor: "var(--surface-raised)",
        borderColor: config.color,
        boxShadow: `0 0 10px ${config.bgColor}`,
      }}
    >
      {/* Status indicator dot */}
      <span
        className={`w-2 h-2 rounded-full ${config.pulse ? "animate-pulse" : ""}`}
        style={{ backgroundColor: config.color }}
      />

      {/* Status label */}
      <span style={{ color: config.color }}>{config.label}</span>

      {/* WebSocket indicator */}
      {usingWebSocket && status === "connected" && (
        <span
          className="ml-1 text-[10px] px-1.5 py-0.5 rounded"
          style={{
            backgroundColor: config.bgColor,
            color: config.color,
          }}
        >
          WS
        </span>
      )}

      {/* Reconnect button for error/disconnected state */}
      {(status === "error" || status === "disconnected") && onReconnect && (
        <button
          onClick={onReconnect}
          className="ml-1 text-[10px] px-1.5 py-0.5 rounded hover:opacity-80 transition-opacity"
          style={{
            backgroundColor: "rgba(99, 102, 241, 0.15)",
            color: "#818cf8",
          }}
          title="Attempt to reconnect WebSocket"
        >
          Reconnect
        </button>
      )}
    </div>
  );
}
