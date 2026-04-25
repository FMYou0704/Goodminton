import type { Match, OverallRatingRow, PairCounter, Player, RankingRow, ScheduleStats } from "../types/tournament";
import { validateBadmintonScore } from "./validation";

const INITIAL_ELO_RATING = 1500;

export function createEmptyPairCounter(): PairCounter {
  return {};
}

export function createEmptyScheduleStats(players: Player[]): ScheduleStats {
  return {
    teammateCount: createEmptyPairCounter(),
    opponentCount: createEmptyPairCounter(),
    playerRoundHistory: Object.fromEntries(players.map((player) => [player.id, []])),
    playerMatchCount: Object.fromEntries(players.map((player) => [player.id, 0]))
  };
}

export function normalizePair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export function getPairCount(counter: PairCounter, a: string, b: string): number {
  const [left, right] = normalizePair(a, b);
  return counter[left]?.[right] ?? 0;
}

export function incrementPair(counter: PairCounter, a: string, b: string, amount = 1): void {
  const [left, right] = normalizePair(a, b);
  counter[left] = counter[left] ?? {};
  counter[left][right] = (counter[left][right] ?? 0) + amount;
}

export function incrementMatchStats(stats: ScheduleStats, match: Pick<Match, "teamA" | "teamB" | "roundIndex">): void {
  const players = [...match.teamA, ...match.teamB];
  for (const playerId of players) {
    stats.playerMatchCount[playerId] = (stats.playerMatchCount[playerId] ?? 0) + 1;
    stats.playerRoundHistory[playerId] = stats.playerRoundHistory[playerId] ?? [];
    if (match.roundIndex !== undefined) {
      stats.playerRoundHistory[playerId].push(match.roundIndex);
    }
  }

  incrementPair(stats.teammateCount, match.teamA[0], match.teamA[1]);
  incrementPair(stats.teammateCount, match.teamB[0], match.teamB[1]);

  for (const playerA of match.teamA) {
    for (const playerB of match.teamB) {
      incrementPair(stats.opponentCount, playerA, playerB);
    }
  }
}

export function countOpponentPairsAtLimit(
  stats: ScheduleStats,
  teamA: [string, string],
  teamB: [string, string],
  maxOpponentCount: number
): number {
  let count = 0;
  for (const playerA of teamA) {
    for (const playerB of teamB) {
      if (getPairCount(stats.opponentCount, playerA, playerB) >= maxOpponentCount) {
        count += 1;
      }
    }
  }
  return count;
}

type MutableRankingRow = RankingRow & {
  partnerRatingTotal: number;
  partnerRatingSamples: number;
  opponentRatingTotal: number;
  opponentRatingSamples: number;
};

