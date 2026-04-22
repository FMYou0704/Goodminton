import { useEffect, useState } from "react";
import { AppShell } from "./components/AppShell";
import { MatchesPage } from "./pages/MatchesPage";
import { RankingsPage } from "./pages/RankingsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SignupPage } from "./pages/SignupPage";
import { useTournamentStore } from "./store/tournamentStore";

type TabId = "signup" | "matches" | "rankings" | "settings";
type ThemeMode = "light" | "dark";

const tabs = [
  { id: "signup", label: "报名信息" },
  { id: "matches", label: "对局计分" },
  { id: "rankings", label: "比赛成绩" },
  { id: "settings", label: "设置" }
];

function readInitialTheme(): ThemeMode {
  if (typeof localStorage === "undefined") return "light";
  return localStorage.getItem("badminton-theme") === "dark" ? "dark" : "light";
}

export default function App() {
  const { isHydrated } = useTournamentStore();
  const [activeTab, setActiveTab] = useState<TabId>("signup");
  const [theme, setTheme] = useState<ThemeMode>(readInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("badminton-theme", theme);
  }, [theme]);

  const changeTab = (tab: string) => setActiveTab(tab as TabId);

  return (
    <AppShell tabs={tabs} activeTab={activeTab} onTabChange={changeTab}>
      {!isHydrated ? (
        <div className="panel text-center text-sm font-semibold text-slate-500 dark:text-slate-400">正在加载本地赛事数据...</div>
      ) : activeTab === "signup" ? (
        <SignupPage onGenerated={() => setActiveTab("matches")} />
      ) : activeTab === "matches" ? (
        <MatchesPage />
      ) : activeTab === "rankings" ? (
        <RankingsPage />
      ) : (
        <SettingsPage theme={theme} onThemeChange={setTheme} />
      )}
    </AppShell>
  );
}
