// stats.ts
// Pure stat computations for the flavor stats screen. No database, no React,
// just match data in and display-ready numbers out, so each function can be
// unit tested on its own. Match lists are expected in chronological order.
import type { Player, MatchRow } from "./data";

function nameOf(players: Player[], id: string): string {
  return players.find((p) => p.id === id)?.name ?? "Unknown";
}

// A player's current streak as a signed number: positive for a win streak,
// negative for a losing streak, 0 if they have never played. It's the trailing
// run of same results from their most recent match backward.
export function streakFor(matches: MatchRow[], playerId: string): number {
  const theirs = matches.filter(
    (m) => m.playerA === playerId || m.playerB === playerId,
  );
  let streak = 0;
  for (let i = theirs.length - 1; i >= 0; i--) {
    const won = theirs[i].winner === playerId;
    if (streak === 0) {
      streak = won ? 1 : -1;
    } else if (won === streak > 0) {
      streak += won ? 1 : -1;
    } else {
      break;
    }
  }
  return streak;
}

export type StreakLeader = { name: string; streak: number };

// The player on the longest active win streak (null if nobody is on one).
export function hottestStreak(
  matches: MatchRow[],
  players: Player[],
): StreakLeader | null {
  let best: StreakLeader | null = null;
  for (const p of players) {
    const s = streakFor(matches, p.id);
    if (s > 0 && (!best || s > best.streak)) best = { name: p.name, streak: s };
  }
  return best;
}

// The player on the longest active losing streak (null if nobody is on one).
export function coldestStreak(
  matches: MatchRow[],
  players: Player[],
): StreakLeader | null {
  let worst: StreakLeader | null = null;
  for (const p of players) {
    const s = streakFor(matches, p.id);
    if (s < 0 && (!worst || s < worst.streak))
      worst = { name: p.name, streak: s };
  }
  return worst;
}

export type Rivalry = {
  aName: string;
  bName: string;
  aWins: number;
  bWins: number;
};

// Head-to-head record for every pair that has played, most-played first.
export function rivalries(matches: MatchRow[], players: Player[]): Rivalry[] {
  const map = new Map<string, { a: string; b: string; aWins: number; bWins: number }>();
  for (const m of matches) {
    const [lo, hi] = [m.playerA, m.playerB].sort();
    const key = `${lo}|${hi}`;
    let r = map.get(key);
    if (!r) {
      r = { a: lo, b: hi, aWins: 0, bWins: 0 };
      map.set(key, r);
    }
    if (m.winner === r.a) r.aWins++;
    else r.bWins++;
  }
  return [...map.values()]
    .map((r) => ({
      aName: nameOf(players, r.a),
      bName: nameOf(players, r.b),
      aWins: r.aWins,
      bWins: r.bWins,
    }))
    .sort((x, y) => y.aWins + y.bWins - (x.aWins + x.bWins));
}

export type Blowout = {
  winner: string;
  loser: string;
  score: string;
  margin: number;
};

// The match with the largest total point margin.
export function biggestBlowout(
  matches: MatchRow[],
  players: Player[],
): Blowout | null {
  let best: MatchRow | null = null;
  for (const m of matches) {
    if (!best || Math.abs(m.aPointMargin) > Math.abs(best.aPointMargin)) best = m;
  }
  if (!best) return null;
  const winnerIsA = best.winner === best.playerA;
  const winnerGames = winnerIsA ? best.aGames : best.bGames;
  const loserGames = winnerIsA ? best.bGames : best.aGames;
  const loserId = winnerIsA ? best.playerB : best.playerA;
  return {
    winner: nameOf(players, best.winner),
    loser: nameOf(players, loserId),
    score: `${winnerGames}-${loserGames}`,
    margin: Math.abs(best.aPointMargin),
  };
}
// Last N results for a player, oldest-first. true = win, false = loss.
export function recentForm(matches: MatchRow[], playerId: string, n = 5): boolean[] {
  return matches
    .filter((m) => m.playerA === playerId || m.playerB === playerId)
    .slice(-n)
    .map((m) => m.winner === playerId);
}

export type PlayerRecord = { wins: number; losses: number; played: number };

// A single player's overall win-loss record.
export function playerRecord(matches: MatchRow[], playerId: string): PlayerRecord {
  let wins = 0;
  let losses = 0;
  for (const m of matches) {
    if (m.playerA !== playerId && m.playerB !== playerId) continue;
    if (m.winner === playerId) wins++;
    else losses++;
  }
  return { wins, losses, played: wins + losses };
}

export type H2H = {
  opponentId: string;
  opponentName: string;
  wins: number;
  losses: number;
};

// One player's head-to-head record against each opponent, most-played first.
export function headToHead(
  matches: MatchRow[],
  players: Player[],
  playerId: string,
): H2H[] {
  const map = new Map<string, { wins: number; losses: number }>();
  for (const m of matches) {
    if (m.playerA !== playerId && m.playerB !== playerId) continue;
    const opp = m.playerA === playerId ? m.playerB : m.playerA;
    let r = map.get(opp);
    if (!r) {
      r = { wins: 0, losses: 0 };
      map.set(opp, r);
    }
    if (m.winner === playerId) r.wins++;
    else r.losses++;
  }
  return [...map.entries()]
    .map(([opp, r]) => ({
      opponentId: opp,
      opponentName: nameOf(players, opp),
      wins: r.wins,
      losses: r.losses,
    }))
    .sort((x, y) => y.wins + y.losses - (x.wins + x.losses));
}