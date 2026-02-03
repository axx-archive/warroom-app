"use client";

interface LaneResult {
  laneId: string;
  worktreeCreated: boolean;
  packetWritten: boolean;
  cursorLaunched: boolean;
  error?: string;
}

export interface StagingResult {
  success: boolean;
  error?: string;
  results: LaneResult[];
}

interface StagingProgressProps {
  result: StagingResult;
}

export function StagingProgress({ result }: StagingProgressProps) {
  if (!result.success && result.error && result.results.length === 0) {
    // Complete failure - show error message
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg
            className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div>
            <h4 className="text-sm font-semibold text-red-800">
              Staging Failed
            </h4>
            <p className="text-sm text-red-700 mt-1">{result.error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Calculate totals
  const total = result.results.length;
  const worktrees = result.results.filter((r) => r.worktreeCreated).length;
  const packets = result.results.filter((r) => r.packetWritten).length;
  const cursors = result.results.filter((r) => r.cursorLaunched).length;
  const errors = result.results.filter((r) => r.error).length;

  const isSuccess = result.success;

  return (
    <div
      className={`
        rounded-lg border p-4
        ${isSuccess ? "bg-green-50 border-green-200" : "bg-yellow-50 border-yellow-200"}
      `}
    >
      <div className="flex items-start gap-3">
        {isSuccess ? (
          <svg
            className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        ) : (
          <svg
            className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        )}

        <div className="flex-1">
          <h4
            className={`text-sm font-semibold ${isSuccess ? "text-green-800" : "text-yellow-800"}`}
          >
            {isSuccess ? "Staging Complete" : "Staging Completed with Issues"}
          </h4>

          {/* Summary */}
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="flex items-center gap-1">
              <span
                className={`h-2 w-2 rounded-full ${worktrees === total ? "bg-green-500" : "bg-yellow-500"}`}
              />
              <span className={isSuccess ? "text-green-700" : "text-yellow-700"}>
                Worktrees: {worktrees}/{total}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span
                className={`h-2 w-2 rounded-full ${packets === total ? "bg-green-500" : "bg-yellow-500"}`}
              />
              <span className={isSuccess ? "text-green-700" : "text-yellow-700"}>
                Packets: {packets}/{total}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span
                className={`h-2 w-2 rounded-full ${cursors === total ? "bg-green-500" : "bg-gray-400"}`}
              />
              <span className={isSuccess ? "text-green-700" : "text-yellow-700"}>
                Cursor: {cursors}/{total}
              </span>
            </div>
            {errors > 0 && (
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                <span className="text-red-700">Errors: {errors}</span>
              </div>
            )}
          </div>

          {/* Individual lane results */}
          <div className="mt-3 space-y-1">
            {result.results.map((lane) => (
              <div
                key={lane.laneId}
                className={`
                  text-xs px-2 py-1 rounded flex items-center justify-between
                  ${lane.error ? "bg-red-100 text-red-800" : "bg-white/50 text-gray-700"}
                `}
              >
                <span className="font-medium">{lane.laneId}</span>
                <div className="flex items-center gap-2">
                  {lane.worktreeCreated && (
                    <span className="text-green-600" title="Worktree created">
                      WT
                    </span>
                  )}
                  {lane.packetWritten && (
                    <span className="text-green-600" title="Packet written">
                      PKT
                    </span>
                  )}
                  {lane.cursorLaunched && (
                    <span className="text-green-600" title="Cursor launched">
                      CUR
                    </span>
                  )}
                  {lane.error && (
                    <span className="text-red-600" title={lane.error}>
                      ERR
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
