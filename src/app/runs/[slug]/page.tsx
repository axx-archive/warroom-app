import Link from "next/link";
import { notFound } from "next/navigation";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { WarRoomPlan, StatusJson } from "@/lib/plan-schema";
import type { LaneStatus, LaneAutonomy } from "@/lib/plan-schema";
import { RunDetailClient } from "@/components/RunDetailClient";
import { DeleteRunButton } from "@/components/DeleteRunButton";
import { RunSidebarActions } from "@/components/RunSidebarActions";

export const dynamic = "force-dynamic";

function getLaneStatus(
  laneId: string,
  status: StatusJson | null
): { status: LaneStatus; staged: boolean; autonomy: LaneAutonomy } {
  const defaultAutonomy: LaneAutonomy = { dangerouslySkipPermissions: false };

  if (!status) {
    return { status: "pending", staged: false, autonomy: defaultAutonomy };
  }

  if (status.lanes && status.lanes[laneId]) {
    return {
      status: status.lanes[laneId].status,
      staged: status.lanes[laneId].staged,
      autonomy: status.lanes[laneId].autonomy ?? defaultAutonomy,
    };
  }

  if (status.lanesCompleted?.includes(laneId)) {
    return { status: "complete", staged: true, autonomy: defaultAutonomy };
  }

  return { status: "pending", staged: false, autonomy: defaultAutonomy };
}

interface RunDetailPageProps {
  params: Promise<{ slug: string }>;
}

async function getRunData(
  slug: string
): Promise<{ plan: WarRoomPlan | null; status: StatusJson | null } | null> {
  const runDir = path.join(
    os.homedir(),
    ".openclaw/workspace/warroom/runs",
    slug
  );

  try {
    await fs.access(runDir);
  } catch {
    return null;
  }

  let plan: WarRoomPlan | null = null;
  let status: StatusJson | null = null;

  try {
    const planContent = await fs.readFile(path.join(runDir, "plan.json"), "utf-8");
    plan = JSON.parse(planContent);
  } catch {
    // No plan.json
  }

  try {
    const statusContent = await fs.readFile(
      path.join(runDir, "status.json"),
      "utf-8"
    );
    status = JSON.parse(statusContent);
  } catch {
    // No status.json
  }

  return { plan, status };
}

const STATUS_CONFIG: Record<string, { color: string; bgColor: string; borderColor: string; label: string }> = {
  draft: {
    color: "var(--text-ghost)",
    bgColor: "transparent",
    borderColor: "var(--border)",
    label: "DRAFT",
  },
  ready_to_stage: {
    color: "var(--info)",
    bgColor: "var(--info-dim)",
    borderColor: "rgba(6, 182, 212, 0.3)",
    label: "READY",
  },
  staged: {
    color: "var(--accent)",
    bgColor: "var(--accent-subtle)",
    borderColor: "var(--accent-border)",
    label: "STAGED",
  },
  in_progress: {
    color: "var(--warning)",
    bgColor: "var(--warning-dim)",
    borderColor: "rgba(245, 158, 11, 0.3)",
    label: "ACTIVE",
  },
  merging: {
    color: "#f97316",
    bgColor: "rgba(249, 115, 22, 0.15)",
    borderColor: "rgba(249, 115, 22, 0.3)",
    label: "MERGING",
  },
  complete: {
    color: "var(--success)",
    bgColor: "var(--success-dim)",
    borderColor: "rgba(16, 185, 129, 0.3)",
    label: "COMPLETE",
  },
};

