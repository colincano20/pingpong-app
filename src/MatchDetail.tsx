// MatchDetail.tsx
// Box score for a single match, opened from a scoreboard card. Reads the match
// id from the URL (/match/:id), so it deep-links and the back button works.
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { Player, MatchDetailData } from "./data";
import { getMatchDetail } from "./data";

export default function MatchDetail({ players }: { players: Player[] }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<MatchDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getMatchDetail(id)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [id]);

  const nameOf = (pid: string) =>
    players.find((p) => p.id === pid)?.name ?? "Unknown";

  let body;
  if (loading) {
    body = (
      <section className="pp-card">
        <p className="pp-muted">Loading box score…</p>
      </section>
    );
  } else if (error) {
    body = (
      <section className="pp-card pp-error">
        <p className="pp-error-title">Couldn't load match</p>
        <p className="pp-muted">{error}</p>
      </section>
    );
  } else if (data) {
    const aWon = data.winner === data.playerA;
    const aName = nameOf(data.playerA);
    const bName = nameOf(data.playerB);
    const aTotal = data.games.reduce((s, g) => s + g.aPoints, 0);
    const bTotal = data.games.reduce((s, g) => s + g.bPoints, 0);
    const dateStr = new Date(data.playedAt).toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    body = (
      <>
        <div className="pp-detail-banner">
          <Link
            to={`/player/${data.playerA}`}
            className={aWon ? "pp-detail-name pp-name-link pp-score-win" : "pp-detail-name pp-name-link"}
          >
            {aName}
          </Link>
          <span className="pp-detail-score">
            <b className={aWon ? "pp-score-win" : "pp-score-dim"}>{data.aGames}</b>
            <span className="pp-score-dash">–</span>
            <b className={!aWon ? "pp-score-win" : "pp-score-dim"}>{data.bGames}</b>
          </span>
          <Link
            to={`/player/${data.playerB}`}
            className={
              !aWon ? "pp-detail-name pp-right pp-name-link pp-score-win" : "pp-detail-name pp-right pp-name-link"
            }
          >
            {bName}
          </Link>
        </div>
        <p className="pp-detail-meta">
          {dateStr}
          {data.aSide ? ` · ${aName} on ${data.aSide}` : ""}
        </p>

        <section className="pp-card">
          <div className="pp-box-row pp-box-headrow">
            <span className="pp-box-label">Game</span>
            <span className="pp-box-cell">{aName}</span>
            <span className="pp-box-cell">{bName}</span>
          </div>
          {data.games.map((g) => {
            const aWinG = g.aPoints > g.bPoints;
            return (
              <div key={g.gameNumber} className="pp-box-row">
                <span className="pp-box-label">{g.gameNumber}</span>
                <span className={aWinG ? "pp-box-cell pp-score-win" : "pp-box-cell"}>
                  {g.aPoints}
                </span>
                <span className={!aWinG ? "pp-box-cell pp-score-win" : "pp-box-cell"}>
                  {g.bPoints}
                </span>
              </div>
            );
          })}
          <div className="pp-box-row pp-box-totalrow">
            <span className="pp-box-label">Points</span>
            <span className="pp-box-cell">{aTotal}</span>
            <span className="pp-box-cell">{bTotal}</span>
          </div>
        </section>
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