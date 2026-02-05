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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-[var(--amber-glow)] border border-[var(--amber-dim)] flex items-center justify-center">
              <svg
                className="w-4 h-4 text-[var(--amber)]"
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
            <h2 className="text-lg font-medium text-[var(--text-primary)]">
              Save as Template
            </h2>
          </div>
          <button
            onClick={onClose}
            className="btn-ghost p-1.5 text-[var(--text-ghost)] hover:text-[var(--text-secondary)]"
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
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Error message */}
          {error && (
            <div className="p-3 rounded border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)] text-[var(--status-danger)] text-sm">
              {error}
            </div>
          )}

          {/* Template summary */}
          <div className="p-3 rounded border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]">
            <div className="text-xs text-[var(--text-ghost)] uppercase tracking-wider mb-2">
              Template Preview
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-secondary)]">Lanes:</span>
                <span className="font-mono text-[var(--text-primary)]">
                  {plan.lanes.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-secondary)]">
                  Agent types:
                </span>
                <span className="font-mono text-[var(--text-primary)]">
                  {[...new Set(plan.lanes.map((l) => l.agent))].length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-secondary)]">
                  Merge method:
                </span>
                <span className="font-mono text-[var(--text-primary)]">
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
              Template Name <span className="text-[var(--status-danger)]">*</span>
            </label>
            <input
              type="text"
              id="templateName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., feature-development-workflow"
              className={`w-full px-3 py-2 rounded border bg-[var(--bg-tertiary)] text-[var(--text-primary)] placeholder-[var(--text-ghost)] focus:outline-none focus:ring-1 ${
                !isValidName && name
                  ? "border-[var(--status-danger)] focus:ring-[var(--status-danger)]"
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
              className="w-full px-3 py-2 rounded border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] placeholder-[var(--text-ghost)] focus:outline-none focus:ring-1 focus:ring-[var(--cyan)] resize-none"
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
              className="w-full px-3 py-2 rounded border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] placeholder-[var(--text-ghost)] focus:outline-none focus:ring-1 focus:ring-[var(--cyan)]"
            />
          </div>

          {/* Lane preview */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
              Lane Configuration
            </label>
            <div className="space-y-1 max-h-40 overflow-y-auto p-2 rounded border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]">
              {plan.lanes.map((lane) => (
                <div
                  key={lane.laneId}
                  className="flex items-center justify-between text-sm py-1"
                >
                  <span className="font-mono text-[var(--text-primary)]">
                    {lane.laneId}
                  </span>
                  <span className="text-xs text-[var(--text-ghost)] bg-[var(--bg-secondary)] px-2 py-0.5 rounded">
                    {lane.agent}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn btn--sm btn--secondary"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`btn btn--sm btn--primary ${
                isSubmitting || !isValidName
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              }`}
              disabled={isSubmitting || !isValidName}
            >
              {isSubmitting ? (
                <>
                  <svg
                    className="w-3 h-3 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg
                    className="w-3 h-3"
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
        </form>
      </div>
    </div>
  );
}
