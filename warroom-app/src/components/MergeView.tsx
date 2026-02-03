"use client";

import { useState, useEffect, useCallback } from "react";
import { LaneStatus, MergeMethod, MergeProposal } from "@/lib/plan-schema";

interface LaneMergeInfo {
  laneId: string;
  branch: string;
  status: LaneStatus;
  isComplete: boolean;
  isMergeCandidate: boolean;
  commitsAhead: number;
  filesChanged: string[];
  conflictRisk: "none" | "low" | "medium" | "high";
  overlappingLanes: string[];
  error?: string;
}

interface MergeInfoResponse {
  success: boolean;
  integrationBranch: string;
  lanes: LaneMergeInfo[];
  overlapMatrix: Record<string, string[]>;
  error?: string;
}

interface MergeProposalResponse {
  success: boolean;
  proposal?: MergeProposal;
  error?: string;
}

interface MergeViewProps {
  slug: string;
}

export function MergeView({ slug }: MergeViewProps) {
  const [mergeInfo, setMergeInfo] = useState<MergeInfoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<MergeProposal | null>(null);
  const [proposalLoading, setProposalLoading] = useState(false);
  const [proposalError, setProposalError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  const fetchMergeInfo = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/runs/${slug}/merge-info`);
      const data = await response.json();
      if (data.success) {
        setMergeInfo(data);
      } else {
        setError(data.error || "Failed to fetch merge info");
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [slug]);

  const fetchExistingProposal = useCallback(async () => {
    try {
      const response = await fetch(`/api/runs/${slug}/merge-proposal`);
      const data: MergeProposalResponse = await response.json();
      if (data.success && data.proposal) {
        setProposal(data.proposal);
      }
    } catch {
      // No existing proposal, that's fine
    }
  }, [slug]);

  const generateProposal = useCallback(async () => {
    setProposalLoading(true);
    setProposalError(null);
    try {
      const response = await fetch(`/api/runs/${slug}/merge-proposal`, {
        method: "POST",
      });
      const data: MergeProposalResponse = await response.json();
      if (data.success && data.proposal) {
        setProposal(data.proposal);
      } else {
        setProposalError(data.error || "Failed to generate proposal");
      }
    } catch (err) {
      setProposalError(String(err));
    } finally {
      setProposalLoading(false);
    }
  }, [slug]);

  const copyPMPrompt = useCallback(async () => {
    if (!proposal?.pmPrompt) return;
    try {
      await navigator.clipboard.writeText(proposal.pmPrompt);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      // Clipboard failed
    }
  }, [proposal?.pmPrompt]);

  useEffect(() => {
    fetchMergeInfo();
    fetchExistingProposal();
  }, [fetchMergeInfo, fetchExistingProposal]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
        <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4">
          Merge Readiness
        </h3>
        <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="text-sm">Analyzing branches...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
        <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4">
          Merge Readiness
        </h3>
        <div className="text-red-500 dark:text-red-400 text-sm">{error}</div>
        <button
          onClick={fetchMergeInfo}
          className="mt-3 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!mergeInfo) {
    return null;
  }

  const mergeCandidates = mergeInfo.lanes.filter((l) => l.isMergeCandidate);
  const pendingLanes = mergeInfo.lanes.filter((l) => !l.isMergeCandidate);
  const hasConflictRisk = mergeInfo.lanes.some((l) => l.conflictRisk !== "none");

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
          Merge Readiness
        </h3>
        <button
          onClick={fetchMergeInfo}
          className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          title="Refresh"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      {/* Integration Branch */}
      <div className="mb-4 pb-4 border-b border-zinc-100 dark:border-zinc-800">
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          Target Branch:
        </span>
        <span className="ml-2 font-mono text-sm text-zinc-900 dark:text-zinc-100">
          {mergeInfo.integrationBranch}
        </span>
      </div>

      {/* Summary */}
      <div className="mb-4 pb-4 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-zinc-600 dark:text-zinc-400">
              {mergeCandidates.length} ready to merge
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-zinc-300 dark:bg-zinc-600" />
            <span className="text-zinc-600 dark:text-zinc-400">
              {pendingLanes.length} pending
            </span>
          </div>
          {hasConflictRisk && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-zinc-600 dark:text-zinc-400">
                Potential conflicts
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Lane List */}
      <div className="space-y-3">
        {mergeInfo.lanes.map((lane) => (
          <LaneMergeCard key={lane.laneId} lane={lane} />
        ))}
      </div>

      {/* Overlap Warning */}
      {Object.keys(mergeInfo.overlapMatrix).length > 0 && (
        <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
          <div className="flex items-start gap-2 text-sm text-amber-600 dark:text-amber-400">
            <svg
              className="w-4 h-4 mt-0.5 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <span className="font-medium">File overlap detected:</span>
              <span className="ml-1">
                Some lanes modify the same files. Review carefully before merging.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Merge Proposal Section */}
      <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Merge Proposal
          </h4>
          <button
            onClick={generateProposal}
            disabled={proposalLoading || mergeCandidates.length === 0}
            className="px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {proposalLoading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Generating...</span>
              </>
            ) : proposal ? (
              "Regenerate Proposal"
            ) : (
              "Generate Merge Proposal"
            )}
          </button>
        </div>

        {proposalError && (
          <div className="text-red-500 dark:text-red-400 text-sm mb-4">
            {proposalError}
          </div>
        )}

        {mergeCandidates.length === 0 && (
          <div className="text-sm text-zinc-500 dark:text-zinc-400">
            No lanes are ready to merge yet. Complete at least one lane to generate a merge proposal.
          </div>
        )}

        {proposal && (
          <MergeProposalDisplay
            proposal={proposal}
            copyState={copyState}
            onCopy={copyPMPrompt}
          />
        )}
      </div>
    </div>
  );
}

function LaneMergeCard({ lane }: { lane: LaneMergeInfo }) {
  const [expanded, setExpanded] = useState(false);

  const riskColors = {
    none: "",
    low: "border-l-4 border-l-yellow-400",
    medium: "border-l-4 border-l-orange-400",
    high: "border-l-4 border-l-red-400",
  };

  const riskBadgeColors = {
    none: "",
    low: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    medium: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <div
      className={`p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 ${
        lane.isMergeCandidate
          ? "bg-green-50 dark:bg-green-900/10"
          : "bg-zinc-50 dark:bg-zinc-800/50"
      } ${riskColors[lane.conflictRisk]}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Merge candidate indicator */}
          <div
            className={`w-5 h-5 rounded-full flex items-center justify-center ${
              lane.isMergeCandidate
                ? "bg-green-500 text-white"
                : "bg-zinc-300 dark:bg-zinc-600"
            }`}
          >
            {lane.isMergeCandidate && (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {lane.laneId}
              </span>
              {lane.isMergeCandidate && (
                <span className="px-1.5 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                  merge candidate
                </span>
              )}
              {lane.conflictRisk !== "none" && (
                <span
                  className={`px-1.5 py-0.5 text-xs font-medium rounded ${
                    riskBadgeColors[lane.conflictRisk]
                  }`}
                >
                  {lane.conflictRisk} risk
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                {lane.branch}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Commit count */}
          <div className="text-right">
            <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {lane.commitsAhead}
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              {lane.commitsAhead === 1 ? "commit" : "commits"} ahead
            </div>
          </div>

          {/* Expand button */}
          {lane.filesChanged.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded"
              title={expanded ? "Hide files" : "Show files"}
            >
              <svg
                className={`w-4 h-4 transition-transform ${
                  expanded ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Overlap warning */}
      {lane.overlappingLanes.length > 0 && (
        <div className="mt-2 ml-8 text-xs text-amber-600 dark:text-amber-400">
          Overlaps with: {lane.overlappingLanes.join(", ")}
        </div>
      )}

      {/* Expanded files list */}
      {expanded && lane.filesChanged.length > 0 && (
        <div className="mt-3 ml-8 pt-3 border-t border-zinc-200 dark:border-zinc-700">
          <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
            Files changed ({lane.filesChanged.length}):
          </div>
          <div className="max-h-40 overflow-y-auto">
            {lane.filesChanged.map((file) => (
              <div
                key={file}
                className="text-xs font-mono text-zinc-600 dark:text-zinc-400 py-0.5"
              >
                {file}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {lane.error && (
        <div className="mt-2 ml-8 text-xs text-red-500 dark:text-red-400">
          {lane.error}
        </div>
      )}
    </div>
  );
}

interface MergeProposalDisplayProps {
  proposal: MergeProposal;
  copyState: "idle" | "copied";
  onCopy: () => void;
}

function MergeProposalDisplay({
  proposal,
  copyState,
  onCopy,
}: MergeProposalDisplayProps) {
  const methodColors: Record<MergeMethod, string> = {
    merge: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    squash: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    "cherry-pick": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  };

  return (
    <div className="space-y-4">
      {/* Warnings */}
      {proposal.warnings.length > 0 && (
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <div className="flex items-start gap-2">
            <svg
              className="w-4 h-4 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div className="text-sm text-amber-700 dark:text-amber-300">
              <div className="font-medium mb-1">Warnings:</div>
              <ul className="list-disc list-inside space-y-0.5">
                {proposal.warnings.map((warning, idx) => (
                  <li key={idx}>{warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Merge Order */}
      <div>
        <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
          Proposed Merge Order:
        </div>
        <div className="space-y-2">
          {proposal.mergeOrder.map((lane) => (
            <div
              key={lane.laneId}
              className="flex items-center gap-3 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50"
            >
              <div className="w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-medium text-zinc-700 dark:text-zinc-300">
                {lane.order}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                    {lane.laneId}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 text-xs font-medium rounded ${methodColors[lane.method]}`}
                  >
                    {lane.method}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {lane.commitsAhead} {lane.commitsAhead === 1 ? "commit" : "commits"}
                  </span>
                </div>
                {lane.notes && (
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {lane.notes}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Copy PM Prompt Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={onCopy}
          className="px-4 py-2 text-sm font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors flex items-center gap-2"
        >
          {copyState === "copied" ? (
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
              <span>Copied!</span>
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
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <span>Copy PM Prompt</span>
            </>
          )}
        </button>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          Generated: {new Date(proposal.createdAt).toLocaleString()}
        </span>
      </div>

      {/* Saved location */}
      <div className="text-xs text-zinc-500 dark:text-zinc-400">
        Proposal saved to: <code className="font-mono">merge-proposal.json</code>
      </div>
    </div>
  );
}
