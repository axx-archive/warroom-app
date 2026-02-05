"use client";

import { ReactNode, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export type TabId = "lanes" | "merge" | "activity";

interface Tab {
  id: TabId;
  label: string;
  badge?: number | string;
  indicator?: boolean; // Show pulsing dot (e.g., for "ready to merge")
}

interface RunTabsProps {
  tabs: Tab[];
  activeTab: TabId;
  onTabChange?: (tab: TabId) => void;
  children: ReactNode;
  slug: string;
}

export function RunTabs({
  tabs,
  activeTab,
  onTabChange,
  children,
  slug,
}: RunTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleTabClick = useCallback(
    (tabId: TabId) => {
      // Update URL with tab parameter
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tabId);
      router.push(`/runs/${slug}?${params.toString()}`, { scroll: false });

      // Call optional callback
      onTabChange?.(tabId);
    },
    [router, searchParams, slug, onTabChange]
  );

  return (
    <div className="surface tech-corners overflow-hidden">
      {/* Tab Bar - Bold tactical styling */}
      <div className="tab-bar tab-bar--bold">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? "tab-button--active" : ""}`}
            onClick={() => handleTabClick(tab.id)}
            type="button"
          >
            {/* Tab icon based on type */}
            {tab.id === "lanes" && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            )}
            {tab.id === "merge" && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            )}
            {tab.id === "activity" && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            )}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span className="tab-button__badge">{tab.badge}</span>
            )}
            {tab.indicator && <span className="tab-button__indicator" />}
          </button>
        ))}

        {/* Right side - status indicator */}
        <div className="ml-auto flex items-center gap-3 pr-4">
          <span className="telemetry-label text-[var(--text-ghost)]">REAL-TIME</span>
          <span className="status-dot status-dot--sm status-dot--active" />
        </div>
      </div>

      {/* Tab Content */}
      <div className="tab-content">{children}</div>
    </div>
  );
}

// Hook to get current tab from URL
export function useCurrentTab(): TabId {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");

  if (tab === "merge" || tab === "activity") {
    return tab;
  }

  return "lanes";
}
