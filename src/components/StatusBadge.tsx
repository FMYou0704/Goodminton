import type { MatchStatus } from "../types/tournament";

const STATUS_STYLES: Record<MatchStatus, string> = {
  not_started: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200",
  finished: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200"
};

const STATUS_LABELS: Record<MatchStatus, string> = {
  not_started: "未开始",
  in_progress: "进行中",
  finished: "已结束"
};

export function StatusBadge({ status }: { status: MatchStatus }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[status]}`}>{STATUS_LABELS[status]}</span>;
}

export function AvailabilityBadge({ canStart, blocked }: { canStart: boolean; blocked: boolean }) {
  if (canStart) {
    return <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-200">可以比赛</span>;
  }

  if (blocked) {
    return <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-950 dark:text-rose-200">人员冲突</span>;
  }

  return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">不可开始</span>;
}
