"use client";

import { useState, useCallback } from "react";
import { AgentType, Lane } from "@/lib/plan-schema";

interface AddLaneModalProps {
  slug: string;
  existingLanes: Lane[];
  onClose: () => void;
  onLaneAdded: (lane: Lane) => void;
}

const AGENT_TYPES: { value: AgentType; label: string; description: string }[] = [
  {
    value: "developer",
    label: "Developer",
    description: "Implement features following project patterns",
  },
  {
    value: "staff-engineer-reviewer",
    label: "Staff Engineer Reviewer",
    description: "Review code quality and architecture",
  },
  {
    value: "doc-updater",
    label: "Documentation Updater",
    description: "Keep documentation in sync with code",
  },
  {
    value: "techdebt",
    label: "Tech Debt",
    description: "Address technical debt and improve code health",
  },
  {
    value: "visual-qa",
    label: "Visual QA",
    description: "Review UI/UX for visual quality and consistency",
  },
  {
    value: "qa-tester",
    label: "QA Tester",
    description: "Validate features against acceptance criteria",
  },
  {
    value: "security-reviewer",
    label: "Security Reviewer",
    description: "Audit for security vulnerabilities",
  },
  {
    value: "architect",
    label: "Architect",
    description: "Design system architecture and technical approach",
  },
  {
    value: "product-owner",
    label: "Product Owner",
    description: "Define requirements and acceptance criteria",
  },
];

