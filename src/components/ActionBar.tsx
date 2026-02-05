"use client";

import { ReactNode } from "react";
import { DropdownMenu, DropdownTriggerButton, DropdownMenuGroup } from "./DropdownMenu";
import { ProgressIndicator } from "./ProgressIndicator";

type MissionState = "idle" | "running" | "complete";

interface ActionBarProps {
  // Mission state
  missionState: MissionState;
  isStartingMission?: boolean;
  isStoppingMission?: boolean;

  // Progress
  completed: number;
  total: number;
  costUsd?: number;
  lanesRunning?: number;
  lanesFailed?: number;

  // Handlers
  onStartMission: () => void;
  onStopMission: () => void;
  onGoToMerge: () => void;

  // Dropdown actions
  dropdownGroups: DropdownMenuGroup[];

  // Optional additional elements (notifications, etc.)
  rightSlot?: ReactNode;
}

export function ActionBar({
  missionState,
  isStartingMission = false,
  isStoppingMission = false,
  completed,
  total,
  costUsd = 0,
  lanesRunning = 0,
  lanesFailed = 0,
  onStartMission,
  onStopMission,
  onGoToMerge,
  dropdownGroups,
  rightSlot,
}: ActionBarProps) {
  const allComplete = completed === total && total > 0;

  // Determine primary action based on state
  const renderPrimaryAction = () => {
    if (missionState === "running") {
      return (
        <button
          onClick={onStopMission}
          disabled={isStoppingMission}
          className="btn btn--danger btn--sm"
          title="Stop the running mission"
        >
          {isStoppingMission ? (
            <>
              <svg className="w-4 h-4 spinner" fill="none" viewBox="0 0 24 24">
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
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Stopping...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="1" strokeWidth={2} />
              </svg>
              Stop Mission
            </>
          )}
        </button>
      );
    }

    if (allComplete) {
      return (
        <button
          onClick={onGoToMerge}
          className="btn btn--success btn--sm animate-glow-pulse"
          title="All lanes complete - go to merge"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
            />
          </svg>
          Go to Merge
        </button>
      );
    }

    return (
      <button
        onClick={onStartMission}
        disabled={isStartingMission}
        className="btn btn--inverted btn--bold px-6 py-2.5 rounded-lg transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2 group"
        title="Start the mission - launches all lanes autonomously"
      >
        {isStartingMission ? (
          <>
            <svg className="w-4 h-4 spinner" fill="none" viewBox="0 0 24 24">
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
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Starting...
          </>
        ) : (
          <>
            <svg className="w-4 h-4 group-hover:animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            Initiate Mission
          </>
        )}
      </button>
    );
  };

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      {/* Primary actions */}
      <div className="flex items-center gap-2">
        {/* Primary CTA */}
        {renderPrimaryAction()}

        {/* More dropdown */}
        {dropdownGroups.length > 0 && (
          <DropdownMenu
            trigger={
              <DropdownTriggerButton
                label="More"
                icon={
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
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                }
              />
            }
            groups={dropdownGroups}
          />
        )}
      </div>

      {/* Secondary info */}
      <div className="flex items-center gap-3">
        {/* Progress indicator */}
        <ProgressIndicator
          completed={completed}
          total={total}
          costUsd={costUsd}
          lanesRunning={lanesRunning}
          lanesFailed={lanesFailed}
        />

        {/* Right slot (notifications, etc.) */}
        {rightSlot}
      </div>
    </div>
  );
}
