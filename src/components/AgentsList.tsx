"use client";

import { useState } from "react";
import type { AgentInfo } from "@/lib/fs-utils";

interface AgentsListProps {
  agents: AgentInfo[];
}

export function AgentsList({ agents }: AgentsListProps) {
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  if (agents.length === 0) {
    return (
      <div className="text-sm text-gray-500 italic">
        No agents found in .claude/agents/
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {agents.map((agent) => (
        <div
          key={agent.path}
          className="border border-gray-200 rounded-md overflow-hidden"
        >
          <button
            onClick={() =>
              setExpandedAgent(expandedAgent === agent.name ? null : agent.name)
            }
            className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 text-left"
          >
            <span className="font-medium text-sm">{agent.name}</span>
            <span className="text-gray-400 text-xs">
              {expandedAgent === agent.name ? "[-]" : "[+]"}
            </span>
          </button>

          {expandedAgent === agent.name && agent.content && (
            <div className="px-3 py-2 bg-white border-t border-gray-200">
              <pre className="text-xs text-gray-700 whitespace-pre-wrap overflow-x-auto max-h-64 overflow-y-auto">
                {agent.content.slice(0, 2000)}
                {agent.content.length > 2000 && "..."}
              </pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
