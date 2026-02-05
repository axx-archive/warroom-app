"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WarRoomPlan, PlanTemplate } from "@/lib/plan-schema";
import { PlanViewer } from "@/components/PlanViewer";
import { ImportPlanModal } from "@/components/ImportPlanModal";
import { ImportRunFolderModal } from "@/components/ImportRunFolderModal";
import { TemplatePickerModal } from "@/components/TemplatePickerModal";

export default function Home() {
  const router = useRouter();
  const [generatedPlan, setGeneratedPlan] = useState<{
    plan: WarRoomPlan;
    runDir: string;
  } | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showImportFolderModal, setShowImportFolderModal] = useState(false);
  const [showTemplatePickerModal, setShowTemplatePickerModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<PlanTemplate | null>(null);

  // Form state - simplified
  const [repoPath, setRepoPath] = useState("");
  const [goal, setGoal] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [isPickingFolder, setIsPickingFolder] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handlePlanImported = (plan: WarRoomPlan, runDir: string) => {
    setGeneratedPlan({ plan, runDir });
    setShowImportModal(false);
  };

  const handleRunFolderImported = (runDir: string) => {
    const slug = runDir.split("/").pop() || "";
    setShowImportFolderModal(false);
    router.push(`/runs/${slug}`);
  };

  const handleTemplateSelected = (template: PlanTemplate) => {
    setSelectedTemplate(template);
    setGoal(template.description);
    setShowTemplatePickerModal(false);
    setShowAdvanced(true);
  };

  const handleReset = () => {
    setGeneratedPlan(null);
    setSelectedTemplate(null);
    setGoal("");
  };

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

  // Handle execute plan
  const handleExecute = useCallback(async () => {
    if (!repoPath.trim()) {
      setError("Please provide a repository path");
      return;
    }

    setIsExecuting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/initialize-mission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: goal.trim() || "Initialize tactical operation",
          repoPath: repoPath.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to execute plan");
      }

      const terminalName = data.terminal || "Terminal";
      setSuccessMessage(`${terminalName} opened! Claude Code is running /warroom-plan.`);
      setTimeout(() => setSuccessMessage(null), 8000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Execution failed");
    } finally {
      setIsExecuting(false);
    }
  }, [goal, repoPath]);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      {/* Corner decorations */}
      <div className="corner-decoration corner-decoration--top-left">
        SESSION_ID: AF-0992-XC
      </div>
      <div className="corner-decoration corner-decoration--bottom-right">
        ENCRYPTION: AES-256-GCM
      </div>

      {/* Header - Bold Mission Control */}
      <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg-deep)]">
        <div className="max-w-[1400px] mx-auto px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="logo-mark logo-mark--bold text-xl">WR</div>
            <div className="flex flex-col">
              <h1 className="text-xl font-black tracking-tight uppercase leading-none text-white">
                WAR ROOM
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="h-[1px] w-4 bg-[var(--accent)]/60" />
                <span className="text-[9px] font-mono text-[var(--text-ghost)] tracking-[0.2em] uppercase">
                  Command Control v1.0_PRO
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Systems Active badge */}
            <div className="flex items-center gap-2 px-4 py-2 rounded border border-[var(--accent-border)] bg-transparent">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--accent)]" />
              </span>
              <span className="text-xs font-mono font-bold text-[var(--accent)] tracking-widest uppercase">
                Systems: Active
              </span>
            </div>

            {/* Settings icon */}
            <button className="btn--icon text-[var(--text-ghost)] hover:text-[var(--text)]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-[1400px] mx-auto w-full px-8 py-16">
        {generatedPlan ? (
          <div>
            <button
              onClick={handleReset}
              className="btn btn--ghost mb-6"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              New Mission
            </button>
            <PlanViewer plan={generatedPlan.plan} runDir={generatedPlan.runDir} />
          </div>
        ) : (
          <div className="max-w-4xl">
            {/* Hero Section - Bold, Left-aligned */}
            <div className="mb-16">
              {/* Status badges */}
              <div className="flex items-center gap-4 mb-6">
                <span className="badge badge--accent px-3 py-1.5 text-xs font-mono font-bold tracking-widest">
                  PRIORITY MISSION
                </span>
                <span className="text-xs font-mono text-[var(--text-ghost)] tracking-widest uppercase">
                  Pending Initialization ...
                </span>
              </div>

              {/* Giant headline */}
              <h2 className="text-6xl md:text-7xl font-black text-white mb-4 tracking-tight leading-[0.95]">
                Engage Tactical<br />
                <span className="text-[var(--accent)]">Operation Session</span>
              </h2>
            </div>

            {/* Inline Form - Simplified */}
            <div className="mb-6">
              {/* Template banner if selected */}
              {selectedTemplate && (
                <div className="flex items-center gap-3 mb-4 p-3 rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/10">
                  <svg className="w-5 h-5 text-[var(--warning)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                  <span className="text-sm text-[var(--warning)] font-medium">
                    Template: {selectedTemplate.name}
                  </span>
                  <button
                    onClick={() => { setSelectedTemplate(null); setGoal(""); }}
                    className="ml-auto text-[var(--text-ghost)] hover:text-[var(--warning)]"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}

              {/* Repo path label */}
              <label className="telemetry-label block mb-3 text-[var(--accent)]">
                Target Repository Path
              </label>

              {/* Inline input + button */}
              <div className="flex items-stretch gap-3">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={repoPath}
                    onChange={(e) => setRepoPath(e.target.value)}
                    placeholder="root://deployment/central-intelligence"
                    className="w-full h-14 px-5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg text-[var(--text)] font-mono text-sm placeholder:text-[var(--text-ghost)] focus:border-[var(--accent-border)] focus:outline-none transition-colors"
                  />
                  <button
                    onClick={handlePickFolder}
                    disabled={isPickingFolder}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-[var(--text-ghost)] hover:text-[var(--text)] transition-colors"
                    title="Browse folders"
                  >
                    {isPickingFolder ? (
                      <svg className="w-5 h-5 spinner" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Execute button */}
                <button
                  onClick={handleExecute}
                  disabled={isExecuting || !repoPath.trim()}
                  className="h-14 px-8 bg-[var(--accent)] hover:bg-[var(--accent-bright)] text-white font-bold text-sm tracking-widest uppercase rounded-lg flex items-center gap-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExecuting ? (
                    <>
                      <svg className="w-5 h-5 spinner" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Executing...
                    </>
                  ) : (
                    <>
                      Execute Plan
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </>
                  )}
                </button>
              </div>

              {/* Advanced toggle */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="mt-4 flex items-center gap-2 text-[var(--text-ghost)] hover:text-[var(--text-secondary)] transition-colors"
              >
                <svg
                  className={`w-3 h-3 transition-transform ${showAdvanced ? "rotate-90" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-xs font-mono uppercase tracking-widest">Advanced Parameters</span>
              </button>

              {/* Advanced options */}
              {showAdvanced && (
                <div className="mt-4 p-5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg animate-slide-up">
                  <label className="telemetry-label block mb-2 text-[var(--accent)]">
                    Mission Objective
                  </label>
                  <textarea
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    placeholder="Describe the mission parameters and objectives..."
                    rows={3}
                    className="w-full px-4 py-3 bg-[var(--bg-deep)] border border-[var(--border)] rounded-lg text-[var(--text)] text-sm placeholder:text-[var(--text-ghost)] focus:border-[var(--accent-border)] focus:outline-none resize-none"
                  />
                </div>
              )}

              {/* Success message */}
              {successMessage && (
                <div className="mt-4 p-4 rounded-lg border border-[var(--success)]/30 bg-[var(--success)]/10 flex items-center gap-3 animate-slide-up">
                  <svg className="w-5 h-5 text-[var(--success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-[var(--success)]">{successMessage}</span>
                </div>
              )}

              {/* Error message */}
              {error && (
                <div className="mt-4 p-4 rounded-lg border border-[var(--error)]/30 bg-[var(--error)]/10 flex items-center gap-3 animate-slide-up">
                  <svg className="w-5 h-5 text-[var(--error)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span className="text-sm text-[var(--error)]">{error}</span>
                </div>
              )}
            </div>

            {/* Quick Actions Section */}
            <div className="mt-20">
              <div className="flex items-center gap-4 mb-8">
                <h3 className="text-xs font-mono font-bold uppercase text-[var(--text-ghost)] tracking-[0.3em]">
                  Operational Quick Actions
                </h3>
                <div className="flex-grow h-px bg-[var(--border)]" />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Mission Logs - Recommended */}
                <Link
                  href="/runs"
                  className="group relative p-6 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg hover:border-[var(--accent-border)] transition-all tech-corners"
                >
                  <span className="absolute top-3 right-3 badge badge--accent text-[9px] px-2 py-0.5">
                    RECOMMENDED
                  </span>
                  <div className="w-12 h-12 rounded-lg bg-[var(--bg-muted)] border border-[var(--border)] flex items-center justify-center mb-4 group-hover:bg-[var(--accent-subtle)] group-hover:border-[var(--accent-border)] transition-all">
                    <svg className="w-6 h-6 text-[var(--text-ghost)] group-hover:text-[var(--accent)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h4 className="font-bold text-white mb-1">Mission Logs</h4>
                  <p className="text-xs text-[var(--text-ghost)] leading-relaxed">
                    Review deployment sequences.
                  </p>
                </Link>

                {/* Architecture / Templates */}
                <button
                  onClick={() => setShowTemplatePickerModal(true)}
                  className="group relative p-6 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg hover:border-[var(--accent-border)] transition-all tech-corners text-left"
                >
                  <div className="w-12 h-12 rounded-lg bg-[var(--bg-muted)] border border-[var(--border)] flex items-center justify-center mb-4 group-hover:bg-[var(--accent-subtle)] group-hover:border-[var(--accent-border)] transition-all">
                    <svg className="w-6 h-6 text-[var(--text-ghost)] group-hover:text-[var(--accent)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                    </svg>
                  </div>
                  <h4 className="font-bold text-white mb-1">Architecture</h4>
                  <p className="text-xs text-[var(--text-ghost)] leading-relaxed">
                    Pre-configured patterns.
                  </p>
                </button>

                {/* Import */}
                <button
                  onClick={() => setShowImportModal(true)}
                  className="group relative p-6 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg hover:border-[var(--accent-border)] transition-all tech-corners text-left"
                >
                  <div className="w-12 h-12 rounded-lg bg-[var(--bg-muted)] border border-[var(--border)] flex items-center justify-center mb-4 group-hover:bg-[var(--accent-subtle)] group-hover:border-[var(--accent-border)] transition-all">
                    <svg className="w-6 h-6 text-[var(--text-ghost)] group-hover:text-[var(--accent)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <h4 className="font-bold text-white mb-1">Import Ops</h4>
                  <p className="text-xs text-[var(--text-ghost)] leading-relaxed">
                    Ingest external datasets.
                  </p>
                </button>

                {/* Recovery */}
                <button
                  onClick={() => setShowImportFolderModal(true)}
                  className="group relative p-6 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg hover:border-[var(--accent-border)] transition-all tech-corners text-left"
                >
                  <div className="w-12 h-12 rounded-lg bg-[var(--bg-muted)] border border-[var(--border)] flex items-center justify-center mb-4 group-hover:bg-[var(--accent-subtle)] group-hover:border-[var(--accent-border)] transition-all">
                    <svg className="w-6 h-6 text-[var(--text-ghost)] group-hover:text-[var(--accent)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </div>
                  <h4 className="font-bold text-white mb-1">Recovery</h4>
                  <p className="text-xs text-[var(--text-ghost)] leading-relaxed">
                    Resume previous session.
                  </p>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      {showImportModal && (
        <ImportPlanModal
          onClose={() => setShowImportModal(false)}
          onImported={handlePlanImported}
        />
      )}

      {showImportFolderModal && (
        <ImportRunFolderModal
          onClose={() => setShowImportFolderModal(false)}
          onImported={handleRunFolderImported}
        />
      )}

      {showTemplatePickerModal && (
        <TemplatePickerModal
          onClose={() => setShowTemplatePickerModal(false)}
          onSelect={handleTemplateSelected}
        />
      )}
    </div>
  );
}
