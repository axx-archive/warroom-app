"use client";

import { Lane, AgentType } from "@/lib/plan-schema";

interface LaneCardProps {
  lane: Lane;
  packetContent?: string;
  onViewPacket?: () => void;
}

const AGENT_LABELS: Record<AgentType, { label: string; color: string }> = {
  "product-owner": { label: "Product Owner", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
  architect: { label: "Architect", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  developer: { label: "Developer", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  "staff-engineer-reviewer": { label: "Staff Engineer", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300" },
  "doc-updater": { label: "Doc Updater", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  techdebt: { label: "Tech Debt", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" },
  "visual-qa": { label: "Visual QA", color: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300" },
  "qa-tester": { label: "QA Tester", color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300" },
  "security-reviewer": { label: "Security", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
};

export function LaneCard({ lane, onViewPacket }: LaneCardProps) {
  const agentInfo = AGENT_LABELS[lane.agent];
  const hasDependencies = lane.dependsOn.length > 0;

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Lane ID and Agent Badge */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-mono text-zinc-500 dark:text-zinc-400">
              {lane.laneId}
            </span>
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${agentInfo.color}`}>
              {agentInfo.label}
            </span>
          </div>

          {/* Branch */}
          <div className="mb-2">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Branch: </span>
            <code className="text-sm font-mono text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
              {lane.branch}
            </code>
          </div>

          {/* Dependencies */}
          {hasDependencies && (
            <div className="mb-2">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Depends on:{" "}
              </span>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                {lane.dependsOn.join(", ")}
              </span>
            </div>
          )}

          {/* Worktree Path */}
          <div className="text-xs text-zinc-400 dark:text-zinc-500 truncate" title={lane.worktreePath}>
            {lane.worktreePath}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          {onViewPacket && (
            <button
              onClick={onViewPacket}
              className="px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md transition-colors"
            >
              View Packet
            </button>
          )}

          {/* Autonomy indicator */}
          {lane.autonomy.dangerouslySkipPermissions && (
            <span className="px-2 py-1 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">
              Autonomous
            </span>
          )}
        </div>
      </div>

      {/* Verification Commands */}
      {lane.verify.commands.length > 0 && (
        <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <span className="text-xs text-zinc-500 dark:text-zinc-400 block mb-1">
            Verification:
          </span>
          <div className="flex flex-wrap gap-1">
            {lane.verify.commands.map((cmd, idx) => (
              <code
                key={idx}
                className="text-xs font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-1.5 py-0.5 rounded"
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
