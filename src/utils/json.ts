import { APP_NAME, SCHEMA_VERSION, type Match, type TournamentExport, type TournamentState } from "../types/tournament";
import { validateBadmintonScore } from "../scheduler/validation";

type ParseResult = {
  ok: true;
  state: TournamentState;
} | {
  ok: false;
  error: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isMatchStatus(value: unknown): value is Match["status"] {
  return value === "not_started" || value === "in_progress" || value === "finished";
}

function isMatchType(value: unknown): value is Match["matchType"] {
  return value === "official" || value === "filler";
}

function isGender(value: unknown): boolean {
  return value === "male" || value === "female" || value === "other";
}

function validateMatch(match: Match, playerIds: Set<string>): string | undefined {
  if (!match.id) return "存在缺少 id 的比赛";
  if (!Array.isArray(match.teamA) || !Array.isArray(match.teamB) || match.teamA.length !== 2 || match.teamB.length !== 2) {
    return `比赛 ${match.id} 队伍结构无效`;
  }
  if (!isMatchStatus(match.status)) return `比赛 ${match.id} 状态无效`;
  if (!isMatchType(match.matchType)) return `比赛 ${match.id} 类型无效`;
  const players = [...match.teamA, ...match.teamB];
  if (players.length !== 4 || new Set(players).size !== 4) return `比赛 ${match.id} 必须包含 4 名不同选手`;
  for (const playerId of players) {
    if (!playerIds.has(playerId)) return `比赛 ${match.id} 引用了不存在的选手 ${playerId}`;
  }
  if (match.status === "finished") {
    const validation = validateBadmintonScore(match.scoreA, match.scoreB);
    if (!validation.valid) return `比赛 ${match.id} 比分无效：${validation.message ?? "未知错误"}`;
  }
  return undefined;
}

export function createTournamentExport(state: TournamentState): TournamentExport {
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    appName: APP_NAME,
    data: state
  };
}

export function downloadTournamentJson(state: TournamentState): void {
  const exportData = createTournamentExport(state);
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${state.config?.name || "badminton-tournament"}-${exportData.exportedAt.slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function parseTournamentExport(raw: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "JSON 解析失败，请检查文件内容。" };
  }

  if (!isObject(parsed)) return { ok: false, error: "导入文件格式无效。" };
  if (parsed.schemaVersion !== SCHEMA_VERSION) return { ok: false, error: `仅支持 schemaVersion ${SCHEMA_VERSION}。` };
  if (parsed.appName !== APP_NAME) return { ok: false, error: "导入文件不是本应用导出的赛事数据。" };
  if (typeof parsed.exportedAt !== "string") return { ok: false, error: "导入文件缺少 exportedAt 元数据。" };
  if (!isObject(parsed.data)) return { ok: false, error: "导入文件缺少 data 数据。" };

  const state = parsed.data as TournamentState;
  if (state.schemaVersion !== SCHEMA_VERSION) return { ok: false, error: "赛事数据版本不匹配。" };
  if (!Array.isArray(state.players) || !Array.isArray(state.matches)) return { ok: false, error: "赛事选手或比赛列表无效。" };
  if (!state.config) return { ok: false, error: "导入文件缺少赛事配置。" };
  if (typeof state.config.name !== "string" || state.config.courtCount < 1 || state.config.matchDurationMinutes < 1) {
    return { ok: false, error: "赛事配置无效。" };
  }
  if (typeof state.createdAt !== "string" || typeof state.updatedAt !== "string") {
    return { ok: false, error: "赛事数据缺少创建或更新时间。" };
  }

  const playerIds = new Set<string>();
  for (const player of state.players) {
    if (!player.id || !player.name) return { ok: false, error: "存在缺少 id 或姓名的选手。" };
    if (!isGender(player.gender)) return { ok: false, error: `选手 ${player.name} 性别无效。` };
    playerIds.add(player.id);
  }

  for (const match of state.matches) {
    const error = validateMatch(match, playerIds);
    if (error) return { ok: false, error };
  }

  return { ok: true, state };
}
