"use client";

import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { LaneStatus, MergeMethod, MergeProposal, MergeState, AutoPushOptions, PushState } from "@/lib/plan-schema";

// Imperative handle for parent to trigger refresh
export interface MergeViewHandle {
  refreshProposal: () => Promise<void>;
}

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
  // Lanes whose changes are included in this lane (via merge/ancestry) - overlap is safe
  includedLanes?: string[];
  // Lanes with true conflict risk (independent changes to same files)
  conflictingLanes?: string[];
  error?: string;
}

interface MergeInfoResponse {
  success: boolean;
  integrationBranch: string;
  lanes: LaneMergeInfo[];
  overlapMatrix: Record<string, string[]>;
  mergeState?: MergeState;
  repoPath?: string;
  autoPushOptions?: AutoPushOptions;
  integrationBranchPushState?: PushState;
  error?: string;
}

interface MergeProposalResponse {
  success: boolean;
  proposal?: MergeProposal;
  error?: string;
}

interface ConflictInfo {
  laneId: string;
  branch: string;
  conflictingFiles: string[];
  worktreePath: string;
}

interface MergeLaneResult {
  laneId: string;
  branch: string;
  success: boolean;
  method: string;
  error?: string;
}

interface MergeResponse {
  success: boolean;
  results: MergeLaneResult[];
  conflict?: ConflictInfo;
  mergedToMain?: boolean;
  error?: string;
}

interface MergeViewProps {
  slug: string;
}

const RISK_CONFIG = {
  none: { color: "transparent", borderColor: "transparent" },
  low: { color: "var(--status-warning)", borderColor: "rgba(245, 158, 11, 0.3)" },
  medium: { color: "#f97316", borderColor: "rgba(249, 115, 22, 0.3)" },
  high: { color: "var(--status-error)", borderColor: "rgba(239, 68, 68, 0.3)" },
};

