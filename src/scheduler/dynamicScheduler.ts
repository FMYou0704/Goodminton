import type { Match, MatchType, PairCounter, Player, SchedulingMode, Team } from "../types/tournament";
import { computeOfficialMatchCounts, getPairCount, incrementPair } from "./stats";

const MAX_OPPONENT_COUNT = 3;
const FILLER_MAX_TOTAL_SPREAD_AFTER_START = 2;

type Candidate = {
  teamA: Team;
  teamB: Team;
  playerIds: string[];
  key: string;
};

export type DynamicRecommendation = {
  match: Match;
  matchType: MatchType;
  score: number;
  source: "candidate_pool" | "generated_filler";
  blockingWarnings: string[];
};

export type DynamicRecommendationResult = {
  nextOfficial?: DynamicRecommendation;
  nextFiller?: DynamicRecommendation;
  nextOverall?: DynamicRecommendation;
  simultaneous: DynamicRecommendation[];
  warnings: string[];
};

export type StartabilityContext = {
  matches: Match[];
  players: Player[];
  courtCount: number;
  schedulingMode?: SchedulingMode;
};

type RuntimeSnapshot = {
  playersById: Map<string, Player>;
  idlePlayerIds: Set<string>;
  inProgressMatches: Match[];
  occupiedByPlayer: Map<string, Match>;
  officialCounts: Record<string, number>;
  totalCounts: Record<string, number>;
  waitingScores: Record<string, number>;
  teammateCount: PairCounter;
  opponentCount: PairCounter;
};

function normalizeTeam(team: Team): Team {
  return team[0] < team[1] ? team : [team[1], team[0]];
}

function teamKey(team: Team): string {
  return `${team[0]}+${team[1]}`;
}

function canonicalCandidate(teamA: Team, teamB: Team): Candidate {
  const sortedA = normalizeTeam(teamA);
  const sortedB = normalizeTeam(teamB);
  const [left, right] = teamKey(sortedA) <= teamKey(sortedB) ? [sortedA, sortedB] : [sortedB, sortedA];
  return {
    teamA: left,
    teamB: right,
    playerIds: [...left, ...right].sort(),
    key: `${teamKey(left)}__${teamKey(right)}`
  };
}

function createCandidateFromMatch(match: Match): Candidate {
  return canonicalCandidate(match.teamA, match.teamB);
}

function generateCandidatesFromPlayerIds(playerIds: string[]): Candidate[] {
  const sortedIds = [...playerIds].sort((left, right) => left.localeCompare(right, "en"));
  const candidates = new Map<string, Candidate>();

  for (let a = 0; a < sortedIds.length - 3; a += 1) {
    for (let b = a + 1; b < sortedIds.length - 2; b += 1) {
      for (let c = b + 1; c < sortedIds.length - 1; c += 1) {
        for (let d = c + 1; d < sortedIds.length; d += 1) {
          const group = [sortedIds[a], sortedIds[b], sortedIds[c], sortedIds[d]];
          for (const candidate of [
            canonicalCandidate([group[0], group[1]], [group[2], group[3]]),
            canonicalCandidate([group[0], group[2]], [group[1], group[3]]),
            canonicalCandidate([group[0], group[3]], [group[1], group[2]])
          ]) {
            candidates.set(candidate.key, candidate);
          }
        }
      }
    }
  }

  return Array.from(candidates.values()).sort((left, right) => left.key.localeCompare(right.key, "en"));
}

function matchNumber(matches: Match[], matchId: string): number {
  return matches.findIndex((match) => match.id === matchId) + 1;
}

function getMatchPlayers(match: Pick<Match, "teamA" | "teamB">): string[] {
  return [...match.teamA, ...match.teamB];
}

function createEmptyCounter(players: Player[]): Record<string, number> {
  return Object.fromEntries(players.map((player) => [player.id, 0]));
}

function countTotalParticipation(players: Player[], matches: Match[]): Record<string, number> {
  const counts = createEmptyCounter(players);
  for (const match of matches) {
    if (match.status !== "in_progress" && match.status !== "finished") continue;
    for (const playerId of getMatchPlayers(match)) {
      if (playerId in counts) counts[playerId] += 1;
    }
  }
  return counts;
}

function createPairCounter(): PairCounter {
  return {};
}

