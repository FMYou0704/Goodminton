import { describe, expect, it } from "vitest";
import { generateSchedule } from "../scheduler/generator";
import type { Match, Player, TournamentConfig } from "../types/tournament";

function makePlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `p-${index + 1}`,
    name: `Player ${index + 1}`,
    gender: index % 2 === 0 ? "female" : "male"
  }));
}

function makeConfig(overrides: Partial<TournamentConfig> = {}): TournamentConfig {
  return {
    id: "t-test",
    name: "Test Tournament",
    totalMinutes: 120,
    courtCount: 2,
    matchDurationMinutes: 15,
    playerCount: 12,
    seed: "fixed-seed",
    ...overrides
  };
}

function opponentPairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function countOpponentPairs(matches: Match[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const match of matches) {
    for (const playerA of match.teamA) {
      for (const playerB of match.teamB) {
        const key = opponentPairKey(playerA, playerB);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }
  return counts;
}

describe("generateSchedule", () => {
  it("is deterministic for the same input", () => {
    const players = makePlayers(12);
    const config = makeConfig();

    const first = generateSchedule(config, players);
    const second = generateSchedule(config, players);

    expect(second.matches).toEqual(first.matches);
  });

  it("respects capacity and match uniqueness constraints", () => {
    const players = makePlayers(11);
    const config = makeConfig({ totalMinutes: 60, courtCount: 3, playerCount: 11 });
    const result = generateSchedule(config, players);
    const capacity = Math.floor(config.totalMinutes / config.matchDurationMinutes) * config.courtCount;

    expect(result.matches.length).toBeLessThanOrEqual(capacity);

    for (const match of result.matches) {
      expect(new Set([...match.teamA, ...match.teamB]).size).toBe(4);
    }
  });

  it("does not place a player twice within the same round", () => {
    const result = generateSchedule(makeConfig(), makePlayers(12));
    const playersByRound = new Map<number, Set<string>>();

    for (const match of result.matches) {
      const roundIndex = match.roundIndex ?? -1;
      const used = playersByRound.get(roundIndex) ?? new Set<string>();
      for (const playerId of [...match.teamA, ...match.teamB]) {
        expect(used.has(playerId), `${playerId} repeated in round ${roundIndex}`).toBe(false);
        used.add(playerId);
      }
      playersByRound.set(roundIndex, used);
    }
  });

  it("keeps every opponent pair at or below three meetings", () => {
    const result = generateSchedule(makeConfig({ totalMinutes: 240, courtCount: 2 }), makePlayers(10));
    const counts = countOpponentPairs(result.matches);

    for (const count of counts.values()) {
      expect(count).toBeLessThanOrEqual(3);
    }
  });

  it("handles fewer than four players without throwing", () => {
    const result = generateSchedule(makeConfig({ playerCount: 3 }), makePlayers(3));

    expect(result.matches).toEqual([]);
    expect(result.warnings.join(" ")).toContain("少于 4");
  });

  it("returns warnings instead of failing when consecutive rests are unavoidable", () => {
    const result = generateSchedule(makeConfig({ totalMinutes: 45, courtCount: 1, playerCount: 12 }), makePlayers(12));

    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.warnings.some((warning) => warning.includes("连续两轮轮空"))).toBe(true);
  });
});
