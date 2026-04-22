import type { RankingRow } from "../types/tournament";

function genderLabel(gender: RankingRow["gender"]): string {
  if (gender === "male") return "男";
  if (gender === "female") return "女";
  return "其他";
}

function initial(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}

export function RankingTable({ rows }: { rows: RankingRow[] }) {
  if (rows.length === 0) {
    return <div className="panel text-center text-sm text-slate-500 dark:text-slate-400">暂无选手数据</div>;
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-soft dark:bg-slate-900">
      <div className="grid grid-cols-[3rem_1fr_4.5rem_4rem] px-3 py-3 text-sm font-semibold text-slate-500 dark:text-slate-400">
        <span>排名</span>
        <span>选手</span>
        <span className="text-right">胜负</span>
        <span className="text-right">净胜</span>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {rows.map((row, index) => (
          <div
            key={row.playerId}
            className={`grid grid-cols-[3rem_1fr_4.5rem_4rem] items-center px-3 py-4 ${
              index === 0 ? "bg-rose-50 dark:bg-rose-950/30" : index === 1 ? "bg-amber-50 dark:bg-amber-950/30" : index === 2 ? "bg-blue-50 dark:bg-blue-950/30" : ""
            }`}
          >
            <div className="text-lg font-bold text-slate-500 dark:text-slate-400">{index + 1}</div>
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-200">
                {initial(row.name)}
              </div>
              <div className="min-w-0">
                <div className="truncate text-lg font-bold text-slate-900 dark:text-slate-50">{row.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {genderLabel(row.gender)} · 已赛 {row.matchesPlayed} · 胜率 {(row.winRate * 100).toFixed(0)}%
                </div>
              </div>
            </div>
            <div className="text-right text-lg font-bold">
              <span className="text-rose-500">{row.wins}</span>
              <span className="text-slate-500">-</span>
              <span>{row.losses}</span>
            </div>
            <div className="text-right text-lg font-bold">{row.pointDiff}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
