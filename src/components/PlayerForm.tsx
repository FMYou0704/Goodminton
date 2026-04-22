import type { Gender, Player } from "../types/tournament";

type PlayerFormProps = {
  players: Player[];
  onChange: (players: Player[]) => void;
};

const GENDER_OPTIONS: Array<{ value: Gender; label: string }> = [
  { value: "male", label: "男" },
  { value: "female", label: "女" },
  { value: "other", label: "其他" }
];

export function PlayerForm({ players, onChange }: PlayerFormProps) {
  const updatePlayer = (index: number, patch: Partial<Player>) => {
    onChange(players.map((player, playerIndex) => (playerIndex === index ? { ...player, ...patch } : player)));
  };

  return (
    <div className="space-y-3">
      {players.map((player, index) => (
        <div key={player.id} className="grid grid-cols-[1fr_6.5rem] gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-950">
          <label className="space-y-1">
            <span className="field-label">选手 {index + 1}</span>
            <input
              className="field-input"
              value={player.name}
              placeholder="姓名"
              onChange={(event) => updatePlayer(index, { name: event.target.value })}
            />
          </label>
          <label className="space-y-1">
            <span className="field-label">性别</span>
            <select
              className="field-input"
              value={player.gender}
              onChange={(event) => updatePlayer(index, { gender: event.target.value as Gender })}
            >
              {GENDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      ))}
    </div>
  );
}
