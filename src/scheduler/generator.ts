import type { Match, Player, ScheduleGenerationResult, Team, TournamentConfig } from "../types/tournament";
import { createMatchId } from "../utils/ids";
import { CandidateMatch, scoreCandidate } from "./scoring";
import { hashString, seededJitter } from "./seededRandom";
import { createEmptyScheduleStats, getPairCount, incrementMatchStats } from "./stats";

const MAX_OPPONENT_COUNT = 3;

function sortTeam(team: Team): Team {
  return team[0] < team[1] ? team : [team[1], team[0]];
}

function teamKey(team: Team): string {
  return `${team[0]}+${team[1]}`;
}

function canonicalCandidate(teamA: Team, teamB: Team): CandidateMatch {
  const sortedA = sortTeam(teamA);
  const sortedB = sortTeam(teamB);
  const [left, right] = teamKey(sortedA) <= teamKey(sortedB) ? [sortedA, sortedB] : [sortedB, sortedA];
  return {
    teamA: left,
    teamB: right,
    playerIds: [...left, ...right].sort(),
    key: `${teamKey(left)}__${teamKey(right)}`
  };
}

function generateCandidates(players: Player[]): CandidateMatch[] {
  const candidates = new Map<string, CandidateMatch>();
  const ids = players.map((player) => player.id);

  for (let a = 0; a < ids.length - 3; a += 1) {
    for (let b = a + 1; b < ids.length - 2; b += 1) {
      for (let c = b + 1; c < ids.length - 1; c += 1) {
        for (let d = c + 1; d < ids.length; d += 1) {
          const group = [ids[a], ids[b], ids[c], ids[d]];
          const pairings = [
            canonicalCandidate([group[0], group[1]], [group[2], group[3]]),
            canonicalCandidate([group[0], group[2]], [group[1], group[3]]),
            canonicalCandidate([group[0], group[3]], [group[1], group[2]])
          ];

          for (const pairing of pairings) {
            candidates.set(pairing.key, pairing);
          }
        }
      }
    }
  }

  return Array.from(candidates.values()).sort((left, right) => left.key.localeCompare(right.key, "en"));
}

function candidateHasUsedPlayer(candidate: CandidateMatch, usedPlayers: Set<string>): boolean {
  return candidate.playerIds.some((playerId) => usedPlayers.has(playerId));
}

function isHardFeasible(candidate: CandidateMatch, usedPlayers: Set<string>, stats: ScheduleGenerationResult["stats"]): boolean {
  if (new Set(candidate.playerIds).size !== 4) return false;
  if (candidateHasUsedPlayer(candidate, usedPlayers)) return false;

  for (const playerA of candidate.teamA) {
    for (const playerB of candidate.teamB) {
      if (getPairCount(stats.opponentCount, playerA, playerB) >= MAX_OPPONENT_COUNT) {
        return false;
      }
    }
  }

  return true;
}

function countRemainingDisjointOptions(
  chosen: CandidateMatch,
  candidates: CandidateMatch[],
  usedPlayers: Set<string>,
  stats: ScheduleGenerationResult["stats"]
): number {
  const nextUsedPlayers = new Set([...usedPlayers, ...chosen.playerIds]);
  let count = 0;

  for (const candidate of candidates) {
    if (candidate.key === chosen.key) continue;
    if (isHardFeasible(candidate, nextUsedPlayers, stats)) {
      count += 1;
    }
  }

  return count;
}

export function deriveScheduleSeed(config: TournamentConfig, players: Player[]): string {
  const normalized = JSON.stringify({
    name: config.name.trim(),
    totalMinutes: config.totalMinutes,
    courtCount: config.courtCount,
    matchDurationMinutes: config.matchDurationMinutes,
    players: players.map((player) => ({
      name: player.name.trim(),
      gender: player.gender
    }))
  });
  return `seed-${hashString(normalized).toString(36)}`;
}

