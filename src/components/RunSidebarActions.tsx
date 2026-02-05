"use client";

import { useState, useCallback } from "react";
import { WarRoomPlan, PlanTemplate } from "@/lib/plan-schema";
import { SaveAsTemplateModal } from "./SaveAsTemplateModal";
import { WorktreeCleanupModal } from "./WorktreeCleanupModal";

interface RunSidebarActionsProps {
  plan: WarRoomPlan;
}

export function RunSidebarActions({ plan }: RunSidebarActionsProps) {
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);

  const handleTemplateSaved = useCallback((template: PlanTemplate) => {
    setSavedMessage(`Template "${template.name}" saved!`);
    // Clear message after 5 seconds
    setTimeout(() => setSavedMessage(null), 5000);
  }, []);

  const handleCleanupComplete = useCallback((result: { lanesRemoved: string[]; branchesDeleted: string[] }) => {
    if (result.lanesRemoved.length > 0) {
      setCleanupMessage(
        `Cleaned up ${result.lanesRemoved.length} worktree${result.lanesRemoved.length !== 1 ? "s" : ""}${
          result.branchesDeleted.length > 0
            ? ` and deleted ${result.branchesDeleted.length} branch${result.branchesDeleted.length !== 1 ? "es" : ""}`
            : ""
        }`
      );
      // Clear message after 5 seconds
      setTimeout(() => setCleanupMessage(null), 5000);
    }
  }, []);

  return (
    <>
      <div className="panel p-5">
        <h3 className="text-sm font-medium text-[var(--text-primary)] mb-4 flex items-center gap-2">
          <svg
            className="w-4 h-4 text-[var(--text-tertiary)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
            />
          </svg>
          Quick Actions
        </h3>

        <div className="space-y-2">
          <button
            onClick={() => setShowSaveTemplateModal(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] hover:border-[var(--amber-dim)] hover:bg-[var(--amber-glow)] transition-colors group text-left"
          >
            <div className="w-7 h-7 rounded bg-[var(--amber-glow)] border border-[var(--amber-dim)] flex items-center justify-center flex-shrink-0 group-hover:border-[var(--amber)]">
              <svg
                className="w-3.5 h-3.5 text-[var(--amber)]"
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
            </div>
            <div>
              <div className="text-sm font-medium text-[var(--text-primary)]">
                Save as Template
              </div>
              <div className="text-xs text-[var(--text-ghost)]">
                Reuse this plan configuration
              </div>
            </div>
          </button>

          <button
            onClick={() => setShowCleanupModal(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] hover:border-[rgba(239,68,68,0.3)] hover:bg-[rgba(239,68,68,0.05)] transition-colors group text-left"
          >
            <div className="w-7 h-7 rounded bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] flex items-center justify-center flex-shrink-0 group-hover:border-[rgba(239,68,68,0.4)]">
              <svg
                className="w-3.5 h-3.5 text-[var(--status-danger)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </div>
            <div>
              <div className="text-sm font-medium text-[var(--text-primary)]">
                Cleanup Merged Lanes
              </div>
              <div className="text-xs text-[var(--text-ghost)]">
                Remove worktrees for completed lanes
              </div>
            </div>
          </button>
        </div>

        {/* Success messages */}
        {savedMessage && (
          <div className="mt-3 p-2 rounded border border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.08)] text-[var(--status-success)] text-xs flex items-center gap-2">
            <svg
              className="w-4 h-4 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            {savedMessage}
          </div>
        )}

        {cleanupMessage && (
          <div className="mt-3 p-2 rounded border border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.08)] text-[var(--status-success)] text-xs flex items-center gap-2">
            <svg
              className="w-4 h-4 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            {cleanupMessage}
          </div>
        )}
      </div>

      {/* Save as Template Modal */}
      {showSaveTemplateModal && (
        <SaveAsTemplateModal
          plan={plan}
          onClose={() => setShowSaveTemplateModal(false)}
          onSaved={handleTemplateSaved}
        />
      )}

      {/* Cleanup Worktrees Modal */}
      {showCleanupModal && (
        <WorktreeCleanupModal
          plan={plan}
          onClose={() => setShowCleanupModal(false)}
          onCleanupComplete={handleCleanupComplete}
        />
      )}
    </>
  );
}
