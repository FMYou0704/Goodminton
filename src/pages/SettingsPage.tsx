import { useRef, useState } from "react";
import { useTournamentStore } from "../store/tournamentStore";
import { downloadTournamentJson, parseTournamentExport } from "../utils/json";

type ThemeMode = "light" | "dark";

type SettingsPageProps = {
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
};

export function SettingsPage({ theme, onThemeChange }: SettingsPageProps) {
  const { state, dispatch } = useTournamentStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");

  const reset = () => {
    if (!window.confirm("确认重置当前赛事？此操作会清空本地赛事数据。")) return;
    dispatch({ type: "reset" });
    setMessage("赛事已重置。");
  };

  const importJson = async (file?: File) => {
    if (!file) return;
    const text = await file.text();
    const result = parseTournamentExport(text);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    dispatch({ type: "import_state", state: result.state });
    setMessage("导入成功。");
  };

  return (
    <div className="space-y-4">
      <section className="panel space-y-4">
        <div>
          <h1 className="text-2xl font-black">赛事设置</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">管理本地数据、导入导出和界面主题。</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button className={theme === "light" ? "primary-button" : "secondary-button"} type="button" onClick={() => onThemeChange("light")}>
            浅色
          </button>
          <button className={theme === "dark" ? "primary-button" : "secondary-button"} type="button" onClick={() => onThemeChange("dark")}>
            深色
          </button>
        </div>
      </section>

      <section className="panel space-y-4">
        <div>
          <h2 className="text-lg font-black">调度模式</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            动态公平模式会在官方公平锁无法开赛时推荐补位赛；严格官方模式不会自动把补位赛作为总体推荐。
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2">
          <button
            className={state.settings.schedulingMode === "dynamic_fairness" ? "primary-button" : "secondary-button"}
            type="button"
            onClick={() => dispatch({ type: "update_settings", settings: { schedulingMode: "dynamic_fairness" } })}
          >
            动态公平模式
          </button>
          <button
            className={state.settings.schedulingMode === "strict_official" ? "primary-button" : "secondary-button"}
            type="button"
            onClick={() => dispatch({ type: "update_settings", settings: { schedulingMode: "strict_official" } })}
          >
            严格官方模式
          </button>
        </div>
      </section>

      <section className="panel space-y-4">
        <div>
          <h2 className="text-lg font-black">榜单显示</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">控制成绩页显示哪些榜单和解释性指标。</p>
        </div>
        {[
          { key: "showOverallRating" as const, label: "显示总等级分榜", description: "官方比赛和补位赛都会影响 Elo。" },
          { key: "showOfficialStandings" as const, label: "显示官方战绩榜", description: "只统计官方比赛。" },
          { key: "showExplanatoryMetrics" as const, label: "显示解释指标", description: "展示搭档均分、对手均分和 Carry 指标。" }
        ].map((item) => (
          <label key={item.key} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
            <span>
              <span className="block text-sm font-black">{item.label}</span>
              <span className="mt-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{item.description}</span>
            </span>
            <input
              className="h-6 w-6 accent-blue-600"
              type="checkbox"
              checked={state.settings[item.key]}
              onChange={(event) => dispatch({ type: "update_settings", settings: { [item.key]: event.target.checked } })}
            />
          </label>
        ))}
      </section>

      <section className="panel space-y-3">
        <h2 className="text-lg font-black">数据管理</h2>
        <button className="secondary-button w-full" type="button" disabled={!state.config} onClick={() => downloadTournamentJson(state)}>
          导出 JSON
        </button>
        <button className="secondary-button w-full" type="button" onClick={() => fileInputRef.current?.click()}>
          导入 JSON
        </button>
        <input
          ref={fileInputRef}
          className="hidden"
          type="file"
          accept="application/json,.json"
          onChange={(event) => {
            void importJson(event.target.files?.[0]);
            event.currentTarget.value = "";
          }}
        />
        <button className="danger-button w-full" type="button" onClick={reset}>
          重置赛事
        </button>
      </section>

      <section className="panel space-y-2 text-sm text-slate-600 dark:text-slate-300">
        <div>schemaVersion: {state.schemaVersion}</div>
        <div>创建时间: {new Date(state.createdAt).toLocaleString()}</div>
        <div>更新时间: {new Date(state.updatedAt).toLocaleString()}</div>
        <div>存储方式: IndexedDB 优先，失败时自动降级 localStorage</div>
      </section>

      {message ? <div className="rounded-2xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-200">{message}</div> : null}
    </div>
  );
}
