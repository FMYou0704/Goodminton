import { useMemo } from "react";
import { getMatchStartBlockingReasons, recommendDynamicMatches } from "../scheduler/dynamicScheduler";
import type { Match, MatchView, Player } from "../types/tournament";

export function buildMatchViews(matches: Match[], players: Player[], courtCount: number): MatchView[] {
  const context = { matches, players, courtCount };
  const dynamicRecommendation = recommendDynamicMatches(context);
  const fillerRecommended = Boolean(dynamicRecommendation.nextFiller);

  return matches.map((match) => {
    const blockingReasons = getMatchStartBlockingReasons(match, context);
    if (
      match.status === "not_started" &&
      match.matchType === "official" &&
      fillerRecommended &&
      blockingReasons.some((reason) => reason.includes("官方公平锁"))
    ) {
      blockingReasons.push("当前无公平官方赛可开，系统建议先开机动补位赛");
    }

    return {
      ...match,
      canStart: match.status === "not_started" && blockingReasons.length === 0,
      blockingReasons
    };
  });
}

export function useMatchAvailability(matches: Match[], players: Player[], courtCount: number): MatchView[] {
  return useMemo(() => buildMatchViews(matches, players, courtCount), [courtCount, matches, players]);
}
