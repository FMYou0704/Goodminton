import { describe, expect, it } from "vitest";
import {
  computeOfficialStandings,
  computeOverallRatingRanking,
  computePlayerDerivedStats,
  sortOfficialStandingRows,
  sortOverallRatingRows
} from "../scheduler/stats";
import type { Match, Player, RankingRow } from "../types/tournament";

const players: Player[] = [
  { id: "p1", name: "Ace", gender: "male" },
  { id: "p2", name: "Pro", gender: "female" },
  { id: "p3", name: "Rookie", gender: "male" },
  { id: "p4", name: "Novice", gender: "female" },
  { id: "p5", name: "Opponent A", gender: "male" },
  { id: "p6", name: "Opponent B", gender: "female" }
];

function finishedMatch(
  id: string,
  teamA: [string, string],
  teamB: [string, string],
  scoreA: number,
  scoreB: number,
  matchType: Match["matchType"] = "official"
): Match {
  return {
    id,
    teamA,
    teamB,
    scoreA,
    scoreB,
    matchType,
    status: "finished",
    finishedAt: `2026-04-22T10:${id.replace(/\D/g, "").padStart(2, "0")}:00.000Z`
  };
}

function row(overrides: Partial<RankingRow>): RankingRow {
  return {
    playerId: overrides.playerId ?? "p",
    name: overrides.name ?? "Player",
    gender: overrides.gender ?? "other",
    officialPlayed: 0,
    officialWins: 0,
    officialLosses: 0,
    officialPointDiff: 0,
    fillerPlayed: 0,
    totalPlayed: 0,
    totalWins: 0,
    totalLosses: 0,
    overallPointDiff: 0,
    overallRating: 1500,
    provisional: false,
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
    ...overrides
  };
}

function ratingOf(playerId: string, matches: Match[]): number {
  return computePlayerDerivedStats(players, matches).find((item) => item.playerId === playerId)?.overallRating ?? 1500;
}

