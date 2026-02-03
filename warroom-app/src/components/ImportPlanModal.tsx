"use client";

import { useState, useCallback } from "react";
import { WarRoomPlan } from "@/lib/plan-schema";

interface ImportPlanModalProps {
  onClose: () => void;
  onImported: (plan: WarRoomPlan, runDir: string) => void;
}

export function ImportPlanModal({ onClose, onImported }: ImportPlanModalProps) {
  const [planJson, setPlanJson] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleImport = useCallback(async () => {
    // Reset error
    setError(null);

    // Validate JSON before sending
    if (!planJson.trim()) {
      setError("Please paste your plan JSON");
      return;
    }

    // Try to parse locally first for immediate feedback
    try {
      JSON.parse(planJson);
    } catch (e) {
      setError(`Invalid JSON: ${e instanceof Error ? e.message : "Parse error"}`);
      return;
    }

    setIsImporting(true);

    try {
      const response = await fetch("/api/import-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planJson }),
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error || "Failed to import plan");
        return;
      }

      // Success - call the callback
      onImported(result.plan, result.runDir);
    } catch (e) {
      setError(`Network error: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setIsImporting(false);
    }
  }, [planJson, onImported]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={handleKeyDown}
    >
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-700">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Import Plan
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 overflow-auto">
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
            Paste a plan.json to create a new run. At minimum, the JSON needs:
          </p>
          <ul className="text-sm text-zinc-600 dark:text-zinc-400 mb-4 list-disc list-inside space-y-1">
            <li>
              <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded">
                goal
              </code>{" "}
              - What you want to accomplish
            </li>
            <li>
              <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded">
                repo.path
              </code>{" "}
              - Path to the repository
            </li>
          </ul>

          <textarea
            value={planJson}
            onChange={(e) => {
              setPlanJson(e.target.value);
              setError(null); // Clear error on change
            }}
            placeholder={`{
  "goal": "Build a new feature...",
  "repo": {
    "path": "/path/to/your/repo",
    "name": "my-project"
  },
  "lanes": [...]  // optional - auto-generated if omitted
}`}
            className="w-full h-64 p-3 font-mono text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            spellCheck={false}
          />

          {/* Error Display */}
          {error && (
            <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-zinc-200 dark:border-zinc-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={isImporting || !planJson.trim()}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-zinc-300 disabled:cursor-not-allowed dark:disabled:bg-zinc-700 transition-colors"
          >
            {isImporting ? "Importing..." : "Import Plan"}
          </button>
        </div>
      </div>
    </div>
  );
}