function buildPairCounters(matches: Match[]): Pick<RuntimeSnapshot, "teammateCount" | "opponentCount"> {
  const teammateCount = createPairCounter();
  const opponentCount = createPairCounter();

  for (const match of matches) {
    if (match.status !== "in_progress" && match.status !== "finished") continue;
    incrementPair(teammateCount, match.teamA[0], match.teamA[1]);
    incrementPair(teammateCount, match.teamB[0], match.teamB[1]);
    for (const playerA of match.teamA) {
      for (const playerB of match.teamB) {
        incrementPair(opponentCount, playerA, playerB);
      }
    }
  }

  return { teammateCount, opponentCount };
}

function computeWaitingScores(players: Player[], matches: Match[]): Record<string, number> {
  const lastActivityIndex = Object.fromEntries(players.map((player) => [player.id, -1]));

  matches.forEach((match, index) => {
    if (match.status !== "in_progress" && match.status !== "finished") return;
    for (const playerId of getMatchPlayers(match)) {
      if (playerId in lastActivityIndex) {
        lastActivityIndex[playerId] = Math.max(lastActivityIndex[playerId], index);
      }
    }
  });

  const latestIndex = Math.max(0, matches.length - 1);
  return Object.fromEntries(
    players.map((player) => {
      const lastIndex = lastActivityIndex[player.id];
      return [player.id, lastIndex < 0 ? latestIndex + 1 : Math.max(0, latestIndex - lastIndex)];
    })
  );
}

export function buildRuntimeSnapshot(matches: Match[], players: Player[]): RuntimeSnapshot {
  const inProgressMatches = matches.filter((match) => match.status === "in_progress");
  const occupiedByPlayer = new Map<string, Match>();
  for (const match of inProgressMatches) {
    for (const playerId of getMatchPlayers(match)) {
      occupiedByPlayer.set(playerId, match);
    }
  }

  const playersById = new Map(players.map((player) => [player.id, player]));
  const idlePlayerIds = new Set(players.filter((player) => !occupiedByPlayer.has(player.id)).map((player) => player.id));
  const pairCounters = buildPairCounters(matches);

  return {
    playersById,
    idlePlayerIds,
    inProgressMatches,
    occupiedByPlayer,
    officialCounts: computeOfficialMatchCounts(players, matches),
    totalCounts: countTotalParticipation(players, matches),
    waitingScores: computeWaitingScores(players, matches),
    ...pairCounters
  };
}

function hasFourDistinctKnownPlayers(candidate: Candidate, snapshot: RuntimeSnapshot): boolean {
  return candidate.playerIds.length === 4 && new Set(candidate.playerIds).size === 4 && candidate.playerIds.every((playerId) => snapshot.playersById.has(playerId));
}

function hasOnlyIdlePlayers(candidate: Candidate, snapshot: RuntimeSnapshot): boolean {
  return candidate.playerIds.every((playerId) => snapshot.idlePlayerIds.has(playerId));
}

function opponentLimitAllows(candidate: Candidate, snapshot: RuntimeSnapshot): boolean {
  for (const playerA of candidate.teamA) {
    for (const playerB of candidate.teamB) {
      if (getPairCount(snapshot.opponentCount, playerA, playerB) >= MAX_OPPONENT_COUNT) {
        return false;
      }
    }
  }
  return true;
}

export function officialFairnessLockAllows(candidatePlayerIds: string[], officialCounts: Record<string, number>): boolean {
  const nextCounts = { ...officialCounts };
  for (const playerId of candidatePlayerIds) {
    nextCounts[playerId] = (nextCounts[playerId] ?? 0) + 1;
  }
  const values = Object.values(nextCounts);
  if (values.length === 0) return false;
  return Math.max(...values) - Math.min(...values) <= 1;
}

function fillerParticipationAllows(candidate: Candidate, totalCounts: Record<string, number>): boolean {
  const nextCounts = { ...totalCounts };
  for (const playerId of candidate.playerIds) {
    nextCounts[playerId] = (nextCounts[playerId] ?? 0) + 1;
  }
  const values = Object.values(nextCounts);
  return Math.max(...values) - Math.min(...values) <= FILLER_MAX_TOTAL_SPREAD_AFTER_START;
}

function futureFeasibilityScore(candidate: Candidate, candidates: Candidate[], snapshot: RuntimeSnapshot): number {
  const reserved = new Set(candidate.playerIds);
  let count = 0;
  for (const nextCandidate of candidates) {
    if (nextCandidate.key === candidate.key) continue;
    if (nextCandidate.playerIds.some((playerId) => reserved.has(playerId))) continue;
    if (!hasOnlyIdlePlayers(nextCandidate, snapshot)) continue;
    if (!opponentLimitAllows(nextCandidate, snapshot)) continue;
    count += 1;
  }
  return Math.min(count, 12);
}

