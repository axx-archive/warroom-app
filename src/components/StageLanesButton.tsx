"use client";

interface StageLanesButtonProps {
  onStage: () => void;
  isStaging: boolean;
  disabled?: boolean;
}

export function StageLanesButton({
  onStage,
  isStaging,
  disabled = false,
}: StageLanesButtonProps) {
  return (
    <button
      onClick={onStage}
      disabled={disabled || isStaging}
      className={`
        px-4 py-2 rounded-md font-medium text-sm
        transition-all duration-200
        ${
          disabled || isStaging
            ? "bg-gray-200 text-gray-500 cursor-not-allowed"
            : "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800"
        }
      `}
    >
      {isStaging ? (
        <span className="flex items-center gap-2">
          <svg
            className="animate-spin h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Staging Lanes...
        </span>
      ) : (
        "Stage Lanes"
      )}
    </button>
  );
}
