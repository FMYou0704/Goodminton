export type TopTabItem = {
  id: string;
  label: string;
};

type TopTabsProps = {
  tabs: TopTabItem[];
  activeTab: string;
  onChange: (tab: string) => void;
};

export function TopTabs({ tabs, activeTab, onChange }: TopTabsProps) {
  return (
    <nav className="sticky top-0 z-30 border-b border-white/80 bg-slate-50/95 px-3 pt-[env(safe-area-inset-top)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
      <div className="mx-auto flex max-w-screen-sm items-end justify-between gap-1">
        {tabs.map((tab) => {
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              className={`relative min-h-16 flex-1 rounded-t-3xl px-2 text-center text-base font-semibold transition ${
                active
                  ? "bg-blue-50 text-slate-950 dark:bg-slate-900 dark:text-white"
                  : "text-slate-500 dark:text-slate-400"
              }`}
              type="button"
              onClick={() => onChange(tab.id)}
            >
              {tab.label}
              {active ? <span className="absolute bottom-3 left-1/2 h-1 w-9 -translate-x-1/2 rounded-full bg-rose-500" /> : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