function getFinishedMatchSortKey(match: Match): string {
  return [
    match.finishedAt ?? "9999-12-31T23:59:59.999Z",
    match.startedAt ?? "9999-12-31T23:59:59.999Z",
    String(match.roundIndex ?? 999999).padStart(6, "0"),
    String(match.courtIndex ?? 999999).padStart(6, "0"),
    match.id
  ].join("|");
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function kFactor(totalPlayedBeforeMatch: number): number {
  return totalPlayedBeforeMatch < 5 ? 32 : 20;
}

function marginMultiplier(scoreA: number, scoreB: number): number {
  const margin = Math.abs(scoreA - scoreB);
  return Math.min(1.25, 1 + 0.08 * Math.log(1 + margin));
}

//功能：计算比赛结果的预期得分和 Elo 评分变化，更新玩家统计数据，并根据官方比赛结果对玩家进行排名。
function expectedScore(teamRating: number, opponentTeamRating: number): number {
  return 1 / (1 + Math.pow(10, (opponentTeamRating - teamRating) / 400));
}

function stripInternalFields(row: MutableRankingRow): RankingRow {
  const {
    partnerRatingTotal: _partnerRatingTotal,
    partnerRatingSamples: _partnerRatingSamples,
    opponentRatingTotal: _opponentRatingTotal,
    opponentRatingSamples: _opponentRatingSamples,
    ...publicRow
  } = row;
  return publicRow;
}

function isFinishedScoredMatch(match: Match): match is Match & { scoreA: number; scoreB: number } {
  if (match.status !== "finished" || match.scoreA === undefined || match.scoreB === undefined) {
    return false;
  }
  return validateBadmintonScore(match.scoreA, match.scoreB).valid;
}

function hasValidPlayers(match: Match, playerIds: Set<string>): boolean {
  const ids = [...match.teamA, ...match.teamB];
  return ids.length === 4 && new Set(ids).size === 4 && ids.every((playerId) => playerIds.has(playerId));
}

export function computeOfficialMatchCounts(players: Player[], matches: Match[]): Record<string, number> {
  const counts = Object.fromEntries(players.map((player) => [player.id, 0]));
  for (const match of matches) {
    if (match.matchType !== "official" || (match.status !== "in_progress" && match.status !== "finished")) {
      continue;
    }
    for (const playerId of [...match.teamA, ...match.teamB]) {
      if (playerId in counts) counts[playerId] += 1;
    }
  }
  return counts;
}

export function computePlayerDerivedStats(players: Player[], matches: Match[]): RankingRow[] {
  const playerIds = new Set(players.map((player) => player.id));
  const rowsByPlayer = new Map<string, MutableRankingRow>(
    players.map((player) => [
      player.id,
      {
        playerId: player.id,
        name: player.name,
        gender: player.gender,
        officialPlayed: 0,
        officialWins: 0,
        officialLosses: 0,
        officialPointDiff: 0,
        fillerPlayed: 0,
        totalPlayed: 0,
        totalWins: 0,
        totalLosses: 0,
        overallPointDiff: 0,
        overallRating: INITIAL_ELO_RATING,
        provisional: true,
        averagePartnerRating: null,
        averageOpponentRating: null,
        strengthOfSchedule: null,
        carryIndex: null,
        totalWinRate: 0,
        officialWinRate: 0,
        averagePointDiff: 0,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        pointDiff: 0,
        winRate: 0,
        partnerRatingTotal: 0,
        partnerRatingSamples: 0,
        opponentRatingTotal: 0,
        opponentRatingSamples: 0
      }
    ])
  );

  const finishedMatches = matches
    .filter(isFinishedScoredMatch)
    .filter((match) => hasValidPlayers(match, playerIds))
    .sort((left, right) => getFinishedMatchSortKey(left).localeCompare(getFinishedMatchSortKey(right), "en"));

  for (const match of finishedMatches) {
    const rows = [...match.teamA, ...match.teamB].map((playerId) => rowsByPlayer.get(playerId));
    if (rows.some((row) => !row)) {
      continue;
    }

    const teamAWon = match.scoreA > match.scoreB;
    const diffForA = match.scoreA - match.scoreB;
    const diffForB = -diffForA;
    const ratingsBefore = new Map<string, number>(
      [...match.teamA, ...match.teamB].map((playerId) => [playerId, rowsByPlayer.get(playerId)?.overallRating ?? INITIAL_ELO_RATING])
    );
    const teamRatingA = average(match.teamA.map((playerId) => ratingsBefore.get(playerId) ?? INITIAL_ELO_RATING));
    const teamRatingB = average(match.teamB.map((playerId) => ratingsBefore.get(playerId) ?? INITIAL_ELO_RATING));
    const expectedA = expectedScore(teamRatingA, teamRatingB);
    const expectedB = 1 - expectedA;
    const multiplier = marginMultiplier(match.scoreA, match.scoreB);
    const teamKFactorA = average(match.teamA.map((playerId) => kFactor(rowsByPlayer.get(playerId)?.totalPlayed ?? 0)));
    const teamKFactorB = average(match.teamB.map((playerId) => kFactor(rowsByPlayer.get(playerId)?.totalPlayed ?? 0)));

    // Team-aware doubles Elo: teammates share the same delta because the match
    // result does not contain reliable within-team attribution.
    const deltaA = teamKFactorA * multiplier * ((teamAWon ? 1 : 0) - expectedA);
    const deltaB = teamKFactorB * multiplier * ((teamAWon ? 0 : 1) - expectedB);

    for (const playerId of match.teamA) {
      const row = rowsByPlayer.get(playerId);
      if (!row) continue;
      const partnerId = match.teamA.find((id) => id !== playerId);
      const opponentRatings = match.teamB.map((id) => ratingsBefore.get(id) ?? INITIAL_ELO_RATING);

      row.totalPlayed += 1;
      row.overallPointDiff += diffForA;
      row.overallRating += deltaA;
      if (teamAWon) row.totalWins += 1;
      else row.totalLosses += 1;

      if (match.matchType === "official") {
        row.officialPlayed += 1;
        row.officialPointDiff += diffForA;
        if (teamAWon) row.officialWins += 1;
        else row.officialLosses += 1;
      } else {
        row.fillerPlayed += 1;
      }

      if (partnerId) {
        row.partnerRatingTotal += ratingsBefore.get(partnerId) ?? INITIAL_ELO_RATING;
        row.partnerRatingSamples += 1;
      }
      row.opponentRatingTotal += opponentRatings.reduce((sum, rating) => sum + rating, 0);
      row.opponentRatingSamples += opponentRatings.length;
    }

    for (const playerId of match.teamB) {
      const row = rowsByPlayer.get(playerId);
      if (!row) continue;
      const partnerId = match.teamB.find((id) => id !== playerId);
      const opponentRatings = match.teamA.map((id) => ratingsBefore.get(id) ?? INITIAL_ELO_RATING);

      row.totalPlayed += 1;
      row.overallPointDiff += diffForB;
      row.overallRating += deltaB;
      if (teamAWon) row.totalLosses += 1;
      else row.totalWins += 1;

      if (match.matchType === "official") {
        row.officialPlayed += 1;
        row.officialPointDiff += diffForB;
        if (teamAWon) row.officialLosses += 1;
        else row.officialWins += 1;
      } else {
        row.fillerPlayed += 1;
      }

      if (partnerId) {
        row.partnerRatingTotal += ratingsBefore.get(partnerId) ?? INITIAL_ELO_RATING;
        row.partnerRatingSamples += 1;
      }
      row.opponentRatingTotal += opponentRatings.reduce((sum, rating) => sum + rating, 0);
      row.opponentRatingSamples += opponentRatings.length;
    }
  }

  const mutableRows = Array.from(rowsByPlayer.values());
  const medianTotalPlayed = median(mutableRows.map((row) => row.totalPlayed));
  const provisionalThreshold = Math.max(4, Math.floor(medianTotalPlayed * 0.6));

  for (const row of mutableRows) {
    row.totalWinRate = row.totalPlayed === 0 ? 0 : row.totalWins / row.totalPlayed;
    row.officialWinRate = row.officialPlayed === 0 ? 0 : row.officialWins / row.officialPlayed;
    row.averagePointDiff = row.totalPlayed === 0 ? 0 : row.overallPointDiff / row.totalPlayed;
    row.averagePartnerRating = row.partnerRatingSamples === 0 ? null : row.partnerRatingTotal / row.partnerRatingSamples;
    row.averageOpponentRating = row.opponentRatingSamples === 0 ? null : row.opponentRatingTotal / row.opponentRatingSamples;
    row.strengthOfSchedule = row.averageOpponentRating;
    row.provisional = row.totalPlayed < provisionalThreshold;

    row.matchesPlayed = row.officialPlayed;
    row.wins = row.officialWins;
    row.losses = row.officialLosses;
    row.pointDiff = row.officialPointDiff;
    row.winRate = row.officialWinRate;
  }

  const partnerAverages = mutableRows
    .map((row) => row.averagePartnerRating)
    .filter((value): value is number => value !== null);
  const leagueAveragePartnerRating = partnerAverages.length === 0 ? null : average(partnerAverages);

  for (const row of mutableRows) {
    row.carryIndex =
      leagueAveragePartnerRating === null || row.averagePartnerRating === null
        ? null
        : leagueAveragePartnerRating - row.averagePartnerRating;
  }

  return mutableRows.map(stripInternalFields);
}

export function sortOverallRatingRows(rows: OverallRatingRow[]): OverallRatingRow[] {
  return [...rows].sort((a, b) => {
    if (b.overallRating !== a.overallRating) return b.overallRating - a.overallRating;
    if ((b.strengthOfSchedule ?? -Infinity) !== (a.strengthOfSchedule ?? -Infinity)) {
      return (b.strengthOfSchedule ?? -Infinity) - (a.strengthOfSchedule ?? -Infinity);
    }
    if (b.totalWinRate !== a.totalWinRate) return b.totalWinRate - a.totalWinRate;
    if (b.averagePointDiff !== a.averagePointDiff) return b.averagePointDiff - a.averagePointDiff;
    if (b.totalPlayed !== a.totalPlayed) return b.totalPlayed - a.totalPlayed;
    return a.name.localeCompare(b.name, "en");
  });
}

export function sortOfficialStandingRows(rows: RankingRow[]): RankingRow[] {
  return [...rows].sort((a, b) => {
    if (b.officialWins !== a.officialWins) return b.officialWins - a.officialWins;
    if (b.officialPointDiff !== a.officialPointDiff) return b.officialPointDiff - a.officialPointDiff;
    if (b.officialWinRate !== a.officialWinRate) return b.officialWinRate - a.officialWinRate;
    if (b.officialPlayed !== a.officialPlayed) return b.officialPlayed - a.officialPlayed;
    return a.name.localeCompare(b.name, "en");
  });
}

export function computeOverallRatingRanking(players: Player[], matches: Match[]): OverallRatingRow[] {
  return sortOverallRatingRows(computePlayerDerivedStats(players, matches));
}

export function computeOfficialStandings(players: Player[], matches: Match[]): RankingRow[] {
  return sortOfficialStandingRows(computePlayerDerivedStats(players, matches));
}

export function computeRankings(players: Player[], matches: Match[]): RankingRow[] {
  return computeOfficialStandings(players, matches);
}
