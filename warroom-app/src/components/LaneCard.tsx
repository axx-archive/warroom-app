"use client";

import { Lane, AgentType } from "@/lib/plan-schema";

interface LaneCardProps {
  lane: Lane;
  packetContent?: string;
  onViewPacket?: () => void;
}

const AGENT_CONFIG: Record<AgentType, { label: string; color: string; bgColor: string }> = {
  "product-owner": {
    label: "Product Owner",
    color: "#a855f7",
    bgColor: "rgba(168, 85, 247, 0.15)",
  },
  architect: {
    label: "Architect",
    color: "#3b82f6",
    bgColor: "rgba(59, 130, 246, 0.15)",
  },
  developer: {
    label: "Developer",
    color: "#22c55e",
    bgColor: "rgba(34, 197, 94, 0.15)",
  },
  "staff-engineer-reviewer": {
    label: "Staff Engineer",
    color: "#6366f1",
    bgColor: "rgba(99, 102, 241, 0.15)",
  },
  "doc-updater": {
    label: "Doc Updater",
    color: "var(--accent)",
    bgColor: "rgba(124, 58, 237, 0.15)",
  },
  techdebt: {
    label: "Tech Debt",
    color: "#f97316",
    bgColor: "rgba(249, 115, 22, 0.15)",
  },
  "visual-qa": {
    label: "Visual QA",
    color: "#ec4899",
    bgColor: "rgba(236, 72, 153, 0.15)",
  },
  "qa-tester": {
    label: "QA Tester",
    color: "#06b6d4",
    bgColor: "rgba(6, 182, 212, 0.15)",
  },
  "security-reviewer": {
    label: "Security",
    color: "#ef4444",
    bgColor: "rgba(239, 68, 68, 0.15)",
  },
};

export function LaneCard({ lane, onViewPacket }: LaneCardProps) {
  const agentInfo = AGENT_CONFIG[lane.agent];
  const hasDependencies = lane.dependsOn.length > 0;

  return (
    <div className="lane-card group">
      <div className="flex-1 min-w-0">
        {/* Lane ID and Agent Badge */}
        <div className="flex items-center gap-3 mb-3">
          <span className="mono text-sm" style={{ color: "var(--muted)" }}>
            {lane.laneId}
          </span>
          <span
            className="badge"
            style={{
              color: agentInfo.color,
              backgroundColor: agentInfo.bgColor,
              borderColor: `${agentInfo.color}40`,
            }}
          >
            {agentInfo.label}
          </span>
        </div>

        {/* Branch */}
        <div className="mb-2">
          <span className="label mr-2">Branch</span>
          <code className="mono" style={{ background: "var(--panel)", padding: "2px 6px", borderRadius: "3px" }}>
            {lane.branch}
          </code>
        </div>

        {/* Dependencies */}
        {hasDependencies && (
          <div className="mb-2">
            <span className="label mr-2">Depends on</span>
            <span className="small" style={{ color: "var(--muted)" }}>
              {lane.dependsOn.join(", ")}
            </span>
          </div>
        )}

        {/* Worktree Path */}
        <div className="mono small truncate" style={{ color: "var(--muted)" }} title={lane.worktreePath}>
          {lane.worktreePath}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col items-end gap-2 ml-4">
        {onViewPacket && (
          <button
            onClick={onViewPacket}
            className="btn btn--ghost btn--sm"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            View Packet
          </button>
        )}

        {/* Autonomy indicator */}
        {lane.autonomy.dangerouslySkipPermissions && (
          <span className="badge badge--warning">
            Autonomous
          </span>
        )}
      </div>

      {/* Verification Commands */}
      {lane.verify.commands.length > 0 && (
        <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
          <span className="label block mb-2">
            Verification Commands
          </span>
          <div className="flex flex-wrap gap-1.5">
            {lane.verify.commands.map((cmd, idx) => (
              <code
                key={idx}
                className="mono"
                style={{
                  fontSize: "11px",
                  background: "var(--bg)",
                  color: "var(--muted)",
                  padding: "4px 8px",
                  borderRadius: "3px",
                  border: "1px solid var(--border)",
                }}
              >
                {cmd}
              </code>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
