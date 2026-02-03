"use client";

interface LaneStatusProps {
  laneId: string;
  agent: string;
  branch: string;
  worktreePath: string;
  staged: boolean;
  error?: string;
}

export function LaneStatus({
  laneId,
  agent,
  branch,
  worktreePath,
  staged,
  error,
}: LaneStatusProps) {
  return (
    <div
      className={`
        border rounded-md p-3
        ${error ? "border-red-200 bg-red-50" : staged ? "border-green-200 bg-green-50" : "border-gray-200 bg-white"}
      `}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm text-gray-900">{laneId}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
              {agent}
            </span>
            {staged && (
              <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">
                Staged
              </span>
            )}
            {error && (
              <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700">
                Error
              </span>
            )}
          </div>

          <div className="space-y-0.5">
            <p className="text-xs text-gray-500 truncate">
              <span className="text-gray-400">Branch:</span> {branch}
            </p>
            <p className="text-xs text-gray-500 truncate">
              <span className="text-gray-400">Path:</span> {worktreePath}
            </p>
          </div>

          {error && (
            <p className="mt-2 text-xs text-red-600">{error}</p>
          )}
        </div>

        <div className="flex-shrink-0">
          {staged ? (
            <svg
              className="h-5 w-5 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          ) : error ? (
            <svg
              className="h-5 w-5 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          ) : (
            <svg
              className="h-5 w-5 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}
