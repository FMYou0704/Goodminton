import { TopTabs, type TopTabItem } from "./TopTabs";
import type { ReactNode } from "react";

type AppShellProps = {
  tabs: TopTabItem[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  children: ReactNode;
};

export function AppShell({ tabs, activeTab, onTabChange, children }: AppShellProps) {
  return (
    <div className="min-h-screen text-slate-950 dark:text-slate-50">
      <TopTabs tabs={tabs} activeTab={activeTab} onChange={onTabChange} />
      <main className="mx-auto max-w-screen-sm px-3 pb-28 pt-4">{children}</main>
    </div>
  );
}
