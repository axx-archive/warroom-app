"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { WarRoomPlan, AgentType } from "@/lib/plan-schema";
import { generatePacketMarkdown } from "@/lib/packet-templates";
import { LaneCard } from "./LaneCard";
import { PacketPreview, PacketExpander } from "./PacketPreview";

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
  "product-owner": "#a855f7",
  architect: "#3b82f6",
  developer: "#22c55e",
  "staff-engineer-reviewer": "#6366f1",
  "doc-updater": "var(--amber)",
  techdebt: "#f97316",
  "visual-qa": "#ec4899",
  "qa-tester": "#06b6d4",
  "security-reviewer": "#ef4444",
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

      router.push(`/runs/${plan.runSlug}`);
    } catch (err) {
      setStageError(err instanceof Error ? err.message : "Failed to stage lanes");
    } finally {
      setIsStaging(false);
    }
  }, [plan.runSlug, router]);

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

  const laneGroups = plan.lanes.reduce<
    { level: number; lanes: typeof plan.lanes }[]
  >((acc, lane) => {
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
      <div className="panel-elevated p-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded bg-[var(--amber-glow)] border border-[var(--amber-dim)] flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-[var(--amber)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-1">
                Mission Plan Generated
              </h2>
              <p className="text-[var(--text-secondary)]">{plan.goal}</p>
            </div>
          </div>
          <span
            className="badge"
            style={{
              color: plan.startMode === "openclaw" ? "var(--status-success)" : "var(--cyan)",
              backgroundColor: plan.startMode === "openclaw" ? "rgba(34, 197, 94, 0.15)" : "rgba(6, 182, 212, 0.15)",
              borderColor: plan.startMode === "openclaw" ? "rgba(34, 197, 94, 0.3)" : "rgba(6, 182, 212, 0.3)",
            }}
          >
            {plan.startMode === "openclaw" ? "OpenClaw" : "Claude Code Import"}
          </span>
        </div>

        {/* Plan Metadata */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-[var(--hull)] rounded border border-[var(--border-subtle)]">
          <div>
            <span className="label-caps block mb-1">Run ID</span>
            <code className="text-xs font-mono text-[var(--amber)]">
              {plan.runSlug}
            </code>
          </div>
          <div>
            <span className="label-caps block mb-1">Repository</span>
            <span className="text-sm text-[var(--text-primary)]">
              {plan.repo.name}
            </span>
          </div>
          <div>
            <span className="label-caps block mb-1">Integration Branch</span>
            <code className="code-inline text-xs">
              {plan.integrationBranch}
            </code>
          </div>
          <div>
            <span className="label-caps block mb-1">Lanes</span>
            <span className="text-sm text-[var(--text-primary)]">
              {plan.lanes.length}
            </span>
          </div>
        </div>

        {/* Run Directory */}
        <div className="mt-4 p-3 bg-[var(--hull)] rounded border border-[var(--border-subtle)]">
          <span className="label-caps block mb-1">Run Directory</span>
          <code className="text-xs font-mono text-[var(--text-secondary)] break-all">
            {runDir}
          </code>
        </div>
      </div>

      {/* Next Steps - Prominent Action Panel */}
      <div className="panel-bracketed p-6" style={{ borderColor: "var(--amber-dim)" }}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-[var(--amber)] flex items-center justify-center animate-[heartbeat_2s_ease-in-out_infinite]">
            <svg className="w-5 h-5 text-[var(--void)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">
              Next Steps
            </h3>
            <p className="text-xs font-mono text-[var(--text-ghost)] uppercase tracking-wider">
              Deploy Agent Lanes
            </p>
          </div>
        </div>

        <p className="text-sm text-[var(--text-secondary)] mb-6">
          Your mission plan is ready. War Room has created run files on disk. Choose how to proceed:
        </p>

        {/* Two-column action cards */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Option 1: Stage Lanes (Recommended) */}
          <div className="panel p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="badge badge-success text-[10px]">Recommended</span>
            </div>
            <h4 className="font-medium text-[var(--text-primary)] mb-2">
              Stage Lanes
            </h4>
            <p className="text-sm text-[var(--text-tertiary)] mb-4">
              Opens a Cursor window for each lane with the packet ready. You paste the packet into each Cursor to start the agent.
            </p>
            <ul className="text-xs text-[var(--text-ghost)] space-y-1.5 mb-5">
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-[var(--text-ghost)]" />
                Creates git worktrees for each lane
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-[var(--text-ghost)]" />
                Opens {plan.lanes.length} Cursor window{plan.lanes.length !== 1 ? "s" : ""}
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-[var(--text-ghost)]" />
                Writes WARROOM_PACKET.md to each worktree
              </li>
            </ul>
            <button
              onClick={handleStageLanes}
              disabled={isStaging}
              className="btn-primary w-full"
            >
              {isStaging ? (
                <>
                  <span className="spinner" />
                  Staging...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Stage Lanes & Open Cursor
                </>
              )}
            </button>
          </div>

          {/* Option 2: Manual Mode */}
          <div className="panel p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="badge badge-neutral text-[10px]">Manual</span>
            </div>
            <h4 className="font-medium text-[var(--text-primary)] mb-2">
              Copy PM Prompt
            </h4>
            <p className="text-sm text-[var(--text-tertiary)] mb-4">
              Copies a prompt to your clipboard for pasting into Claude Code. Use this if you want to manually orchestrate the agents.
            </p>
            <ul className="text-xs text-[var(--text-ghost)] space-y-1.5 mb-5">
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-[var(--text-ghost)]" />
                Includes /warroom-plan command reference
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-[var(--text-ghost)]" />
                Contains repo path, goal, and constraints
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-[var(--text-ghost)]" />
                Lists all lanes and their dependencies
              </li>
            </ul>
            <button
              onClick={handleCopyPMPrompt}
              className={copyStatus === "copied" ? "btn-success w-full" : "btn-secondary w-full"}
            >
              {copyStatus === "copied" ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy PM Prompt
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error display */}
        {stageError && (
          <div className="mt-4 p-4 rounded border border-[var(--status-danger-dim)] bg-[rgba(239,68,68,0.1)]">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-[var(--status-danger)] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm text-[var(--status-danger)]">{stageError}</p>
            </div>
          </div>
        )}

        {/* Checklist */}
        <div className="mt-6 pt-5 border-t border-[var(--border-subtle)]">
          <h4 className="text-sm font-medium text-[var(--text-primary)] mb-4">
            What happens after staging:
          </h4>
          <ol className="space-y-3">
            {[
              { step: 1, action: "Copy packet", detail: "from WARROOM_PACKET.md in each Cursor window" },
              { step: 2, action: "Paste packet", detail: "into Claude Code chat to start the agent" },
              { step: 3, action: "Monitor progress", detail: "in War Room and mark lanes complete as work finishes" },
              { step: 4, action: "Run merge", detail: "when all lanes are done to integrate changes" },
            ].map(({ step, action, detail }) => (
              <li key={step} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-[var(--panel)] border border-[var(--border-default)] flex items-center justify-center text-xs font-mono text-[var(--text-tertiary)] flex-shrink-0">
                  {step}
                </span>
                <span className="text-sm text-[var(--text-secondary)]">
                  <strong className="text-[var(--text-primary)]">{action}</strong> {detail}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Agent Chain Visualization */}
      <div className="panel p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded bg-[var(--cyan-glow)] border border-[var(--cyan-dim)] flex items-center justify-center">
            <svg className="w-4 h-4 text-[var(--cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-[var(--text-primary)]">
            Agent Chain
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {plan.lanes.map((lane, idx) => (
            <div key={lane.laneId} className="flex items-center gap-2">
              <div
                className="px-3 py-1.5 rounded text-sm font-medium"
                style={{
                  color: AGENT_COLORS[lane.agent],
                  backgroundColor: `${AGENT_COLORS[lane.agent]}20`,
                  border: `1px solid ${AGENT_COLORS[lane.agent]}40`,
                }}
              >
                {lane.agent}
              </div>
              {idx < plan.lanes.length - 1 && (
                <svg className="w-4 h-4 text-[var(--text-ghost)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </div>
          ))}
        </div>

        {laneGroups.some((g) => g.lanes.length > 1) && (
          <p className="mt-4 text-sm text-[var(--text-tertiary)]">
            <span className="font-medium text-[var(--amber)]">Parallelization:</span>{" "}
            Some lanes can run in parallel. Check dependencies to see which lanes can start together.
          </p>
        )}
      </div>

      {/* Lane List */}
      <div className="panel p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded bg-[var(--panel-elevated)] border border-[var(--border-default)] flex items-center justify-center">
            <svg className="w-4 h-4 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-[var(--text-primary)]">
            Lanes
          </h3>
        </div>

        <div className="space-y-4">
          {laneGroups.map((group, groupIdx) => (
            <div key={groupIdx}>
              {group.level > 0 && (
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-px flex-1 bg-[var(--border-subtle)]" />
                  <span className="text-xs font-mono text-[var(--text-ghost)] uppercase tracking-wider">
                    Level {group.level} (depends on above)
                  </span>
                  <div className="h-px flex-1 bg-[var(--border-subtle)]" />
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
      <div className="panel p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded bg-[var(--panel-elevated)] border border-[var(--border-default)] flex items-center justify-center">
            <svg className="w-4 h-4 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-[var(--text-primary)]">
            Run Packets
          </h3>
        </div>

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
      <div className="panel p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded bg-[rgba(168,85,247,0.15)] border border-[rgba(168,85,247,0.3)] flex items-center justify-center">
            <svg className="w-4 h-4 text-[#a855f7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-[var(--text-primary)]">
            Merge Plan
          </h3>
        </div>

        <div className="space-y-4">
          <div>
            <span className="label-caps block mb-2">Proposed Order</span>
            <div className="flex flex-wrap gap-2">
              {plan.merge.proposedOrder.map((laneId, idx) => (
                <div key={laneId} className="flex items-center gap-1.5">
                  <code className="px-2 py-1 bg-[var(--hull)] text-[var(--text-secondary)] rounded text-xs font-mono border border-[var(--border-subtle)]">
                    {laneId}
                  </code>
                  {idx < plan.merge.proposedOrder.length - 1 && (
                    <svg className="w-3 h-3 text-[var(--text-ghost)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-4">
            <div>
              <span className="label-caps block mb-1">Method</span>
              <span className="badge badge-neutral">{plan.merge.method}</span>
            </div>
            {plan.merge.requiresHuman && (
              <div>
                <span className="label-caps block mb-1">Review</span>
                <span className="badge badge-warning">Requires Human Review</span>
              </div>
            )}
          </div>

          {plan.merge.notes && (
            <p className="text-sm text-[var(--text-tertiary)]">
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
