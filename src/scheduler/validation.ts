export type ScoreValidationResult = {
  valid: boolean;
  scoreA?: number;
  scoreB?: number;
  message?: string;
};

function parseScoreValue(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isInteger(value) ? value : undefined;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) return undefined;
    return Number(trimmed);
  }

  return undefined;
}

export function validateBadmintonScore(rawScoreA: unknown, rawScoreB: unknown): ScoreValidationResult {
  const scoreA = parseScoreValue(rawScoreA);
  const scoreB = parseScoreValue(rawScoreB);

  if (scoreA === undefined || scoreB === undefined) {
    return { valid: false, message: "比分必须是非负整数" };
  }

  if (scoreA < 0 || scoreB < 0) {
    return { valid: false, message: "比分不能为负数" };
  }

  if (scoreA > 30 || scoreB > 30) {
    return { valid: false, message: "单局最高分不能超过 30 分" };
  }

  if (scoreA === scoreB) {
    return { valid: false, message: "羽毛球单局不能以平分结束" };
  }

  const winner = Math.max(scoreA, scoreB);
  const loser = Math.min(scoreA, scoreB);

  if (winner < 21) {
    return { valid: false, message: "胜方至少需要 21 分" };
  }

  if (winner === 21) {
    if (loser <= 19) {
      return { valid: true, scoreA, scoreB };
    }
    return { valid: false, message: "20 平后必须领先 2 分" };
  }

  if (winner >= 22 && winner <= 29) {
    if (winner - loser === 2) {
      return { valid: true, scoreA, scoreB };
    }
    return { valid: false, message: "20 平后必须领先 2 分" };
  }

  if (winner === 30) {
    if (loser === 29) {
      return { valid: true, scoreA, scoreB };
    }
    return { valid: false, message: "封顶 30 分时只允许 30:29 或 29:30" };
  }

  return { valid: false, message: "比分不符合羽毛球单局规则" };
}
