// Standings.tsx
// League roster ranked by Elo, with each player's overall win-loss record.
// Fetches on mount, so switching back to this tab after logging a match shows
// the updated table.
import { useEffect, useState } from "react";
import { getStandings, type StandingsRow } from "./data";
import { Link } from "react-router-dom";

export default function Standings() {
  const [rows, setRows] = useState<StandingsRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStandings()
      .then((r) => {
        setRows(r);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="pp-card">
      {loading && <p className="pp-muted">Loading the league…</p>}

      {error && (
        <div className="pp-error">
          <p className="pp-error-title">Couldn't load standings</p>
          <p className="pp-muted">{error}</p>
          <p className="pp-muted">
            Check that your <code>.env</code> values are right and that you
            restarted the dev server after adding them.
          </p>
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <p className="pp-muted">
          No players yet. Add a few in the Supabase table editor to get going.
        </p>
      )}

      {!loading && !error && rows.length > 0 && (
        <ol className="pp-list">
          {rows.map((r, i) => {
            const pct =
              r.matchesPlayed > 0
                ? Math.round((r.wins / r.matchesPlayed) * 100)
                : null;
            return (
              <li key={r.id} className="pp-row">
                <span className="pp-rank">{i + 1}</span>
                <div className="pp-name-block">
                  <Link className="pp-name pp-name-link" to={`/player/${r.id}`}>{r.name}</Link>
                  <span className="pp-record">
                    {r.wins}-{r.losses}
                    {pct !== null ? ` · ${pct}%` : ""}
                  </span>
                </div>
                <span className="pp-elo">{Math.round(r.elo)}</span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
