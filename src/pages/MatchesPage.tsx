import { useMemo, useState } from "react";
import { BottomFilterBar } from "../components/BottomFilterBar";
import { MatchCard } from "../components/MatchCard";
import { ScoreDialog } from "../components/ScoreDialog";
import { useMatchAvailability } from "../hooks/useMatchAvailability";
import { useDynamicRecommendation } from "../hooks/useRecommendation";
import { useTournamentStore } from "../store/tournamentStore";
import type { Match, MatchFilter, MatchView } from "../types/tournament";
import type { DynamicRecommendation } from "../scheduler/dynamicScheduler";

function isPlayerConflict(match: MatchView): boolean {
  return match.blockingReasons.some((reason) => reason.includes("当前正在第"));
}

function filterMatches(matches: MatchView[], filter: MatchFilter): MatchView[] {
  switch (filter) {
    case "unfinished":
      return matches.filter((match) => match.status !== "finished");
    case "available":
      return matches.filter((match) => match.canStart);
    case "in_progress":
      return matches.filter((match) => match.status === "in_progress");
    case "blocked":
      return matches.filter((match) => match.status === "not_started" && isPlayerConflict(match));
    case "finished":
      return matches.filter((match) => match.status === "finished");
    case "all":
    default:
      return matches;
  }
}

function matchNumber(matches: Match[], matchId: string): number {
  const index = matches.findIndex((match) => match.id === matchId);
  return index >= 0 ? index + 1 : 0;
}

function teamNames(team: [string, string], playersById: ReadonlyMap<string, { name: string }>): string {
  return team.map((playerId) => playersById.get(playerId)?.name ?? playerId).join(" + ");
}

function recommendationTitle(recommendation?: DynamicRecommendation): string {
  if (!recommendation) return "暂无可推荐";
  return recommendation.match.matchType === "official" ? "官方比赛" : "机动补位赛";
}

