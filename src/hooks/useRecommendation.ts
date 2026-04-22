import { useMemo } from "react";
import { recommendDynamicMatches } from "../scheduler/dynamicScheduler";
import type { Match, MatchView, Player, SchedulingMode } from "../types/tournament";

function sortBySchedule(left: MatchView, right: MatchView): number {
  const leftRound = left.roundIndex ?? Number.MAX_SAFE_INTEGER;
  const rightRound = right.roundIndex ?? Number.MAX_SAFE_INTEGER;
  const leftCourt = left.courtIndex ?? Number.MAX_SAFE_INTEGER;
  const rightCourt = right.courtIndex ?? Number.MAX_SAFE_INTEGER;
  if (leftRound !== rightRound) return leftRound - rightRound;
  if (leftCourt !== rightCourt) return leftCourt - rightCourt;
  return left.id.localeCompare(right.id, "en");
}

export function recommendNextMatch(matchViews: MatchView[]): MatchView | undefined {
  return [...matchViews].filter((match) => match.status === "not_started" && match.canStart).sort(sortBySchedule)[0];
}

export function recommendNextRound(matchViews: MatchView[], courtCount: number): MatchView[] {
  const inProgressCount = matchViews.filter((match) => match.status === "in_progress").length;
  const availableSlots = Math.max(0, courtCount - inProgressCount);
  if (availableSlots === 0) return [];

  const candidates = [...matchViews].filter((match) => match.status === "not_started" && match.canStart).sort(sortBySchedule);
  const roundIndexes = [...new Set(candidates.map((match) => match.roundIndex ?? Number.MAX_SAFE_INTEGER))].sort((left, right) => left - right);

  for (const roundIndex of roundIndexes) {
    const selected: MatchView[] = [];
    const usedPlayers = new Set<string>();
    for (const match of candidates.filter((candidate) => (candidate.roundIndex ?? Number.MAX_SAFE_INTEGER) === roundIndex)) {
      const players = [...match.teamA, ...match.teamB];
      if (players.some((playerId) => usedPlayers.has(playerId))) continue;
      selected.push(match);
      for (const playerId of players) {
        usedPlayers.add(playerId);
      }
      if (selected.length >= availableSlots) break;
    }
    if (selected.length > 0) return selected;
  }

  return [];
}

export function useRecommendation(matchViews: MatchView[], courtCount: number) {
  return useMemo(
    () => ({
      nextMatch: recommendNextMatch(matchViews),
      nextRound: recommendNextRound(matchViews, courtCount)
    }),
    [courtCount, matchViews]
  );
}

export function useDynamicRecommendation(matches: Match[], players: Player[], courtCount: number, schedulingMode?: SchedulingMode) {
  return useMemo(() => recommendDynamicMatches({ matches, players, courtCount, schedulingMode }), [courtCount, matches, players, schedulingMode]);
}
