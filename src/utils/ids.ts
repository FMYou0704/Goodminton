export function createTournamentId(now = new Date()): string {
  return `t-${now.getTime().toString(36)}`;
}

export function createPlayerId(index: number): string {
  return `p-${String(index + 1).padStart(3, "0")}`;
}

export function createMatchId(index: number): string {
  return `m-${String(index + 1).padStart(3, "0")}`;
}
