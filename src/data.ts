// data.ts
// The bridge between the engine and the database. Everything that reads from
// or writes to Supabase lives here, so the rest of the app never touches SQL
// directly. The engine stays pure; this file is where it meets real data.
// (Imports are extensionless, which is what Vite expects.)
import { supabase } from "./supabaseClient";
import {
  updateElo,
  matchWinProb,
  toAmericanOdds,
  estimateSpread,
} from "./engine";

export type GameScore = { aPoints: number; bPoints: number };
export type Player = { id: string; name: string; elo: number; userId: string | null };

// ----------------------------------------------------------------------------
// Pure helper (no database): work out the result of a match from its games.
// Kept exported so it can be unit tested on its own.
// ----------------------------------------------------------------------------
export function computeOutcome(games: GameScore[]) {
  let aGames = 0;
  let bGames = 0;
  let aPoints = 0;
  let bPoints = 0;
  for (const g of games) {
    aPoints += g.aPoints;
    bPoints += g.bPoints;
    if (g.aPoints > g.bPoints) aGames++;
    else bGames++;
  }
  return {
    aGames,
    bGames,
    winnerIsA: aGames > bGames,
    aPointMargin: aPoints - bPoints,
    totalMarginAbs: Math.abs(aPoints - bPoints),
  };
}

// ----------------------------------------------------------------------------
// Reads
// ----------------------------------------------------------------------------
export async function getPlayers(): Promise<Player[]> {
  const { data, error } = await supabase
    .from("players")
    .select("id, name, elo, user_id")
    .order("elo", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    elo: Number(r.elo),
    userId: (r.user_id as string | null) ?? null,
  }));
}

export type StandingsRow = {
  id: string;
  name: string;
  elo: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  pointMargin: number;
};

export async function getStandings(): Promise<StandingsRow[]> {
  const { data, error } = await supabase
    .from("standings")
    .select("*")
    .order("elo", { ascending: false });
  if (error) throw error;
  // Postgres count/numeric can arrive as strings, so coerce to clean numbers.
  return (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    elo: Number(r.elo),
    matchesPlayed: Number(r.matches_played),
    wins: Number(r.wins),
    losses: Number(r.losses),
    pointMargin: Number(r.total_point_margin),
  }));
}

export type MatchRow = {
  matchId: string;
  playedAt: string;
  playerA: string;
  playerB: string;
  aGames: number;
  bGames: number;
  aPointMargin: number;
  winner: string;
};

// Full match history in chronological order, used by the stats screen.
export async function getMatchHistory(): Promise<MatchRow[]> {
  const { data, error } = await supabase
    .from("match_results")
    .select("match_id, played_at, player_a, player_b, a_games, b_games, a_point_margin, winner")
    .order("played_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((m) => ({
    matchId: m.match_id as string,
    playedAt: m.played_at as string,
    playerA: m.player_a as string,
    playerB: m.player_b as string,
    aGames: Number(m.a_games),
    bGames: Number(m.b_games),
    aPointMargin: Number(m.a_point_margin),
    winner: m.winner as string,
  }));
}

// ----------------------------------------------------------------------------
// Odds for an UPCOMING match. Pure compute off the two current ratings, so it
// needs no database write. This is what powers your "preview the matchup" view.
// ----------------------------------------------------------------------------
export function matchupOdds(eloA: number, eloB: number) {
  const pA = matchWinProb(eloA, eloB);
  const spread = estimateSpread(eloA, eloB);
  return {
    aWinPct: Math.round(pA * 1000) / 10,
    bWinPct: Math.round((1 - pA) * 1000) / 10,
    aMoneyline: toAmericanOdds(pA),
    bMoneyline: toAmericanOdds(1 - pA),
    aSpread: spread.line, // A favoured -> negative number
  };
}

