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
    // Reset error
    setError(null);

    // Validate path is provided
    if (!runPath.trim()) {
      setError("Please enter a run folder path");
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
        setError(result.error || "Failed to import run folder");
        return;
      }

      // Success - call the callback with runDir
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
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={handleKeyDown}
    >
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-lg w-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-700">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Open Existing Run
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
        <div className="p-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            Enter the path to an existing run folder. The folder must contain a{" "}
            <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded">
              plan.json
            </code>{" "}
            file.
          </p>

          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            Run Folder Path
          </label>
          <input
            type="text"
            value={runPath}
            onChange={(e) => {
              setRunPath(e.target.value);
              setError(null); // Clear error on change
            }}
            placeholder="~/.openclaw/workspace/warroom/runs/my-run"
            className="w-full px-3 py-2 font-mono text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            spellCheck={false}
            autoFocus
          />

          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Supports absolute paths or paths starting with ~ for home directory.
          </p>

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
            disabled={isImporting || !runPath.trim()}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-zinc-300 disabled:cursor-not-allowed dark:disabled:bg-zinc-700 transition-colors"
          >
            {isImporting ? "Opening..." : "Open Run"}
          </button>
        </div>
      </div>
    </div>
  );
}
