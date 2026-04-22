import { describe, expect, it } from "vitest";
import {
  getMatchStartBlockingReasons,
  officialFairnessLockAllows,
  recommendDynamicMatches,
  recommendNextFillerMatch,
  recommendNextOfficialMatch
} from "../scheduler/dynamicScheduler";
import type { Match, Player } from "../types/tournament";

function makePlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `p${index + 1}`,
    name: `Player ${index + 1}`,
    gender: index % 2 === 0 ? "female" : "male"
  }));
}

function officialMatch(id: string, teamA: [string, string], teamB: [string, string], status: Match["status"] = "not_started"): Match {
  return {
    id,
    teamA,
    teamB,
    matchType: "official",
    status,
    ...(status === "finished" ? { scoreA: 21, scoreB: 18 } : {})
  };
}

describe("dynamic scheduler and official fairness lock", () => {
  it("blocks an official match that would make official counts differ by more than one", () => {
    expect(
      officialFairnessLockAllows(["p1", "p2", "p3", "p4"], {
        p1: 1,
        p2: 1,
        p3: 0,
        p4: 0,
        p5: 0,
        p6: 0
      })
    ).toBe(false);
  });

  it("adds a clear blocking reason when official fairness lock prevents starting", () => {
    const players = makePlayers(8);
    const matches: Match[] = [
      officialMatch("m1", ["p1", "p2"], ["p7", "p8"], "finished"),
      officialMatch("m2", ["p1", "p2"], ["p3", "p4"])
    ];

    const reasons = getMatchStartBlockingReasons(matches[1], {
      matches,
      players,
      courtCount: 1
    });

    expect(reasons.some((reason) => reason.includes("官方公平锁"))).toBe(true);
  });

  it("recommends a filler match when no fair official match can start", () => {
    const players = makePlayers(8);
    const matches: Match[] = [
      officialMatch("m1", ["p1", "p2"], ["p7", "p8"], "finished"),
      officialMatch("m2", ["p1", "p2"], ["p3", "p4"])
    ];

    const official = recommendNextOfficialMatch({ matches, players, courtCount: 1 });
    const filler = recommendNextFillerMatch({ matches, players, courtCount: 1 });
    const overall = recommendDynamicMatches({ matches, players, courtCount: 1 });

    expect(official).toBeUndefined();
    expect(filler?.match.matchType).toBe("filler");
    expect(overall.nextOverall?.match.matchType).toBe("filler");
    expect(overall.warnings.some((warning) => warning.includes("机动补位赛"))).toBe(true);
  });

  it("strict official mode does not use filler as the overall recommendation", () => {
    const players = makePlayers(8);
    const matches: Match[] = [
      officialMatch("m1", ["p1", "p2"], ["p7", "p8"], "finished"),
      officialMatch("m2", ["p1", "p2"], ["p3", "p4"])
    ];

    const result = recommendDynamicMatches({ matches, players, courtCount: 1, schedulingMode: "strict_official" });

    expect(result.nextOfficial).toBeUndefined();
    expect(result.nextFiller?.match.matchType).toBe("filler");
    expect(result.nextOverall).toBeUndefined();
  });

  it("does not duplicate players in simultaneous recommendations", () => {
    const players = makePlayers(8);
    const matches: Match[] = [
      officialMatch("m1", ["p1", "p2"], ["p3", "p4"]),
      officialMatch("m2", ["p1", "p5"], ["p6", "p7"]),
      officialMatch("m3", ["p5", "p6"], ["p7", "p8"])
    ];

    const result = recommendDynamicMatches({ matches, players, courtCount: 2 });
    const selectedPlayers = result.simultaneous.flatMap((recommendation) => [...recommendation.match.teamA, ...recommendation.match.teamB]);

    expect(result.simultaneous.length).toBe(2);
    expect(new Set(selectedPlayers).size).toBe(selectedPlayers.length);
  });
});
