import Link from "next/link";
import { notFound } from "next/navigation";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { WarRoomPlan, StatusJson } from "@/lib/plan-schema";
import type { LaneStatus } from "@/lib/plan-schema";
import { LaneStatusCard } from "@/components/LaneStatusCard";

export const dynamic = "force-dynamic";

// Helper to get lane status from either status.json format
function getLaneStatus(
  laneId: string,
  status: StatusJson | null
): { status: LaneStatus; staged: boolean } {
  if (!status) {
    return { status: "pending", staged: false };
  }

  // Format 1: lanes object with per-lane status
  if (status.lanes && status.lanes[laneId]) {
    return {
      status: status.lanes[laneId].status,
      staged: status.lanes[laneId].staged,
    };
  }

  // Format 2: lanesCompleted array
  if (status.lanesCompleted?.includes(laneId)) {
    return { status: "complete", staged: true };
  }

  return { status: "pending", staged: false };
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

export default async function RunDetailPage({ params }: RunDetailPageProps) {
  const { slug } = await params;
  const data = await getRunData(slug);

  if (!data) {
    notFound();
  }

  const { plan, status } = data;

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
            href="/runs"
            className="px-3 py-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
          >
            &larr; All Runs
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Run Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
            {slug}
          </h2>
          <div className="flex items-center gap-4">
            {status?.status && <StatusBadge status={status.status} />}
            {status?.updatedAt && (
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                Updated {formatDate(status.updatedAt)}
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Info Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Plan Summary */}
            {plan && (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
                <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4">
                  Plan Summary
                </h3>
                <dl className="space-y-3">
                  <div>
                    <dt className="text-sm text-zinc-500 dark:text-zinc-400">
                      Goal
                    </dt>
                    <dd className="text-zinc-900 dark:text-zinc-100 mt-1">
                      {plan.goal}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-zinc-500 dark:text-zinc-400">
                      Start Mode
                    </dt>
                    <dd className="text-zinc-900 dark:text-zinc-100 mt-1">
                      {plan.startMode}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-zinc-500 dark:text-zinc-400">
                      Integration Branch
                    </dt>
                    <dd className="font-mono text-sm text-zinc-900 dark:text-zinc-100 mt-1">
                      {plan.integrationBranch}
                    </dd>
                  </div>
                </dl>
              </div>
            )}

            {/* Lanes */}
            {plan?.lanes && plan.lanes.length > 0 && (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
                <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4">
                  Lanes ({plan.lanes.length})
                </h3>
                <div className="space-y-3">
                  {plan.lanes.map((lane) => {
                    const laneStatus = getLaneStatus(lane.laneId, status);
                    return (
                      <LaneStatusCard
                        key={lane.laneId}
                        lane={lane}
                        slug={slug}
                        initialStatus={laneStatus.status}
                        initialStaged={laneStatus.staged}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* No plan available */}
            {!plan && (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
                <p className="text-zinc-500 dark:text-zinc-400">
                  No plan.json found for this run.
                </p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status Panel */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
              <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4">
                Status
              </h3>
              {status ? (
                <dl className="space-y-3">
                  <div>
                    <dt className="text-sm text-zinc-500 dark:text-zinc-400">
                      Current Status
                    </dt>
                    <dd className="mt-1">
                      <StatusBadge status={status.status} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-zinc-500 dark:text-zinc-400">
                      Lane Progress
                    </dt>
                    <dd className="text-zinc-900 dark:text-zinc-100 mt-1">
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
                    <dt className="text-sm text-zinc-500 dark:text-zinc-400">
                      Last Updated
                    </dt>
                    <dd className="text-zinc-900 dark:text-zinc-100 mt-1 text-sm">
                      {formatDate(status.updatedAt)}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                  No status.json found for this run.
                </p>
              )}
            </div>

            {/* Quick Info */}
            {plan && (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
                <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4">
                  Repository
                </h3>
                <dl className="space-y-3">
                  <div>
                    <dt className="text-sm text-zinc-500 dark:text-zinc-400">
                      Name
                    </dt>
                    <dd className="text-zinc-900 dark:text-zinc-100 mt-1">
                      {plan.repo.name}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-zinc-500 dark:text-zinc-400">
                      Path
                    </dt>
                    <dd className="font-mono text-xs text-zinc-900 dark:text-zinc-100 mt-1 break-all">
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
      <footer className="border-t border-zinc-200 dark:border-zinc-800 mt-auto">
        <div className="max-w-5xl mx-auto px-4 py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
          War Room MVP - Run Detail
        </div>
      </footer>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusColors: Record<string, string> = {
    draft: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    ready_to_stage:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    staged:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    in_progress:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    merging:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    complete:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  };

  const colorClass =
    statusColors[status] ??
    "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";

  return (
    <span
      className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${colorClass}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString();
}
