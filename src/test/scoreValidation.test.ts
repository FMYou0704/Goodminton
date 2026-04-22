import { describe, expect, it } from "vitest";
import { validateBadmintonScore } from "../scheduler/validation";

describe("validateBadmintonScore", () => {
  it("accepts legal scores for either side winning", () => {
    const validScores: Array<[number, number]> = [
      [21, 18],
      [18, 21],
      [22, 20],
      [20, 22],
      [30, 29],
      [29, 30]
    ];

    for (const [scoreA, scoreB] of validScores) {
      expect(validateBadmintonScore(scoreA, scoreB), `${scoreA}:${scoreB}`).toMatchObject({ valid: true, scoreA, scoreB });
    }
  });

  it("rejects illegal badminton scores", () => {
    const invalidScores: Array<[unknown, unknown]> = [
      [20, 18],
      [21, 20],
      [31, 29],
      [30, 28],
      [21, 21],
      [-1, 21],
      ["x", 21],
      [21, "x"]
    ];

    for (const [scoreA, scoreB] of invalidScores) {
      expect(validateBadmintonScore(scoreA, scoreB), `${String(scoreA)}:${String(scoreB)}`).toMatchObject({ valid: false });
    }
  });
});