function scoreDynamicCandidate(candidate: Candidate, candidates: Candidate[], snapshot: RuntimeSnapshot, matchType: MatchType): number {
  const officialMin = Math.min(...Object.values(snapshot.officialCounts));
  const totalMin = Math.min(...Object.values(snapshot.totalCounts));
  let score = 0;

  for (const playerId of candidate.playerIds) {
    score += (officialMin - (snapshot.officialCounts[playerId] ?? 0)) * 28;
    score += (snapshot.waitingScores[playerId] ?? 0) * 10;
    score += (totalMin - (snapshot.totalCounts[playerId] ?? 0)) * 16;
  }

  for (const [left, right] of [candidate.teamA, candidate.teamB]) {
    const teammateRepeats = getPairCount(snapshot.teammateCount, left, right);
    score += teammateRepeats === 0 ? 24 : -18 * teammateRepeats;
  }

  for (const playerA of candidate.teamA) {
    for (const playerB of candidate.teamB) {
      const opponentRepeats = getPairCount(snapshot.opponentCount, playerA, playerB);
      score += opponentRepeats === 0 ? 8 : -8 * opponentRepeats;
      if (opponentRepeats === MAX_OPPONENT_COUNT - 1) score -= 12;
    }
  }

  if (matchType === "official") {
    const selectedLowestLayerCount = candidate.playerIds.filter((playerId) => (snapshot.officialCounts[playerId] ?? 0) === officialMin).length;
    score += selectedLowestLayerCount * 30;
  }

  score += futureFeasibilityScore(candidate, candidates, snapshot) * 1.5;
  return score;
}

function createGeneratedFillerMatch(candidate: Candidate): Match {
  return {
    id: `filler-${candidate.key}`,
    teamA: candidate.teamA,
    teamB: candidate.teamB,
    status: "not_started",
    matchType: "filler"
  };
}

function validOfficialPoolCandidates(matches: Match[], snapshot: RuntimeSnapshot): Array<{ match: Match; candidate: Candidate }> {
  const idleOfficialMin = Math.min(
    ...Array.from(snapshot.idlePlayerIds).map((playerId) => snapshot.officialCounts[playerId] ?? 0)
  );

  return matches
    .filter((match) => match.status === "not_started" && match.matchType === "official")
    .map((match) => ({ match, candidate: createCandidateFromMatch(match) }))
    .filter(({ candidate }) => {
      if (!hasFourDistinctKnownPlayers(candidate, snapshot)) return false;
      if (!hasOnlyIdlePlayers(candidate, snapshot)) return false;
      if (!opponentLimitAllows(candidate, snapshot)) return false;
      if (candidate.playerIds.some((playerId) => (snapshot.officialCounts[playerId] ?? 0) > idleOfficialMin + 1)) return false;
      return officialFairnessLockAllows(candidate.playerIds, snapshot.officialCounts);
    });
}

export function recommendNextOfficialMatch(context: StartabilityContext): DynamicRecommendation | undefined {
  const snapshot = buildRuntimeSnapshot(context.matches, context.players);
  if (snapshot.inProgressMatches.length >= context.courtCount) return undefined;

  const poolCandidates = validOfficialPoolCandidates(context.matches, snapshot);
  if (poolCandidates.length === 0) return undefined;
  const allCandidates = poolCandidates.map((item) => item.candidate);

  const [best] = poolCandidates
    .map((item) => ({
      ...item,
      score: scoreDynamicCandidate(item.candidate, allCandidates, snapshot, "official")
    }))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.candidate.key.localeCompare(right.candidate.key, "en");
    });

  return {
    match: best.match,
    matchType: "official",
    source: "candidate_pool",
    score: best.score,
    blockingWarnings: []
  };
}

export function recommendNextFillerMatch(context: StartabilityContext): DynamicRecommendation | undefined {
  const snapshot = buildRuntimeSnapshot(context.matches, context.players);
  if (snapshot.inProgressMatches.length >= context.courtCount) return undefined;
  if (snapshot.idlePlayerIds.size < 4) return undefined;

  const candidates = generateCandidatesFromPlayerIds(Array.from(snapshot.idlePlayerIds)).filter((candidate) => {
    if (!hasFourDistinctKnownPlayers(candidate, snapshot)) return false;
    if (!opponentLimitAllows(candidate, snapshot)) return false;
    return fillerParticipationAllows(candidate, snapshot.totalCounts);
  });

  if (candidates.length === 0) return undefined;

  const [best] = candidates
    .map((candidate) => ({
      candidate,
      score: scoreDynamicCandidate(candidate, candidates, snapshot, "filler")
    }))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.candidate.key.localeCompare(right.candidate.key, "en");
    });

  return {
    match: createGeneratedFillerMatch(best.candidate),
    matchType: "filler",
    source: "generated_filler",
    score: best.score,
    blockingWarnings: []
  };
}