describe("hybrid ranking and team-aware doubles Elo", () => {
  it("official matches affect official standings and Elo, while filler matches affect Elo only", () => {
    const matches: Match[] = [
      finishedMatch("m1", ["p1", "p2"], ["p3", "p4"], 21, 18, "official"),
      finishedMatch("m2", ["p3", "p4"], ["p1", "p2"], 21, 18, "filler")
    ];

    const stats = computePlayerDerivedStats(players.slice(0, 4), matches);
    const ace = stats.find((item) => item.playerId === "p1");
    const rookie = stats.find((item) => item.playerId === "p3");

    expect(ace).toMatchObject({
      officialPlayed: 1,
      officialWins: 1,
      fillerPlayed: 1,
      totalPlayed: 2,
      totalWins: 1,
      totalLosses: 1
    });
    expect(rookie).toMatchObject({
      officialPlayed: 1,
      officialLosses: 1,
      fillerPlayed: 1,
      totalWins: 1
    });
    expect(ace?.officialPointDiff).toBe(3);
    expect(rookie?.officialPointDiff).toBe(-3);
    expect(ace?.overallRating).not.toBe(1500);
  });

  it("team-aware Elo gives a smaller expected-win gain to a stronger team than to a mixed-strength team", () => {
    const prehistory: Match[] = [
      finishedMatch("m1", ["p1", "p2"], ["p3", "p4"], 21, 12),
      finishedMatch("m2", ["p1", "p2"], ["p3", "p4"], 21, 13)
    ];
    const before = ratingOf("p1", prehistory);

    const strongTeamAfter = ratingOf("p1", [...prehistory, finishedMatch("m3", ["p1", "p2"], ["p5", "p6"], 21, 18)]);
    const mixedTeamAfter = ratingOf("p1", [...prehistory, finishedMatch("m3", ["p1", "p4"], ["p5", "p6"], 21, 18)]);

    expect(mixedTeamAfter - before).toBeGreaterThan(strongTeamAfter - before);
  });

  it("marks low-sample players as provisional and clears the badge after enough matches", () => {
    const matches: Match[] = [
      finishedMatch("m1", ["p1", "p2"], ["p3", "p4"], 21, 18),
      finishedMatch("m2", ["p1", "p2"], ["p3", "p4"], 18, 21),
      finishedMatch("m3", ["p1", "p3"], ["p2", "p4"], 21, 18),
      finishedMatch("m4", ["p1", "p4"], ["p2", "p3"], 21, 18)
    ];

    const stats = computePlayerDerivedStats(players.slice(0, 5), matches);

    expect(stats.find((item) => item.playerId === "p1")?.provisional).toBe(false);
    expect(stats.find((item) => item.playerId === "p5")?.provisional).toBe(true);
  });

  it("computes carryIndex from league average partner rating minus player average partner rating", () => {
    const matches: Match[] = [
      finishedMatch("m1", ["p1", "p2"], ["p3", "p4"], 21, 12),
      finishedMatch("m2", ["p1", "p2"], ["p3", "p4"], 21, 13),
      finishedMatch("m3", ["p1", "p4"], ["p5", "p6"], 21, 18)
    ];
    const stats = computePlayerDerivedStats(players, matches);
    const partnerRatings = stats
      .map((item) => item.averagePartnerRating)
      .filter((value): value is number => value !== null);
    const leagueAveragePartnerRating = partnerRatings.reduce((sum, value) => sum + value, 0) / partnerRatings.length;
    const ace = stats.find((item) => item.playerId === "p1");

    expect(ace?.averagePartnerRating).not.toBeNull();
    expect(ace?.carryIndex).toBeCloseTo(leagueAveragePartnerRating - (ace?.averagePartnerRating ?? 0), 6);
  });

  it("sorts overall rating by Elo, schedule strength, win rate, point diff, played count, then name", () => {
    const sorted = sortOverallRatingRows([
      row({ playerId: "a", name: "Alice", overallRating: 1600, strengthOfSchedule: 1500, totalWinRate: 0.7, averagePointDiff: 4, totalPlayed: 6 }),
      row({ playerId: "b", name: "Bob", overallRating: 1600, strengthOfSchedule: 1520, totalWinRate: 0.6, averagePointDiff: 2, totalPlayed: 8 }),
      row({ playerId: "c", name: "Cindy", overallRating: 1610, strengthOfSchedule: 1400, totalWinRate: 0.5, averagePointDiff: 1, totalPlayed: 9 })
    ]);

    expect(sorted.map((item) => item.name)).toEqual(["Cindy", "Bob", "Alice"]);
  });

  it("sorts official standings by wins, point diff, win rate, played count, then name", () => {
    const sorted = sortOfficialStandingRows([
      row({ playerId: "a", name: "Alice", officialWins: 2, officialPointDiff: 5, officialWinRate: 0.5, officialPlayed: 4 }),
      row({ playerId: "b", name: "Bob", officialWins: 2, officialPointDiff: 5, officialWinRate: 0.75, officialPlayed: 4 }),
      row({ playerId: "c", name: "Cindy", officialWins: 2, officialPointDiff: 7, officialWinRate: 0.5, officialPlayed: 4 }),
      row({ playerId: "d", name: "Daniel", officialWins: 1, officialPointDiff: 20, officialWinRate: 1, officialPlayed: 1 })
    ]);

    expect(sorted.map((item) => item.name)).toEqual(["Cindy", "Bob", "Alice", "Daniel"]);
  });

  it("exposes separate overall and official ranking entry points", () => {
    const matches: Match[] = [
      finishedMatch("m1", ["p1", "p2"], ["p3", "p4"], 21, 18, "official"),
      finishedMatch("m2", ["p3", "p4"], ["p1", "p2"], 21, 18, "filler")
    ];

    const overall = computeOverallRatingRanking(players.slice(0, 4), matches);
    const official = computeOfficialStandings(players.slice(0, 4), matches);

    expect(overall[0].overallRating).toBeGreaterThanOrEqual(overall[1].overallRating);
    expect(official[0].officialWins).toBeGreaterThanOrEqual(official[1].officialWins);
  });
});
