"use client";

import { useState } from "react";
import Link from "next/link";
import { WarRoomPlan } from "@/lib/plan-schema";
import { PlanGenerator } from "@/components/PlanGenerator";
import { PlanViewer } from "@/components/PlanViewer";

export default function Home() {
  const [generatedPlan, setGeneratedPlan] = useState<{
    plan: WarRoomPlan;
    runDir: string;
  } | null>(null);

  const handlePlanGenerated = (plan: WarRoomPlan, runDir: string) => {
    setGeneratedPlan({ plan, runDir });
  };

  const handleReset = () => {
    setGeneratedPlan(null);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">WR</span>
            </div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              War Room
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/runs"
              className="px-3 py-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
            >
              View Runs
            </Link>
            {generatedPlan && (
              <button
                onClick={handleReset}
                className="px-3 py-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
              >
                + New Plan
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {generatedPlan ? (
          <PlanViewer plan={generatedPlan.plan} runDir={generatedPlan.runDir} />
        ) : (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                Start a War Room Run
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400">
                Generate a plan with agent lanes and run packets. Then stage
                lanes to open Cursor windows for parallel development.
              </p>
            </div>
            <PlanGenerator
              onPlanGenerated={handlePlanGenerated}
              defaultRepoPath={
                process.env.HOME
                  ? `${process.env.HOME}/.openclaw/workspace`
                  : ""
              }
            />

            {/* Info Section */}
            <div className="mt-8 grid md:grid-cols-2 gap-4">
              <div className="p-4 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <h3 className="font-medium text-zinc-900 dark:text-zinc-100 mb-2">
                  OpenClaw Kickoff
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Click Generate Plan to have War Room create a plan with agent
                  lanes and run packets automatically.
                </p>
              </div>
              <div className="p-4 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <h3 className="font-medium text-zinc-900 dark:text-zinc-100 mb-2">
                  What Happens
                </h3>
                <ul className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
                  <li>• Creates plan.json with agent chain</li>
                  <li>• Generates packet files for each lane</li>
                  <li>• Writes to ~/.openclaw/workspace/warroom/runs/</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 mt-auto">
        <div className="max-w-5xl mx-auto px-4 py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
          War Room MVP - Plan Generation (M1)
        </div>
      </footer>
    </div>
  );
}