export function recommendNextOverallMatch(context: StartabilityContext): DynamicRecommendation | undefined {
  const official = recommendNextOfficialMatch(context);
  if (official) return official;
  if (context.schedulingMode === "strict_official") return undefined;
  return recommendNextFillerMatch(context);
}

function asSimulatedInProgress(match: Match): Match {
  return {
    ...match,
    status: "in_progress",
    startedAt: match.startedAt ?? "simulated"
  };
}

export function recommendSimultaneousMatches(context: StartabilityContext): DynamicRecommendation[] {
  const selected: DynamicRecommendation[] = [];
  let simulatedMatches = context.matches;
  let availableSlots = Math.max(0, context.courtCount - context.matches.filter((match) => match.status === "in_progress").length);

  while (availableSlots > 0) {
    const recommendation = recommendNextOverallMatch({
      ...context,
      matches: simulatedMatches
    });
    if (!recommendation) break;

    selected.push(recommendation);
    simulatedMatches = [...simulatedMatches, asSimulatedInProgress(recommendation.match)];
    availableSlots -= 1;
  }

  return selected;
}

export function recommendDynamicMatches(context: StartabilityContext): DynamicRecommendationResult {
  const nextOfficial = recommendNextOfficialMatch(context);
  const nextFiller = recommendNextFillerMatch(context);
  const nextOverall = recommendNextOverallMatch(context);
  const simultaneous = recommendSimultaneousMatches(context);
  const warnings: string[] = [];

  if (!nextOfficial && nextFiller && context.schedulingMode !== "strict_official") {
    warnings.push("当前没有满足官方公平锁的官方比赛，已推荐机动补位赛以提高场地利用率。");
  }

  if (!nextOverall && context.schedulingMode === "strict_official" && nextFiller) {
    warnings.push("严格官方模式下不会自动推荐补位赛；如需提高场地利用率，可手动选择机动补位赛。");
  } else if (!nextOverall) {
    warnings.push("当前没有可推荐的官方比赛或机动补位赛。");
  }

  return {
    nextOfficial,
    nextFiller,
    nextOverall,
    simultaneous,
    warnings
  };
}

export function getMatchStartBlockingReasons(match: Match, context: StartabilityContext): string[] {
  const snapshot = buildRuntimeSnapshot(context.matches, context.players);
  const reasons: string[] = [];
  const candidate = createCandidateFromMatch(match);

  if (!hasFourDistinctKnownPlayers(candidate, snapshot)) {
    reasons.push("无效状态：比赛必须包含 4 名不同且存在的选手");
  }

  if (context.courtCount <= 0) {
    reasons.push("无效状态：场地数量必须大于 0");
  }

  if (match.status === "finished") {
    reasons.push("比赛已结束");
    return reasons;
  }

  if (match.status === "in_progress") {
    reasons.push("比赛已经开始");
    return reasons;
  }

  if (match.status !== "not_started") {
    reasons.push("无效状态：未知比赛状态");
    return reasons;
  }

  if (snapshot.inProgressMatches.length >= context.courtCount) {
    reasons.push(`场地已满：当前 ${context.courtCount} 块场地均在使用中`);
  }

  for (const playerId of candidate.playerIds) {
    const occupiedMatch = snapshot.occupiedByPlayer.get(playerId);
    if (!occupiedMatch) continue;
    const playerName = snapshot.playersById.get(playerId)?.name ?? playerId;
    reasons.push(`${playerName} 当前正在第 ${matchNumber(context.matches, occupiedMatch.id)} 场比赛中`);
  }

  if (!opponentLimitAllows(candidate, snapshot)) {
    reasons.push("重复交手已达上限：任意两名对手最多交手 3 次");
  }

  if (match.matchType === "official" && !officialFairnessLockAllows(candidate.playerIds, snapshot.officialCounts)) {
    reasons.push("官方公平锁阻止：开始后官方参赛次数差会超过 1 场");
  }

  if (match.matchType === "filler" && !fillerParticipationAllows(candidate, snapshot.totalCounts)) {
    reasons.push("补位赛参与度限制阻止：开始后总参与次数差会过大");
  }

  return reasons;
}
