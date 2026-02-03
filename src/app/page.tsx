"use client";

import { useState, useCallback } from "react";
import { RepoSelector } from "@/components/RepoSelector";
import { AgentsList } from "@/components/AgentsList";
import { SkillsList } from "@/components/SkillsList";
import { PrdList } from "@/components/PrdList";
import { RunsList } from "@/components/RunsList";
import { ClaudeMdViewer } from "@/components/ClaudeMdViewer";
import { fetchRepoInfo } from "@/lib/actions";
import type { RepoInfo } from "@/lib/fs-utils";

const DEFAULT_REPO_PATH = "/Users/ajhart/.openclaw/workspace";

export default function DashboardPage() {
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRepoSelect = useCallback(async (path: string) => {
    setIsLoading(true);
    setError(null);

    const result = await fetchRepoInfo(path);

    if (result.success && result.data) {
      setRepoInfo(result.data);
    } else {
      setError(result.error || "Failed to load repo");
      setRepoInfo(null);
    }

    setIsLoading(false);
  }, []);

  return (
    <div className="space-y-6">
      {/* Repo Selector */}
      <section className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          Select Repository
        </h2>
        <RepoSelector
          initialPath={DEFAULT_REPO_PATH}
          onSelect={handleRepoSelect}
        />
        {isLoading && (
          <p className="mt-2 text-sm text-gray-500">Loading repo info...</p>
        )}
        {error && (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        )}
      </section>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Repo Info */}
        <div className="lg:col-span-2 space-y-6">
          {repoInfo ? (
            <>
              {/* Repo Summary */}
              <section className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-gray-700">
                    {repoInfo.name}
                  </h2>
                  <div className="flex gap-2">
                    {repoInfo.hasClaudeDir && (
                      <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">
                        .claude/
                      </span>
                    )}
                    {repoInfo.hasTasksDir && (
                      <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                        tasks/
                      </span>
                    )}
                    {repoInfo.hasClaudeMd && (
                      <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                        CLAUDE.md
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-500 truncate">{repoInfo.path}</p>
              </section>

              {/* Agents & Skills */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <section className="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    Agents ({repoInfo.agents.length})
                  </h3>
                  <AgentsList agents={repoInfo.agents} />
                </section>

                <section className="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    Skills ({repoInfo.skills.length})
                  </h3>
                  <SkillsList skills={repoInfo.skills} />
                </section>
              </div>

              {/* PRDs */}
              <section className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Tasks / PRDs ({repoInfo.prds.length})
                </h3>
                <PrdList prds={repoInfo.prds} />
              </section>

              {/* CLAUDE.md */}
              {repoInfo.claudeMdContent && (
                <section className="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    Project Instructions
                  </h3>
                  <ClaudeMdViewer content={repoInfo.claudeMdContent} />
                </section>
              )}
            </>
          ) : (
            <section className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <p className="text-gray-500 text-sm">
                Select a repository to view its agents, skills, and PRDs
              </p>
            </section>
          )}
        </div>

        {/* Right Column: Runs */}
        <div className="space-y-6">
          <section className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              Recent Runs
            </h2>
            <RunsList useStubData={true} />
          </section>
        </div>
      </div>
    </div>
  );
}
