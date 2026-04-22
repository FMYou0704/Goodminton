import type { PairCounter, Player, ScheduleStats, Team } from "../types/tournament";
import { getPairCount } from "./stats";

export type CandidateMatch = {
  teamA: Team;
  teamB: Team;
  playerIds: string[];
  key: string;
};

export type ScoringContext = {
  players: Player[];
  stats: ScheduleStats;
  consecutiveRests: Record<string, number>;
  maxOpponentCount: number;
  remainingDisjointOptionCount: number;
};

export type ScoringWeights = {
  lowMatchCount: number;
  matchCountImbalance: number;
  newTeammate: number;
  repeatedTeammate: number;
  newOpponent: number;
  repeatedOpponent: number;
  restRelief: number;
  futureLimitRisk: number;
  remainingRoundOption: number;
};

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  lowMatchCount: 10,
  matchCountImbalance: 5,
  newTeammate: 18,
  repeatedTeammate: 12,
  newOpponent: 7,
  repeatedOpponent: 5,
  restRelief: 14,
  futureLimitRisk: 10,
  remainingRoundOption: 1.5
};

function pairScore(counter: PairCounter, a: string, b: string, newReward: number, repeatPenalty: number): number {
  const count = getPairCount(counter, a, b);
  if (count === 0) return newReward;
  return -repeatPenalty * count;
}

export function scoreCandidate(
  candidate: CandidateMatch,
  context: ScoringContext,
  weights = DEFAULT_SCORING_WEIGHTS
): number {
  const currentCounts = candidate.playerIds.map((playerId) => context.stats.playerMatchCount[playerId] ?? 0);
  const globalMinCount = Math.min(...context.players.map((player) => context.stats.playerMatchCount[player.id] ?? 0));
  const averageAfter =
    (context.players.reduce((sum, player) => sum + (context.stats.playerMatchCount[player.id] ?? 0), 0) + 4) /
    context.players.length;

  let score = 0;

  for (const count of currentCounts) {
    score += (globalMinCount - count) * weights.lowMatchCount;
    score -= Math.pow(count + 1 - averageAfter, 2) * weights.matchCountImbalance;
  }

  score += pairScore(
    context.stats.teammateCount,
    candidate.teamA[0],
    candidate.teamA[1],
    weights.newTeammate,
    weights.repeatedTeammate
  );
  score += pairScore(
    context.stats.teammateCount,
    candidate.teamB[0],
    candidate.teamB[1],
    weights.newTeammate,
    weights.repeatedTeammate
  );

  for (const playerA of candidate.teamA) {
    for (const playerB of candidate.teamB) {
      const opponentCount = getPairCount(context.stats.opponentCount, playerA, playerB);
      if (opponentCount === 0) {
        score += weights.newOpponent;
      } else {
        score -= opponentCount * weights.repeatedOpponent;
      }
      if (opponentCount === context.maxOpponentCount - 1) {
        score -= weights.futureLimitRisk;
      }
    }
  }

  for (const playerId of candidate.playerIds) {
    score += (context.consecutiveRests[playerId] ?? 0) * weights.restRelief;
  }

  score += Math.min(context.remainingDisjointOptionCount, 12) * weights.remainingRoundOption;

  return score;
}