export function generateSchedule(config: TournamentConfig, players: Player[]): ScheduleGenerationResult {
  const warnings: string[] = [];
  const stats = createEmptyScheduleStats(players);
  const normalizedPlayers = [...players].sort((left, right) => left.id.localeCompare(right.id, "en"));

  if (normalizedPlayers.length < 4) {
    return {
      matches: [],
      warnings: ["报名人数少于 4，无法生成双打比赛。"],
      stats
    };
  }

  const courtCount = Math.max(1, Math.floor(config.courtCount));
  const matchDuration = Math.max(1, Math.floor(config.matchDurationMinutes));
  const roundCount = Math.floor(Math.max(0, config.totalMinutes) / matchDuration);
  const maxMatches = roundCount * courtCount;

  if (maxMatches <= 0) {
    return {
      matches: [],
      warnings: ["可用时间太短，当前配置无法安排任何比赛。"],
      stats
    };
  }

  if (normalizedPlayers.length % 4 !== 0) {
    warnings.push("报名人数不是 4 的倍数，系统会通过轮空尽量保持参赛次数公平。");
  }

  if (Math.floor(normalizedPlayers.length / 4) < courtCount) {
    warnings.push("选手人数不足以填满全部场地，部分轮次无法满场。");
  }

  const candidates = generateCandidates(normalizedPlayers);
  const matches: Match[] = [];
  const consecutiveRests = Object.fromEntries(normalizedPlayers.map((player) => [player.id, 0]));
  const seed = config.seed || deriveScheduleSeed(config, normalizedPlayers);
  let restViolationCount = 0;
  let partialRoundCount = 0;

  for (let roundIndex = 0; roundIndex < roundCount && matches.length < maxMatches; roundIndex += 1) {
    const usedPlayers = new Set<string>();
    const roundMatches: Match[] = [];
    const roundCapacity = Math.min(courtCount, Math.floor(normalizedPlayers.length / 4), maxMatches - matches.length);

    for (let courtIndex = 0; courtIndex < roundCapacity; courtIndex += 1) {
      const feasibleCandidates = candidates.filter((candidate) => isHardFeasible(candidate, usedPlayers, stats));
      if (feasibleCandidates.length === 0) break;

      const scoredCandidates = feasibleCandidates
        .map((candidate) => ({
          candidate,
          score:
            scoreCandidate(candidate, {
              players: normalizedPlayers,
              stats,
              consecutiveRests,
              maxOpponentCount: MAX_OPPONENT_COUNT,
              remainingDisjointOptionCount: countRemainingDisjointOptions(candidate, candidates, usedPlayers, stats)
            }) + seededJitter(seed, `${roundIndex}:${courtIndex}:${candidate.key}`)
        }))
        .sort((left, right) => {
          if (right.score !== left.score) return right.score - left.score;
          return left.candidate.key.localeCompare(right.candidate.key, "en");
        });

      const chosen = scoredCandidates[0].candidate;
      const match: Match = {
        id: createMatchId(matches.length),
        roundIndex,
        courtIndex,
        teamA: chosen.teamA,
        teamB: chosen.teamB,
        status: "not_started",
        matchType: "official"
      };

      roundMatches.push(match);
      matches.push(match);
      for (const playerId of chosen.playerIds) {
        usedPlayers.add(playerId);
      }
      incrementMatchStats(stats, match);
    }

    if (roundMatches.length === 0) {
      break;
    }

    if (roundMatches.length < roundCapacity) {
      partialRoundCount += 1;
    }

    for (const player of normalizedPlayers) {
      if (usedPlayers.has(player.id)) {
        consecutiveRests[player.id] = 0;
      } else {
        consecutiveRests[player.id] = (consecutiveRests[player.id] ?? 0) + 1;
        if (consecutiveRests[player.id] >= 2) {
          restViolationCount += 1;
        }
      }
    }
  }

  if (matches.length < maxMatches) {
    warnings.push(`受硬约束限制，最多可安排 ${maxMatches} 场，实际生成 ${matches.length} 场。`);
  }

  if (partialRoundCount > 0) {
    warnings.push(`有 ${partialRoundCount} 个轮次未能填满全部可用场地，已优先保证人员不冲突和重复交手上限。`);
  }

  if (restViolationCount > 0) {
    warnings.push(`存在 ${restViolationCount} 次连续两轮轮空风险；该目标为软约束，已在可行范围内最小化。`);
  }

  return {
    matches,
    warnings,
    stats
  };
}
