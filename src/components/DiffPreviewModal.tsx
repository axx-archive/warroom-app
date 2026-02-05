"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { DiffFile, LaneDiffResponse } from "@/app/api/runs/[slug]/lane-diff/route";

interface DiffPreviewModalProps {
  slug: string;
  laneId: string;
  onClose: () => void;
  onApproveAndComplete: () => void;
}

// Status icons and colors
const STATUS_CONFIG: Record<DiffFile["status"], { icon: string; color: string; label: string }> = {
  modified: { icon: "M", color: "#f59e0b", label: "Modified" },
  added: { icon: "A", color: "#22c55e", label: "Added" },
  deleted: { icon: "D", color: "#ef4444", label: "Deleted" },
  renamed: { icon: "R", color: "#8b5cf6", label: "Renamed" },
  untracked: { icon: "?", color: "#6b7280", label: "Untracked" },
};

// Build a tree structure from flat file paths
interface FileTreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children: FileTreeNode[];
  file?: DiffFile;
}

function buildFileTree(files: DiffFile[]): FileTreeNode[] {
  const root: FileTreeNode[] = [];

  for (const file of files) {
    const parts = file.path.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join("/");

      let node = current.find((n) => n.name === part);

      if (!node) {
        node = {
          name: part,
          path: currentPath,
          isDirectory: !isLast,
          children: [],
          file: isLast ? file : undefined,
        };
        current.push(node);
      }

      if (!isLast) {
        current = node.children;
      }
    }
  }

  // Sort: directories first, then alphabetically
  const sortNodes = (nodes: FileTreeNode[]): FileTreeNode[] => {
    return nodes
      .map((n) => ({ ...n, children: sortNodes(n.children) }))
      .sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
  };

  return sortNodes(root);
}

