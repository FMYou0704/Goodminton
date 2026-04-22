import { useEffect, useState } from "react";
import { validateBadmintonScore } from "../scheduler/validation";
import type { Match, Player } from "../types/tournament";

type ScoreDialogProps = {
  match?: Match;
  matchNumber: number;
  playersById: Map<string, Player>;
  onClose: () => void;
  onSave: (scoreA: number, scoreB: number) => void;
};

function teamNames(team: [string, string], playersById: Map<string, Player>): string {
  return team.map((playerId) => playersById.get(playerId)?.name ?? playerId).join(" + ");
}

export function ScoreDialog({ match, matchNumber, playersById, onClose, onSave }: ScoreDialogProps) {
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setScoreA("");
    setScoreB("");
    setError("");
  }, [match?.id]);

  if (!match) return null;

  const save = () => {
    const validation = validateBadmintonScore(scoreA, scoreB);
    if (!validation.valid || validation.scoreA === undefined || validation.scoreB === undefined) {
      setError(validation.message ?? "比分无效");
      return;
    }
    onSave(validation.scoreA, validation.scoreB);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/45 p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
      <div className="mx-auto w-full max-w-screen-sm rounded-3xl bg-white p-4 shadow-soft dark:bg-slate-900">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-blue-600 dark:text-blue-300">第 {matchNumber} 场</div>
            <h2 className="text-xl font-bold text-slate-950 dark:text-white">记录比分</h2>
          </div>
          <button className="secondary-button min-h-10 px-3 py-2 text-sm" type="button" onClick={onClose}>
            关闭
          </button>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="rounded-2xl bg-blue-50 p-3 dark:bg-blue-950">
            <div className="text-xs font-semibold text-blue-600 dark:text-blue-200">A 队</div>
            <div className="mt-1 min-h-12 text-base font-bold">{teamNames(match.teamA, playersById)}</div>
            <input className="field-input mt-3 text-center text-2xl" inputMode="numeric" value={scoreA} onChange={(event) => setScoreA(event.target.value)} placeholder="21" />
          </div>
          <div className="text-lg font-black text-rose-500">VS</div>
          <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-300">B 队</div>
            <div className="mt-1 min-h-12 text-base font-bold">{teamNames(match.teamB, playersById)}</div>
            <input className="field-input mt-3 text-center text-2xl" inputMode="numeric" value={scoreB} onChange={(event) => setScoreB(event.target.value)} placeholder="18" />
          </div>
        </div>

        {error ? <div className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:bg-rose-950 dark:text-rose-200">{error}</div> : null}

        <button className="primary-button mt-4 w-full" type="button" onClick={save}>
          保存比分
        </button>
      </div>
    </div>
  );
}
