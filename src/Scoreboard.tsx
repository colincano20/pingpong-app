// Scoreboard.tsx
// Recent matches as separate cards, newest first. Each card shows the matchup,
// the final game score (winner in green), and the date. In the next step each
// card becomes tappable to open its box score.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Player, MatchRow } from "./data";
import { getMatchHistory } from "./data";

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function Scoreboard({ players }: { players: Player[] }) {
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

  const nameOf = (id: string) =>
    players.find((p) => p.id === id)?.name ?? "Unknown";
  const recent = [...matches].reverse();

  if (loading) {
    return (
      <section className="pp-card">
        <p className="pp-muted">Loading scores…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="pp-card pp-error">
        <p className="pp-error-title">Couldn't load scores</p>
        <p className="pp-muted">{error}</p>
      </section>
    );
  }

  if (recent.length === 0) {
    return (
      <section className="pp-card">
        <p className="pp-muted">No matches yet. Log one and it shows up here.</p>
      </section>
    );
  }

  return (
    <div>
      <p className="pp-section-label">Recent games</p>
      <div className="pp-matches">
        {recent.map((m) => {
          const aWon = m.winner === m.playerA;
          return (
            <Link to={`/match/${m.matchId}`} key={m.matchId} className="pp-match-card">
              <div className="pp-match-top">
                <span className={aWon ? "pp-score-name pp-score-win" : "pp-score-name"}>
                  {nameOf(m.playerA)}
                </span>
                <span className="pp-match-score">
                  <b className={aWon ? "pp-score-win" : "pp-score-dim"}>{m.aGames}</b>
                  <span className="pp-score-dash">–</span>
                  <b className={!aWon ? "pp-score-win" : "pp-score-dim"}>{m.bGames}</b>
                </span>
                <span
                  className={
                    !aWon
                      ? "pp-score-name pp-right pp-score-win"
                      : "pp-score-name pp-right"
                  }
                >
                  {nameOf(m.playerB)}
                </span>
              </div>
              <div className="pp-match-bottom">
                <span className="pp-match-date">{shortDate(m.playedAt)}</span>
                <span className="pp-match-chevron" aria-hidden="true">›</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}