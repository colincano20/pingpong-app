// App.tsx
// App shell with routing. Each tab is a real route, so the back button and
// shareable URLs work. Holds the shared player list and the theme toggle.
import { useCallback, useEffect, useState } from "react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";
import { getPlayers, type Player } from "./data";
import Scoreboard from "./Scoreboard";
import Standings from "./Standings";
import LogMatch from "./LogMatch";
import Odds from "./Odds";
import Stats from "./Stats";
import MatchDetail from "./MatchDetail";
import Profile from "./Profile";
import Auth from "./Auth";

type Theme = "dark" | "light";

const TABS = [
  { to: "/", label: "Scores", end: true },
  { to: "/standings", label: "Ranks", end: false },
  { to: "/log", label: "Log", end: false },
  { to: "/odds", label: "Odds", end: false },
  { to: "/stats", label: "Stats", end: false },
];

function titleFor(pathname: string): string {
  if (pathname.startsWith("/standings")) return "Standings";
  if (pathname.startsWith("/log")) return "New match";
  if (pathname.startsWith("/odds")) return "Match odds";
  if (pathname.startsWith("/stats")) return "Stats";
  if (pathname.startsWith("/match")) return "Box score";
  if (pathname.startsWith("/player")) return "Profile";
  return "Scoreboard";
}

export default function App() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("pp-theme");
    return saved === "light" || saved === "dark" ? saved : "dark";
  });
  const location = useLocation();

  const load = useCallback(() => {
    getPlayers()
      .then(setPlayers)
      .catch((e) => console.error("Could not load players:", e));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("pp-theme", theme);
  }, [theme]);

  const userId = session?.user.id ?? null;

  function signOut() {
    supabase.auth.signOut();
  }

  return (
    <div className="pp-page">
      <header className="pp-header">
        <div>
          <span className="pp-eyebrow">Garage League</span>
          <h1 className="pp-title">{titleFor(location.pathname)}</h1>
        </div>
        <div className="pp-header-right">
          {session ? (
            <div className="pp-auth-signed-in">
              <NavLink className="pp-auth-account" to="/login">
                {session.user.email?.split("@")[0]}
              </NavLink>
              <button className="pp-auth-out" onClick={signOut}>Sign out</button>
            </div>
          ) : (
            <NavLink className="pp-auth-in" to="/login">Sign in</NavLink>
          )}
          <button
            className="pp-theme-toggle"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle light and dark theme"
          >
            {theme === "dark" ? "☀" : "☾"}
          </button>
        </div>
      </header>

      <nav className="pp-tabs">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) => (isActive ? "pp-tab pp-tab-on" : "pp-tab")}
          >
            {t.label}
          </NavLink>
        ))}
      </nav>

      <Routes>
        <Route path="/" element={<Scoreboard players={players} />} />
        <Route path="/standings" element={<Standings onPlayersChanged={load} />} />
        <Route path="/log" element={<LogMatch players={players} onSaved={load} userId={userId} />} />
        <Route path="/odds" element={<Odds players={players} />} />
        <Route path="/stats" element={<Stats players={players} />} />
        <Route path="/match/:id" element={<MatchDetail players={players} />} />
        <Route path="/player/:id" element={<Profile players={players} userId={userId} onClaimed={load} />} />
        <Route path="/login" element={<Auth session={session} />} />
      </Routes>

      <footer className="pp-footer">© {new Date().getFullYear()} Colin Cano</footer>
    </div>
  );
}