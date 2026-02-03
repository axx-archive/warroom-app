"use client";

import { useState, useMemo } from "react";
import { WarRoomPlan, AgentType } from "@/lib/plan-schema";
import { generatePacketMarkdown } from "@/lib/packet-templates";
import { LaneCard } from "./LaneCard";
import { PacketPreview, PacketExpander } from "./PacketPreview";

interface PlanViewerProps {
  plan: WarRoomPlan;
  runDir: string;
}

const AGENT_COLORS: Record<AgentType, string> = {
  "product-owner": "bg-purple-500",
  architect: "bg-blue-500",
  developer: "bg-green-500",
  "staff-engineer-reviewer": "bg-indigo-500",
  "doc-updater": "bg-amber-500",
  techdebt: "bg-orange-500",
  "visual-qa": "bg-pink-500",
  "qa-tester": "bg-cyan-500",
  "security-reviewer": "bg-red-500",
};

export function PlanViewer({ plan, runDir }: PlanViewerProps) {
  const [selectedPacket, setSelectedPacket] = useState<{
    laneId: string;
    content: string;
  } | null>(null);

  // Generate packet content for all lanes (derived state, not async)
  const packets = useMemo(() => {
    const newPackets = new Map<string, string>();
    for (const lane of plan.lanes) {
      const content = generatePacketMarkdown(lane, plan);
      newPackets.set(lane.laneId, content);
    }
    return newPackets;
  }, [plan]);

  const handleViewPacket = (laneId: string) => {
    const content = packets.get(laneId);
    if (content) {
      setSelectedPacket({ laneId, content });
    }
  };

  // Group lanes by dependencies for visualization
  const laneGroups = plan.lanes.reduce<
    { level: number; lanes: typeof plan.lanes }[]
  >((acc, lane) => {
    // Determine the level based on dependencies
    let level = 0;
    if (lane.dependsOn.length > 0) {
      const depLevels = lane.dependsOn.map((depId) => {
        const existing = acc.find((g) =>
          g.lanes.some((l) => l.laneId === depId)
        );
        return existing ? existing.level : 0;
      });
      level = Math.max(...depLevels) + 1;
    }

    const existingGroup = acc.find((g) => g.level === level);
    if (existingGroup) {
      existingGroup.lanes.push(lane);
    } else {
      acc.push({ level, lanes: [lane] });
    }

    return acc;
  }, []);

  laneGroups.sort((a, b) => a.level - b.level);

  return (
    <div className="space-y-6">
      {/* Plan Header */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              Plan Generated
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400">{plan.goal}</p>
          </div>
          <span
            className={`px-3 py-1 text-sm font-medium rounded-full ${
              plan.startMode === "openclaw"
                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
            }`}
          >
            {plan.startMode === "openclaw" ? "OpenClaw" : "Claude Code Import"}
          </span>
        </div>

        {/* Plan Metadata */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-zinc-500 dark:text-zinc-400 block">Run ID</span>
            <code className="text-zinc-700 dark:text-zinc-300 font-mono text-xs">
              {plan.runSlug}
            </code>
          </div>
          <div>
            <span className="text-zinc-500 dark:text-zinc-400 block">Repository</span>
            <span className="text-zinc-700 dark:text-zinc-300">
              {plan.repo.name}
            </span>
          </div>
          <div>
            <span className="text-zinc-500 dark:text-zinc-400 block">
              Integration Branch
            </span>
            <code className="text-zinc-700 dark:text-zinc-300 font-mono text-xs">
              {plan.integrationBranch}
            </code>
          </div>
          <div>
            <span className="text-zinc-500 dark:text-zinc-400 block">Lanes</span>
            <span className="text-zinc-700 dark:text-zinc-300">
              {plan.lanes.length}
            </span>
          </div>
        </div>

        {/* Run Directory */}
        <div className="mt-4 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-md">
          <span className="text-xs text-zinc-500 dark:text-zinc-400 block mb-1">
            Run Directory
          </span>
          <code className="text-sm font-mono text-zinc-700 dark:text-zinc-300 break-all">
            {runDir}
          </code>
        </div>
      </div>

      {/* Agent Chain Visualization */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
          Agent Chain
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          {plan.lanes.map((lane, idx) => (
            <div key={lane.laneId} className="flex items-center gap-2">
              <div
                className={`px-3 py-1.5 rounded-md text-white text-sm font-medium ${AGENT_COLORS[lane.agent]}`}
              >
                {lane.agent}
              </div>
              {idx < plan.lanes.length - 1 && (
                <span className="text-zinc-400">→</span>
              )}
            </div>
          ))}
        </div>

        {/* Parallelization Note */}
        {laneGroups.some((g) => g.lanes.length > 1) && (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            <span className="font-medium">Parallelization:</span> Some lanes can
            run in parallel. Check dependencies to see which lanes can start
            together.
          </p>
        )}
      </div>

      {/* Lane List */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
          Lanes
        </h3>
        <div className="space-y-4">
          {laneGroups.map((group, groupIdx) => (
            <div key={groupIdx}>
              {group.level > 0 && (
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    Level {group.level} (depends on above)
                  </span>
                  <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
                </div>
              )}
              <div className={`grid gap-4 ${group.lanes.length > 1 ? "md:grid-cols-2" : ""}`}>
                {group.lanes.map((lane) => (
                  <LaneCard
                    key={lane.laneId}
                    lane={lane}
                    onViewPacket={() => handleViewPacket(lane.laneId)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* All Packets Expandable */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
          Run Packets
        </h3>
        <div className="space-y-2">
          {plan.lanes.map((lane) => (
            <PacketExpander
              key={lane.laneId}
              laneId={lane.laneId}
              content={packets.get(lane.laneId) ?? ""}
            />
          ))}
        </div>
      </div>

      {/* Merge Configuration */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
          Merge Plan
        </h3>
        <div className="space-y-3">
          <div>
            <span className="text-sm text-zinc-500 dark:text-zinc-400 block mb-1">
              Proposed Order
            </span>
            <div className="flex flex-wrap gap-2">
              {plan.merge.proposedOrder.map((laneId, idx) => (
                <div key={laneId} className="flex items-center gap-1">
                  <code className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded text-sm">
                    {laneId}
                  </code>
                  {idx < plan.merge.proposedOrder.length - 1 && (
                    <span className="text-zinc-400">→</span>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-4 text-sm">
            <div>
              <span className="text-zinc-500 dark:text-zinc-400">Method: </span>
              <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                {plan.merge.method}
              </span>
            </div>
            {plan.merge.requiresHuman && (
              <div className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded text-xs font-medium">
                Requires Human Review
              </div>
            )}
          </div>
          {plan.merge.notes && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {plan.merge.notes}
            </p>
          )}
        </div>
      </div>

      {/* Packet Modal */}
      {selectedPacket && (
        <PacketPreview
          laneId={selectedPacket.laneId}
          content={selectedPacket.content}
          onClose={() => setSelectedPacket(null)}
        />
      )}
    </div>
  );
}
