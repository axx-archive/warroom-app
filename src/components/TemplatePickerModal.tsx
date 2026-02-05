"use client";

import { useState, useEffect, useCallback } from "react";
import { PlanTemplate } from "@/lib/plan-schema";

interface TemplatePickerModalProps {
  onClose: () => void;
  onSelect: (template: PlanTemplate) => void;
}

export function TemplatePickerModal({
  onClose,
  onSelect,
}: TemplatePickerModalProps) {
  const [templates, setTemplates] = useState<PlanTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<PlanTemplate | null>(
    null
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch templates on mount
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const response = await fetch("/api/templates");
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Failed to load templates");
        }

        setTemplates(data.templates);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load templates"
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchTemplates();
  }, []);

  const handleDelete = useCallback(
    async (templateId: string, e: React.MouseEvent) => {
      e.stopPropagation();

      if (!confirm("Are you sure you want to delete this template?")) {
        return;
      }

      setDeletingId(templateId);

      try {
        const response = await fetch(`/api/templates/${templateId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error("Failed to delete template");
        }

        setTemplates((prev) => prev.filter((t) => t.id !== templateId));
        if (selectedTemplate?.id === templateId) {
          setSelectedTemplate(null);
        }
      } catch (err) {
        console.error("Delete template error:", err);
        alert("Failed to delete template");
      } finally {
        setDeletingId(null);
      }
    },
    [selectedTemplate]
  );

  const handleSelect = useCallback(() => {
    if (selectedTemplate) {
      onSelect(selectedTemplate);
    }
  }, [selectedTemplate, onSelect]);

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal tech-corners max-w-4xl" style={{ maxHeight: "85vh" }}>
        {/* Header */}
        <div className="modal-header flex-shrink-0">
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
              New from Template
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

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Template List */}
          <div className="w-1/2 border-r border-[var(--border-subtle)] overflow-y-auto p-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <svg
                  className="w-6 h-6 animate-spin text-[var(--text-ghost)]"
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
              </div>
            ) : error ? (
              <div className="p-4 rounded border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)] text-[var(--error)] text-sm">
                {error}
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-8">
                <svg
                  className="w-12 h-12 text-[var(--text-ghost)] mx-auto mb-3"
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
                <p className="text-[var(--text-muted)] mb-1">
                  No templates yet
                </p>
                <p className="text-xs text-[var(--text-ghost)]">
                  Save a plan as template from any mission run
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    onClick={() => setSelectedTemplate(template)}
                    className={`p-3 rounded border cursor-pointer transition-all ${
                      selectedTemplate?.id === template.id
                        ? "border-[var(--amber)] bg-[var(--amber-glow)]"
                        : "border-[var(--border-subtle)] bg-[var(--bg-muted)] hover:border-[var(--border-default)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-[var(--text)] truncate">
                          {template.name}
                        </h4>
                        <p className="text-xs text-[var(--text-ghost)] mt-0.5 line-clamp-2">
                          {template.description}
                        </p>
                      </div>
                      <button
                        onClick={(e) => handleDelete(template.id, e)}
                        disabled={deletingId === template.id}
                        className="flex-shrink-0 p-1 rounded text-[var(--text-ghost)] hover:text-[var(--error)] hover:bg-[rgba(239,68,68,0.1)] transition-colors"
                        title="Delete template"
                      >
                        {deletingId === template.id ? (
                          <svg
                            className="w-4 h-4 animate-spin"
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
                        ) : (
                          <svg
                            className="w-4 h-4"
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
                        )}
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs font-mono text-[var(--cyan)] bg-[var(--cyan-glow)] px-1.5 py-0.5 rounded">
                        {template.lanes.length} lanes
                      </span>
                      {template.tags &&
                        template.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className="text-xs text-[var(--text-ghost)] bg-[var(--bg-surface)] px-1.5 py-0.5 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Template Preview */}
          <div className="w-1/2 overflow-y-auto p-4 bg-[var(--bg-muted)]">
            {selectedTemplate ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium text-[var(--text)]">
                    {selectedTemplate.name}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">
                    {selectedTemplate.description}
                  </p>
                </div>

                <div className="flex items-center gap-4 text-xs text-[var(--text-ghost)]">
                  <span>Created: {formatDate(selectedTemplate.createdAt)}</span>
                  {selectedTemplate.sourceRunSlug && (
                    <span>
                      From:{" "}
                      <span className="font-mono text-[var(--text-muted)]">
                        {selectedTemplate.sourceRunSlug}
                      </span>
                    </span>
                  )}
                </div>

                {/* Tags */}
                {selectedTemplate.tags && selectedTemplate.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedTemplate.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs text-[var(--text-secondary)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-2 py-0.5 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Lane Configuration */}
                <div>
                  <h4 className="text-sm font-medium text-[var(--text)] mb-2">
                    Lane Configuration
                  </h4>
                  <div className="space-y-2">
                    {selectedTemplate.lanes.map((lane) => (
                      <div
                        key={lane.laneId}
                        className="p-2.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)]"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-sm text-[var(--text)]">
                            {lane.laneId}
                          </span>
                          <span className="text-xs bg-[var(--cyan-glow)] text-[var(--cyan)] border border-[var(--cyan-dim)] px-2 py-0.5 rounded">
                            {lane.agent}
                          </span>
                        </div>
                        {lane.dependsOn.length > 0 && (
                          <div className="mt-1.5 text-xs text-[var(--text-ghost)]">
                            Depends on:{" "}
                            <span className="font-mono text-[var(--text-muted)]">
                              {lane.dependsOn.join(", ")}
                            </span>
                          </div>
                        )}
                        {lane.foundation && (
                          <span className="inline-block mt-1.5 text-xs text-[var(--amber)] bg-[var(--amber-glow)] px-1.5 py-0.5 rounded">
                            Foundation
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Merge Settings */}
                <div>
                  <h4 className="text-sm font-medium text-[var(--text)] mb-2">
                    Merge Settings
                  </h4>
                  <div className="text-sm space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--text-secondary)]">
                        Method:
                      </span>
                      <span className="font-mono text-[var(--text)]">
                        {selectedTemplate.mergeMethod}
                      </span>
                    </div>
                    {selectedTemplate.mergeNotes && (
                      <div className="pt-1 text-xs text-[var(--text-ghost)]">
                        {selectedTemplate.mergeNotes}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <svg
                  className="w-16 h-16 text-[var(--border-default)] mb-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
                <p className="text-[var(--text-muted)]">
                  Select a template to preview
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer flex-shrink-0">
          <button onClick={onClose} className="btn btn--ghost">
            Cancel
          </button>
          <button
            onClick={handleSelect}
            disabled={!selectedTemplate}
            className="btn btn--primary"
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
                d="M12 4v16m8-8H4"
              />
            </svg>
            Use Template
          </button>
        </div>
      </div>
    </div>
  );
}
