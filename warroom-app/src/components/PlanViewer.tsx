"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { WarRoomPlan, AgentType } from "@/lib/plan-schema";
import { generatePacketMarkdown } from "@/lib/packet-templates";
import { LaneCard } from "./LaneCard";
import { PacketPreview, PacketExpander } from "./PacketPreview";

/**
 * Generates a PM prompt for Claude Code to kick off manual planning.
 * Includes /warroom-plan command reference, repoPath, goal, and constraints.
 */
function generatePMPrompt(plan: WarRoomPlan): string {
  const constraints = [
    `Integration branch: ${plan.integrationBranch}`,
    `Lanes: ${plan.lanes.length} (${plan.lanes.map(l => l.agent).join(" → ")})`,
    `Merge method: ${plan.merge.method}`,
  ];

  if (plan.workstream.type === "ralph_workstream" && plan.workstream.prdPath) {
    constraints.push(`PRD: ${plan.workstream.prdPath}`);
  }

  return `# War Room Planning Session

Use the /warroom-plan skill to begin planning for this project.

## Repository
- **Path**: ${plan.repo.path}
- **Name**: ${plan.repo.name}

## Goal
${plan.goal}

## Constraints
${constraints.map(c => `- ${c}`).join("\n")}

## Run Context
- **Run ID**: ${plan.runSlug}
- **Run Directory**: ${plan.runDir}

## Instructions
1. Review the goal and constraints above
2. Stage the lanes when ready: each lane will get a Cursor window
3. Copy each lane's packet and paste it to start the agent
4. Monitor progress and mark lanes complete as work finishes
5. Run merge choreography when all lanes are done

Refer to the War Room UI for real-time status tracking.
`;
}

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
  const router = useRouter();
  const [selectedPacket, setSelectedPacket] = useState<{
    laneId: string;
    content: string;
  } | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");
  const [isStaging, setIsStaging] = useState(false);
  const [stageError, setStageError] = useState<string | null>(null);

  const handleCopyPMPrompt = useCallback(async () => {
    const prompt = generatePMPrompt(plan);
    try {
      await navigator.clipboard.writeText(prompt);
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 2000);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }
  }, [plan]);

  const handleStageLanes = useCallback(async () => {
    setIsStaging(true);
    setStageError(null);
    try {
      const response = await fetch(`/api/runs/${plan.runSlug}/stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to stage lanes");
      }

      // Navigate to the run detail page after successful staging
      router.push(`/runs/${plan.runSlug}`);
    } catch (err) {
      setStageError(err instanceof Error ? err.message : "Failed to stage lanes");
    } finally {
      setIsStaging(false);
    }
  }, [plan.runSlug, router]);

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

      {/* Next Steps - Prominent Action Panel */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-6">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
          <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm">!</span>
          Next Steps
        </h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
          Your plan is ready. War Room has created run files on disk. Now choose how to proceed:
        </p>

        {/* Two-column action cards */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Option 1: Stage Lanes (Recommended) */}
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
            <div className="flex items-start gap-3 mb-3">
              <span className="px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded">
                Recommended
              </span>
            </div>
            <h4 className="font-medium text-zinc-900 dark:text-zinc-100 mb-2">
              Stage Lanes
            </h4>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
              Opens a Cursor window for each lane with the packet ready. You paste the packet into each Cursor to start the agent.
            </p>
            <ul className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1 mb-4">
              <li>• Creates git worktrees for each lane</li>
              <li>• Opens {plan.lanes.length} Cursor window{plan.lanes.length !== 1 ? "s" : ""}</li>
              <li>• Writes WARROOM_PACKET.md to each worktree</li>
            </ul>
            <button
              onClick={handleStageLanes}
              disabled={isStaging}
              className={`w-full px-4 py-2.5 text-sm font-medium rounded-md transition-colors ${
                isStaging
                  ? "bg-zinc-100 text-zinc-400 cursor-not-allowed dark:bg-zinc-800 dark:text-zinc-500"
                  : "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
              }`}
            >
              {isStaging ? "Staging..." : "Stage Lanes & Open Cursor"}
            </button>
          </div>

          {/* Option 2: Manual Mode */}
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
            <div className="flex items-start gap-3 mb-3">
              <span className="px-2 py-0.5 text-xs font-semibold bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 rounded">
                Manual
              </span>
            </div>
            <h4 className="font-medium text-zinc-900 dark:text-zinc-100 mb-2">
              Copy PM Prompt
            </h4>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
              Copies a prompt to your clipboard for pasting into Claude Code. Use this if you want to manually orchestrate the agents.
            </p>
            <ul className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1 mb-4">
              <li>• Includes /warroom-plan command reference</li>
              <li>• Contains repo path, goal, and constraints</li>
              <li>• Lists all lanes and their dependencies</li>
            </ul>
            <button
              onClick={handleCopyPMPrompt}
              className={`w-full px-4 py-2.5 text-sm font-medium rounded-md transition-colors ${
                copyStatus === "copied"
                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              {copyStatus === "copied" ? "Copied!" : "Copy PM Prompt"}
            </button>
          </div>
        </div>

        {/* Error display */}
        {stageError && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-sm text-red-700 dark:text-red-400">{stageError}</p>
          </div>
        )}

        {/* Checklist */}
        <div className="mt-6 pt-4 border-t border-blue-200 dark:border-blue-800">
          <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-3">
            What happens after staging:
          </h4>
          <ol className="text-sm text-zinc-600 dark:text-zinc-400 space-y-2">
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 bg-zinc-200 dark:bg-zinc-700 rounded-full flex items-center justify-center text-xs font-medium shrink-0 mt-0.5">1</span>
              <span><strong>Copy packet</strong> from WARROOM_PACKET.md in each Cursor window</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 bg-zinc-200 dark:bg-zinc-700 rounded-full flex items-center justify-center text-xs font-medium shrink-0 mt-0.5">2</span>
              <span><strong>Paste packet</strong> into Claude Code chat to start the agent</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 bg-zinc-200 dark:bg-zinc-700 rounded-full flex items-center justify-center text-xs font-medium shrink-0 mt-0.5">3</span>
              <span><strong>Monitor progress</strong> in War Room and mark lanes complete as work finishes</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 bg-zinc-200 dark:bg-zinc-700 rounded-full flex items-center justify-center text-xs font-medium shrink-0 mt-0.5">4</span>
              <span><strong>Run merge</strong> when all lanes are done to integrate changes</span>
            </li>
          </ol>
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
