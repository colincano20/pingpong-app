// Profile.tsx
// A player's page: name and Elo, summary stats, head-to-head records, and their
// complete match history (each game tappable to its box score). Reached via
// /player/:id by tapping a name anywhere it appears.
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { Player, MatchRow } from "./data";
import { getMatchHistory } from "./data";
import { headToHead, playerRecord, streakFor } from "./statsmath";

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function Profile({ players }: { players: Player[] }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getMatchHistory()
      .then((m) => {
        setMatches(m);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  const player = players.find((p) => p.id === id);
  const nameOf = (pid: string) =>
    players.find((p) => p.id === pid)?.name ?? "Unknown";

  const record = useMemo(
    () => (id ? playerRecord(matches, id) : { wins: 0, losses: 0, played: 0 }),
    [matches, id],
  );
  const streak = useMemo(() => (id ? streakFor(matches, id) : 0), [matches, id]);
  const h2h = useMemo(
    () => (id ? headToHead(matches, players, id) : []),
    [matches, players, id],
  );
  const myMatches = useMemo(
    () =>
      id
        ? [...matches]
            .reverse()
            .filter((m) => m.playerA === id || m.playerB === id)
        : [],
    [matches, id],
  );

  const winPct =
    record.played > 0 ? Math.round((record.wins / record.played) * 100) : null;
  const streakText = streak > 0 ? `W${streak}` : streak < 0 ? `L${-streak}` : "—";
  const streakClass =
    streak > 0 ? "pp-chip-val pp-up" : streak < 0 ? "pp-chip-val pp-down" : "pp-chip-val";

  let body;
  if (loading) {
    body = (
      <section className="pp-card">
        <p className="pp-muted">Loading profile…</p>
      </section>
    );
  } else if (error) {
    body = (
      <section className="pp-card pp-error">
        <p className="pp-error-title">Couldn't load profile</p>
        <p className="pp-muted">{error}</p>
      </section>
    );
  } else if (!player) {
    body = (
      <section className="pp-card">
        <p className="pp-muted">Player not found.</p>
      </section>
    );
  } else {
    body = (
      <>
        <h2 className="pp-profile-name">{player.name}</h2>
        <p className="pp-profile-elo">{Math.round(player.elo)} Elo</p>

        <div className="pp-chips">
          <div className="pp-chip">
            <div className="pp-chip-val">
              {record.wins}-{record.losses}
            </div>
            <div className="pp-chip-label">Record</div>
          </div>
          <div className="pp-chip">
            <div className="pp-chip-val">{winPct === null ? "—" : `${winPct}%`}</div>
            <div className="pp-chip-label">Win rate</div>
          </div>
          <div className="pp-chip">
            <div className={streakClass}>{streakText}</div>
            <div className="pp-chip-label">Streak</div>
          </div>
        </div>

        {h2h.length > 0 && (
          <>
            <p className="pp-section-label">Head-to-head</p>
            <section className="pp-card">
              <ol className="pp-list">
                {h2h.map((r) => (
                  <li key={r.opponentId} className="pp-row">
                    <Link className="pp-name pp-name-link" to={`/player/${r.opponentId}`}>
                      {r.opponentName}
                    </Link>
                    <span className="pp-elo">
                      {r.wins}-{r.losses}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          </>
        )}

        <p className="pp-section-label">Match history</p>
        {myMatches.length === 0 ? (
          <section className="pp-card">
            <p className="pp-muted">No matches yet.</p>
          </section>
        ) : (
          <div className="pp-log">
            {myMatches.map((m) => {
              const won = m.winner === id;
              const oppId = m.playerA === id ? m.playerB : m.playerA;
              const myGames = m.playerA === id ? m.aGames : m.bGames;
              const oppGames = m.playerA === id ? m.bGames : m.aGames;
              return (
                <Link key={m.matchId} to={`/match/${m.matchId}`} className="pp-log-row">
                  <span className={won ? "pp-log-badge pp-log-win" : "pp-log-badge pp-log-loss"}>
                    {won ? "W" : "L"}
                  </span>
                  <span className="pp-log-mid">
                    <span className="pp-log-opp">vs {nameOf(oppId)}</span>
                    <span className="pp-log-date">{shortDate(m.playedAt)}</span>
                  </span>
                  <span className="pp-log-score">
                    {myGames}–{oppGames}
                  </span>
                  <span className="pp-match-chevron" aria-hidden="true">›</span>
                </Link>
              );
            })}
          </div>
        )}
      </>
    );
  }

  return (
    <div>
      <button className="pp-back" onClick={() => navigate(-1)}>
        ‹ Back
      </button>
      {body}
    </div>
  );
}