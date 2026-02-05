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
      <header className="panel-header sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="logo-mark">WR</div>
            <div>
              <h1 className="logo-text">WAR ROOM</h1>
              <p className="text-[10px] font-mono text-[var(--text-ghost)] tracking-[0.2em] uppercase mt-0.5">
                Mission Control v0.1
              </p>
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
            {/* Hero Section - tightened vertical rhythm */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--border-accent)] bg-[var(--amber-glow)] mb-4">
                <span className="indicator-dot indicator-dot-amber" />
                <span className="text-xs font-mono text-[var(--amber)] tracking-wide uppercase">
                  System Online
                </span>
              </div>
              <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-2 tracking-tight">
                Initialize War Room Session
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

            {/* Quick Actions Rail - secondary navigation */}
            <div className="quick-actions-rail">
              <div className="quick-actions-header">Quick Actions</div>
              <div className="grid md:grid-cols-2 gap-3">
                {/* Recommended tile - View Runs */}
                <Link
                  href="/runs"
                  className="quick-action-tile quick-action-tile-recommended group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded bg-[var(--amber-glow)] border border-[var(--amber-dim)] flex items-center justify-center flex-shrink-0 transition-all group-hover:border-[var(--amber)] group-hover:shadow-[0_0_12px_var(--amber-glow)]">
                      <svg className="w-5 h-5 text-[var(--amber)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-medium text-[var(--text-primary)] leading-tight">
                          View Mission Runs
                        </h3>
                        <span className="badge-recommended">Recommended</span>
                      </div>
                      <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
                        Browse existing mission runs and their status
                      </p>
                    </div>
                    <svg className="w-4 h-4 text-[var(--text-ghost)] group-hover:text-[var(--amber)] transition-colors flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>

                {/* New from Template tile */}
                <button
                  onClick={() => setShowTemplatePickerModal(true)}
                  className="quick-action-tile group text-left"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded bg-[var(--amber-glow)] border border-[var(--amber-dim)] flex items-center justify-center flex-shrink-0 transition-all group-hover:border-[var(--amber)] group-hover:shadow-[0_0_12px_var(--amber-glow)]">
                      <svg className="w-5 h-5 text-[var(--amber)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-[var(--text-primary)] mb-1 leading-tight">
                        New from Template
                      </h3>
                      <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
                        Start with a saved plan configuration
                      </p>
                    </div>
                    <svg className="w-4 h-4 text-[var(--text-ghost)] group-hover:text-[var(--amber)] transition-colors flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>

                {/* Import Plan tile */}
                <button
                  onClick={() => setShowImportModal(true)}
                  className="quick-action-tile group text-left"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded bg-[var(--cyan-glow)] border border-[var(--cyan-dim)] flex items-center justify-center flex-shrink-0 transition-all group-hover:border-[var(--cyan)] group-hover:shadow-[0_0_12px_rgba(6,182,212,0.2)]">
                      <svg className="w-5 h-5 text-[var(--cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-[var(--text-primary)] mb-1 leading-tight">
                        Import Mission Plan
                      </h3>
                      <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
                        Load a plan.json from external source
                      </p>
                    </div>
                    <svg className="w-4 h-4 text-[var(--text-ghost)] group-hover:text-[var(--cyan)] transition-colors flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>

                {/* Open Folder tile */}
                <button
                  onClick={() => setShowImportFolderModal(true)}
                  className="quick-action-tile group text-left"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded bg-[var(--amber-glow)] border border-[var(--border-accent)] flex items-center justify-center flex-shrink-0 transition-all group-hover:border-[var(--accent)] group-hover:shadow-[var(--shadow-glow)]">
                      <svg className="w-5 h-5 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-[var(--text-primary)] mb-1 leading-tight">
                        Resume Existing Mission
                      </h3>
                      <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
                        Open a run folder to continue operations
                      </p>
                    </div>
                    <svg className="w-4 h-4 text-[var(--text-ghost)] group-hover:text-[var(--accent)] transition-colors flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>

                {/* Mission Sequence info tile */}
                <div className="quick-action-tile">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded bg-[rgba(34,197,94,0.12)] border border-[rgba(34,197,94,0.25)] flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-[var(--status-success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-[var(--text-primary)] mb-1 leading-tight">
                        Mission Sequence
                      </h3>
                      <ul className="text-xs text-[var(--text-tertiary)] space-y-0.5">
                        <li className="flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-[var(--text-ghost)]" />
                          Creates plan.json with agent chain
                        </li>
                        <li className="flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-[var(--text-ghost)]" />
                          Generates packets for each lane
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border-subtle)] mt-auto">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between text-xs">
          <div className="flex items-center gap-4 text-[var(--text-ghost)] font-mono">
            <span className="uppercase tracking-wider">War Room MVP</span>
            <span className="text-[var(--border-default)]">|</span>
            <span>Plan Generation M1</span>
          </div>
          <div className="flex items-center gap-2 text-[var(--text-ghost)]">
            <span className="indicator-dot indicator-dot-success indicator-dot--sm" />
            <span className="font-mono uppercase tracking-wider">All Systems Nominal</span>
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
