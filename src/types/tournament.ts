export const APP_NAME = "badminton-doubles-scheduler" as const;
export const SCHEMA_VERSION = 2 as const;

export type Gender = "male" | "female" | "other";

export type MatchStatus = "not_started" | "in_progress" | "finished";

export type MatchType = "official" | "filler";

export type SchedulingMode = "dynamic_fairness" | "strict_official";

export type Team = [string, string];

export type Player = {
  id: string;
  name: string;
  gender: Gender;
};

export type TournamentConfig = {
  id: string;
  name: string;
  totalMinutes: number;
  courtCount: number;
  matchDurationMinutes: number;
  playerCount: number;
  seed: string;
};

export type Match = {
  id: string;
  roundIndex?: number;
  courtIndex?: number;
  teamA: Team;
  teamB: Team;
  status: MatchStatus;
  matchType: MatchType;
  scoreA?: number;
  scoreB?: number;
  startedAt?: string;
  finishedAt?: string;
};

export type MatchView = Match & {
  canStart: boolean;
  blockingReasons: string[];
};

export type PlayerDerivedStats = {
  officialPlayed: number;
  officialWins: number;
  officialLosses: number;
  officialPointDiff: number;
  fillerPlayed: number;
  totalPlayed: number;
  totalWins: number;
  totalLosses: number;
  overallPointDiff: number;
  overallRating: number;
  provisional: boolean;
  averagePartnerRating: number | null;
  averageOpponentRating: number | null;
  strengthOfSchedule: number | null;
  carryIndex: number | null;
};

export type RankingRow = PlayerDerivedStats & {
  playerId: string;
  name: string;
  gender: Gender;
  totalWinRate: number;
  officialWinRate: number;
  averagePointDiff: number;
  // Compatibility fields used by the pre-refactor ranking table until Phase 3.
  matchesPlayed: number;
  wins: number;
  losses: number;
  pointDiff: number;
  winRate: number;
};

export type OverallRatingRow = RankingRow;

export type OfficialStandingRow = RankingRow;

export type ConflictInfo = {
  playerId: string;
  playerName: string;
  blockingMatchId: string;
  blockingMatchNumber: number;
  reason: string;
};

export type PairCounter = Record<string, Record<string, number>>;

export type PlayerRoundHistory = Record<string, number[]>;

export type ScheduleStats = {
  teammateCount: PairCounter;
  opponentCount: PairCounter;
  playerRoundHistory: PlayerRoundHistory;
  playerMatchCount: Record<string, number>;
};

export type ScheduleGenerationResult = {
  matches: Match[];
  warnings: string[];
  stats: ScheduleStats;
};

export type TournamentSettings = {
  schedulingMode: SchedulingMode;
  showOverallRating: boolean;
  showOfficialStandings: boolean;
  showExplanatoryMetrics: boolean;
};

export type TournamentState = {
  schemaVersion: typeof SCHEMA_VERSION;
  config?: TournamentConfig;
  players: Player[];
  matches: Match[];
  generationWarnings: string[];
  settings: TournamentSettings;
  createdAt: string;
  updatedAt: string;
};

export type TournamentExport = {
  schemaVersion: typeof SCHEMA_VERSION;
  exportedAt: string;
  appName: typeof APP_NAME;
  data: TournamentState;
};

export type MatchFilter =
  | "all"
  | "unfinished"
  | "available"
  | "in_progress"
  | "blocked"
  | "finished";
