"use client";

import { useState } from "react";
import { GeneratePlanRequest, WarRoomPlan } from "@/lib/plan-schema";

interface PlanGeneratorProps {
  onPlanGenerated: (plan: WarRoomPlan, runDir: string) => void;
  defaultRepoPath?: string;
}

export function PlanGenerator({
  onPlanGenerated,
  defaultRepoPath = "",
}: PlanGeneratorProps) {
  const [goal, setGoal] = useState("");
  const [repoPath, setRepoPath] = useState(defaultRepoPath);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Advanced options
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [maxLanes, setMaxLanes] = useState<number | undefined>(undefined);
  const [autonomy, setAutonomy] = useState(false);

  const handleGenerate = async () => {
    if (!goal.trim() || !repoPath.trim()) {
      setError("Please provide both a goal and repository path");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const request: GeneratePlanRequest = {
        goal: goal.trim(),
        repoPath: repoPath.trim(),
        maxLanes,
        autonomy,
      };

      const response = await fetch("/api/generate-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to generate plan");
      }

      onPlanGenerated(data.plan, data.runDir);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate plan");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
        Generate Plan
      </h2>

      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
        War Room will generate a plan with agent lanes and run packets. You can
        then stage lanes to open Cursor windows.
      </p>

      <div className="space-y-4">
        {/* Repository Path */}
        <div>
          <label
            htmlFor="repoPath"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
          >
            Repository Path
          </label>
          <input
            id="repoPath"
            type="text"
            value={repoPath}
            onChange={(e) => setRepoPath(e.target.value)}
            placeholder="/Users/ajhart/Desktop/MyProject"
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Goal Input */}
        <div>
          <label
            htmlFor="goal"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
          >
            What do you want to build?
          </label>
          <textarea
            id="goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Describe what you want to accomplish..."
            rows={3}
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </div>

        {/* Advanced Options Toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 flex items-center gap-1"
        >
          <span className={`transform transition-transform ${showAdvanced ? "rotate-90" : ""}`}>
            ▶
          </span>
          Advanced Options
        </button>

        {/* Advanced Options */}
        {showAdvanced && (
          <div className="pl-4 border-l-2 border-zinc-200 dark:border-zinc-700 space-y-3">
            <div>
              <label
                htmlFor="maxLanes"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
              >
                Max Lanes (optional)
              </label>
              <input
                id="maxLanes"
                type="number"
                min={1}
                max={10}
                value={maxLanes ?? ""}
                onChange={(e) =>
                  setMaxLanes(
                    e.target.value ? parseInt(e.target.value, 10) : undefined
                  )
                }
                placeholder="Auto"
                className="w-32 px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="autonomy"
                type="checkbox"
                checked={autonomy}
                onChange={(e) => setAutonomy(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-zinc-300 rounded focus:ring-blue-500"
              />
              <label
                htmlFor="autonomy"
                className="text-sm text-zinc-700 dark:text-zinc-300"
              >
                Skip permissions (autonomous mode)
              </label>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !goal.trim() || !repoPath.trim()}
          className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-400 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <>
              <span className="animate-spin">⟳</span>
              Generating...
            </>
          ) : (
            "Generate Plan"
          )}
        </button>
      </div>
    </div>
  );
}
