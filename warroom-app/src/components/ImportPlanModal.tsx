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
    setError(null);

    if (!planJson.trim()) {
      setError("Please paste your mission plan JSON");
      return;
    }

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
        setError(result.error || "Failed to import mission plan");
        return;
      }

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
      className="modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={handleKeyDown}
    >
      <div className="modal max-w-2xl">
        {/* Header */}
        <div className="modal-header">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded flex items-center justify-center" style={{ background: "rgba(124, 58, 237, 0.15)", border: "1px solid rgba(124, 58, 237, 0.3)" }}>
              <svg className="w-4 h-4" style={{ color: "var(--accent)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <div>
              <h2 className="h3" style={{ color: "var(--text)" }}>
                Import Mission Plan
              </h2>
              <p className="label">
                Load External Configuration
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn--icon"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="modal-body">
          <p className="small mb-4" style={{ color: "var(--muted)" }}>
            Paste a plan.json to create a new mission run. Required fields:
          </p>
          <div className="flex flex-wrap gap-2 mb-5">
            <code className="mono" style={{ background: "var(--panel)", padding: "2px 6px", borderRadius: "3px" }}>goal</code>
            <code className="mono" style={{ background: "var(--panel)", padding: "2px 6px", borderRadius: "3px" }}>repo.path</code>
          </div>

          <textarea
            value={planJson}
            onChange={(e) => {
              setPlanJson(e.target.value);
              setError(null);
            }}
            placeholder={`{
  "goal": "Mission objective...",
  "repo": {
    "path": "/path/to/your/repo",
    "name": "my-project"
  },
  "lanes": [...]  // optional - auto-generated if omitted
}`}
            className="textarea h-64 mono small"
            spellCheck={false}
          />

          {error && (
            <div className="card--static mt-4 p-4" style={{ borderColor: "rgba(239, 68, 68, 0.3)", background: "rgba(239, 68, 68, 0.08)" }}>
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "var(--status-error)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="small" style={{ color: "var(--status-error)" }}>{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn--ghost">
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={isImporting || !planJson.trim()}
            className="btn btn--primary"
          >
            {isImporting ? (
              <>
                <span className="spinner" />
                Importing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Import Plan
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
