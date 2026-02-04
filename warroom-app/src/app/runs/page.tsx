import Link from "next/link";
import { RunsList } from "@/components/RunsList";
import { listRuns } from "@/lib/run-manager";
import os from "os";

export const dynamic = "force-dynamic";

export default async function RunsPage() {
  const workspacePath = `${os.homedir()}/.openclaw/workspace`;
  const runs = await listRuns(workspacePath);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="panel-header sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-4 group">
              <div className="logo-mark">WR</div>
              <div>
                <h1 className="logo-text group-hover:text-[var(--amber)] transition-colors">WAR ROOM</h1>
                <p className="text-[10px] font-mono text-[var(--text-ghost)] tracking-[0.2em] uppercase mt-0.5">
                  Mission Control v0.1
                </p>
              </div>
            </Link>
          </div>

          <Link href="/" className="btn-primary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Mission
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-10">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded bg-[var(--panel)] border border-[var(--border-default)] flex items-center justify-center">
              <svg className="w-5 h-5 text-[var(--amber)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-[var(--text-primary)]">
                Mission Runs
              </h2>
              <p className="text-sm text-[var(--text-tertiary)]">
                View and manage active and completed operations
              </p>
            </div>
          </div>
        </div>

        <RunsList initialRuns={runs} />
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border-subtle)] mt-auto">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between text-xs">
          <div className="flex items-center gap-4 text-[var(--text-ghost)] font-mono">
            <span className="uppercase tracking-wider">War Room MVP</span>
            <span className="text-[var(--border-default)]">|</span>
            <span>Runs Dashboard</span>
          </div>
          <div className="flex items-center gap-2 text-[var(--text-ghost)]">
            <span className="indicator-dot indicator-dot-success" style={{ width: '6px', height: '6px' }} />
            <span className="font-mono uppercase tracking-wider">All Systems Nominal</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
