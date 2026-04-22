import { useEffect, useMemo, useState } from "react";
import { PlayerForm } from "../components/PlayerForm";
import { generateSchedule, deriveScheduleSeed } from "../scheduler/generator";
import { useTournamentStore } from "../store/tournamentStore";
import type { Player, TournamentConfig } from "../types/tournament";
import { createTournamentId } from "../utils/ids";
import { createBlankPlayers, createSamplePlayers } from "../utils/sampleData";

type SignupPageProps = {
  onGenerated: () => void;
};

function resizePlayers(players: Player[], count: number): Player[] {
  const normalizedCount = Math.max(0, Math.floor(Number.isFinite(count) ? count : 0));
  const blankPlayers = createBlankPlayers(normalizedCount);
  return blankPlayers.map((blankPlayer, index) => players[index] ?? blankPlayer);
}

export function SignupPage({ onGenerated }: SignupPageProps) {
  const { state, dispatch, isHydrated } = useTournamentStore();
  const [name, setName] = useState("羽毛球双打赛");
  const [totalMinutes, setTotalMinutes] = useState(120);
  const [courtCount, setCourtCount] = useState(2);
  const [matchDurationMinutes, setMatchDurationMinutes] = useState(15);
  const [playerCount, setPlayerCount] = useState(8);
  const [players, setPlayers] = useState<Player[]>(() => createBlankPlayers(8));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isHydrated || !state.config) return;
    setName(state.config.name);
    setTotalMinutes(state.config.totalMinutes);
    setCourtCount(state.config.courtCount);
    setMatchDurationMinutes(state.config.matchDurationMinutes);
    setPlayerCount(state.players.length || state.config.playerCount);
    setPlayers(state.players.length > 0 ? state.players : createBlankPlayers(state.config.playerCount));
  }, [isHydrated, state.config, state.players]);

  useEffect(() => {
    setPlayers((currentPlayers) => resizePlayers(currentPlayers, playerCount));
  }, [playerCount]);

  const capacityText = useMemo(() => {
    const matchesPerCourt = Math.floor(totalMinutes / Math.max(1, matchDurationMinutes));
    return `${matchesPerCourt * Math.max(1, courtCount)} 场上限`;
  }, [courtCount, matchDurationMinutes, totalMinutes]);

  const fillSample = () => {
    const count = Math.max(4, playerCount || 8);
    setPlayerCount(count);
    setPlayers(createSamplePlayers(count, Date.now() % 17));
    setError("");
  };

  const generate = () => {
    const normalizedPlayers = resizePlayers(players, playerCount).map((player, index) => ({
      ...player,
      id: player.id || `p-${index + 1}`,
      name: player.name.trim()
    }));

    if (normalizedPlayers.length < 4) {
      setError("报名人数少于 4，无法生成双打比赛。");
      return;
    }

    if (normalizedPlayers.some((player) => player.name.length === 0)) {
      setError("请填写所有选手姓名。");
      return;
    }

    if (totalMinutes < matchDurationMinutes) {
      setError("可用总时长短于单场时长，无法安排比赛。");
      return;
    }

    const baseConfig: TournamentConfig = {
      id: state.config?.id ?? createTournamentId(),
      name: name.trim() || "羽毛球双打赛",
      totalMinutes: Math.max(0, Math.floor(totalMinutes)),
      courtCount: Math.max(1, Math.floor(courtCount)),
      matchDurationMinutes: Math.max(1, Math.floor(matchDurationMinutes)),
      playerCount: normalizedPlayers.length,
      seed: ""
    };
    const config = {
      ...baseConfig,
      seed: deriveScheduleSeed(baseConfig, normalizedPlayers)
    };
    const result = generateSchedule(config, normalizedPlayers);

    if (result.matches.length === 0) {
      setError(result.warnings[0] ?? "当前配置无法生成比赛。");
      return;
    }

    dispatch({
      type: "configure",
      payload: {
        config,
        players: normalizedPlayers,
        matches: result.matches,
        warnings: result.warnings
      }
    });
    setError("");
    onGenerated();
  };

  return (
    <div className="space-y-4">
      <section className="panel space-y-4">
        <div>
          <h1 className="text-2xl font-black text-slate-950 dark:text-white">报名信息</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">填写配置后生成确定性的双打对阵。</p>
        </div>

        <label className="space-y-1">
          <span className="field-label">赛事名称</span>
          <input className="field-input" value={name} onChange={(event) => setName(event.target.value)} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="field-label">总时长（分钟）</span>
            <input className="field-input" type="number" min={1} value={totalMinutes} onChange={(event) => setTotalMinutes(Number(event.target.value))} />
          </label>
          <label className="space-y-1">
            <span className="field-label">场地数量</span>
            <input className="field-input" type="number" min={1} value={courtCount} onChange={(event) => setCourtCount(Number(event.target.value))} />
          </label>
          <label className="space-y-1">
            <span className="field-label">单场时长</span>
            <input
              className="field-input"
              type="number"
              min={1}
              value={matchDurationMinutes}
              onChange={(event) => setMatchDurationMinutes(Number(event.target.value))}
            />
          </label>
          <label className="space-y-1">
            <span className="field-label">选手人数</span>
            <input
              className="field-input"
              type="number"
              min={0}
              value={playerCount}
              onChange={(event) => setPlayerCount(Math.max(0, Math.floor(Number(event.target.value) || 0)))}
            />
          </label>
        </div>

        <div className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-200">
          当前配置理论最多安排 {capacityText}
        </div>
      </section>

      <section className="panel space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-black">选手名单</h2>
          <button className="secondary-button min-h-10 px-3 py-2 text-sm" type="button" onClick={fillSample}>
            随机填充测试数据
          </button>
        </div>
        <PlayerForm players={players} onChange={setPlayers} />
      </section>

      {error ? <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:bg-rose-950 dark:text-rose-200">{error}</div> : null}

      <button className="primary-button w-full" type="button" onClick={generate}>
        生成对阵
      </button>
    </div>
  );
}