export function AddLaneModal({
  slug,
  existingLanes,
  onClose,
  onLaneAdded,
}: AddLaneModalProps) {
  const [laneId, setLaneId] = useState("");
  const [agent, setAgent] = useState<AgentType>("developer");
  const [branchName, setBranchName] = useState("");
  const [dependencies, setDependencies] = useState<string[]>([]);
  const [skipPermissions, setSkipPermissions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate suggested branch name based on lane ID
  const suggestedBranch = laneId ? `warroom/${slug}/${laneId}` : "";

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmitting(true);
      setError(null);

      try {
        const response = await fetch(`/api/runs/${slug}/add-lane`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            laneId,
            agent,
            branchName: branchName || undefined, // Use suggested if empty
            dependsOn: dependencies,
            autonomy: { dangerouslySkipPermissions: skipPermissions },
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Failed to add lane");
        }

        onLaneAdded(data.lane);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error occurred");
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      slug,
      laneId,
      agent,
      branchName,
      dependencies,
      skipPermissions,
      onLaneAdded,
      onClose,
    ]
  );

  const toggleDependency = useCallback((depId: string) => {
    setDependencies((prev) =>
      prev.includes(depId)
        ? prev.filter((d) => d !== depId)
        : [...prev, depId]
    );
  }, []);

  // Validate lane ID - alphanumeric, dashes, underscores only
  const isValidLaneId = /^[a-zA-Z0-9_-]+$/.test(laneId);
  const laneIdExists = existingLanes.some((l) => l.laneId === laneId);

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal tech-corners max-w-lg">
        {/* Header */}
        <div className="modal-header">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded flex items-center justify-center" style={{ background: "var(--info-dim)", border: "1px solid rgba(6, 182, 212, 0.3)" }}>
              <svg
                className="w-4 h-4"
                style={{ color: "var(--info)" }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </div>
            <h2 className="text-heading" style={{ color: "var(--text)" }}>
              Add New Lane
            </h2>
          </div>
          <button
            onClick={onClose}
            className="btn btn--icon"
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="modal-body space-y-4">
          {/* Error message */}
          {error && (
            <div className="p-3 rounded border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)] text-[var(--error)] text-sm">
              {error}
            </div>
          )}

          {/* Lane ID */}
          <div>
            <label
              htmlFor="laneId"
              className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5"
            >
              Lane ID <span className="text-[var(--error)]">*</span>
            </label>
            <input
              type="text"
              id="laneId"
              value={laneId}
              onChange={(e) => setLaneId(e.target.value)}
              placeholder="e.g., fix-auth-bug"
              className={`w-full px-3 py-2 rounded border bg-[var(--bg-muted)] text-[var(--text)] placeholder-[var(--text-ghost)] focus:outline-none focus:ring-1 ${
                laneId && !isValidLaneId
                  ? "border-[var(--error)] focus:ring-[var(--error)]"
                  : laneIdExists
                  ? "border-[var(--warning)] focus:ring-[var(--warning)]"
                  : "border-[var(--border-subtle)] focus:ring-[var(--cyan)]"
              }`}
              required
            />
            {laneId && !isValidLaneId && (
              <p className="mt-1 text-xs text-[var(--error)]">
                Only letters, numbers, dashes, and underscores allowed
              </p>
            )}
            {laneIdExists && (
              <p className="mt-1 text-xs text-[var(--warning)]">
                This lane ID already exists
              </p>
            )}
          </div>

          {/* Agent Type */}
          <div>
            <label
              htmlFor="agent"
              className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5"
            >
              Agent Type <span className="text-[var(--error)]">*</span>
            </label>
            <select
              id="agent"
              value={agent}
              onChange={(e) => setAgent(e.target.value as AgentType)}
              className="w-full px-3 py-2 rounded border border-[var(--border-subtle)] bg-[var(--bg-muted)] text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--cyan)]"
            >
              {AGENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-[var(--text-ghost)]">
              {AGENT_TYPES.find((t) => t.value === agent)?.description}
            </p>
          </div>

          {/* Branch Name (Optional) */}
          <div>
            <label
              htmlFor="branchName"
              className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5"
            >
              Branch Name{" "}
              <span className="text-[var(--text-ghost)] font-normal">
                (optional)
              </span>
            </label>
            <input
              type="text"
              id="branchName"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              placeholder={suggestedBranch || "Auto-generated if empty"}
              className="w-full px-3 py-2 rounded border border-[var(--border-subtle)] bg-[var(--bg-muted)] text-[var(--text)] placeholder-[var(--text-ghost)] focus:outline-none focus:ring-1 focus:ring-[var(--cyan)]"
            />
            {!branchName && suggestedBranch && (
              <p className="mt-1 text-xs text-[var(--text-ghost)]">
                Will use: {suggestedBranch}
              </p>
            )}
          </div>

          {/* Dependencies */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
              Dependencies{" "}
              <span className="text-[var(--text-ghost)] font-normal">
                (select lanes this depends on)
              </span>
            </label>
            {existingLanes.length > 0 ? (
              <div className="space-y-2 max-h-32 overflow-y-auto p-2 rounded border border-[var(--border-subtle)] bg-[var(--bg-muted)]">
                {existingLanes.map((lane) => (
                  <label
                    key={lane.laneId}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={dependencies.includes(lane.laneId)}
                      onChange={() => toggleDependency(lane.laneId)}
                      className="w-4 h-4 rounded border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--cyan)] focus:ring-[var(--cyan)] focus:ring-offset-0"
                    />
                    <span className="text-sm text-[var(--text)]">
                      {lane.laneId}
                    </span>
                    <span className="text-xs text-[var(--text-ghost)]">
                      ({lane.agent})
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--text-ghost)] italic">
                No existing lanes to depend on
              </p>
            )}
          </div>

          {/* Autonomy Toggle */}
          <div className="p-3 rounded border border-[var(--border-subtle)] bg-[var(--bg-muted)]">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={skipPermissions}
                onChange={(e) => setSkipPermissions(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--cyan)] focus:ring-[var(--cyan)] focus:ring-offset-0"
              />
              <div>
                <span className="text-sm font-medium text-[var(--text)]">
                  Enable Autonomous Mode
                </span>
                <p className="text-xs text-[var(--text-ghost)] mt-0.5">
                  Run with --dangerously-skip-permissions for faster execution
                </p>
              </div>
            </label>
          </div>

        </form>

        {/* Footer */}
        <div className="modal-footer">
          <button
            type="button"
            onClick={onClose}
            className="btn btn--ghost"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="add-lane-form"
            onClick={handleSubmit}
            className="btn btn--primary"
            disabled={isSubmitting || !laneId || !isValidLaneId || laneIdExists}
          >
            {isSubmitting ? (
              <>
                <span className="spinner" style={{ width: 12, height: 12 }} />
                Creating...
              </>
            ) : (
              <>
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
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Add Lane
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
