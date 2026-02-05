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
    <div className="surface overflow-hidden">
      {/* Tab Bar */}
      <div className="tab-bar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? "tab-button--active" : ""}`}
            onClick={() => handleTabClick(tab.id)}
            type="button"
          >
            <span className="font-medium">{tab.label}</span>
            {tab.badge !== undefined && (
              <span className="tab-button__badge">{tab.badge}</span>
            )}
            {tab.indicator && <span className="tab-button__indicator" />}
          </button>
        ))}
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
