// Stats.tsx
// A sortable stats table (tap a column header to sort, tap again to flip), with
// the biggest blowout and rivalry records below it. The table merges the
// standings view with each player's current streak.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Player, MatchRow, StandingsRow } from "./data";
import { getStandings, getMatchHistory } from "./data";
import { streakFor, biggestBlowout, rivalries } from "./statsmath";

type SortKey =
  | "name"
  | "elo"
  | "wins"
  | "losses"
  | "winPct"
  | "streak"
  | "pointMargin"
  | "played";

type StatRow = {
  id: string;
  name: string;
  elo: number;
  wins: number;
  losses: number;
  winPct: number | null;
  streak: number;
  pointMargin: number;
  played: number;
};

const COLS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Player" },
  { key: "elo", label: "Elo" },
  { key: "wins", label: "W" },
  { key: "losses", label: "L" },
  { key: "winPct", label: "Win%" },
  { key: "streak", label: "Strk" },
  { key: "pointMargin", label: "+/-" },
  { key: "played", label: "GP" },
];

function fmtStreak(s: number): string {
  return s > 0 ? `W${s}` : s < 0 ? `L${-s}` : "—";
}

export default function Stats({ players }: { players: Player[] }) {
  const [standings, setStandings] = useState<StandingsRow[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "elo",
    dir: "desc",
  });

  useEffect(() => {
    Promise.all([getStandings(), getMatchHistory()])
      .then(([s, m]) => {
        setStandings(s);
        setMatches(m);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  const rows: StatRow[] = useMemo(
    () =>
      standings.map((s) => ({
        id: s.id,
        name: s.name,
        elo: s.elo,
        wins: s.wins,
        losses: s.losses,
        winPct: s.matchesPlayed > 0 ? s.wins / s.matchesPlayed : null,
        streak: streakFor(matches, s.id),
        pointMargin: s.pointMargin,
        played: s.matchesPlayed,
      })),
    [standings, matches],
  );

  const sorted = useMemo(() => {
    const { key, dir } = sort;
    const out = [...rows];
    out.sort((a, b) => {
      let cmp: number;
      if (key === "name") {
        cmp = a.name.localeCompare(b.name);
      } else {
        const av = a[key] ?? -Infinity;
        const bv = b[key] ?? -Infinity;
        cmp = av - bv;
      }
      return dir === "asc" ? cmp : -cmp;
    });
    return out;
  }, [rows, sort]);

  function clickSort(key: SortKey) {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "name" ? "asc" : "desc" },
    );
  }

  const blowout = useMemo(() => biggestBlowout(matches, players), [matches, players]);
  const rivs = useMemo(() => rivalries(matches, players), [matches, players]);

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
  if (rows.length === 0) {
    return (
      <section className="pp-card">
        <p className="pp-muted">No players yet.</p>
      </section>
    );
  }

  return (
    <div>
      <div className="pp-table-wrap">
        <table className="pp-table">
          <thead>
            <tr>
              {COLS.map((c) => (
                <th
                  key={c.key}
                  className={sort.key === c.key ? "pp-th-active" : undefined}
                  onClick={() => clickSort(c.key)}
                >
                  {c.label}
                  {sort.key === c.key ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link className="pp-name-link" to={`/player/${r.id}`}>
                    {r.name}
                  </Link>
                </td>
                <td>{Math.round(r.elo)}</td>
                <td>{r.wins}</td>
                <td>{r.losses}</td>
                <td>{r.winPct === null ? "—" : `${Math.round(r.winPct * 100)}%`}</td>
                <td className={r.streak > 0 ? "pp-up" : r.streak < 0 ? "pp-down" : undefined}>
                  {fmtStreak(r.streak)}
                </td>
                <td>{r.pointMargin > 0 ? `+${r.pointMargin}` : r.pointMargin}</td>
                <td>{r.played}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pp-stat-card pp-stat-wide pp-section-gap">
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

      {rivs.length > 0 && (
        <>
          <p className="pp-section-label pp-section-gap">Rivalries</p>
          <section className="pp-card">
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
          </section>
        </>
      )}
    </div>
  );
}