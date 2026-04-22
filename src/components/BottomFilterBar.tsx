import type { MatchFilter } from "../types/tournament";

type FilterItem = {
  id: MatchFilter;
  label: string;
  count: number;
};

type BottomFilterBarProps = {
  activeFilter: MatchFilter;
  filters: FilterItem[];
  onChange: (filter: MatchFilter) => void;
};

export function BottomFilterBar({ activeFilter, filters, onChange }: BottomFilterBarProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_30px_rgba(15,23,42,0.12)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
      <div className="mx-auto flex max-w-screen-sm gap-2 overflow-x-auto px-3 py-3">
        {filters.map((filter) => {
          const active = filter.id === activeFilter;
          return (
            <button
              key={filter.id}
              className={`min-w-24 rounded-xl border px-3 py-2 text-center transition ${
                active
                  ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200"
                  : "border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
              }`}
              type="button"
              onClick={() => onChange(filter.id)}
            >
              <div className="text-sm font-semibold">{filter.label}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{filter.count} 场</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
