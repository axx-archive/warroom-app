"use client";

import { useState } from "react";

interface ClaudeMdViewerProps {
  content: string;
}

export function ClaudeMdViewer({ content }: ClaudeMdViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!content) {
    return (
      <div className="text-sm text-gray-500 italic">
        No CLAUDE.md found in repo root
      </div>
    );
  }

  const previewLength = 500;
  const needsTruncation = content.length > previewLength;
  const displayContent = isExpanded ? content : content.slice(0, previewLength);

  return (
    <div className="border border-gray-200 rounded-md overflow-hidden">
      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <span className="text-sm font-medium">CLAUDE.md</span>
        <span className="text-xs text-gray-500">
          {content.length.toLocaleString()} chars
        </span>
      </div>

      <div className="px-3 py-2 bg-white">
        <pre className="text-xs text-gray-700 whitespace-pre-wrap overflow-x-auto max-h-96 overflow-y-auto">
          {displayContent}
          {needsTruncation && !isExpanded && "..."}
        </pre>

        {needsTruncation && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-2 text-xs text-blue-600 hover:underline"
          >
            {isExpanded ? "Show less" : "Show more"}
          </button>
        )}
      </div>
    </div>
  );
}