export function MatchesPage() {
  const { state, dispatch } = useTournamentStore();
  const [filter, setFilter] = useState<MatchFilter>("all");
  const [scoringMatch, setScoringMatch] = useState<Match | undefined>();
  const [highlightedIds, setHighlightedIds] = useState<string[]>([]);
  const [recommendationText, setRecommendationText] = useState("");
  const courtCount = state.config?.courtCount ?? 1;
  const matchViews = useMatchAvailability(state.matches, state.players, courtCount);
  const playersById = useMemo(() => new Map(state.players.map((player) => [player.id, player])), [state.players]);
  const dynamicRecommendation = useDynamicRecommendation(state.matches, state.players, courtCount, state.settings.schedulingMode);
  const visibleMatches = filterMatches(matchViews, filter);
  const finishedCount = state.matches.filter((match) => match.status === "finished").length;
  const inProgressCount = state.matches.filter((match) => match.status === "in_progress").length;
  const progress = state.matches.length === 0 ? 0 : (finishedCount / state.matches.length) * 100;

  const filters = [
    { id: "all" as const, label: "全部", count: matchViews.length },
    { id: "unfinished" as const, label: "未结束", count: matchViews.filter((match) => match.status !== "finished").length },
    { id: "available" as const, label: "可以比赛", count: matchViews.filter((match) => match.canStart).length },
    { id: "in_progress" as const, label: "进行中", count: inProgressCount },
    { id: "blocked" as const, label: "人员冲突", count: matchViews.filter((match) => match.status === "not_started" && isPlayerConflict(match)).length },
    { id: "finished" as const, label: "已结束", count: finishedCount }
  ];

  const showRecommendation = (recommendation?: DynamicRecommendation) => {
    if (!recommendation) {
      setHighlightedIds([]);
      setRecommendationText("暂无可展示的推荐比赛。");
      return;
    }
    if (recommendation.source === "candidate_pool") {
      setHighlightedIds([recommendation.match.id]);
      setRecommendationText(`已高亮第 ${matchNumber(state.matches, recommendation.match.id)} 场官方比赛。`);
    } else {
      setHighlightedIds([]);
      setRecommendationText(
        `推荐机动补位赛：${teamNames(recommendation.match.teamA, playersById)} VS ${teamNames(recommendation.match.teamB, playersById)}。`
      );
    }
  };

  const startRecommendation = (recommendation?: DynamicRecommendation) => {
    if (!recommendation) return;
    if (recommendation.source === "candidate_pool") {
      dispatch({ type: "start_match", matchId: recommendation.match.id });
    } else {
      dispatch({ type: "append_and_start_match", match: recommendation.match });
    }
  };

  const showSimultaneous = () => {
    const existingIds = dynamicRecommendation.simultaneous
      .filter((recommendation) => recommendation.source === "candidate_pool")
      .map((recommendation) => recommendation.match.id);
    setHighlightedIds(existingIds);
    if (dynamicRecommendation.simultaneous.length === 0) {
      setRecommendationText("暂无可同时开始的一组比赛。");
      return;
    }
    setRecommendationText(
      `推荐同时开赛 ${dynamicRecommendation.simultaneous.length} 场：${dynamicRecommendation.simultaneous
        .map((recommendation) =>
          recommendation.source === "candidate_pool"
            ? `第 ${matchNumber(state.matches, recommendation.match.id)} 场`
            : `补位赛 ${teamNames(recommendation.match.teamA, playersById)} VS ${teamNames(recommendation.match.teamB, playersById)}`
        )
        .join("、")}。`
    );
  };

  const startSimultaneous = () => {
    for (const recommendation of dynamicRecommendation.simultaneous) {
      startRecommendation(recommendation);
    }
  };

  if (!state.config || state.matches.length === 0) {
    return (
      <div className="panel text-center">
        <h1 className="text-xl font-black">暂无对阵</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">请先在报名信息页生成对阵。</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="panel space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black">{state.config.name}</h1>
            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
              {state.players.length} 人 · {courtCount} 块场 · {state.config.matchDurationMinutes} 分钟/场
            </p>
          </div>
          <div className="text-right text-sm font-semibold text-slate-500 dark:text-slate-400">
            <div>总场数 {state.matches.length}</div>
            <div>进行中 {inProgressCount}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">比赛进度</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div className="h-full rounded-full bg-blue-600" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-sm font-black">{finishedCount}/{state.matches.length}</span>
        </div>
        {state.generationWarnings.length > 0 ? (
          <div className="space-y-1 rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            {state.generationWarnings.map((warning) => (
              <div key={warning}>{warning}</div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="grid gap-2">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            { label: "推荐下一官方赛", recommendation: dynamicRecommendation.nextOfficial },
            { label: "推荐补位赛", recommendation: dynamicRecommendation.nextFiller },
            { label: "推荐总体下一场", recommendation: dynamicRecommendation.nextOverall }
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/80 bg-white p-3 shadow-soft dark:border-slate-800 dark:bg-slate-900">
              <div className="text-sm font-black text-slate-900 dark:text-white">{item.label}</div>
              <div className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{recommendationTitle(item.recommendation)}</div>
              {item.recommendation ? (
                <div className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                  {teamNames(item.recommendation.match.teamA, playersById)}
                  <span className="mx-1 font-black text-rose-500">VS</span>
                  {teamNames(item.recommendation.match.teamB, playersById)}
                </div>
              ) : (
                <div className="mt-2 text-sm text-slate-400">当前不可用</div>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button className="secondary-button min-h-10 px-2 py-2 text-xs" type="button" disabled={!item.recommendation} onClick={() => showRecommendation(item.recommendation)}>
                  查看
                </button>
                <button className="primary-button min-h-10 px-2 py-2 text-xs" type="button" disabled={!item.recommendation} onClick={() => startRecommendation(item.recommendation)}>
                  开始
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-white/80 bg-white p-3 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-black">推荐同时开赛</div>
              <div className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                可用场地 {Math.max(0, courtCount - inProgressCount)} 块 · 推荐 {dynamicRecommendation.simultaneous.length} 场
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button className="secondary-button min-h-10 px-3 py-2 text-xs" type="button" onClick={showSimultaneous}>
                查看
              </button>
              <button className="primary-button min-h-10 px-3 py-2 text-xs" type="button" disabled={dynamicRecommendation.simultaneous.length === 0} onClick={startSimultaneous}>
                全部开始
              </button>
            </div>
          </div>
          {dynamicRecommendation.warnings.length > 0 ? (
            <div className="mt-3 space-y-1 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
              {dynamicRecommendation.warnings.map((warning) => (
                <div key={warning}>{warning}</div>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {recommendationText ? <div className="rounded-2xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-200">{recommendationText}</div> : null}

      <section className="space-y-4">
        {visibleMatches.map((match) => (
          <MatchCard
            key={match.id}
            match={match}
            matchNumber={state.matches.findIndex((item) => item.id === match.id) + 1}
            playersById={playersById}
            highlighted={highlightedIds.includes(match.id)}
            onStart={() => dispatch({ type: "start_match", matchId: match.id })}
            onUndo={() => dispatch({ type: "undo_start", matchId: match.id })}
            onRecord={() => setScoringMatch(match)}
          />
        ))}
      </section>

      <ScoreDialog
        match={scoringMatch}
        matchNumber={scoringMatch ? state.matches.findIndex((match) => match.id === scoringMatch.id) + 1 : 0}
        playersById={playersById}
        onClose={() => setScoringMatch(undefined)}
        onSave={(scoreA, scoreB) => {
          if (!scoringMatch) return;
          dispatch({ type: "finish_match", payload: { matchId: scoringMatch.id, scoreA, scoreB } });
          setScoringMatch(undefined);
        }}
      />

      <BottomFilterBar activeFilter={filter} filters={filters} onChange={setFilter} />
    </div>
  );
}