export const MergeView = forwardRef<MergeViewHandle, MergeViewProps>(function MergeView({ slug }, ref) {
  const [mergeInfo, setMergeInfo] = useState<MergeInfoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<MergeProposal | null>(null);
  const [proposalLoading, setProposalLoading] = useState(false);
  const [proposalError, setProposalError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  const [mergeLoading, setMergeLoading] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [mergeResults, setMergeResults] = useState<MergeLaneResult[]>([]);
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [confirmMergeToMain, setConfirmMergeToMain] = useState(false);
  const [mergedToMain, setMergedToMain] = useState(false);
  const [launchMergeStatus, setLaunchMergeStatus] = useState<"idle" | "launched" | "error">("idle");
  const [openingCursor, setOpeningCursor] = useState(false);
  const [autoPushOptions, setAutoPushOptions] = useState<AutoPushOptions>({
    fullAutonomyMode: false,
    pushLaneBranches: false,
    pushIntegrationBranch: false,
    mergeToMain: false,
    pushMainBranch: false,
  });

  // Expose refresh function to parent via ref
  useImperativeHandle(ref, () => ({
    refreshProposal: async () => {
      await fetchExistingProposal();
      await fetchMergeInfo();
    },
  }));

  const fetchMergeInfo = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/runs/${slug}/merge-info`);
      const data = await response.json();
      if (data.success) {
        setMergeInfo(data);
        // Load auto-push options from merge info
        if (data.autoPushOptions) {
          setAutoPushOptions(data.autoPushOptions);
        }
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
      // No existing proposal
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

  const executeMerge = useCallback(async () => {
    if (!proposal) {
      console.error("No proposal available");
      setMergeError("No merge proposal available. Generate one first.");
      return;
    }

    console.log("Launching merge for slug:", slug);
    setMergeLoading(true);
    setMergeError(null);

    try {
      // Launch merge - spawns terminal with Claude Code running /warroom-merge
      const response = await fetch(`/api/runs/${slug}/launch-merge`, {
        method: "POST",
      });

      console.log("Launch merge response status:", response.status);
      const data = await response.json();
      console.log("Launch merge response data:", data);

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to launch merge");
      }

      // Terminal has been spawned with Claude Code
      setLaunchMergeStatus("launched");
      setTimeout(() => {
        setLaunchMergeStatus("idle");
      }, 5000);

      setMergeLoading(false);
      return;
    } catch (err) {
      console.error("Launch merge error:", err);
      setMergeError(err instanceof Error ? err.message : String(err));
      setLaunchMergeStatus("error");
      setMergeLoading(false);
      setTimeout(() => setLaunchMergeStatus("idle"), 3000);
      return;
    }
  }, [slug, proposal]);

  // Keep old server-side merge function for reference (not currently used)
  const executeServerMerge = useCallback(async () => {
    if (!proposal) return;

    const shouldMergeToMain = autoPushOptions.mergeToMain &&
      (autoPushOptions.fullAutonomyMode || confirmMergeToMain);

    setMergeLoading(true);
    setMergeError(null);
    setConflict(null);
    setMergeResults([]);
    setMergedToMain(false);

    try {
      const response = await fetch(`/api/runs/${slug}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mergeToMain: shouldMergeToMain,
          confirmMergeToMain: shouldMergeToMain,
          pushMainBranch: shouldMergeToMain && autoPushOptions.pushMainBranch,
        }),
      });
      const data: MergeResponse = await response.json();

      setMergeResults(data.results);

      if (data.conflict) {
        setConflict(data.conflict);
        setMergeError(data.error || "Merge conflict occurred");
      } else if (!data.success) {
        setMergeError(data.error || "Merge failed");
      } else {
        setMergedToMain(data.mergedToMain || false);
        fetchMergeInfo();
      }
    } catch (err) {
      setMergeError(String(err));
    } finally {
      setMergeLoading(false);
    }
  }, [slug, proposal, autoPushOptions, confirmMergeToMain, fetchMergeInfo]);

  const openInCursor = useCallback(async (worktreePath: string) => {
    setOpeningCursor(true);
    try {
      await fetch(`/api/open-cursor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: worktreePath }),
      });
    } catch {
      // Best-effort
    } finally {
      setOpeningCursor(false);
    }
  }, []);

  const updateAutoPushOptions = useCallback(async (newOptions: AutoPushOptions) => {
    setAutoPushOptions(newOptions);
    try {
      await fetch(`/api/runs/${slug}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoPushOptions: newOptions }),
      });
    } catch (err) {
      console.error("Failed to update auto-push options:", err);
    }
  }, [slug]);

  useEffect(() => {
    fetchMergeInfo();
    fetchExistingProposal();
  }, [fetchMergeInfo, fetchExistingProposal]);

  // Auto-generate proposal when full autonomy is enabled and lanes are ready
  useEffect(() => {
    if (
      autoPushOptions.fullAutonomyMode &&
      mergeInfo &&
      !proposal &&
      !proposalLoading &&
      mergeInfo.lanes.some((l) => l.isMergeCandidate)
    ) {
      generateProposal();
    }
  }, [autoPushOptions.fullAutonomyMode, mergeInfo, proposal, proposalLoading, generateProposal]);

  if (loading) {
    return (
      <div className="panel-bracketed p-6">
        <h3 className="text-lg font-medium text-[var(--text-primary)] mb-4">
          Merge Readiness
        </h3>
        <div className="flex items-center gap-3 text-[var(--text-tertiary)]">
          <span className="spinner" />
          <span className="text-sm font-mono uppercase tracking-wider">Analyzing branches...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel-bracketed p-6">
        <h3 className="text-lg font-medium text-[var(--text-primary)] mb-4">
          Merge Readiness
        </h3>
        <div className="text-sm text-[var(--status-danger)] mb-3">{error}</div>
        <button onClick={fetchMergeInfo} className="btn-ghost text-sm">
          Retry
        </button>
      </div>
    );
  }

  if (!mergeInfo) return null;

  const mergeCandidates = mergeInfo.lanes.filter((l) => l.isMergeCandidate);
  const pendingLanes = mergeInfo.lanes.filter((l) => !l.isMergeCandidate);
  // True conflicts are lanes with conflictingLanes (not just inherited overlaps)
  const hasConflictRisk = mergeInfo.lanes.some((l) => l.conflictingLanes && l.conflictingLanes.length > 0);
  // Lanes with inherited changes (safe overlaps)
  const hasInheritedChanges = mergeInfo.lanes.some((l) => l.includedLanes && l.includedLanes.length > 0);

  return (
    <div className="panel-bracketed p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[rgba(168,85,247,0.15)] border border-[rgba(168,85,247,0.3)] flex items-center justify-center">
            <svg className="w-4 h-4 text-[#a855f7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-[var(--text-primary)]">
            Merge Readiness
          </h3>
        </div>
        <button
          onClick={fetchMergeInfo}
          className="btn-ghost p-2"
          title="Refresh"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Integration Branch */}
      <div className="mb-5 pb-5 border-b border-[var(--border-subtle)]">
        <span className="label-caps mr-2">Target Branch</span>
        <code className="code-inline">{mergeInfo.integrationBranch}</code>
      </div>

      {/* Summary */}
      <div className="mb-5 pb-5 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="indicator-dot indicator-dot-success" />
            <span className="text-sm text-[var(--text-secondary)]">
              {mergeCandidates.length} ready to merge
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--text-ghost)]" />
            <span className="text-sm text-[var(--text-secondary)]">
              {pendingLanes.length} pending
            </span>
          </div>
          {hasInheritedChanges && !hasConflictRisk && (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--cyan)]" />
              <span className="text-sm text-[var(--text-secondary)]">
                Sequential merges
              </span>
            </div>
          )}
          {hasConflictRisk && (
            <div className="flex items-center gap-2">
              <span className="indicator-dot indicator-dot-amber" />
              <span className="text-sm text-[var(--text-secondary)]">
                Potential conflicts
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Auto-Merge Status - shows when merge has started or has conflict */}
      {mergeInfo.mergeState && mergeInfo.mergeState.status !== "idle" && (
        <AutoMergeStatusDisplay
          mergeState={mergeInfo.mergeState}
          repoPath={mergeInfo.repoPath || ""}
          onOpenInCursor={openInCursor}
          openingCursor={openingCursor}
          onRefresh={fetchMergeInfo}
        />
      )}

      {/* Lane List */}
      <div className="space-y-3 mb-5">
        {(() => {
          // Group lanes with identical errors together
          const errorGroups: Record<string, LaneMergeInfo[]> = {};
          const normalLanes: LaneMergeInfo[] = [];

          mergeInfo.lanes.forEach((lane) => {
            if (lane.error) {
              const key = lane.error;
              if (!errorGroups[key]) {
                errorGroups[key] = [];
              }
              errorGroups[key].push(lane);
            } else {
              normalLanes.push(lane);
            }
          });

          return (
            <>
              {/* Show normal lanes individually */}
              {normalLanes.map((lane) => (
                <LaneMergeCard key={lane.laneId} lane={lane} />
              ))}

              {/* Show grouped error lanes as collapsed summaries */}
              {Object.entries(errorGroups).map(([errorMsg, lanes]) => (
                lanes.length > 1 ? (
                  <ErrorSummaryCard key={errorMsg} error={errorMsg} lanes={lanes} />
                ) : (
                  <LaneMergeCard key={lanes[0].laneId} lane={lanes[0]} />
                )
              ))}
            </>
          );
        })()}
      </div>

      {/* True Conflict Warning - only for independent overlapping changes */}
      {hasConflictRisk && (
        <div className="mb-5 p-4 rounded border border-[rgba(234,179,8,0.3)] bg-[rgba(234,179,8,0.08)]">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-[var(--status-warning)] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="text-sm text-[var(--status-warning)]">
              <span className="font-medium">Potential conflicts detected:</span>{" "}
              Some lanes independently modified the same files. Review carefully before merging.
            </div>
          </div>
        </div>
      )}

      {/* Sequential Merge Info - safe overlaps from dependency chain */}
      {hasInheritedChanges && !hasConflictRisk && (
        <div className="mb-5 p-4 rounded border border-[rgba(6,182,212,0.3)] bg-[rgba(6,182,212,0.08)]">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-[var(--cyan)] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-[var(--cyan)]">
              <span className="font-medium">Sequential dependency chain:</span>{" "}
              Some lanes include changes from upstream lanes. This is expected and will merge cleanly.
            </div>
          </div>
        </div>
      )}

      {/* Auto-Push Options */}
      <AutoPushOptionsPanel
        options={autoPushOptions}
        onChange={updateAutoPushOptions}
        integrationBranchPushState={mergeInfo.integrationBranchPushState}
      />

      {/* Merge Proposal Section */}
      <div className="pt-5 border-t border-[var(--border-subtle)]">
        <div className="flex items-center justify-between mb-5">
          <h4 className="text-sm font-medium text-[var(--text-primary)]">
            Merge Proposal
          </h4>
          {/* In full autonomy mode, proposal auto-generates - only show regenerate option */}
          {autoPushOptions.fullAutonomyMode ? (
            proposalLoading ? (
              <span className="text-xs text-[var(--text-tertiary)] flex items-center gap-2">
                <span className="spinner" />
                Auto-generating...
              </span>
            ) : proposal ? (
              <button
                onClick={generateProposal}
                className="btn-ghost text-xs"
                title="Regenerate proposal"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            ) : null
          ) : (
            <button
              onClick={generateProposal}
              disabled={proposalLoading || mergeCandidates.length === 0}
              className="btn-primary text-sm"
            >
              {proposalLoading ? (
                <>
                  <span className="spinner" />
                  Generating...
                </>
              ) : proposal ? (
                "Regenerate Proposal"
              ) : (
                "Generate Merge Proposal"
              )}
            </button>
          )}
        </div>

        {proposalError && (
          <div className="mb-4 text-sm text-[var(--status-danger)]">{proposalError}</div>
        )}

        {mergeCandidates.length === 0 && !autoPushOptions.fullAutonomyMode && (
          <div className="text-sm text-[var(--text-tertiary)]">
            No lanes are ready to merge yet. Complete at least one lane to generate a merge proposal.
          </div>
        )}

        {mergeCandidates.length === 0 && autoPushOptions.fullAutonomyMode && (
          <div className="text-sm text-[var(--text-tertiary)]">
            Waiting for lanes to complete. Proposal will auto-generate when ready.
          </div>
        )}

        {proposal && (
          <MergeProposalDisplay
            proposal={proposal}
            copyState={copyState}
            onCopy={copyPMPrompt}
            mergeLoading={mergeLoading}
            mergeError={mergeError}
            mergeResults={mergeResults}
            conflict={conflict}
            autoPushOptions={autoPushOptions}
            confirmMergeToMain={confirmMergeToMain}
            setConfirmMergeToMain={setConfirmMergeToMain}
            mergedToMain={mergedToMain}
            onExecuteMerge={executeMerge}
            onOpenInCursor={openInCursor}
            launchMergeStatus={launchMergeStatus}
          />
        )}
      </div>
    </div>
  );
});