// File tree item component
function FileTreeItem({
  node,
  depth,
  selectedFile,
  onSelectFile,
  expandedDirs,
  onToggleDir,
}: {
  node: FileTreeNode;
  depth: number;
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
  expandedDirs: Set<string>;
  onToggleDir: (path: string) => void;
}) {
  const isSelected = selectedFile === node.path;
  const isExpanded = expandedDirs.has(node.path);

  if (node.isDirectory) {
    return (
      <div>
        <button
          onClick={() => onToggleDir(node.path)}
          className="w-full flex items-center gap-1.5 px-2 py-1 hover:bg-[var(--bg-hover)] transition-colors text-left"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <svg
            className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <svg className="w-4 h-4" style={{ color: "var(--accent)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d={isExpanded
                ? "M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
                : "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              }
            />
          </svg>
          <span className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
            {node.name}
          </span>
        </button>
        {isExpanded && (
          <div>
            {node.children.map((child) => (
              <FileTreeItem
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedFile={selectedFile}
                onSelectFile={onSelectFile}
                expandedDirs={expandedDirs}
                onToggleDir={onToggleDir}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const config = node.file ? STATUS_CONFIG[node.file.status] : STATUS_CONFIG.modified;

  return (
    <button
      onClick={() => onSelectFile(node.path)}
      className={`w-full flex items-center gap-1.5 px-2 py-1 hover:bg-[var(--bg-hover)] transition-colors text-left ${
        isSelected ? "bg-[var(--bg-hover)]" : ""
      }`}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
    >
      <span
        className="w-4 h-4 flex items-center justify-center text-xs font-mono font-bold rounded"
        style={{ backgroundColor: `${config.color}20`, color: config.color }}
      >
        {config.icon}
      </span>
      <span
        className="text-xs truncate"
        style={{ color: isSelected ? "var(--text)" : "var(--text-secondary)" }}
        title={node.name}
      >
        {node.name}
      </span>
    </button>
  );
}

// Diff line renderer with syntax highlighting
function DiffLine({ line, lineNumber }: { line: string; lineNumber: number }) {
  const isAddition = line.startsWith("+") && !line.startsWith("+++");
  const isDeletion = line.startsWith("-") && !line.startsWith("---");
  const isHeader = line.startsWith("@@");
  const isMetadata = line.startsWith("diff ") || line.startsWith("index ") || line.startsWith("---") || line.startsWith("+++");

  let bgColor = "transparent";
  let textColor = "var(--text-secondary)";
  let prefix = " ";

  if (isAddition) {
    bgColor = "rgba(34, 197, 94, 0.15)";
    textColor = "#22c55e";
    prefix = "+";
  } else if (isDeletion) {
    bgColor = "rgba(239, 68, 68, 0.15)";
    textColor = "#ef4444";
    prefix = "-";
  } else if (isHeader) {
    bgColor = "rgba(124, 58, 237, 0.1)";
    textColor = "var(--accent)";
  } else if (isMetadata) {
    textColor = "var(--muted)";
  }

  const content = isAddition || isDeletion ? line.substring(1) : line;

  return (
    <div
      className="flex font-mono text-xs leading-5"
      style={{ backgroundColor: bgColor }}
    >
      <span
        className="w-12 shrink-0 text-right pr-2 select-none"
        style={{ color: "var(--muted)", borderRight: "1px solid var(--border)" }}
      >
        {!isMetadata && !isHeader ? lineNumber : ""}
      </span>
      <span
        className="w-5 shrink-0 text-center select-none"
        style={{ color: textColor }}
      >
        {!isMetadata ? prefix : ""}
      </span>
      <pre
        className="flex-1 px-2 whitespace-pre overflow-x-auto"
        style={{ color: textColor, margin: 0 }}
      >
        {content || " "}
      </pre>
    </div>
  );
}

// Diff viewer component
function DiffViewer({ file }: { file: DiffFile }) {
  const lines = file.diff.split("\n");

  // Parse diff headers to get starting line numbers
  const lineNumbers: (number | null)[] = [];
  let currentLine = 0;

  for (const line of lines) {
    if (line.startsWith("@@")) {
      // Parse @@ -start,count +start,count @@
      const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        currentLine = parseInt(match[1], 10);
      }
      lineNumbers.push(null);
    } else if (line.startsWith("diff ") || line.startsWith("index ") || line.startsWith("---") || line.startsWith("+++")) {
      lineNumbers.push(null);
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      lineNumbers.push(null); // Deletions don't have line numbers in new file
    } else if (line.startsWith("+") && !line.startsWith("+++")) {
      lineNumbers.push(currentLine++);
    } else {
      lineNumbers.push(currentLine++);
    }
  }

  return (
    <div className="overflow-auto">
      {lines.map((line, idx) => (
        <DiffLine
          key={idx}
          line={line}
          lineNumber={lineNumbers[idx] ?? 0}
        />
      ))}
    </div>
  );
}

export function DiffPreviewModal({
  slug,
  laneId,
  onClose,
  onApproveAndComplete,
}: DiffPreviewModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [diffData, setDiffData] = useState<LaneDiffResponse | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [isApproving, setIsApproving] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Fetch diff data
  useEffect(() => {
    const fetchDiff = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/runs/${slug}/lane-diff?laneId=${encodeURIComponent(laneId)}`);
        const data: LaneDiffResponse = await response.json();

        if (!data.success) {
          setError(data.error || "Failed to load diff");
          return;
        }

        setDiffData(data);

        // Auto-select first file and expand all directories
        if (data.files.length > 0) {
          setSelectedFile(data.files[0].path);

          // Expand all directories
          const dirs = new Set<string>();
          for (const file of data.files) {
            const parts = file.path.split("/");
            for (let i = 1; i < parts.length; i++) {
              dirs.add(parts.slice(0, i).join("/"));
            }
          }
          setExpandedDirs(dirs);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load diff");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDiff();
  }, [slug, laneId]);

  const handleToggleDir = useCallback((path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleApprove = useCallback(async () => {
    setIsApproving(true);
    try {
      await onApproveAndComplete();
      onClose();
    } finally {
      setIsApproving(false);
    }
  }, [onApproveAndComplete, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  const fileTree = diffData ? buildFileTree(diffData.files) : [];
  const selectedDiffFile = diffData?.files.find((f) => f.path === selectedFile);

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={handleKeyDown}
    >
      <div
        className="modal"
        style={{
          maxWidth: "90vw",
          width: "1200px",
          height: "80vh",
          maxHeight: "800px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div className="modal-header">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded flex items-center justify-center"
              style={{
                background: "rgba(124, 58, 237, 0.15)",
                border: "1px solid rgba(124, 58, 237, 0.3)",
              }}
            >
              <svg
                className="w-4 h-4"
                style={{ color: "var(--accent)" }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div>
              <h2 className="h3" style={{ color: "var(--text)" }}>
                Preview Changes
              </h2>
              <p className="label">
                {laneId}
                {diffData && (
                  <span className="ml-2">
                    <span style={{ color: "#22c55e" }}>+{diffData.totalAdditions}</span>
                    {" "}
                    <span style={{ color: "#ef4444" }}>-{diffData.totalDeletions}</span>
                  </span>
                )}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn--icon">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden" style={{ borderTop: "1px solid var(--border)" }}>
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 spinner" style={{ color: "var(--accent)" }} fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                <span style={{ color: "var(--text-secondary)" }}>Loading diff...</span>
              </div>
            </div>
          ) : error ? (
            <div className="flex-1 flex items-center justify-center">
              <div
                className="p-4 rounded-lg"
                style={{
                  backgroundColor: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                }}
              >
                <div className="flex items-center gap-2">
                  <svg
                    className="w-5 h-5"
                    style={{ color: "var(--status-error)" }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <span style={{ color: "var(--status-error)" }}>{error}</span>
                </div>
              </div>
            </div>
          ) : diffData && diffData.files.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <svg
                  className="w-12 h-12 mx-auto mb-3"
                  style={{ color: "var(--muted)" }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p style={{ color: "var(--text-secondary)" }}>No changes to preview</p>
                <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                  This lane has no uncommitted changes
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* File tree sidebar */}
              <div
                className="w-64 shrink-0 overflow-y-auto"
                style={{
                  borderRight: "1px solid var(--border)",
                  backgroundColor: "var(--panel)",
                }}
              >
                <div
                  className="px-3 py-2 text-xs font-medium uppercase tracking-wide"
                  style={{ color: "var(--muted)", borderBottom: "1px solid var(--border)" }}
                >
                  Files ({diffData?.files.length || 0})
                </div>
                <div className="py-1">
                  {fileTree.map((node) => (
                    <FileTreeItem
                      key={node.path}
                      node={node}
                      depth={0}
                      selectedFile={selectedFile}
                      onSelectFile={setSelectedFile}
                      expandedDirs={expandedDirs}
                      onToggleDir={handleToggleDir}
                    />
                  ))}
                </div>
              </div>

              {/* Diff content */}
              <div ref={contentRef} className="flex-1 overflow-auto" style={{ backgroundColor: "var(--bg)" }}>
                {selectedDiffFile ? (
                  <div>
                    {/* File header */}
                    <div
                      className="sticky top-0 z-10 flex items-center gap-2 px-4 py-2"
                      style={{
                        backgroundColor: "var(--panel)",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      <span
                        className="w-5 h-5 flex items-center justify-center text-xs font-mono font-bold rounded"
                        style={{
                          backgroundColor: `${STATUS_CONFIG[selectedDiffFile.status].color}20`,
                          color: STATUS_CONFIG[selectedDiffFile.status].color,
                        }}
                      >
                        {STATUS_CONFIG[selectedDiffFile.status].icon}
                      </span>
                      <span className="font-mono text-sm" style={{ color: "var(--text)" }}>
                        {selectedDiffFile.path}
                      </span>
                      {selectedDiffFile.oldPath && (
                        <span className="text-xs" style={{ color: "var(--muted)" }}>
                          (from {selectedDiffFile.oldPath})
                        </span>
                      )}
                      <span className="ml-auto text-xs" style={{ color: "var(--muted)" }}>
                        {selectedDiffFile.language}
                      </span>
                    </div>

                    {/* Diff content */}
                    <DiffViewer file={selectedDiffFile} />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p style={{ color: "var(--muted)" }}>Select a file to view diff</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn--ghost">
            Close
          </button>
          <button
            onClick={handleApprove}
            disabled={isApproving || isLoading || !!error}
            className="btn btn--primary"
            style={{
              backgroundColor: "#22c55e",
              borderColor: "#22c55e",
            }}
          >
            {isApproving ? (
              <>
                <svg className="w-4 h-4 spinner" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Approving...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Approve & Mark Complete
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
