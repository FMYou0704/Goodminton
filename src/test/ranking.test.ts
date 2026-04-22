import { describe, expect, it } from "vitest";
import { computeRankings } from "../scheduler/stats";
import type { Match, Player } from "../types/tournament";

const players: Player[] = [
  { id: "p1", name: "Alice", gender: "female" },
  { id: "p2", name: "Bob", gender: "male" },
  { id: "p3", name: "Cindy", gender: "female" },
  { id: "p4", name: "Daniel", gender: "male" },
  { id: "p5", name: "Evan", gender: "male" },
  { id: "p6", name: "Fiona", gender: "female" }
];

describe("computeRankings", () => {
  it("derives rankings from finished matches only", () => {
    const matches: Match[] = [
      {
        id: "m1",
        roundIndex: 0,
        courtIndex: 0,
        teamA: ["p1", "p2"],
        teamB: ["p3", "p4"],
        matchType: "official",
        status: "finished",
        scoreA: 21,
        scoreB: 18
      },
      {
        id: "m2",
        roundIndex: 1,
        courtIndex: 0,
        teamA: ["p1", "p3"],
        teamB: ["p5", "p6"],
        matchType: "official",
        status: "in_progress"
      },
      {
        id: "m3",
        roundIndex: 2,
        courtIndex: 0,
        teamA: ["p5", "p6"],
        teamB: ["p2", "p4"],
        matchType: "official",
        status: "not_started"
      }
    ];

    const rankings = computeRankings(players, matches);
    const alice = rankings.find((row) => row.playerId === "p1");
    const evan = rankings.find((row) => row.playerId === "p5");

    expect(alice).toMatchObject({ matchesPlayed: 1, wins: 1, pointDiff: 3 });
    expect(evan).toMatchObject({ matchesPlayed: 0, wins: 0, pointDiff: 0 });
  });

  it("sorts by wins, point diff, fewer played matches, then name", () => {
    const matches: Match[] = [
      {
        id: "m1",
        roundIndex: 0,
        courtIndex: 0,
        teamA: ["p1", "p2"],
        teamB: ["p3", "p4"],
        matchType: "official",
        status: "finished",
        scoreA: 21,
        scoreB: 18
      },
      {
        id: "m2",
        roundIndex: 1,
        courtIndex: 0,
        teamA: ["p1", "p5"],
        teamB: ["p3", "p6"],
        matchType: "official",
        status: "finished",
        scoreA: 18,
        scoreB: 21
      }
    ];

    const rankings = computeRankings(players, matches);

    expect(rankings.map((row) => row.name).slice(0, 4)).toEqual(["Bob", "Fiona", "Alice", "Cindy"]);
  });
});
