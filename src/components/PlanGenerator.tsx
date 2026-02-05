"use client";

import { useState, useCallback, useEffect } from "react";
import { WarRoomPlan, PlanTemplate } from "@/lib/plan-schema";

interface PlanGeneratorProps {
  onPlanGenerated: (plan: WarRoomPlan, runDir: string) => void;
  defaultRepoPath?: string;
  selectedTemplate?: PlanTemplate | null;
  onClearTemplate?: () => void;
}

export function PlanGenerator({
  onPlanGenerated,
  defaultRepoPath = "",
  selectedTemplate,
  onClearTemplate,
}: PlanGeneratorProps) {
  const [goal, setGoal] = useState("");
  const [repoPath, setRepoPath] = useState(defaultRepoPath);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPickingFolder, setIsPickingFolder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Advanced options
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [maxLanes, setMaxLanes] = useState<number | undefined>(undefined);
  const [autonomy, setAutonomy] = useState(false);

  // When template is selected, pre-fill the goal
  useEffect(() => {
    if (selectedTemplate) {
      setGoal(selectedTemplate.description);
      // Set max lanes to match template
      setMaxLanes(selectedTemplate.lanes.length);
      // Check if any lane has autonomy enabled
      const hasAutonomy = selectedTemplate.lanes.some(
        (lane) => lane.autonomy.dangerouslySkipPermissions
      );
      setAutonomy(hasAutonomy);
      setShowAdvanced(true);
    }
  }, [selectedTemplate]);

  // Handle folder picker
  const handlePickFolder = useCallback(async () => {
    setIsPickingFolder(true);
    setError(null);

    try {
      const response = await fetch("/api/folder-picker", {
        method: "POST",
      });

      const data = await response.json();

      if (data.error === "cancelled") {
        // User cancelled - not an error
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to select folder");
      }

      setRepoPath(data.path);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open folder picker");
    } finally {
      setIsPickingFolder(false);
    }
  }, []);

  // Handle Initialize Mission - spawns terminal with Claude Code running /warroom-plan
  const handleInitialize = useCallback(async () => {
    if (!goal.trim() || !repoPath.trim()) {
      setError("Please provide both a mission objective and repository path");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/initialize-mission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: goal.trim(),
          repoPath: repoPath.trim(),
          maxLanes,
          autonomy,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to initialize mission");
      }

      // Terminal has been spawned with Claude Code
      const terminalName = data.terminal || "Terminal";
      const autonomyNote = autonomy ? " Running autonomously with skip-permissions." : "";
      setSuccessMessage(`${terminalName} opened! Claude Code is running /warroom-plan.${autonomyNote}`);

      // Clear success message after 8 seconds (longer to let user see terminal spawning)
      setTimeout(() => setSuccessMessage(null), 8000);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Mission initialization failed");
    } finally {
      setIsGenerating(false);
    }
  }, [goal, repoPath, maxLanes, autonomy]);

  // Keep the old generate function for backward compatibility (if needed)
  void onPlanGenerated; // Suppress unused warning - keeping prop for future use

  return (
    <div className="card--static p-6" style={{ border: "1px solid var(--border-accent)" }}>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded flex items-center justify-center" style={{ background: "rgba(124, 58, 237, 0.15)", border: "1px solid rgba(124, 58, 237, 0.3)" }}>
          <svg className="w-5 h-5" style={{ color: "var(--accent)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        </div>
        <div>
          <h2 className="h3" style={{ color: "var(--text)" }}>
            Mission Parameters
          </h2>
          <p className="label">
            Configure agent deployment
          </p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Template Banner */}
        {selectedTemplate && (
          <div className="p-3 rounded border border-[var(--amber-dim)] bg-[var(--amber-glow)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg
                  className="w-5 h-5 text-[var(--amber)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                  />
                </svg>
                <div>
                  <p className="text-sm font-medium text-[var(--amber)]">
                    Using Template: {selectedTemplate.name}
                  </p>
                  <p className="text-xs text-[var(--text-ghost)]">
                    {selectedTemplate.lanes.length} lanes pre-configured
                  </p>
                </div>
              </div>
              {onClearTemplate && (
                <button
                  onClick={onClearTemplate}
                  className="btn-ghost p-1.5 text-[var(--text-ghost)] hover:text-[var(--amber)]"
                  title="Clear template"
                >
                  <svg
                    className="w-4 h-4"
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
              )}
            </div>
          </div>
        )}

        {/* Repository Path */}
        <div>
          <label
            htmlFor="repoPath"
            className="label block mb-2"
            style={{ color: "var(--accent)" }}
          >
            Target Repository Path
          </label>
          <div className="input-with-action">
            <input
              id="repoPath"
              type="text"
              value={repoPath}
              onChange={(e) => setRepoPath(e.target.value)}
              placeholder="/Users/operator/workspace/project"
              className="input"
            />
            <button
              type="button"
              onClick={handlePickFolder}
              disabled={isPickingFolder}
              className="btn btn--icon"
              style={{ border: "1px solid var(--border)", borderRadius: "3px", width: "44px", height: "44px" }}
              title="Browse for folder"
            >
              {isPickingFolder ? (
                <svg className="w-4 h-4 spinner" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Goal Input */}
        <div>
          <label
            htmlFor="goal"
            className="label block mb-2"
            style={{ color: "var(--accent)" }}
          >
            Mission Objective
          </label>
          <textarea
            id="goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Describe the mission parameters and objectives..."
            rows={4}
            className="textarea"
          />
        </div>

        {/* Advanced Options Toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 small hover:text-[var(--text)] transition-colors"
          style={{ color: "var(--muted)" }}
        >
          <svg
            className={`w-3.5 h-3.5 transition-transform duration-200 ${showAdvanced ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="label">Advanced Parameters</span>
        </button>

        {/* Advanced Options */}
        {showAdvanced && (
          <div className="pl-5 space-y-4 reveal" style={{ borderLeft: "2px solid var(--border)" }}>
            <div>
              <label
                htmlFor="maxLanes"
                className="label block mb-2"
              >
                Max Agent Lanes
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
                placeholder="Auto-detect"
                className="input input--sm w-40"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setAutonomy(!autonomy)}
                className={`toggle ${autonomy ? "active" : ""}`}
                role="switch"
                aria-checked={autonomy}
              />
              <div>
                <span className="small" style={{ color: "var(--muted)" }}>
                  Skip permissions
                </span>
                {autonomy && (
                  <span className="ml-2 badge badge--warning">
                    Autonomous
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="card--static p-4" style={{ borderColor: "rgba(34, 197, 94, 0.3)", background: "rgba(34, 197, 94, 0.08)" }}>
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "var(--status-success)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <p className="small font-medium" style={{ color: "var(--status-success)" }}>Mission Initialized</p>
                <p className="small mt-0.5" style={{ color: "var(--muted)" }}>{successMessage}</p>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="card--static p-4" style={{ borderColor: "rgba(239, 68, 68, 0.3)", background: "rgba(239, 68, 68, 0.08)" }}>
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "var(--status-error)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="small font-medium" style={{ color: "var(--status-error)" }}>Mission Error</p>
                <p className="small mt-0.5" style={{ color: "var(--muted)" }}>{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Initialize Button */}
        <button
          onClick={handleInitialize}
          disabled={isGenerating || !goal.trim() || !repoPath.trim()}
          className="btn btn--primary w-full"
          style={{ padding: "14px 20px", fontSize: "16px" }}
        >
          {isGenerating ? (
            <span className="flex items-center justify-center gap-3">
              <span className="spinner" />
              <span>Launching Terminal...</span>
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Initialize Mission
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
