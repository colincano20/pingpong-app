// Stats.tsx
// Flavor stats. Pulls the full match history once, then derives everything with
// the pure functions in stats.ts. Reuses the players list passed from App to
// turn ids into names.
import { useEffect, useMemo, useState } from "react";
import type { Player, MatchRow } from "./data";
import { getMatchHistory } from "./data";
import { hottestStreak, coldestStreak, rivalries, biggestBlowout } from "./statsmath";

export default function Stats({ players }: { players: Player[] }) {
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMatchHistory()
      .then((m) => {
        setMatches(m);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  const hot = useMemo(() => hottestStreak(matches, players), [matches, players]);
  const cold = useMemo(() => coldestStreak(matches, players), [matches, players]);
  const rivs = useMemo(() => rivalries(matches, players), [matches, players]);
  const blowout = useMemo(() => biggestBlowout(matches, players), [matches, players]);

  if (loading) {
    return (
      <section className="pp-card">
        <p className="pp-muted">Loading stats…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="pp-card pp-error">
        <p className="pp-error-title">Couldn't load stats</p>
        <p className="pp-muted">{error}</p>
      </section>
    );
  }

  if (matches.length === 0) {
    return (
      <section className="pp-card">
        <p className="pp-muted">
          No matches logged yet. Play a few and the stats fill in.
        </p>
      </section>
    );
  }

  return (
    <div className="pp-stats">
      <div className="pp-stat-grid">
        <div className="pp-stat-card">
          <span className="pp-stat-label">On a heater</span>
          {hot ? (
            <>
              <p className="pp-stat-big">{hot.name}</p>
              <p className="pp-stat-sub">{hot.streak} in a row</p>
            </>
          ) : (
            <p className="pp-muted">Nobody hot yet</p>
          )}
        </div>

        <div className="pp-stat-card">
          <span className="pp-stat-label">Ice cold</span>
          {cold ? (
            <>
              <p className="pp-stat-big">{cold.name}</p>
              <p className="pp-stat-sub">{Math.abs(cold.streak)} losses straight</p>
            </>
          ) : (
            <p className="pp-muted">Nobody slumping</p>
          )}
        </div>
      </div>

      <div className="pp-stat-card pp-stat-wide">
        <span className="pp-stat-label">Biggest blowout</span>
        {blowout ? (
          <>
            <p className="pp-stat-big">
              {blowout.winner} over {blowout.loser}
            </p>
            <p className="pp-stat-sub">
              {blowout.score} · {blowout.margin} points
            </p>
          </>
        ) : (
          <p className="pp-muted">None yet</p>
        )}
      </div>

      <div className="pp-card">
        <p className="pp-section-label">Rivalries</p>
        <ol className="pp-list">
          {rivs.map((r, i) => (
            <li key={i} className="pp-row">
              <span className="pp-name">
                {r.aName} vs {r.bName}
              </span>
              <span className="pp-elo">
                {r.aWins}-{r.bWins}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