// Collapsed error summary for multiple lanes with the same error
function ErrorSummaryCard({ error, lanes }: { error: string; lanes: LaneMergeInfo[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="error-summary p-4 rounded border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: "var(--status-error)",
              color: "var(--void)",
            }}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
            </svg>
          </div>

          <div>
            <div className="badge-cluster">
              <span className="font-medium text-sm text-[var(--status-error)]">
                {lanes.length} lanes affected
              </span>
              <span className="badge badge-danger">error</span>
            </div>
            <div className="text-xs text-[var(--status-error)] mt-1 opacity-80">
              {error}
            </div>
          </div>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="btn-ghost p-1.5"
          title={expanded ? "Hide lanes" : "Show lanes"}
        >
          <svg
            className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-[rgba(239,68,68,0.2)]">
          <div className="text-[10px] text-[var(--text-ghost)] uppercase tracking-wider mb-2">
            Affected lanes ({lanes.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {lanes.map((lane) => (
              <span
                key={lane.laneId}
                className="text-xs font-mono px-2 py-1 rounded bg-[rgba(239,68,68,0.1)] text-[var(--status-error)] border border-[rgba(239,68,68,0.2)]"
              >
                {lane.laneId}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LaneMergeCard({ lane }: { lane: LaneMergeInfo }) {
  const [expanded, setExpanded] = useState(false);
  const riskConfig = RISK_CONFIG[lane.conflictRisk];

  return (
    <div
      className="p-4 rounded border transition-all"
      style={{
        backgroundColor: lane.isMergeCandidate ? "rgba(34, 197, 94, 0.08)" : "var(--panel)",
        borderColor: lane.isMergeCandidate ? "rgba(34, 197, 94, 0.3)" : "var(--border-default)",
        borderLeftWidth: "3px",
        borderLeftColor: lane.conflictRisk !== "none" ? riskConfig.color : (lane.isMergeCandidate ? "var(--status-success)" : "var(--border-default)"),
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: lane.isMergeCandidate ? "var(--status-success)" : "var(--panel-elevated)",
              color: lane.isMergeCandidate ? "var(--void)" : "var(--text-ghost)",
            }}
          >
            {lane.isMergeCandidate && (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>

          <div>
            <div className="badge-cluster">
              <span className="font-medium text-sm text-[var(--text-primary)]">
                {lane.laneId}
              </span>
              {lane.isMergeCandidate && (
                <span className="badge badge-success">merge candidate</span>
              )}
              {lane.conflictRisk !== "none" && (
                <span
                  className="badge"
                  style={{
                    color: riskConfig.color,
                    backgroundColor: `${riskConfig.color}20`,
                    borderColor: riskConfig.borderColor,
                  }}
                >
                  {lane.conflictRisk} risk
                </span>
              )}
            </div>
            <code className="text-xs font-mono text-[var(--text-ghost)] mt-1">
              {lane.branch}
            </code>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm font-mono font-medium text-[var(--text-primary)]">
              {lane.commitsAhead}
            </div>
            <div className="text-[10px] text-[var(--text-ghost)] uppercase tracking-wider">
              {lane.commitsAhead === 1 ? "commit" : "commits"} ahead
            </div>
          </div>

          {lane.filesChanged.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="btn-ghost p-1.5"
              title={expanded ? "Hide files" : "Show files"}
            >
              <svg
                className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Show conflicting lanes (true conflict risk) */}
      {lane.conflictingLanes && lane.conflictingLanes.length > 0 && (
        <div className="mt-2 ml-8 text-xs text-[var(--status-warning)]">
          <span className="font-medium">Conflicts with:</span> {lane.conflictingLanes.join(", ")}
        </div>
      )}

      {/* Show included lanes (safe - in same dependency chain) */}
      {lane.includedLanes && lane.includedLanes.length > 0 && (
        <div className="mt-2 ml-8 text-xs text-[var(--text-tertiary)]">
          <span className="text-[var(--cyan)]">In dependency chain with:</span> {lane.includedLanes.join(", ")}
        </div>
      )}

      {expanded && lane.filesChanged.length > 0 && (
        <div className="mt-3 ml-8 pt-3 border-t border-[var(--border-subtle)]">
          <div className="text-[10px] font-mono text-[var(--text-ghost)] uppercase tracking-wider mb-2">
            Files changed ({lane.filesChanged.length})
          </div>
          <div className="max-h-40 overflow-y-auto">
            {lane.filesChanged.map((file) => (
              <div key={file} className="text-xs font-mono text-[var(--text-tertiary)] py-0.5">
                {file}
              </div>
            ))}
          </div>
        </div>
      )}

      {lane.error && (
        <div className="mt-2 ml-8 text-xs text-[var(--status-danger)]">
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
  mergeLoading: boolean;
  mergeError: string | null;
  mergeResults: MergeLaneResult[];
  conflict: ConflictInfo | null;
  autoPushOptions: AutoPushOptions;
  confirmMergeToMain: boolean;
  setConfirmMergeToMain: (v: boolean) => void;
  mergedToMain: boolean;
  onExecuteMerge: () => void;
  onOpenInCursor: (path: string) => void;
  launchMergeStatus: "idle" | "launched" | "error";
}

const METHOD_COLORS: Record<MergeMethod, { color: string; bgColor: string; borderColor: string }> = {
  merge: {
    color: "#a855f7",
    bgColor: "rgba(168, 85, 247, 0.15)",
    borderColor: "rgba(168, 85, 247, 0.3)",
  },
  squash: {
    color: "var(--cyan)",
    bgColor: "rgba(6, 182, 212, 0.15)",
    borderColor: "rgba(6, 182, 212, 0.3)",
  },
  "cherry-pick": {
    color: "var(--status-success)",
    bgColor: "rgba(34, 197, 94, 0.15)",
    borderColor: "rgba(34, 197, 94, 0.3)",
  },
};

// Auto-merge status display component
interface AutoMergeStatusDisplayProps {
  mergeState: MergeState;
  repoPath: string;
  onOpenInCursor: (path: string) => void;
  openingCursor: boolean;
  onRefresh: () => void;
}

function AutoMergeStatusDisplay({
  mergeState,
  repoPath,
  onOpenInCursor,
  openingCursor,
  onRefresh,
}: AutoMergeStatusDisplayProps) {
  const getStatusIcon = () => {
    switch (mergeState.status) {
      case "in_progress":
        return (
          <svg className="w-5 h-5 animate-spin text-[var(--cyan)]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        );
      case "complete":
        return (
          <svg className="w-5 h-5 text-[var(--status-success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case "conflict":
        return (
          <svg className="w-5 h-5 text-[var(--status-warning)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case "failed":
        return (
          <svg className="w-5 h-5 text-[var(--status-danger)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (mergeState.status) {
      case "in_progress":
        return mergeState.currentLane
          ? `Auto-merging ${mergeState.currentLane}...`
          : "Auto-merge in progress...";
      case "complete":
        return `Auto-merge complete. ${mergeState.mergedLanes.length} lane(s) merged to integration branch.`;
      case "conflict":
        return "Merge conflict detected. Manual resolution required.";
      case "failed":
        return `Auto-merge failed: ${mergeState.error || "Unknown error"}`;
      default:
        return "";
    }
  };

  const getBorderColor = () => {
    switch (mergeState.status) {
      case "in_progress":
        return "rgba(6, 182, 212, 0.3)";
      case "complete":
        return "rgba(34, 197, 94, 0.3)";
      case "conflict":
        return "rgba(234, 179, 8, 0.3)";
      case "failed":
        return "rgba(239, 68, 68, 0.3)";
      default:
        return "var(--border-default)";
    }
  };

  const getBgColor = () => {
    switch (mergeState.status) {
      case "in_progress":
        return "rgba(6, 182, 212, 0.08)";
      case "complete":
        return "rgba(34, 197, 94, 0.08)";
      case "conflict":
        return "rgba(234, 179, 8, 0.08)";
      case "failed":
        return "rgba(239, 68, 68, 0.08)";
      default:
        return "var(--panel)";
    }
  };

  return (
    <div
      className="mb-5 p-5 rounded border"
      style={{
        borderColor: getBorderColor(),
        backgroundColor: getBgColor(),
      }}
    >
      <div className="flex items-start gap-3">
        {getStatusIcon()}
        <div className="flex-1">
          <div className="font-medium text-[var(--text-primary)] mb-2">
            Auto-Merge Status
          </div>
          <div className="text-sm text-[var(--text-secondary)] mb-3">
            {getStatusText()}
          </div>

          {/* Show merged lanes */}
          {mergeState.mergedLanes.length > 0 && (
            <div className="mb-3">
              <span className="text-xs text-[var(--text-ghost)] uppercase tracking-wider">
                Merged lanes:
              </span>
              <div className="flex flex-wrap gap-2 mt-1">
                {mergeState.mergedLanes.map((laneId) => (
                  <span key={laneId} className="badge badge-success">
                    {laneId}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Conflict resolution UI */}
          {mergeState.status === "conflict" && mergeState.conflictInfo && (
            <div className="mt-4 p-4 rounded border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)]">
              <div className="font-medium text-[var(--status-danger)] mb-2">
                Conflict in lane: {mergeState.conflictInfo.laneId}
              </div>
              <div className="text-sm text-[var(--text-secondary)] mb-3">
                Branch: <code className="font-mono text-xs">{mergeState.conflictInfo.branch}</code>
              </div>
              <div className="text-sm text-[var(--text-secondary)] mb-3">
                Conflicting files:
              </div>
              <div className="bg-[rgba(239,68,68,0.1)] rounded p-3 mb-4 max-h-32 overflow-y-auto">
                {mergeState.conflictInfo.conflictingFiles.map((file) => (
                  <div key={file} className="text-xs font-mono text-[var(--status-danger)] py-0.5">
                    {file}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onOpenInCursor(repoPath)}
                  disabled={openingCursor}
                  className="btn-danger"
                >
                  {openingCursor ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Opening...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Open in Cursor to Resolve
                    </>
                  )}
                </button>
                <button
                  onClick={onRefresh}
                  className="btn-ghost text-sm"
                >
                  Refresh Status
                </button>
              </div>
              <div className="mt-3 text-xs text-[var(--text-ghost)]">
                Resolve the conflicts in Cursor, commit the changes, then click Refresh Status.
              </div>
            </div>
          )}

          {/* Complete state - show human gate message */}
          {mergeState.status === "complete" && (
            <div className="mt-4 p-4 rounded border border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.08)]">
              <div className="flex items-center gap-2 text-[var(--status-success)] mb-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium">Ready for human review</span>
              </div>
              <div className="text-sm text-[var(--text-secondary)]">
                All lanes have been merged to the integration branch. Use the &quot;Launch Merge&quot; button below to merge to main (requires human confirmation).
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MergeProposalDisplay({
  proposal,
  copyState,
  onCopy,
  mergeLoading,
  mergeError,
  mergeResults,
  conflict,
  autoPushOptions,
  confirmMergeToMain,
  setConfirmMergeToMain,
  mergedToMain,
  onExecuteMerge,
  onOpenInCursor,
  launchMergeStatus,
}: MergeProposalDisplayProps) {
  const hasLanesToMerge = proposal.mergeOrder.some((l) => l.commitsAhead > 0);

  return (
    <div className="space-y-5">
      {/* Warnings */}
      {proposal.warnings.length > 0 && (
        <div className="p-4 rounded border border-[rgba(234,179,8,0.3)] bg-[rgba(234,179,8,0.08)]">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-[var(--status-warning)] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="text-sm text-[var(--status-warning)]">
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
        <span className="label-caps block mb-3">Proposed Merge Order</span>
        <div className="space-y-2">
          {proposal.mergeOrder.map((lane) => {
            const result = mergeResults.find((r) => r.laneId === lane.laneId);
            const isConflict = conflict?.laneId === lane.laneId;
            const methodConfig = METHOD_COLORS[lane.method];

            return (
              <div
                key={lane.laneId}
                className="flex items-center gap-3 p-3 rounded"
                style={{
                  backgroundColor: result?.success
                    ? "rgba(34, 197, 94, 0.08)"
                    : isConflict
                    ? "rgba(239, 68, 68, 0.08)"
                    : "var(--panel)",
                  border: `1px solid ${
                    result?.success
                      ? "rgba(34, 197, 94, 0.3)"
                      : isConflict
                      ? "rgba(239, 68, 68, 0.3)"
                      : "var(--border-default)"
                  }`,
                }}
              >
                {/* Order indicator - subdued styling to not compete with method badge */}
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono"
                  style={{
                    backgroundColor: result?.success
                      ? "var(--status-success)"
                      : isConflict
                      ? "var(--status-error)"
                      : "var(--border)",
                    color: result?.success || isConflict ? "var(--bg)" : "var(--text-ghost)",
                  }}
                >
                  {result?.success ? (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : isConflict ? (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    lane.order
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="badge-cluster">
                    <span className="font-medium text-sm text-[var(--text-primary)]">
                      {lane.laneId}
                    </span>
                    <span
                      className="badge"
                      style={{
                        color: methodConfig.color,
                        backgroundColor: methodConfig.bgColor,
                        borderColor: methodConfig.borderColor,
                      }}
                    >
                      {lane.method}
                    </span>
                    <span className="text-xs text-[var(--text-ghost)]">
                      {lane.commitsAhead} {lane.commitsAhead === 1 ? "commit" : "commits"}
                    </span>
                    {result?.success && (
                      <span className="badge badge-success">merged</span>
                    )}
                  </div>
                  {lane.notes && (
                    <div className="text-xs text-[var(--text-ghost)] mt-0.5">
                      {lane.notes}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Conflict Display */}
      {conflict && (
        <div className="p-5 rounded border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)]">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-[var(--status-danger)] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <div className="font-medium text-[var(--status-danger)] mb-2">
                Merge Conflict in {conflict.laneId}
              </div>
              <div className="text-sm text-[var(--text-secondary)] mb-3">
                The following files have conflicts that need manual resolution:
              </div>
              <div className="bg-[rgba(239,68,68,0.1)] rounded p-3 mb-4 max-h-32 overflow-y-auto">
                {conflict.conflictingFiles.map((file) => (
                  <div key={file} className="text-xs font-mono text-[var(--status-danger)] py-0.5">
                    {file}
                  </div>
                ))}
              </div>
              <button
                onClick={() => onOpenInCursor(conflict.worktreePath)}
                className="btn-danger"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open in Cursor to Resolve
              </button>
              <div className="mt-2 text-xs text-[var(--text-ghost)]">
                Path: <code className="font-mono">{conflict.worktreePath}</code>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Merge Error (non-conflict) */}
      {mergeError && !conflict && (
        <div className="p-4 rounded border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)]">
          <div className="text-sm text-[var(--status-danger)]">{mergeError}</div>
        </div>
      )}

      {/* Success Message */}
      {mergeResults.length > 0 && mergeResults.every((r) => r.success) && !conflict && (
        <div className="p-4 rounded border border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.08)]">
          <div className="flex items-center gap-2 text-[var(--status-success)]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-medium">
              All lanes merged successfully to integration branch!
              {mergedToMain && " Also merged to main."}
            </span>
          </div>
        </div>
      )}

      {/* Launch Merge Section */}
      <div className="pt-5 border-t border-[var(--border-subtle)] space-y-4">
        <span className="label-caps block">Launch Merge</span>

        {/* Merge to main confirmation - only shown when merge to main is enabled but not in full autonomy */}
        {autoPushOptions.mergeToMain && !autoPushOptions.fullAutonomyMode && (
          <div className="p-4 rounded border border-[rgba(234,179,8,0.3)] bg-[rgba(234,179,8,0.08)]">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmMergeToMain}
                onChange={(e) => setConfirmMergeToMain(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-[var(--status-warning)] accent-[var(--status-warning)]"
              />
              <div>
                <span className="text-sm font-medium text-[var(--status-warning)]">
                  I confirm I want to merge to main
                </span>
                <div className="text-xs text-[var(--text-tertiary)] mt-1">
                  This will merge the integration branch into main/master. This action modifies your production branch.
                </div>
              </div>
            </label>
          </div>
        )}

        {/* Execute Button with Copy as secondary action */}
        <div className="flex items-center gap-3">
          <button
            onClick={onExecuteMerge}
            disabled={
              mergeLoading ||
              !hasLanesToMerge ||
              (autoPushOptions.mergeToMain && !autoPushOptions.fullAutonomyMode && !confirmMergeToMain) ||
              (mergeResults.length > 0 && mergeResults.every((r) => r.success) && !conflict)
            }
            className={launchMergeStatus === "launched" ? "btn-success" : launchMergeStatus === "error" ? "btn-danger" : "btn-success"}
          >
            {mergeLoading ? (
              <>
                <span className="spinner" />
                Launching...
              </>
            ) : launchMergeStatus === "launched" ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Terminal Launched!
              </>
            ) : launchMergeStatus === "error" ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Error
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Launch Merge
              </>
            )}
          </button>

          {/* Secondary: Copy prompt only (icon button) */}
          <button
            onClick={onCopy}
            className="btn-ghost p-2"
            title={copyState === "copied" ? "Copied!" : "Copy prompt to clipboard"}
          >
            {copyState === "copied" ? (
              <svg className="w-4 h-4 text-[var(--status-success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>

          {autoPushOptions.mergeToMain && !autoPushOptions.fullAutonomyMode && !confirmMergeToMain && (
            <span className="text-xs text-[var(--status-warning)]">
              Check the confirmation box to enable merge to main
            </span>
          )}
        </div>

        <div className="text-xs text-[var(--text-ghost)]">
          Generated: {new Date(proposal.createdAt).toLocaleString()}
        </div>
      </div>

    </div>
  );
}

// Autonomy options panel - consolidated controls for autonomous operation
interface AutoPushOptionsPanelProps {
  options: AutoPushOptions;
  onChange: (options: AutoPushOptions) => void;
  integrationBranchPushState?: PushState;
}

function AutoPushOptionsPanel({ options, onChange, integrationBranchPushState }: AutoPushOptionsPanelProps) {
  const isFullAutonomy = options.fullAutonomyMode ?? false;

  const toggleFullAutonomy = () => {
    if (isFullAutonomy) {
      // Turning off - reset to individual defaults (all off)
      onChange({
        fullAutonomyMode: false,
        pushLaneBranches: false,
        pushIntegrationBranch: false,
        mergeToMain: false,
        pushMainBranch: false,
      });
    } else {
      // Turning on - enable everything
      onChange({
        fullAutonomyMode: true,
        pushLaneBranches: true,
        pushIntegrationBranch: true,
        mergeToMain: true,
        pushMainBranch: true,
      });
    }
  };

  return (
    <div className="mb-5 pb-5 border-b border-[var(--border-subtle)]">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-6 h-6 rounded bg-[rgba(168,85,247,0.15)] border border-[rgba(168,85,247,0.3)] flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-[#a855f7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <span className="text-sm font-medium text-[var(--text-primary)]">Autonomy Options</span>
      </div>

      {/* Full Autonomy Mode Toggle */}
      <div className="ml-9 mb-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <button
            type="button"
            onClick={toggleFullAutonomy}
            className={`toggle ${isFullAutonomy ? "active" : ""}`}
            role="switch"
            aria-checked={isFullAutonomy}
          />
          <div>
            <span className={`text-sm font-medium ${isFullAutonomy ? "text-[#a855f7]" : "text-[var(--text-secondary)]"}`}>
              Full Autonomy Mode
            </span>
            <div className="text-xs text-[var(--text-ghost)]">
              Push all branches and merge to main automatically
            </div>
          </div>
        </label>
      </div>

      {/* Individual options - shown when not in full autonomy mode */}
      {!isFullAutonomy && (
        <div className="space-y-3 ml-9 pl-4 border-l-2 border-[var(--border-subtle)]">
          {/* Push lane branches */}
          <label className="flex items-center gap-3 cursor-pointer">
            <button
              type="button"
              onClick={() => onChange({ ...options, pushLaneBranches: !options.pushLaneBranches })}
              className={`toggle toggle--sm ${options.pushLaneBranches ? "active" : ""}`}
              role="switch"
              aria-checked={options.pushLaneBranches}
            />
            <span className="text-xs text-[var(--text-tertiary)]">
              Auto-push lane branches after commit
            </span>
          </label>

          {/* Push integration branch */}
          <label className="flex items-center gap-3 cursor-pointer">
            <button
              type="button"
              onClick={() => onChange({ ...options, pushIntegrationBranch: !options.pushIntegrationBranch })}
              className={`toggle toggle--sm ${options.pushIntegrationBranch ? "active" : ""}`}
              role="switch"
              aria-checked={options.pushIntegrationBranch}
            />
            <span className="text-xs text-[var(--text-tertiary)]">
              Auto-push integration branch after merge
            </span>
          </label>

          {/* Merge to main */}
          <label className="flex items-center gap-3 cursor-pointer">
            <button
              type="button"
              onClick={() => onChange({ ...options, mergeToMain: !options.mergeToMain, pushMainBranch: !options.mergeToMain ? options.pushMainBranch : false })}
              className={`toggle toggle--sm ${options.mergeToMain ? "active" : ""}`}
              role="switch"
              aria-checked={options.mergeToMain ?? false}
            />
            <span className="text-xs text-[var(--text-tertiary)]">
              Merge integration branch to main
            </span>
          </label>

          {/* Push main branch - only shown if merge to main is enabled */}
          {options.mergeToMain && (
            <label className="flex items-center gap-3 cursor-pointer ml-4">
              <button
                type="button"
                onClick={() => onChange({ ...options, pushMainBranch: !options.pushMainBranch })}
                className={`toggle toggle--sm ${options.pushMainBranch ? "active" : ""}`}
                role="switch"
                aria-checked={options.pushMainBranch ?? false}
              />
              <span className="text-xs text-[var(--text-tertiary)]">
                Auto-push main after merge
              </span>
            </label>
          )}
        </div>
      )}

      {/* Full autonomy summary */}
      {isFullAutonomy && (
        <div className="ml-9 p-3 rounded bg-[rgba(168,85,247,0.08)] border border-[rgba(168,85,247,0.2)]">
          <div className="text-xs text-[var(--text-tertiary)] space-y-1">
            <div className="flex items-center gap-2">
              <svg className="w-3 h-3 text-[#a855f7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Push lane branches after commit
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-3 h-3 text-[#a855f7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Push integration branch after merge
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-3 h-3 text-[#a855f7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Merge to main and push
            </div>
          </div>
        </div>
      )}

      {/* Integration branch push status */}
      {integrationBranchPushState && integrationBranchPushState.status !== "idle" && (
        <div className="mt-3 ml-9">
          <IntegrationBranchPushStatus pushState={integrationBranchPushState} />
        </div>
      )}
    </div>
  );
}

// Integration branch push status display
function IntegrationBranchPushStatus({ pushState }: { pushState: PushState }) {
  const getStatusConfig = () => {
    switch (pushState.status) {
      case "pushing":
        return {
          color: "#06b6d4",
          bgColor: "rgba(6, 182, 212, 0.08)",
          borderColor: "rgba(6, 182, 212, 0.3)",
          icon: (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ),
          text: "Pushing integration branch...",
        };
      case "success":
        return {
          color: "#22c55e",
          bgColor: "rgba(34, 197, 94, 0.08)",
          borderColor: "rgba(34, 197, 94, 0.3)",
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ),
          text: `Integration branch pushed${pushState.lastPushedAt ? ` at ${new Date(pushState.lastPushedAt).toLocaleTimeString()}` : ""}`,
        };
      case "failed":
        return {
          color: "#ef4444",
          bgColor: "rgba(239, 68, 68, 0.08)",
          borderColor: "rgba(239, 68, 68, 0.3)",
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ),
          text: `Push failed: ${pushState.error || "Unknown error"}`,
        };
      default:
        return null;
    }
  };

  const config = getStatusConfig();
  if (!config) return null;

  return (
    <div
      className="p-3 rounded border flex items-center gap-2"
      style={{
        backgroundColor: config.bgColor,
        borderColor: config.borderColor,
        color: config.color,
      }}
    >
      {config.icon}
      <span className="text-sm">{config.text}</span>
    </div>
  );
}
