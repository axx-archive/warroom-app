"use client";

import { useState, useCallback } from "react";
import { WarRoomPlan, PlanTemplate } from "@/lib/plan-schema";

interface SaveAsTemplateModalProps {
  plan: WarRoomPlan;
  onClose: () => void;
  onSaved: (template: PlanTemplate) => void;
}

export function SaveAsTemplateModal({
  plan,
  onClose,
  onSaved,
}: SaveAsTemplateModalProps) {
  const [name, setName] = useState(`${plan.runSlug}-template`);
  const [description, setDescription] = useState(plan.goal);
  const [tags, setTags] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmitting(true);
      setError(null);

      try {
        const response = await fetch("/api/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            plan,
            name: name.trim(),
            description: description.trim() || undefined,
            tags: tags
              .split(",")
              .map((t) => t.trim())
              .filter((t) => t.length > 0),
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Failed to save template");
        }

        onSaved(data.template);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error occurred");
      } finally {
        setIsSubmitting(false);
      }
    },
    [plan, name, description, tags, onSaved, onClose]
  );

  const isValidName = name.trim().length > 0;

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal tech-corners max-w-lg">
        {/* Header */}
        <div className="modal-header">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded flex items-center justify-center" style={{ background: "var(--accent-subtle)", border: "1px solid var(--accent-border)" }}>
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
                  d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                />
              </svg>
            </div>
            <h2 className="text-heading" style={{ color: "var(--text)" }}>
              Save as Template
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

          {/* Template summary */}
          <div className="p-3 rounded border border-[var(--border-subtle)] bg-[var(--bg-muted)]">
            <div className="text-xs text-[var(--text-ghost)] uppercase tracking-wider mb-2">
              Template Preview
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-secondary)]">Lanes:</span>
                <span className="font-mono text-[var(--text)]">
                  {plan.lanes.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-secondary)]">
                  Agent types:
                </span>
                <span className="font-mono text-[var(--text)]">
                  {[...new Set(plan.lanes.map((l) => l.agent))].length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-secondary)]">
                  Merge method:
                </span>
                <span className="font-mono text-[var(--text)]">
                  {plan.merge.method}
                </span>
              </div>
            </div>
          </div>

          {/* Template Name */}
          <div>
            <label
              htmlFor="templateName"
              className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5"
            >
              Template Name <span className="text-[var(--error)]">*</span>
            </label>
            <input
              type="text"
              id="templateName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., feature-development-workflow"
              className={`w-full px-3 py-2 rounded border bg-[var(--bg-muted)] text-[var(--text)] placeholder-[var(--text-ghost)] focus:outline-none focus:ring-1 ${
                !isValidName && name
                  ? "border-[var(--error)] focus:ring-[var(--error)]"
                  : "border-[var(--border-subtle)] focus:ring-[var(--cyan)]"
              }`}
              required
            />
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="templateDescription"
              className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5"
            >
              Description{" "}
              <span className="text-[var(--text-ghost)] font-normal">
                (optional)
              </span>
            </label>
            <textarea
              id="templateDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this template good for?"
              rows={3}
              className="w-full px-3 py-2 rounded border border-[var(--border-subtle)] bg-[var(--bg-muted)] text-[var(--text)] placeholder-[var(--text-ghost)] focus:outline-none focus:ring-1 focus:ring-[var(--cyan)] resize-none"
            />
          </div>

          {/* Tags */}
          <div>
            <label
              htmlFor="templateTags"
              className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5"
            >
              Tags{" "}
              <span className="text-[var(--text-ghost)] font-normal">
                (comma-separated)
              </span>
            </label>
            <input
              type="text"
              id="templateTags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g., feature, review, security"
              className="w-full px-3 py-2 rounded border border-[var(--border-subtle)] bg-[var(--bg-muted)] text-[var(--text)] placeholder-[var(--text-ghost)] focus:outline-none focus:ring-1 focus:ring-[var(--cyan)]"
            />
          </div>

          {/* Lane preview */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
              Lane Configuration
            </label>
            <div className="space-y-1 max-h-40 overflow-y-auto p-2 rounded border border-[var(--border-subtle)] bg-[var(--bg-muted)]">
              {plan.lanes.map((lane) => (
                <div
                  key={lane.laneId}
                  className="flex items-center justify-between text-sm py-1"
                >
                  <span className="font-mono text-[var(--text)]">
                    {lane.laneId}
                  </span>
                  <span className="text-xs text-[var(--text-ghost)] bg-[var(--bg-surface)] px-2 py-0.5 rounded">
                    {lane.agent}
                  </span>
                </div>
              ))}
            </div>
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
            onClick={handleSubmit}
            className="btn btn--primary"
            disabled={isSubmitting || !isValidName}
          >
            {isSubmitting ? (
              <>
                <span className="spinner" style={{ width: 12, height: 12 }} />
                Saving...
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
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Save Template
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
