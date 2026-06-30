// LogMatch.tsx
// Record a completed match. Pick two players and which side A is on, enter the
// games one at a time (to 11, win by 2), watch the live odds shift after each
// game, then save. Saving runs the whole Elo update through data.recordMatch.
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { Player, GameScore } from "./data";
import { recordMatch, matchupOdds, deleteUpcomingMatch } from "./data";
import { gameProbFromElo, liveMatchProb, toAmericanOdds, liveExpectedMargin } from "./engine";

type Props = {
  players: Player[];
  onSaved: () => void;
};

type SaveResult = Awaited<ReturnType<typeof recordMatch>>;
const SIDES = ["Left", "Right"] as const;

export default function LogMatch({ players, onSaved }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [aId, setAId] = useState(() => searchParams.get("a") ?? "");
  const [bId, setBId] = useState(() => searchParams.get("b") ?? "");
  const [upcomingId, setUpcomingId] = useState<string | null>(() =>
    searchParams.get("upcoming"),
  );
  const [aSide, setASide] = useState<(typeof SIDES)[number]>("Left");
  const [games, setGames] = useState<GameScore[]>([]);
  const [aPts, setAPts] = useState("");
  const [bPts, setBPts] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [result, setResult] = useState<SaveResult | null>(null);

  // Clear the prefill params from the URL once read, so a refresh doesn't
  // re-trigger the prefill or re-delete the upcoming match.
  useEffect(() => {
    if (searchParams.get("a") || searchParams.get("b") || searchParams.get("upcoming")) {
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const a = players.find((p) => p.id === aId);
  const b = players.find((p) => p.id === bId);
  const ready = Boolean(a && b && a.id !== b.id);

  // Pre-match odds and per-game probability, recomputed only when the matchup
  // changes (the spread runs a Monte Carlo, so we don't want it every render).
  const odds = useMemo(
    () => (ready ? matchupOdds(a!.elo, b!.elo) : null),
    [ready, a?.elo, b?.elo],
  );
  const gameProb = useMemo(
    () => (ready ? gameProbFromElo(a!.elo, b!.elo) : 0.5),
    [ready, a?.elo, b?.elo],
  );

  const gamesWonA = games.filter((g) => g.aPoints > g.bPoints).length;
  const gamesWonB = games.length - gamesWonA;
  const complete = gamesWonA === 3 || gamesWonB === 3;
  const liveProbA = liveMatchProb(gameProb, gamesWonA, gamesWonB);

  // Once games are in, the odds go live off the current score. The live spread
  // is the points already banked plus the expected margin of the games left.
  const inMatch = games.length > 0;
  const bankedMargin = games.reduce((acc, g) => acc + g.aPoints - g.bPoints, 0);
  const liveRemaining = useMemo(
    () =>
      ready && inMatch ? liveExpectedMargin(a!.elo, b!.elo, gamesWonA, gamesWonB) : 0,
    [ready, inMatch, a?.elo, b?.elo, gamesWonA, gamesWonB],
  );
  const liveSpreadLine = -Math.round((bankedMargin + liveRemaining) * 2) / 2;

  function addGame() {
    setInputError(null);
    const x = Number(aPts);
    const y = Number(bPts);
    if (aPts === "" || bPts === "" || !Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0) {
      setInputError("Enter both scores as whole numbers.");
      return;
    }
    if (x === y) {
      setInputError("A game can't end in a tie.");
      return;
    }
    if (Math.max(x, y) < 11 || Math.abs(x - y) < 2) {
      setInputError("A game goes to 11 and has to be won by 2.");
      return;
    }
    setGames([...games, { aPoints: x, bPoints: y }]);
    setAPts("");
    setBPts("");
  }

  function undoLastGame() {
    setGames(games.slice(0, -1));
  }

  async function save() {
    if (!ready) return;
    setSaving(true);
    setSaveError(null);
    try {
      const r = await recordMatch({
        playerAId: a!.id,
        playerBId: b!.id,
        aSide,
        games,
      });
      setResult(r);
      onSaved();
      if (upcomingId) {
        try {
          await deleteUpcomingMatch(upcomingId);
        } catch {
          // not fatal; the match is already recorded
        }
        setUpcomingId(null);
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setAId("");
    setBId("");
    setASide("Left");
    setGames([]);
    setAPts("");
    setBPts("");
    setInputError(null);
    setSaveError(null);
    setResult(null);
    setUpcomingId(null);
  }

  // ---- Saved confirmation ----
  if (result) {
    const names = Object.keys(result.eloChange);
    return (
      <section className="pp-card pp-result">
        <p className="pp-result-head">
          {result.winner} wins {result.score}
        </p>
        <ul className="pp-delta-list">
          {names.map((name) => {
            const c = result.eloChange[name];
            const up = c.delta >= 0;
            return (
              <li key={name} className="pp-delta-row">
                <span className="pp-name">{name}</span>
                <span className="pp-muted">{c.before} →</span>
                <span className="pp-elo">{c.after}</span>
                <span className={up ? "pp-up" : "pp-down"}>
                  {up ? "+" : ""}
                  {c.delta}
                </span>
              </li>
            );
          })}
        </ul>
        <button className="pp-btn pp-btn-primary" onClick={reset}>
          Log another match
        </button>
      </section>
    );
  }

  // ---- The form ----
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
          <div className="pp-toggle">
            {SIDES.map((s) => (
              <button
                key={s}
                type="button"
                className={s === aSide ? "pp-toggle-btn pp-toggle-on" : "pp-toggle-btn"}
                onClick={() => setASide(s)}
              >
                {s}
              </button>
            ))}
          </div>
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
            <span className="pp-pct">
              {inMatch ? `${Math.round(liveProbA * 100)}%` : `${odds.aWinPct}%`}
            </span>
            <span className="pp-ml">
              {inMatch ? fmtLiveMl(liveProbA) : fmtMoneyline(odds.aMoneyline)}
            </span>
          </div>
          <div className="pp-odds-line">
            <span>{b!.name}</span>
            <span className="pp-pct">
              {inMatch ? `${Math.round((1 - liveProbA) * 100)}%` : `${odds.bWinPct}%`}
            </span>
            <span className="pp-ml">
              {inMatch ? fmtLiveMl(1 - liveProbA) : fmtMoneyline(odds.bMoneyline)}
            </span>
          </div>
          <p className="pp-spread">
            Spread: {a!.name}{" "}
            {(inMatch ? liveSpreadLine : odds.aSpread) > 0 ? "+" : ""}
            {inMatch ? liveSpreadLine : odds.aSpread}
            {inMatch && <span className="pp-live-tag"> · live</span>}
          </p>
        </div>
      )}

      {ready && (
        <>
          <div className="pp-tally">
            <span>{a!.name} {gamesWonA}</span>
            <span className="pp-muted">games</span>
            <span>{gamesWonB} {b!.name}</span>
          </div>

          {games.length > 0 && (
            <ol className="pp-games">
              {games.map((g, i) => (
                <li key={i} className="pp-game">
                  <span className="pp-muted">Game {i + 1}</span>
                  <span className={g.aPoints > g.bPoints ? "pp-win" : ""}>{g.aPoints}</span>
                  <span className="pp-muted">–</span>
                  <span className={g.bPoints > g.aPoints ? "pp-win" : ""}>{g.bPoints}</span>
                </li>
              ))}
            </ol>
          )}

          {!complete ? (
            <div className="pp-add">
              <input
                className="pp-num"
                type="number"
                min={0}
                inputMode="numeric"
                placeholder={a!.name}
                value={aPts}
                onChange={(e) => setAPts(e.target.value)}
              />
              <input
                className="pp-num"
                type="number"
                min={0}
                inputMode="numeric"
                placeholder={b!.name}
                value={bPts}
                onChange={(e) => setBPts(e.target.value)}
              />
              <button className="pp-btn" type="button" onClick={addGame}>
                Add game
              </button>
            </div>
          ) : (
            <button
              className="pp-btn pp-btn-primary"
              type="button"
              disabled={saving}
              onClick={save}
            >
              {saving ? "Saving…" : `Save match ${gamesWonA}-${gamesWonB}`}
            </button>
          )}

          {games.length > 0 && (
            <button className="pp-link" type="button" onClick={undoLastGame}>
              Undo last game
            </button>
          )}

          {inputError && <p className="pp-inline-error">{inputError}</p>}
          {saveError && <p className="pp-inline-error">{saveError}</p>}
        </>
      )}

      {!ready && a && b && a.id === b.id && (
        <p className="pp-muted">Pick two different players.</p>
      )}
    </section>
  );
}

function fmtLiveMl(p: number): string {
  if (p <= 0 || p >= 1) return "—";
  return fmtMoneyline(toAmericanOdds(p));
}

function fmtMoneyline(ml: number): string {
  return ml > 0 ? `+${ml}` : `${ml}`;
}