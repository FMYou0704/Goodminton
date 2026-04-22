import { AvailabilityBadge, StatusBadge } from "./StatusBadge";
import type { MatchView, Player } from "../types/tournament";

type MatchCardProps = {
  match: MatchView;
  matchNumber: number;
  playersById: Map<string, Player>;
  highlighted: boolean;
  onStart: () => void;
  onUndo: () => void;
  onRecord: () => void;
};

function initial(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}

function isPlayerConflictReason(reason: string): boolean {
  return reason.includes("当前正在第");
}

function PlayerLine({ playerId, playersById }: { playerId: string; playersById: Map<string, Player> }) {
  const player = playersById.get(playerId);
  const name = player?.name ?? playerId;
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-base font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-200">
        {initial(name)}
      </div>
      <span className="truncate text-base font-bold text-slate-900 dark:text-slate-50">{name}</span>
    </div>
  );
}

export function MatchCard({ match, matchNumber, playersById, highlighted, onStart, onUndo, onRecord }: MatchCardProps) {
  const playerBlocked = match.blockingReasons.some(isPlayerConflictReason);
  const canUndo = match.status === "in_progress" && match.scoreA === undefined && match.scoreB === undefined;
  const isOfficial = match.matchType === "official";

  return (
    <article
      className={`relative overflow-hidden rounded-2xl border bg-white p-4 shadow-soft transition dark:bg-slate-900 ${
        highlighted ? "border-blue-500 ring-4 ring-blue-100 dark:ring-blue-950" : "border-white/80 dark:border-slate-800"
      }`}
    >
      <div className="absolute left-0 top-4 rounded-r-lg bg-blue-500 px-3 py-1 text-sm font-bold text-white">{matchNumber}</div>
      <div className="ml-9 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            {match.roundIndex === undefined ? "动态推荐" : `第 ${(match.roundIndex ?? 0) + 1} 轮`} ·{" "}
            {match.courtIndex === undefined ? "待分配场地" : `${(match.courtIndex ?? 0) + 1} 号场`}
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                isOfficial
                  ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200"
                  : "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-200"
              }`}
            >
              {isOfficial ? "官方比赛" : "机动补位赛"}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {isOfficial ? "计入官方战绩 + 总等级分" : "仅计入总等级分和参与次数"}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={match.status} />
          <AvailabilityBadge canStart={match.canStart} blocked={playerBlocked} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="space-y-3">
          <PlayerLine playerId={match.teamA[0]} playersById={playersById} />
          <PlayerLine playerId={match.teamA[1]} playersById={playersById} />
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-100 bg-white text-lg font-black shadow-sm dark:border-slate-700 dark:bg-slate-950">
          <span className="text-blue-600">P</span>
          <span className="text-rose-500">K</span>
        </div>
        <div className="space-y-3">
          <PlayerLine playerId={match.teamB[0]} playersById={playersById} />
          <PlayerLine playerId={match.teamB[1]} playersById={playersById} />
        </div>
      </div>

      {match.status === "finished" && match.scoreA !== undefined && match.scoreB !== undefined ? (
        <div className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-center text-lg font-black text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
          {match.scoreA} : {match.scoreB}
        </div>
      ) : null}

      {match.blockingReasons.length > 0 && match.status === "not_started" ? (
        <div className="mt-4 space-y-1 rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:bg-rose-950 dark:text-rose-200">
          {match.blockingReasons.map((reason) => (
            <div key={reason}>{reason}</div>
          ))}
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-3 gap-2">
        <button className="primary-button px-2 text-sm" type="button" disabled={!match.canStart} onClick={onStart}>
          开始比赛
        </button>
        <button className="secondary-button px-2 text-sm" type="button" disabled={match.status !== "in_progress"} onClick={onRecord}>
          记录比分
        </button>
        <button className="secondary-button px-2 text-sm" type="button" disabled={!canUndo} onClick={onUndo}>
          撤销开始
        </button>
      </div>
    </article>
  );
}
