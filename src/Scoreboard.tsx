// Scoreboard.tsx
// Landing screen. Up top: upcoming matches you've scheduled, each showing its
// live betting line, with a small form to add one. Below: recent completed
// games as cards that tap through to their box score.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Player, MatchRow, UpcomingMatch } from "./data";
import {
  getMatchHistory,
  getUpcomingMatches,
  addUpcomingMatch,
  deleteUpcomingMatch,
  matchupOdds,
} from "./data";

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
function fmtMl(ml: number): string {
  return ml > 0 ? `+${ml}` : `${ml}`;
}

export default function Scoreboard({ players }: { players: Player[] }) {
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingMatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [showAdd, setShowAdd] = useState(false);
  const [aId, setAId] = useState("");
  const [bId, setBId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([getMatchHistory(), getUpcomingMatches()])
      .then(([m, u]) => {
        setMatches(m);
        setUpcoming(u);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  const nameOf = (id: string) =>
    players.find((p) => p.id === id)?.name ?? "Unknown";
  const eloOf = (id: string) =>
    players.find((p) => p.id === id)?.elo ?? 1500;
  const recent = [...matches].reverse();

  async function reloadUpcoming() {
    try {
      setUpcoming(await getUpcomingMatches());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const a = players.find((p) => p.id === aId);
  const b = players.find((p) => p.id === bId);
  const ready = Boolean(a && b && a.id !== b.id);
  const previewOdds = useMemo(
    () => (ready ? matchupOdds(a!.elo, b!.elo) : null),
    [ready, a?.elo, b?.elo],
  );

  const upcomingWithOdds = useMemo(
    () =>
      upcoming.map((u) => ({
        ...u,
        odds: matchupOdds(eloOf(u.playerA), eloOf(u.playerB)),
      })),
    [upcoming, players],
  );

  async function handleAdd() {
    if (!ready) return;
    setSaving(true);
    try {
      await addUpcomingMatch(a!.id, b!.id);
      setAId("");
      setBId("");
      setShowAdd(false);
      await reloadUpcoming();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: string) {
    try {
      await deleteUpcomingMatch(id);
      await reloadUpcoming();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  if (loading) {
    return (
      <section className="pp-card">
        <p className="pp-muted">Loading…</p>
      </section>
    );
  }
  if (error) {
    return (
      <section className="pp-card pp-error">
        <p className="pp-error-title">Couldn't load the scoreboard</p>
        <p className="pp-muted">{error}</p>
      </section>
    );
  }

  return (
    <div>
      <div className="pp-section-row">
        <p className="pp-section-label">Upcoming</p>
        <button className="pp-add-btn" onClick={() => setShowAdd((v) => !v)}>
          {showAdd ? "Close" : "+ Add"}
        </button>
      </div>

      {showAdd && (
        <section className="pp-card pp-form">
          <div className="pp-matchup">
            <div className="pp-side">
              <label className="pp-label">Player A</label>
              <select
                className="pp-select"
                value={aId}
                onChange={(e) => setAId(e.target.value)}
              >
                <option value="">Pick a player</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id} disabled={p.id === bId}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <span className="pp-vs">vs</span>
            <div className="pp-side">
              <label className="pp-label">Player B</label>
              <select
                className="pp-select"
                value={bId}
                onChange={(e) => setBId(e.target.value)}
              >
                <option value="">Pick a player</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id} disabled={p.id === aId}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {previewOdds && a && b && (
            <div className="pp-odds">
              <div className="pp-odds-line">
                <span>{a.name}</span>
                <span className="pp-pct">{previewOdds.aWinPct}%</span>
                <span className="pp-ml">{fmtMl(previewOdds.aMoneyline)}</span>
              </div>
              <div className="pp-odds-line">
                <span>{b.name}</span>
                <span className="pp-pct">{previewOdds.bWinPct}%</span>
                <span className="pp-ml">{fmtMl(previewOdds.bMoneyline)}</span>
              </div>
              <p className="pp-spread">
                Spread: {a.name} {previewOdds.aSpread > 0 ? "+" : ""}
                {previewOdds.aSpread}
              </p>
            </div>
          )}

          <button
            className="pp-btn-primary"
            disabled={!ready || saving}
            onClick={handleAdd}
          >
            {saving ? "Adding…" : "Add to upcoming"}
          </button>
        </section>
      )}

      {upcomingWithOdds.length === 0 && !showAdd && (
        <section className="pp-card">
          <p className="pp-muted">
            Nothing scheduled. Add a matchup to see its odds.
          </p>
        </section>
      )}

      {upcomingWithOdds.length > 0 && (
        <div className="pp-matches">
          {upcomingWithOdds.map((u) => (
            <div key={u.id} className="pp-up-card">
              <div className="pp-up-top">
                <span className="pp-up-name">{nameOf(u.playerA)}</span>
                <span className="pp-vs-mini">vs</span>
                <span className="pp-up-name pp-right">{nameOf(u.playerB)}</span>
              </div>
              <div className="pp-up-odds">
                <span>
                  {u.odds.aWinPct}% · {fmtMl(u.odds.aMoneyline)}
                </span>
                <span className="pp-right">
                  {fmtMl(u.odds.bMoneyline)} · {u.odds.bWinPct}%
                </span>
              </div>
              <div className="pp-up-foot">
                <span className="pp-up-spread">
                  Spread: {nameOf(u.playerA)} {u.odds.aSpread > 0 ? "+" : ""}
                  {u.odds.aSpread}
                </span>
                <span className="pp-up-actions">
                  <Link
                    className="pp-up-play"
                    to={`/log?a=${u.playerA}&b=${u.playerB}&upcoming=${u.id}`}
                  >
                    Play
                  </Link>
                  <button className="pp-up-remove" onClick={() => handleRemove(u.id)}>
                    Remove
                  </button>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="pp-section-label pp-section-gap">Recent games</p>
      {recent.length === 0 ? (
        <section className="pp-card">
          <p className="pp-muted">No matches yet. Log one and it shows up here.</p>
        </section>
      ) : (
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
      )}
    </div>
  );
}