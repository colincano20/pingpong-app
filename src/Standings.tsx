// Standings.tsx
// League roster ranked by Elo, with each player's record. Also where you manage
// players: add a new one, or rename an existing one with the pencil. Changes
// call back up to App so the new/renamed player shows everywhere immediately.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getStandings, getMatchHistory, addPlayer, renamePlayer, type StandingsRow, type MatchRow } from "./data";
import { recentForm } from "./statsmath";

function PlayerRow({
  rank,
  row,
  form,
  onSaved,
}: {
  rank: number;
  row: StandingsRow;
  form: boolean[];
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(row.name);
  const [busy, setBusy] = useState(false);

  const pct =
    row.matchesPlayed > 0 ? Math.round((row.wins / row.matchesPlayed) * 100) : null;

  async function save() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === row.name) {
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      await renamePlayer(row.id, trimmed);
      setEditing(false);
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <li className="pp-row">
        <span className="pp-rank">{rank}</span>
        <input
          className="pp-inline-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <button className="pp-row-save" onClick={save} disabled={busy}>
          {busy ? "…" : "Save"}
        </button>
      </li>
    );
  }

  return (
    <li className="pp-row">
      <span className="pp-rank">{rank}</span>
      <div className="pp-name-block">
        <Link className="pp-name pp-name-link" to={`/player/${row.id}`}>
          {row.name}
        </Link>
        <span className="pp-record">
          {row.wins}-{row.losses}
          {pct !== null ? ` · ${pct}%` : ""}
        </span>
        {form.length > 0 && (
          <span className="pp-recent-form">
            {form.map((won, i) => (
              <span key={i} className={won ? "pp-form-dot pp-form-w" : "pp-form-dot pp-form-l"} />
            ))}
          </span>
        )}
      </div>
      <button
        className="pp-edit-btn"
        onClick={() => {
          setName(row.name);
          setEditing(true);
        }}
        aria-label={`Rename ${row.name}`}
      >
        ✎
      </button>
      <span className="pp-elo">{Math.round(row.elo)}</span>
    </li>
  );
}

export default function Standings({
  onPlayersChanged,
}: {
  onPlayersChanged: () => void;
}) {
  const [rows, setRows] = useState<StandingsRow[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  async function load() {
    try {
      const [s, m] = await Promise.all([getStandings(), getMatchHistory()]);
      setRows(s);
      setMatches(m);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setAdding(true);
    setAddError(null);
    try {
      await addPlayer(trimmed);
      setNewName("");
      setShowAdd(false);
      await load();
      onPlayersChanged();
    } catch (e) {
      setAddError(e instanceof Error ? e.message : String(e));
    } finally {
      setAdding(false);
    }
  }

  async function handleRenamed() {
    await load();
    onPlayersChanged();
  }

  return (
    <div>
      <div className="pp-section-row">
        <p className="pp-section-label">Players</p>
        <button className="pp-add-btn" onClick={() => setShowAdd((v) => !v)}>
          {showAdd ? "Close" : "+ Add"}
        </button>
      </div>

      {showAdd && (
        <section className="pp-card pp-add-player">
          <input
            className="pp-inline-input"
            placeholder="Player name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
          />
          <button
            className="pp-row-save"
            onClick={handleAdd}
            disabled={!newName.trim() || adding}
          >
            {adding ? "…" : "Add"}
          </button>
        </section>
      )}
      {addError && <p className="pp-inline-error">{addError}</p>}

      {loading && (
        <section className="pp-card">
          <p className="pp-muted">Loading the league…</p>
        </section>
      )}
      {error && (
        <section className="pp-card pp-error">
          <p className="pp-error-title">Couldn't load standings</p>
          <p className="pp-muted">{error}</p>
        </section>
      )}
      {!loading && !error && rows.length === 0 && (
        <section className="pp-card">
          <p className="pp-muted">No players yet. Add one above.</p>
        </section>
      )}
      {!loading && !error && rows.length > 0 && (
        <section className="pp-card">
          <ol className="pp-list">
            {rows.map((r, i) => (
              <PlayerRow key={r.id} rank={i + 1} row={r} form={recentForm(matches, r.id)} onSaved={handleRenamed} />
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}