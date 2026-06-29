// App.tsx
// App shell: holds the shared player list and switches between Standings, the
// match-logging form, the odds preview, and the stats screen. Tabs that read
// data fetch their own on mount, so they refresh when you switch to them.
import { useCallback, useEffect, useState } from "react";
import { getPlayers, type Player } from "./data";
import Standings from "./Standings";
import LogMatch from "./LogMatch";
import Odds from "./Odds";
import Stats from "./Stats.tsx";

type Tab = "standings" | "log" | "odds" | "stats";
const TITLES: Record<Tab, string> = {
  standings: "Standings",
  log: "New match",
  odds: "Match odds",
  stats: "Stats",
};

export default function App() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [tab, setTab] = useState<Tab>("standings");

  const load = useCallback(() => {
    getPlayers()
      .then(setPlayers)
      .catch((e) => console.error("Could not load players:", e));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "standings", label: "Standings" },
    { id: "log", label: "Log match" },
    { id: "odds", label: "Odds" },
    { id: "stats", label: "Stats" },
  ];

  return (
    <div className="pp-page">
      <header className="pp-header">
        <span className="pp-eyebrow">Garage League</span>
        <h1 className="pp-title">{TITLES[tab]}</h1>
      </header>

      <nav className="pp-tabs">
        {tabs.map((t) => (
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
