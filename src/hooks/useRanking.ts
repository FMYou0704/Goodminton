import { useMemo } from "react";
import { computeOfficialStandings, computeOverallRatingRanking, computePlayerDerivedStats, computeRankings } from "../scheduler/stats";
import type { Match, Player } from "../types/tournament";

export function useRanking(players: Player[], matches: Match[]) {
  return useMemo(() => computeRankings(players, matches), [matches, players]);
}

export function useDerivedPlayerStats(players: Player[], matches: Match[]) {
  return useMemo(() => computePlayerDerivedStats(players, matches), [matches, players]);
}

export function useOverallRatingRanking(players: Player[], matches: Match[]) {
  return useMemo(() => computeOverallRatingRanking(players, matches), [matches, players]);
}

export function useOfficialStandings(players: Player[], matches: Match[]) {
  return useMemo(() => computeOfficialStandings(players, matches), [matches, players]);
}
