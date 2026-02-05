"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WarRoomPlan, PlanTemplate } from "@/lib/plan-schema";
import { PlanGenerator } from "@/components/PlanGenerator";
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

  const handlePlanGenerated = (plan: WarRoomPlan, runDir: string) => {
    setGeneratedPlan({ plan, runDir });
  };

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
    setShowTemplatePickerModal(false);
  };

  const handleReset = () => {
    setGeneratedPlan(null);
    setSelectedTemplate(null);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="panel-header sticky top-0 z-50 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="logo-mark logo-mark--bold">WR</div>
            <div className="flex flex-col">
              <h1 className="text-xl font-black tracking-tighter uppercase leading-none text-white">WAR ROOM</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="h-[1px] w-4 bg-[var(--accent)]/60" />
                <span className="text-[9px] font-mono text-[var(--text-ghost)] tracking-[0.25em] uppercase">
                  Command Control v1.0
                </span>
              </div>
            </div>
          </div>

          <nav className="flex items-center gap-2">
            <Link
              href="/runs"
              className="btn-ghost"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              View Runs
            </Link>
            {!generatedPlan && (
              <>
                <button
                  onClick={() => setShowTemplatePickerModal(true)}
                  className="btn-ghost"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                  New from Template
                </button>
                <button
                  onClick={() => setShowImportFolderModal(true)}
                  className="btn-ghost"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  Open Folder
                </button>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="btn-secondary"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Import Plan
                </button>
              </>
            )}
            {generatedPlan && (
              <button
                onClick={handleReset}
                className="btn-secondary"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                </svg>
                New Mission
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-4">
        {generatedPlan ? (
          <PlanViewer plan={generatedPlan.plan} runDir={generatedPlan.runDir} />
        ) : (
          <div className="max-w-2xl mx-auto">
            {/* Hero Section - Bold Command Center */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-3 px-4 py-2 rounded-md bg-[var(--accent-subtle)] border border-[var(--accent-border)] shadow-[0_0_20px_var(--accent-glow)] mb-6">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--accent)]" />
                </span>
                <span className="text-xs font-mono font-bold text-[var(--accent)] tracking-[0.15em] uppercase">
                  Systems: Active
                </span>
              </div>
              <div className="flex items-center gap-4 mb-4 justify-center">
                <span className="text-[10px] font-mono text-[var(--accent)] font-bold uppercase tracking-[0.3em] bg-[var(--accent-subtle)] px-3 py-1 rounded">
                  Priority Mission
                </span>
                <span className="text-[10px] font-mono text-[var(--text-ghost)] uppercase tracking-[0.2em]">
                  Pending Initialization...
                </span>
              </div>
              <h2 className="text-4xl font-black text-white mb-3 tracking-tight leading-[1.1]">
                Engage Tactical<br />
                <span className="text-[var(--accent)] drop-shadow-[0_0_10px_var(--accent-glow)]">Operation Session</span>
              </h2>
              <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto leading-relaxed">
                Generate a mission plan with coordinated agent lanes for parallel development.
              </p>
            </div>

            <PlanGenerator
              onPlanGenerated={handlePlanGenerated}
              defaultRepoPath={
                process.env.HOME
                  ? `${process.env.HOME}/.openclaw/workspace`
                  : ""
              }
              selectedTemplate={selectedTemplate}
              onClearTemplate={() => setSelectedTemplate(null)}
            />

            {/* Quick Actions Rail - Bold Command Center */}
            <div className="quick-actions-rail mt-12">
              <div className="flex items-center gap-4 mb-6">
                <h3 className="text-xs font-mono font-bold uppercase text-[var(--text-ghost)] tracking-[0.3em]">
                  Operational Quick Actions
                </h3>
                <div className="flex-grow h-px bg-[var(--border)]" />
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                {/* Recommended tile - View Runs - Bold Command Center */}
                <Link
                  href="/runs"
                  className="quick-action-tile quick-action-tile-recommended group tech-corners card-hover-glow relative p-6 rounded-xl"
                >
                  <div className="flex flex-col h-full justify-between">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-12 h-12 rounded-lg bg-[var(--bg-muted)] border border-[var(--border)] flex items-center justify-center transition-all group-hover:bg-[var(--accent-subtle)] group-hover:border-[var(--accent-border)] group-hover:shadow-[0_0_20px_var(--accent-glow)]">
                        <svg className="w-6 h-6 text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <span className="badge--recommended text-[9px] font-bold uppercase tracking-tight px-2 py-0.5 rounded bg-[var(--accent)] text-white animate-pulse">
                        Recommended
                      </span>
                    </div>
                    <div>
                      <h4 className="font-bold text-lg mb-2 text-white">Mission Logs</h4>
                      <p className="text-[var(--text-ghost)] text-sm leading-snug">
                        Review and optimize deployment command sequences.
                      </p>
                    </div>
                  </div>
                </Link>

                {/* New from Template tile - Bold */}
                <button
                  onClick={() => setShowTemplatePickerModal(true)}
                  className="quick-action-tile group text-left tech-corners card-hover-glow relative p-6 rounded-xl"
                >
                  <div className="flex flex-col h-full justify-between">
                    <div className="w-12 h-12 rounded-lg bg-[var(--bg-muted)] border border-[var(--border)] flex items-center justify-center mb-4 transition-all group-hover:bg-[var(--accent-subtle)] group-hover:border-[var(--accent-border)]">
                      <svg className="w-6 h-6 text-[var(--text-muted)] group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-bold text-lg mb-2 text-white">Architecture</h4>
                      <p className="text-[var(--text-ghost)] text-sm leading-snug">
                        Deploy pre-configured tactical environment patterns.
                      </p>
                    </div>
                  </div>
                </button>

                {/* Import Plan tile - Bold */}
                <button
                  onClick={() => setShowImportModal(true)}
                  className="quick-action-tile group text-left tech-corners card-hover-glow relative p-6 rounded-xl"
                >
                  <div className="flex flex-col h-full justify-between">
                    <div className="w-12 h-12 rounded-lg bg-[var(--bg-muted)] border border-[var(--border)] flex items-center justify-center mb-4 transition-all group-hover:bg-[var(--accent-subtle)] group-hover:border-[var(--accent-border)]">
                      <svg className="w-6 h-6 text-[var(--text-muted)] group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-bold text-lg mb-2 text-white">Import Ops</h4>
                      <p className="text-[var(--text-ghost)] text-sm leading-snug">
                        Ingest external YAML/JSON operational datasets.
                      </p>
                    </div>
                  </div>
                </button>

                {/* Open Folder tile - Bold */}
                <button
                  onClick={() => setShowImportFolderModal(true)}
                  className="quick-action-tile group text-left tech-corners card-hover-glow relative p-6 rounded-xl"
                >
                  <div className="flex flex-col h-full justify-between">
                    <div className="w-12 h-12 rounded-lg bg-[var(--bg-muted)] border border-[var(--border)] flex items-center justify-center mb-4 transition-all group-hover:bg-[var(--accent-subtle)] group-hover:border-[var(--accent-border)]">
                      <svg className="w-6 h-6 text-[var(--text-muted)] group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-bold text-lg mb-2 text-white">Recovery</h4>
                      <p className="text-[var(--text-ghost)] text-sm leading-snug">
                        Re-establish link with previous session state.
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer - Bold Command Center */}
      <footer className="border-t border-[var(--border)] mt-auto bg-[var(--bg-deep)]/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded bg-[var(--accent-subtle)] border border-[var(--accent-border)]">
                <svg className="w-3 h-3 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <span className="text-[10px] font-mono uppercase text-[var(--accent)] font-bold tracking-[0.15em]">
                Encrypted Uplink Established
              </span>
            </div>
            <div className="h-4 w-px bg-[var(--border)]" />
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)] shadow-[0_0_8px_var(--success)]" />
              <span className="text-[10px] font-mono uppercase text-[var(--text-ghost)] tracking-[0.15em]">
                Hardware Nominal
              </span>
            </div>
          </div>
          <div className="flex items-center gap-8 text-[10px] font-mono text-[var(--text-ghost)] uppercase tracking-[0.15em]">
            <a href="#" className="hover:text-[var(--accent)] transition-colors flex items-center gap-1.5">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Protocol Docs
            </a>
            <span className="hover:text-[var(--accent)] transition-colors cursor-pointer">Node Map</span>
            <div className="flex items-center gap-2 text-[var(--accent)] font-bold">
              <span className="animate-pulse">●</span>
              <span className="tabular-nums">{new Date().toLocaleTimeString('en-US', { hour12: false })}</span>
            </div>
          </div>
        </div>
      </footer>

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
