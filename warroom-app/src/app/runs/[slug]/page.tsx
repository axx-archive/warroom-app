import Link from "next/link";
import { notFound } from "next/navigation";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { WarRoomPlan, StatusJson } from "@/lib/plan-schema";
import type { LaneStatus, LaneAutonomy } from "@/lib/plan-schema";
import { RunDetailClient } from "@/components/RunDetailClient";
import { DeleteRunButton } from "@/components/DeleteRunButton";

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

const STATUS_CONFIG: Record<string, { color: string; bgColor: string; borderColor: string }> = {
  draft: {
    color: "var(--text-tertiary)",
    bgColor: "transparent",
    borderColor: "var(--border-default)",
  },
  ready_to_stage: {
    color: "var(--cyan)",
    bgColor: "rgba(6, 182, 212, 0.15)",
    borderColor: "rgba(6, 182, 212, 0.3)",
  },
  staged: {
    color: "#a855f7",
    bgColor: "rgba(168, 85, 247, 0.15)",
    borderColor: "rgba(168, 85, 247, 0.3)",
  },
  in_progress: {
    color: "var(--status-warning)",
    bgColor: "rgba(234, 179, 8, 0.15)",
    borderColor: "rgba(234, 179, 8, 0.3)",
  },
  merging: {
    color: "#f97316",
    bgColor: "rgba(249, 115, 22, 0.15)",
    borderColor: "rgba(249, 115, 22, 0.3)",
  },
  complete: {
    color: "var(--status-success)",
    bgColor: "rgba(34, 197, 94, 0.15)",
    borderColor: "rgba(34, 197, 94, 0.3)",
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

          <div className="flex items-center gap-3">
            <DeleteRunButton slug={slug} />
            <Link
              href="/runs"
              className="btn-ghost"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              All Missions
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-10">
        {/* Run Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-3">
            <h2 className="text-2xl font-mono font-semibold text-[var(--text-primary)]">
              {slug}
            </h2>
            {status?.status && (
              <span
                className="px-2.5 py-1 text-[10px] font-mono font-medium uppercase tracking-wider rounded"
                style={{
                  color: statusConfig.color,
                  backgroundColor: statusConfig.bgColor,
                  border: `1px solid ${statusConfig.borderColor}`,
                }}
              >
                {status.status.replace(/_/g, " ")}
              </span>
            )}
          </div>
          {status?.updatedAt && (
            <p className="text-sm text-[var(--text-ghost)] font-mono">
              Last updated: {formatDate(status.updatedAt)}
            </p>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Info Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Plan Summary */}
            {plan && (
              <div className="panel-bracketed p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-8 h-8 rounded bg-[var(--amber-glow)] border border-[var(--amber-dim)] flex items-center justify-center">
                    <svg className="w-4 h-4 text-[var(--amber)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-[var(--text-primary)]">
                    Mission Summary
                  </h3>
                </div>

                <dl className="space-y-4">
                  <div>
                    <dt className="label-caps mb-1">Objective</dt>
                    <dd className="text-[var(--text-primary)]">{plan.goal}</dd>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <dt className="label-caps mb-1">Start Mode</dt>
                      <dd className="badge badge-amber">{plan.startMode}</dd>
                    </div>
                    <div>
                      <dt className="label-caps mb-1">Integration Branch</dt>
                      <dd className="code-inline text-xs">{plan.integrationBranch}</dd>
                    </div>
                  </div>
                </dl>
              </div>
            )}

            {/* Lanes and Merge View - Client Component for Reactivity */}
            {plan?.lanes && plan.lanes.length > 0 && (
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
            )}

            {/* No plan available */}
            {!plan && (
              <div className="panel p-6">
                <div className="flex items-center gap-3 text-[var(--text-tertiary)]">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-sm">No plan.json found for this mission.</p>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status Panel */}
            <div className="panel p-5">
              <h3 className="text-sm font-medium text-[var(--text-primary)] mb-4 flex items-center gap-2">
                <span className="indicator-dot indicator-dot-amber" />
                System Status
              </h3>

              {status ? (
                <dl className="space-y-4">
                  <div>
                    <dt className="label-caps mb-1">Current Status</dt>
                    <dd>
                      <span
                        className="px-2.5 py-1 text-[10px] font-mono font-medium uppercase tracking-wider rounded"
                        style={{
                          color: statusConfig.color,
                          backgroundColor: statusConfig.bgColor,
                          border: `1px solid ${statusConfig.borderColor}`,
                        }}
                      >
                        {status.status.replace(/_/g, " ")}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="label-caps mb-1">Lane Progress</dt>
                    <dd className="text-[var(--text-primary)] font-mono text-sm">
                      {(() => {
                        if (!plan?.lanes) return "No lanes";
                        const counts = plan.lanes.reduce(
                          (acc, lane) => {
                            const laneStatus = getLaneStatus(lane.laneId, status);
                            acc[laneStatus.status] = (acc[laneStatus.status] || 0) + 1;
                            return acc;
                          },
                          {} as Record<string, number>
                        );
                        const completed = counts.complete || 0;
                        const total = plan.lanes.length;
                        return `${completed} / ${total} complete`;
                      })()}
                    </dd>
                  </div>
                  <div>
                    <dt className="label-caps mb-1">Last Updated</dt>
                    <dd className="text-sm font-mono text-[var(--text-secondary)]">
                      {formatDate(status.updatedAt)}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-[var(--text-ghost)]">
                  No status.json found for this mission.
                </p>
              )}
            </div>

            {/* Repository Info */}
            {plan && (
              <div className="panel p-5">
                <h3 className="text-sm font-medium text-[var(--text-primary)] mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  Repository
                </h3>

                <dl className="space-y-3">
                  <div>
                    <dt className="label-caps mb-1">Name</dt>
                    <dd className="text-[var(--text-primary)]">{plan.repo.name}</dd>
                  </div>
                  <div>
                    <dt className="label-caps mb-1">Path</dt>
                    <dd className="text-xs font-mono text-[var(--text-secondary)] break-all">
                      {plan.repo.path}
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border-subtle)] mt-auto">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between text-xs">
          <div className="flex items-center gap-4 text-[var(--text-ghost)] font-mono">
            <span className="uppercase tracking-wider">War Room MVP</span>
            <span className="text-[var(--border-default)]">|</span>
            <span>Mission Detail</span>
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

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString();
}
