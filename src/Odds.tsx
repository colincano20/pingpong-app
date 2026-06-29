// Odds.tsx
// Preview the line for an upcoming match. Pick two players and the engine
// produces win percentages, moneylines, and the point spread off their current
// ratings. Nothing is written to the database; this is a read-only what-if.
import { useMemo, useState } from "react";
import type { Player } from "./data";
import { matchupOdds } from "./data";

export default function Odds({ players }: { players: Player[] }) {
  const [aId, setAId] = useState("");
  const [bId, setBId] = useState("");

  const a = players.find((p) => p.id === aId);
  const b = players.find((p) => p.id === bId);
  const ready = Boolean(a && b && a.id !== b.id);

  const odds = useMemo(
    () => (ready ? matchupOdds(a!.elo, b!.elo) : null),
    [ready, a?.elo, b?.elo],
  );

  return (
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

      {ready && odds && (
        <div className="pp-odds">
          <div className="pp-odds-line">
            <span>{a!.name}</span>
            <span className="pp-pct">{odds.aWinPct}%</span>
            <span className="pp-ml">
              {odds.aMoneyline > 0 ? `+${odds.aMoneyline}` : odds.aMoneyline}
            </span>
          </div>
          <div className="pp-odds-line">
            <span>{b!.name}</span>
            <span className="pp-pct">{odds.bWinPct}%</span>
            <span className="pp-ml">
              {odds.bMoneyline > 0 ? `+${odds.bMoneyline}` : odds.bMoneyline}
            </span>
          </div>
          <p className="pp-spread">
            Spread: {a!.name} {odds.aSpread > 0 ? "+" : ""}
            {odds.aSpread}
          </p>
        </div>
      )}

      {!ready && (
        <p className="pp-muted">
          {players.length === 0
            ? "No players loaded yet."
            : "Pick two different players to see the line."}
        </p>
      )}
    </section>
  );
}
