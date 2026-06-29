// App.tsx
// App shell: shared player list, tab switching, and the light/dark theme toggle.
// Theme is stored on <html data-theme> so all the CSS variables switch at once,
// and remembered in localStorage. Dark is the default.
import { useCallback, useEffect, useState } from "react";
import { getPlayers, type Player } from "./data";
import Standings from "./Standings";
import LogMatch from "./LogMatch";
import Odds from "./Odds";
import Stats from "./Stats";

type Tab = "standings" | "log" | "odds" | "stats";
type Theme = "dark" | "light";

const TITLES: Record<Tab, string> = {
  standings: "Standings",
  log: "New match",
  odds: "Match odds",
  stats: "Stats",
};

const TABS: { id: Tab; label: string }[] = [
  { id: "standings", label: "Standings" },
  { id: "log", label: "Log match" },
  { id: "odds", label: "Odds" },
  { id: "stats", label: "Stats" },
];

export default function App() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [tab, setTab] = useState<Tab>("standings");
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("pp-theme");
    return saved === "light" || saved === "dark" ? saved : "dark";
  });

  const load = useCallback(() => {
    getPlayers()
      .then(setPlayers)
      .catch((e) => console.error("Could not load players:", e));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("pp-theme", theme);
  }, [theme]);

  return (
    <div className="pp-page">
      <header className="pp-header">
        <div>
          <span className="pp-eyebrow">Garage League</span>
          <h1 className="pp-title">{TITLES[tab]}</h1>
        </div>
        <button
          className="pp-theme-toggle"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Toggle light and dark theme"
        >
          {theme === "dark" ? "☀" : "☾"}
        </button>
      </header>

      <nav className="pp-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? "pp-tab pp-tab-on" : "pp-tab"}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "standings" && <Standings />}
      {tab === "log" && <LogMatch players={players} onSaved={load} />}
      {tab === "odds" && <Odds players={players} />}
      {tab === "stats" && <Stats players={players} />}

      <footer className="pp-footer">Best of 5, first to 3</footer>
    </div>
  );
}