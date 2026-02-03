import Link from "next/link";
import { notFound } from "next/navigation";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { WarRoomPlan, StatusJson } from "@/lib/plan-schema";

export const dynamic = "force-dynamic";

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
                    const isCompleted =
                      status?.lanesCompleted?.includes(lane.laneId) ?? false;
                    return (
                      <div
                        key={lane.laneId}
                        className={`p-4 border rounded-lg ${
                          isCompleted
                            ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10"
                            : "border-zinc-200 dark:border-zinc-700"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                                {lane.laneId}
                              </span>
                              <span className="px-2 py-0.5 text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded">
                                {lane.agent}
                              </span>
                            </div>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 font-mono">
                              {lane.branch}
                            </p>
                          </div>
                          {isCompleted && (
                            <span className="text-green-600 dark:text-green-400 text-sm">
                              Completed
                            </span>
                          )}
                        </div>
                        {lane.dependsOn.length > 0 && (
                          <div className="mt-2 text-xs text-zinc-500">
                            Depends on: {lane.dependsOn.join(", ")}
                          </div>
                        )}
                      </div>
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
                      Lanes Completed
                    </dt>
                    <dd className="text-zinc-900 dark:text-zinc-100 mt-1">
                      {status.lanesCompleted?.length ?? 0}
                      {plan?.lanes && ` / ${plan.lanes.length}`}
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