export default async function RunDetailPage({ params }: RunDetailPageProps) {
  const { slug } = await params;
  const data = await getRunData(slug);

  if (!data) {
    notFound();
  }

  const { plan, status } = data;
  const statusConfig = STATUS_CONFIG[status?.status || "draft"] || STATUS_CONFIG.draft;

  // Calculate stats
  const laneCounts = plan?.lanes?.reduce(
    (acc, lane) => {
      const laneStatus = getLaneStatus(lane.laneId, status);
      acc[laneStatus.status] = (acc[laneStatus.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  ) || {};

  const completed = laneCounts.complete || 0;
  const inProgress = laneCounts.in_progress || 0;
  const failed = laneCounts.failed || 0;
  const pending = (plan?.lanes?.length || 0) - completed - inProgress - failed;
  const totalLanes = plan?.lanes?.length || 0;

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      {/* Corner decorations */}
      <div className="corner-decoration corner-decoration--top-left">
        SESSION_{slug.slice(0, 8).toUpperCase()}
      </div>
      <div className="corner-decoration corner-decoration--bottom-right">
        AES-256 ENCRYPTED
      </div>

      {/* Header - Bold Mission Control */}
      <header className="sticky top-0 z-50 border-b-2 border-[var(--border-strong)] bg-[var(--bg-deep)]">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-4 group">
              <div className="logo-mark logo-mark--bold animate-fade-in">WR</div>
              <div className="animate-fade-in" style={{ animationDelay: '50ms' }}>
                <h1 className="logo-text group-hover:text-[var(--accent)] transition-colors duration-200 tracking-wider">
                  WAR ROOM
                </h1>
                <p className="telemetry-label mt-0.5">
                  TACTICAL COMMAND CENTER
                </p>
              </div>
            </Link>

            {/* Mission status badge */}
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-lg border animate-fade-in"
              style={{
                backgroundColor: statusConfig.bgColor,
                borderColor: statusConfig.borderColor,
                animationDelay: '100ms',
              }}
            >
              <span
                className="status-dot status-dot--sm status-dot--dramatic"
                style={{ background: statusConfig.color }}
              />
              <span
                className="font-mono text-xs font-bold tracking-widest"
                style={{ color: statusConfig.color }}
              >
                {statusConfig.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 animate-fade-in" style={{ animationDelay: '150ms' }}>
            {/* System status */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded">
              <span className="status-dot status-dot--sm status-dot--success" />
              <span className="telemetry-label">SYSTEMS NOMINAL</span>
            </div>

            <DeleteRunButton slug={slug} />
            <Link
              href="/runs"
              className="btn btn--ghost btn--sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              All Missions
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content - Two Column Layout */}
      <main className="flex-1 max-w-[1600px] mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-0">
          {/* Left Column - Main Content */}
          <div className="px-6 py-8 border-r border-[var(--border)]">
            {/* Run Header - Bold tactical styling */}
            <div className="mb-8 animate-slide-up">
              <div className="flex items-center gap-3 mb-2">
                <span className="telemetry-label">MISSION DESIGNATION</span>
              </div>
              <h2 className="text-3xl font-bold text-[var(--text)] font-mono tracking-tight">
                {slug}
              </h2>
              {status?.updatedAt && (
                <p className="text-caption font-mono mt-2 flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-[var(--text-ghost)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Last updated: {formatDate(status.updatedAt)}
                </p>
              )}
            </div>

            {/* Mission Summary Panel */}
            {plan && (
              <div className="surface-raised tech-corners p-6 mb-6 animate-slide-up" style={{ animationDelay: '100ms' }}>
                {/* Panel header */}
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-[var(--border)]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center justify-center">
                      <svg className="w-5 h-5 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-heading text-[var(--text)] font-bold">
                        MISSION BRIEF
                      </h3>
                      <span className="telemetry-label">
                        {totalLanes} LANES CONFIGURED
                      </span>
                    </div>
                  </div>
                  <RunSidebarActions plan={plan} compact />
                </div>

                {/* Objective */}
                <div className="mb-6">
                  <span className="telemetry-label block mb-2">PRIMARY OBJECTIVE</span>
                  <p className="text-body text-[var(--text)] leading-relaxed">
                    {plan.goal}
                  </p>
                </div>

                {/* Config details grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="p-3 bg-[var(--bg-muted)] rounded-lg border border-[var(--border)]">
                    <span className="telemetry-label block mb-1">BRANCH</span>
                    <code className="text-sm font-mono text-[var(--accent-bright)] truncate block">
                      {plan.integrationBranch}
                    </code>
                  </div>
                  <div className="p-3 bg-[var(--bg-muted)] rounded-lg border border-[var(--border)]">
                    <span className="telemetry-label block mb-1">REPOSITORY</span>
                    <span className="text-sm text-[var(--text)] font-medium truncate block">
                      {plan.repo.name}
                    </span>
                  </div>
                  <div className="p-3 bg-[var(--bg-muted)] rounded-lg border border-[var(--border)]">
                    <span className="telemetry-label block mb-1">MODE</span>
                    <span className="badge badge--accent w-fit">
                      {plan.startMode?.toUpperCase() || "STANDARD"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Lanes and Merge View - Client Component for Reactivity */}
            {plan?.lanes && plan.lanes.length > 0 && (
              <div className="animate-slide-up" style={{ animationDelay: '200ms' }}>
                <RunDetailClient
                  lanes={plan.lanes}
                  slug={slug}
                  initialStates={Object.fromEntries(
                    plan.lanes.map((lane) => {
                      const laneStatus = getLaneStatus(lane.laneId, status);
                      return [
                        lane.laneId,
                        {
                          status: laneStatus.status,
                          staged: laneStatus.staged,
                          autonomy: laneStatus.autonomy,
                        },
                      ];
                    })
                  )}
                />
              </div>
            )}

            {/* No plan available */}
            {!plan && (
              <div className="surface tech-corners p-8 text-center animate-slide-up">
                <div className="w-12 h-12 rounded-xl bg-[var(--bg-muted)] flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-[var(--text-ghost)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <p className="text-body text-[var(--text-muted)]">
                  No plan.json found for this mission.
                </p>
              </div>
            )}
          </div>

          {/* Right Column - Telemetry Sidebar */}
          <div className="bg-[var(--bg-deep)] px-6 py-8 lg:sticky lg:top-[73px] lg:h-[calc(100vh-73px)] lg:overflow-y-auto">
            <div className="space-y-6">
              {/* Telemetry Panel Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-status-pulse" />
                  <span className="telemetry-label">LIVE TELEMETRY</span>
                </div>
                <span className="telemetry-label text-[var(--text-ghost)]">
                  REAL-TIME
                </span>
              </div>

              {/* Mission Progress Card */}
              <div className="surface tech-corners p-5 animate-slide-up" style={{ animationDelay: '100ms' }}>
                <div className="flex items-center justify-between mb-4">
                  <span className="telemetry-label">MISSION PROGRESS</span>
                  <span className="font-mono text-2xl font-bold text-[var(--text)] tabular-nums">
                    {totalLanes > 0 ? Math.round((completed / totalLanes) * 100) : 0}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="progress progress--lg progress--tactical mb-4">
                  <div
                    className="progress__bar"
                    style={{ width: `${totalLanes > 0 ? (completed / totalLanes) * 100 : 0}%` }}
                  />
                </div>

                {/* Status breakdown */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <span className="status-dot status-dot--sm status-dot--success" />
                    <span className="telemetry-label flex-1">COMPLETE</span>
                    <span className="font-mono text-sm font-bold text-[var(--success)] tabular-nums">{completed}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="status-dot status-dot--sm status-dot--active" />
                    <span className="telemetry-label flex-1">RUNNING</span>
                    <span className="font-mono text-sm font-bold text-[var(--accent)] tabular-nums">{inProgress}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="status-dot status-dot--sm status-dot--idle" />
                    <span className="telemetry-label flex-1">PENDING</span>
                    <span className="font-mono text-sm font-bold text-[var(--text-muted)] tabular-nums">{pending}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="status-dot status-dot--sm status-dot--error" />
                    <span className="telemetry-label flex-1">FAILED</span>
                    <span className="font-mono text-sm font-bold text-[var(--error)] tabular-nums">{failed}</span>
                  </div>
                </div>
              </div>

              {/* Resource Metrics */}
              <div className="surface tech-corners p-5 animate-slide-up" style={{ animationDelay: '150ms' }}>
                <span className="telemetry-label block mb-4">RESOURCE ALLOCATION</span>

                <div className="space-y-4">
                  {/* Lanes metric */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-caption text-[var(--text-secondary)]">Lane Capacity</span>
                      <span className="font-mono text-sm font-bold text-[var(--text)] tabular-nums">
                        {completed + inProgress}/{totalLanes}
                      </span>
                    </div>
                    <div className="progress">
                      <div
                        className="progress__bar"
                        style={{
                          width: `${totalLanes > 0 ? ((completed + inProgress) / totalLanes) * 100 : 0}%`,
                          background: inProgress > 0 ? 'var(--accent)' : 'var(--success)',
                        }}
                      />
                    </div>
                  </div>

                  {/* Efficiency metric */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-caption text-[var(--text-secondary)]">Success Rate</span>
                      <span className="font-mono text-sm font-bold text-[var(--success)] tabular-nums">
                        {totalLanes > 0 && (completed + failed) > 0
                          ? Math.round((completed / (completed + failed)) * 100)
                          : 100}%
                      </span>
                    </div>
                    <div className="progress">
                      <div
                        className="progress__bar"
                        style={{
                          width: `${totalLanes > 0 && (completed + failed) > 0 ? (completed / (completed + failed)) * 100 : 100}%`,
                          background: 'var(--success)',
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Stats Grid */}
              <div className="grid grid-cols-2 gap-3 animate-slide-up" style={{ animationDelay: '200ms' }}>
                <div className="surface p-4 text-center">
                  <span className="telemetry-label block mb-1">TOTAL</span>
                  <span className="text-2xl font-bold font-mono text-[var(--text)] tabular-nums">{totalLanes}</span>
                </div>
                <div className="surface p-4 text-center">
                  <span className="telemetry-label block mb-1">ACTIVE</span>
                  <span className="text-2xl font-bold font-mono text-[var(--accent)] tabular-nums">{inProgress}</span>
                </div>
              </div>

              {/* Command Log Placeholder */}
              <div className="surface tech-corners p-5 animate-slide-up" style={{ animationDelay: '250ms' }}>
                <div className="flex items-center justify-between mb-4">
                  <span className="telemetry-label">COMMAND LOG</span>
                  <span className="badge badge--muted text-xs">LATEST</span>
                </div>

                <div className="space-y-2 font-mono text-xs">
                  {status?.updatedAt && (
                    <div className="flex items-start gap-2 text-[var(--text-secondary)]">
                      <span className="text-[var(--text-ghost)]">{formatTime(status.updatedAt)}</span>
                      <span className="text-[var(--accent)]">SYS</span>
                      <span>Status updated</span>
                    </div>
                  )}
                  <div className="flex items-start gap-2 text-[var(--text-secondary)]">
                    <span className="text-[var(--text-ghost)]">--:--:--</span>
                    <span className="text-[var(--success)]">CMD</span>
                    <span>Mission initialized</span>
                  </div>
                  <div className="flex items-start gap-2 text-[var(--text-ghost)]">
                    <span>--:--:--</span>
                    <span className="text-[var(--info)]">INF</span>
                    <span>Awaiting commands...</span>
                  </div>
                </div>
              </div>

              {/* System Info */}
              <div className="text-center pt-4 border-t border-[var(--border)] animate-slide-up" style={{ animationDelay: '300ms' }}>
                <span className="telemetry-label text-[var(--text-ghost)]">
                  WAR ROOM v2.0 // TACTICAL OPS
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer - Minimal, tactical */}
      <footer className="border-t-2 border-[var(--border-strong)] bg-[var(--bg-deep)]">
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6 text-caption font-mono">
            <span className="text-[var(--text-ghost)]">WAR ROOM</span>
            <span className="text-[var(--border)]">//</span>
            <span className="text-[var(--text-ghost)]">MISSION CONTROL</span>
            <span className="text-[var(--border)]">//</span>
            <span className="text-[var(--accent)]">{slug}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="status-dot status-dot--sm status-dot--success" />
              <span className="telemetry-label">OPERATIONAL</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString();
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}
