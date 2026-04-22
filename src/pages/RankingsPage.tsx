import { useOfficialStandings, useOverallRatingRanking } from "../hooks/useRanking";
import { useTournamentStore } from "../store/tournamentStore";
import type { RankingRow } from "../types/tournament";

function formatRate(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

function formatNumber(value: number | null, digits = 0): string {
  if (value === null || Number.isNaN(value)) return "-";
  return value.toFixed(digits);
}

function initial(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}

function PlayerCell({ row }: { row: RankingRow }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 text-base font-black text-blue-700 dark:bg-blue-950 dark:text-blue-200">
        {initial(row.name)}
      </div>
      <div className="min-w-0">
        <div className="truncate text-base font-black text-slate-900 dark:text-white">{row.name}</div>
        {row.provisional ? (
          <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            样本较少
          </span>
        ) : null}
      </div>
    </div>
  );
}

function OverallRatingTable({ rows, showMetrics }: { rows: RankingRow[]; showMetrics: boolean }) {
  if (rows.length === 0) return <div className="panel text-center text-sm text-slate-500">暂无总等级分数据</div>;

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-soft dark:bg-slate-900">
      <div className="grid grid-cols-[2.5rem_1fr_4.5rem_4rem] px-3 py-3 text-xs font-bold text-slate-500 dark:text-slate-400">
        <span>排名</span>
        <span>选手</span>
        <span className="text-right">等级分</span>
        <span className="text-right">总场</span>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {rows.map((row, index) => (
          <div key={row.playerId} className="px-3 py-4">
            <div className="grid grid-cols-[2.5rem_1fr_4.5rem_4rem] items-center">
              <div className="text-lg font-black text-slate-500">{index + 1}</div>
              <PlayerCell row={row} />
              <div className="text-right text-lg font-black text-blue-700 dark:text-blue-200">{Math.round(row.overallRating)}</div>
              <div className="text-right text-lg font-black">{row.totalPlayed}</div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-950">
                <div className="font-semibold text-slate-500">总胜率</div>
                <div className="mt-1 font-black">{formatRate(row.totalWinRate)}</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-950">
                <div className="font-semibold text-slate-500">场均净胜</div>
                <div className="mt-1 font-black">{row.averagePointDiff.toFixed(1)}</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-950">
                <div className="font-semibold text-slate-500">赛程强度</div>
                <div className="mt-1 font-black">{formatNumber(row.strengthOfSchedule)}</div>
              </div>
            </div>
            {showMetrics ? (
              <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-xl bg-blue-50 p-2 text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                  <div className="font-semibold">搭档均分</div>
                  <div className="mt-1 font-black">{formatNumber(row.averagePartnerRating)}</div>
                </div>
                <div className="rounded-xl bg-rose-50 p-2 text-rose-800 dark:bg-rose-950 dark:text-rose-200">
                  <div className="font-semibold">对手均分</div>
                  <div className="mt-1 font-black">{formatNumber(row.averageOpponentRating)}</div>
                </div>
                <div className="rounded-xl bg-emerald-50 p-2 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                  <div className="font-semibold">Carry</div>
                  <div className="mt-1 font-black">{formatNumber(row.carryIndex, 1)}</div>
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function OfficialStandingsTable({ rows }: { rows: RankingRow[] }) {
  if (rows.length === 0) return <div className="panel text-center text-sm text-slate-500">暂无官方战绩数据</div>;

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-soft dark:bg-slate-900">
      <div className="grid grid-cols-[2.5rem_1fr_4rem_4rem] px-3 py-3 text-xs font-bold text-slate-500 dark:text-slate-400">
        <span>排名</span>
        <span>选手</span>
        <span className="text-right">胜负</span>
        <span className="text-right">净胜</span>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {rows.map((row, index) => (
          <div key={row.playerId} className="grid grid-cols-[2.5rem_1fr_4rem_4rem] items-center px-3 py-4">
            <div className="text-lg font-black text-slate-500">{index + 1}</div>
            <div className="min-w-0">
              <PlayerCell row={row} />
              <div className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                官方 {row.officialPlayed} 场 · 胜率 {formatRate(row.officialWinRate)}
              </div>
            </div>
            <div className="text-right text-lg font-black">
              <span className="text-rose-500">{row.officialWins}</span>
              <span className="text-slate-500">-</span>
              <span>{row.officialLosses}</span>
            </div>
            <div className="text-right text-lg font-black">{row.officialPointDiff}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RankingsPage() {
  const { state } = useTournamentStore();
  const overallRows = useOverallRatingRanking(state.players, state.matches);
  const officialRows = useOfficialStandings(state.players, state.matches);
  const finishedOfficialCount = state.matches.filter((match) => match.status === "finished" && match.matchType === "official").length;
  const finishedFillerCount = state.matches.filter((match) => match.status === "finished" && match.matchType === "filler").length;

  return (
    <div className="space-y-4">
      <section className="panel">
        <h1 className="text-2xl font-black">比赛成绩</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
          总等级分榜是主榜，官方比赛和机动补位赛都会影响 Elo。官方战绩榜只统计官方比赛，用于查看可信官方排名。
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950">
            <div className="text-xs font-semibold text-slate-500">选手</div>
            <div className="text-xl font-black">{state.players.length}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950">
            <div className="text-xs font-semibold text-slate-500">官方完赛</div>
            <div className="text-xl font-black">{finishedOfficialCount}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950">
            <div className="text-xs font-semibold text-slate-500">补位完赛</div>
            <div className="text-xl font-black">{finishedFillerCount}</div>
          </div>
        </div>
      </section>

      {state.settings.showOverallRating ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-xl font-black">总等级分榜</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">按双打 Elo 排序，包含官方比赛和机动补位赛。</p>
          </div>
          <OverallRatingTable rows={overallRows} showMetrics={state.settings.showExplanatoryMetrics} />
        </section>
      ) : null}

      {state.settings.showOfficialStandings ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-xl font-black">官方战绩榜</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">只统计官方比赛，不计入机动补位赛。</p>
          </div>
          <OfficialStandingsTable rows={officialRows} />
        </section>
      ) : null}
    </div>
  );
}
