import Link from "next/link";
import { RunsList } from "@/components/RunsList";
import { listRuns } from "@/lib/run-manager";
import os from "os";

export const dynamic = "force-dynamic";

export default async function RunsPage() {
  const workspacePath = `${os.homedir()}/.openclaw/workspace`;
  const runs = await listRuns(workspacePath);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">WR</span>
              </div>
              <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                War Room
              </h1>
            </Link>
          </div>
          <Link
            href="/"
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
          >
            + New Plan
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
            Runs
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400">
            View and manage your War Room runs
          </p>
        </div>

        <RunsList initialRuns={runs} />
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 mt-auto">
        <div className="max-w-5xl mx-auto px-4 py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
          War Room MVP - Runs Dashboard
        </div>
      </footer>
    </div>
  );
}
