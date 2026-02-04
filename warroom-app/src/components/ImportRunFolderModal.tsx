"use client";

import { useState, useCallback } from "react";

interface ImportRunFolderModalProps {
  onClose: () => void;
  onImported: (runDir: string) => void;
}

export function ImportRunFolderModal({
  onClose,
  onImported,
}: ImportRunFolderModalProps) {
  const [runPath, setRunPath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleImport = useCallback(async () => {
    setError(null);

    if (!runPath.trim()) {
      setError("Please enter a mission folder path");
      return;
    }

    setIsImporting(true);

    try {
      const response = await fetch("/api/import-run-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runPath: runPath.trim() }),
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error || "Failed to import mission folder");
        return;
      }

      onImported(result.runDir);
    } catch (e) {
      setError(
        `Network error: ${e instanceof Error ? e.message : "Unknown error"}`
      );
    } finally {
      setIsImporting(false);
    }
  }, [runPath, onImported]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
      if (e.key === "Enter" && !isImporting && runPath.trim()) {
        handleImport();
      }
    },
    [onClose, isImporting, runPath, handleImport]
  );

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={handleKeyDown}
    >
      <div className="modal max-w-lg">
        {/* Header */}
        <div className="modal-header">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded flex items-center justify-center" style={{ background: "rgba(124, 58, 237, 0.15)", border: "1px solid rgba(124, 58, 237, 0.3)" }}>
              <svg className="w-4 h-4" style={{ color: "var(--accent)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="h3" style={{ color: "var(--text)" }}>
                Open Existing Mission
              </h2>
              <p className="label">
                Resume Operations
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
          <p className="small mb-5" style={{ color: "var(--muted)" }}>
            Enter the path to an existing mission folder. The folder must contain a{" "}
            <code className="mono" style={{ background: "var(--panel)", padding: "2px 6px", borderRadius: "3px" }}>plan.json</code> file.
          </p>

          <label className="label block mb-2">
            Mission Folder Path
          </label>
          <input
            type="text"
            value={runPath}
            onChange={(e) => {
              setRunPath(e.target.value);
              setError(null);
            }}
            placeholder="~/.openclaw/workspace/warroom/runs/my-mission"
            className="input mono"
            spellCheck={false}
            autoFocus
          />

          <p className="mt-2 small" style={{ color: "var(--muted)" }}>
            Supports absolute paths or paths starting with ~ for home directory.
          </p>

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
            disabled={isImporting || !runPath.trim()}
            className="btn btn--primary"
          >
            {isImporting ? (
              <>
                <span className="spinner" />
                Opening...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                Open Mission
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