// ----------------------------------------------------------------------------
// The main write: record a COMPLETED match. This is the whole loop in one call.
//   1. read both players' current Elo
//   2. work out who won and by how much
//   3. compute new ratings with the engine
//   4. insert the match, then its games
//   5. update both players' Elo
//   6. append two rating_history rows for the charts
//
// Note: this reads then writes Elo without a transaction, so if two matches
// were finalised at the exact same instant they could race on a shared player.
// For a friend group logging one match at a time that never happens; tightening
// it into a Postgres function is a clean v2 task if you ever need it.
// ----------------------------------------------------------------------------
export async function recordMatch(input: {
  playerAId: string;
  playerBId: string;
  aSide?: string;
  games: GameScore[];
}) {
  const { data: players, error: pErr } = await supabase
    .from("players")
    .select("id, name, elo")
    .in("id", [input.playerAId, input.playerBId]);
  if (pErr) throw pErr;
  const a = players?.find((p) => p.id === input.playerAId);
  const b = players?.find((p) => p.id === input.playerBId);
  if (!a || !b) throw new Error("Could not find both players");

  const o = computeOutcome(input.games);

  const winnerElo = o.winnerIsA ? a.elo : b.elo;
  const loserElo = o.winnerIsA ? b.elo : a.elo;
  const updated = updateElo(winnerElo, loserElo, o.totalMarginAbs);
  const aNew = o.winnerIsA ? updated.winner : updated.loser;
  const bNew = o.winnerIsA ? updated.loser : updated.winner;

  const { data: match, error: mErr } = await supabase
    .from("matches")
    .insert({ player_a: a.id, player_b: b.id, a_side: input.aSide ?? null })
    .select("id")
    .single();
  if (mErr) throw mErr;

  const gameRows = input.games.map((g, i) => ({
    match_id: match.id,
    game_number: i + 1,
    a_points: g.aPoints,
    b_points: g.bPoints,
  }));
  const { error: gErr } = await supabase.from("games").insert(gameRows);
  if (gErr) throw gErr;

  const { error: uaErr } = await supabase
    .from("players").update({ elo: aNew }).eq("id", a.id);
  if (uaErr) throw uaErr;
  const { error: ubErr } = await supabase
    .from("players").update({ elo: bNew }).eq("id", b.id);
  if (ubErr) throw ubErr;

  const { error: hErr } = await supabase.from("rating_history").insert([
    { player_id: a.id, match_id: match.id, elo_before: a.elo, elo_after: aNew },
    { player_id: b.id, match_id: match.id, elo_before: b.elo, elo_after: bNew },
  ]);
  if (hErr) throw hErr;

  const eloChange: Record<string, { before: number; after: number; delta: number }> = {
    [a.name]: { before: Math.round(a.elo), after: Math.round(aNew), delta: Math.round((aNew - a.elo) * 10) / 10 },
    [b.name]: { before: Math.round(b.elo), after: Math.round(bNew), delta: Math.round((bNew - b.elo) * 10) / 10 },
  };

  return {
    matchId: match.id,
    winner: o.winnerIsA ? a.name : b.name,
    score: `${o.aGames}-${o.bGames}`,
    eloChange,
  };
}
export type GameRow = { gameNumber: number; aPoints: number; bPoints: number };

export type MatchDetailData = {
  matchId: string;
  playedAt: string;
  playerA: string;
  playerB: string;
  aSide: string | null;
  aGames: number;
  bGames: number;
  winner: string;
  games: GameRow[];
};

// Everything needed for one match's box score: the meta plus every game's score.
export async function getMatchDetail(matchId: string): Promise<MatchDetailData> {
  const [{ data: meta, error: metaErr }, { data: gameRows, error: gamesErr }] =
    await Promise.all([
      supabase
        .from("match_results")
        .select("match_id, played_at, player_a, player_b, a_side, a_games, b_games, winner")
        .eq("match_id", matchId)
        .single(),
      supabase
        .from("games")
        .select("game_number, a_points, b_points")
        .eq("match_id", matchId)
        .order("game_number", { ascending: true }),
    ]);
  if (metaErr) throw metaErr;
  if (gamesErr) throw gamesErr;
  return {
    matchId: meta.match_id as string,
    playedAt: meta.played_at as string,
    playerA: meta.player_a as string,
    playerB: meta.player_b as string,
    aSide: (meta.a_side as string | null) ?? null,
    aGames: Number(meta.a_games),
    bGames: Number(meta.b_games),
    winner: meta.winner as string,
    games: (gameRows ?? []).map((g) => ({
      gameNumber: Number(g.game_number),
      aPoints: Number(g.a_points),
      bPoints: Number(g.b_points),
    })),
  };
}

export type UpcomingMatch = { id: string; playerA: string; playerB: string };

export async function getUpcomingMatches(): Promise<UpcomingMatch[]> {
  const { data, error } = await supabase
    .from("upcoming_matches")
    .select("id, player_a, player_b")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    playerA: r.player_a as string,
    playerB: r.player_b as string,
  }));
}

export async function addUpcomingMatch(playerAId: string, playerBId: string): Promise<void> {
  const { error } = await supabase
    .from("upcoming_matches")
    .insert({ player_a: playerAId, player_b: playerBId });
  if (error) throw error;
}

export async function deleteUpcomingMatch(id: string): Promise<void> {
  const { error } = await supabase.from("upcoming_matches").delete().eq("id", id);
  if (error) throw error;
}

export async function addPlayer(name: string): Promise<void> {
  const { error } = await supabase.from("players").insert({ name });
  if (error) throw error;
}

export async function claimPlayer(playerId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { error } = await supabase
    .from("players")
    .update({ user_id: user.id })
    .eq("id", playerId)
    .is("user_id", null); // only claim unclaimed profiles
  if (error) throw error;
}

export async function renamePlayer(id: string, name: string): Promise<void> {
  const { error } = await supabase.from("players").update({ name }).eq("id", id);
  if (error) throw error;
}

export type EloPoint = { eloBefore: number; eloAfter: number; playedAt: string };

export async function getRatingHistory(playerId: string): Promise<EloPoint[]> {
  const { data, error } = await supabase
    .from("rating_history")
    .select("elo_before, elo_after, matches(played_at)")
    .eq("player_id", playerId);
  if (error) throw error;
  const rows = (data ?? []) as unknown as Array<{
    elo_before: number;
    elo_after: number;
    matches: { played_at: string } | null;
  }>;
  return rows
    .filter((r) => r.matches !== null)
    .sort(
      (a, b) =>
        new Date(a.matches!.played_at).getTime() -
        new Date(b.matches!.played_at).getTime(),
    )
    .map((r) => ({
      eloBefore: Number(r.elo_before),
      eloAfter: Number(r.elo_after),
      playedAt: r.matches!.played_at,
    }));
}
