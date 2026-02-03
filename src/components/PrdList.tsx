"use client";

import { useState } from "react";
import type { PrdInfo } from "@/lib/fs-utils";

interface PrdListProps {
  prds: PrdInfo[];
}

function getTypeColor(type: PrdInfo["type"]): string {
  switch (type) {
    case "json":
      return "text-yellow-700 bg-yellow-50";
    case "markdown":
      return "text-blue-700 bg-blue-50";
    case "text":
      return "text-gray-700 bg-gray-100";
    default:
      return "text-gray-500 bg-gray-50";
  }
}

function getTypeLabel(type: PrdInfo["type"]): string {
  switch (type) {
    case "json":
      return "JSON";
    case "markdown":
      return "MD";
    case "text":
      return "TXT";
    default:
      return "?";
  }
}

export function PrdList({ prds }: PrdListProps) {
  const [expandedPrd, setExpandedPrd] = useState<string | null>(null);

  if (prds.length === 0) {
    return (
      <div className="text-sm text-gray-500 italic">
        No files found in tasks/
      </div>
    );
  }

  // Sort: prd.json first, then progress.txt, then others alphabetically
  const sortedPrds = [...prds].sort((a, b) => {
    if (a.name === "prd.json") return -1;
    if (b.name === "prd.json") return 1;
    if (a.name === "progress.txt") return -1;
    if (b.name === "progress.txt") return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-2">
      {sortedPrds.map((prd) => (
        <div
          key={prd.path}
          className="border border-gray-200 rounded-md overflow-hidden"
        >
          <button
            onClick={() =>
              setExpandedPrd(expandedPrd === prd.name ? null : prd.name)
            }
            className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 text-left"
          >
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{prd.name}</span>
              <span
                className={`text-xs px-1.5 py-0.5 rounded ${getTypeColor(prd.type)}`}
              >
                {getTypeLabel(prd.type)}
              </span>
            </div>
            <span className="text-gray-400 text-xs">
              {expandedPrd === prd.name ? "[-]" : "[+]"}
            </span>
          </button>

          {expandedPrd === prd.name && prd.content && (
            <div className="px-3 py-2 bg-white border-t border-gray-200">
              {prd.type === "json" ? (
                <pre className="text-xs text-gray-700 whitespace-pre-wrap overflow-x-auto max-h-96 overflow-y-auto">
                  {formatJson(prd.content)}
                </pre>
              ) : (
                <pre className="text-xs text-gray-700 whitespace-pre-wrap overflow-x-auto max-h-96 overflow-y-auto">
                  {prd.content.slice(0, 5000)}
                  {prd.content.length > 5000 && "\n\n... (truncated)"}
                </pre>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function formatJson(content: string): string {
  try {
    const parsed = JSON.parse(content);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return content;
  }
}
