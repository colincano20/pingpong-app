// engine.ts
// Pure odds engine for the ping pong league.
// No UI, no database, just math. Every function here is deterministic
// (the Monte Carlo sim takes an injectable RNG), so you can unit test all
// of it in isolation. This is the file you own end to end.
//
// Vocabulary (official table tennis terms):
//   match = best of 5, first to 3 games
//   game  = first to 11 points, win by 2

// ----------------------------------------------------------------------------
// Tunable constants. These are the knobs. Defaults are sane; tune with data.
// ----------------------------------------------------------------------------
export const DEFAULT_ELO = 1500;
export const K_BASE = 32;          // base rating sensitivity per match
export const MARGIN_WEIGHT = 0.15; // how much total point margin amplifies a
                                   // rating change. Set to 0 to disable the
                                   // margin-of-victory effect entirely.

// ----------------------------------------------------------------------------
// Core Elo. Anchored at the MATCH level: this is P(A wins the whole match).
// The moneyline comes straight out of this number, so it is reliable from
// day one (no simulation needed for the moneyline).
// ----------------------------------------------------------------------------
export function matchWinProb(eloA: number, eloB: number): number {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

// Rating update after a completed match.
// totalMarginAbs = |total points A minus total points B| across all games.
// A blowout moves ratings more than a nail-biter. Zero-sum: the loser drops
// exactly what the winner gains.
export function updateElo(
  eloWinner: number,
  eloLoser: number,
  totalMarginAbs: number,
): { winner: number; loser: number } {
  const expectedWinner = matchWinProb(eloWinner, eloLoser);
  const marginFactor = 1 + MARGIN_WEIGHT * Math.log(totalMarginAbs + 1);
  const k = K_BASE * marginFactor;
  const delta = k * (1 - expectedWinner); // winner scored 1, expected was < 1
  return { winner: eloWinner + delta, loser: eloLoser - delta };
}

// ----------------------------------------------------------------------------
// Moneyline formatting. Probability in, sportsbook odds out.
// ----------------------------------------------------------------------------
export function toAmericanOdds(prob: number): number {
  // Favourites are negative, underdogs positive. e.g. 0.62 -> -163.
  if (prob >= 0.5) return Math.round((-100 * prob) / (1 - prob));
  return Math.round((100 * (1 - prob)) / prob);
}

export function toDecimalOdds(prob: number): number {
  return Math.round((1 / prob) * 100) / 100;
}

// ----------------------------------------------------------------------------
// Game level. Probability of winning ONE game (to 11, win by 2) given a
// per-point win probability q. Closed form, no simulation.
// ----------------------------------------------------------------------------
export function gameWinProb(q: number): number {
  let p = 0;
  // Win 11 to k, for k = 0..9 (opponent gets k points, you take the 11th).
  for (let k = 0; k <= 9; k++) {
    p += binom(10 + k, k) * Math.pow(q, 11) * Math.pow(1 - q, k);
  }
  // Or reach 10-10 (deuce), then win the win-by-2 endgame.
  const reachDeuce = binom(20, 10) * Math.pow(q, 10) * Math.pow(1 - q, 10);
  const winDeuce = (q * q) / (q * q + (1 - q) * (1 - q));
  p += reachDeuce * winDeuce;
  return p;
}

// Match win probability (first to 3) from a per-game win probability g.
export function matchWinProbFromGameProb(g: number): number {
  let p = 0;
  for (let j = 0; j <= 2; j++) {
    p += binom(2 + j, j) * Math.pow(g, 3) * Math.pow(1 - g, j); // win 3 to j
  }
  return p;
}

// ----------------------------------------------------------------------------
// Solve for the per-point probability q whose implied MATCH win probability
// equals a target (the target being Elo's match prob). Monotonic in q, so a
// binary search nails it. This q is what feeds the match simulator.
// ----------------------------------------------------------------------------
export function solvePointProb(targetMatchProb: number): number {
  let lo = 0.0001;
  let hi = 0.9999;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const m = matchWinProbFromGameProb(gameWinProb(mid));
    if (m < targetMatchProb) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// Convenience: per-game win prob for A straight from the two ratings.
// Used by the live in-match odds.
export function gameProbFromElo(eloA: number, eloB: number): number {
  return gameWinProb(solvePointProb(matchWinProb(eloA, eloB)));
}

// ----------------------------------------------------------------------------
// Match simulation. Plays out points -> games -> match with constant q, and
// reports the signed point margin (A minus B). v1 ignores serving alternation
// and the mid-game end switch; constant q is a fine first approximation.
// ----------------------------------------------------------------------------
export function simulateMatch(
  q: number,
  rng: () => number = Math.random,
): { winnerIsA: boolean; pointMarginA: number } {
  let gamesA = 0;
  let gamesB = 0;
  let pointsA = 0;
  let pointsB = 0;
  while (gamesA < 3 && gamesB < 3) {
    const g = simulateGame(q, rng);
    pointsA += g.a;
    pointsB += g.b;
    if (g.a > g.b) gamesA++;
    else gamesB++;
  }
  return { winnerIsA: gamesA > gamesB, pointMarginA: pointsA - pointsB };
}

function simulateGame(q: number, rng: () => number): { a: number; b: number } {
  let a = 0;
  let b = 0;
  while (true) {
    if (rng() < q) a++;
    else b++;
    if (a >= 11 && a - b >= 2) break;
    if (b >= 11 && b - a >= 2) break;
  }
  return { a, b };
}

// ----------------------------------------------------------------------------
// The point spread, via Monte Carlo. Returns the line plus a function that
// prices any alternate line off the same simulated distribution.
//
//   expectedMarginA : average (A points minus B points) over the match
//   line            : A's spread, sportsbook style. A favoured -> negative.
//   coverProb(L)    : P(A covers the line L). For A -5.5, call coverProb(-5.5).
// ----------------------------------------------------------------------------
export function estimateSpread(
  eloA: number,
  eloB: number,
  iters = 10000,
  rng: () => number = Math.random,
) {
  const q = solvePointProb(matchWinProb(eloA, eloB));
  const margins: number[] = [];
  let sum = 0;
  for (let i = 0; i < iters; i++) {
    const m = simulateMatch(q, rng).pointMarginA;
    sum += m;
    margins.push(m);
  }
  const expectedMarginA = sum / iters;
  return {
    expectedMarginA,
    line: -Math.round(expectedMarginA * 2) / 2, // round to nearest 0.5
    coverProb: (lineForA: number) =>
      margins.filter((m) => m + lineForA > 0).length / iters,
  };
}

// ----------------------------------------------------------------------------
// Live in-match odds. After each completed game, recompute P(A wins the match)
// from the current game score. g is A's per-game win prob (use gameProbFromElo).
// Pure combinatorics over the games still to play, no new data needed.
// ----------------------------------------------------------------------------
export function liveMatchProb(g: number, winsA: number, winsB: number): number {
  if (winsA >= 3) return 1;
  if (winsB >= 3) return 0;
  const needA = 3 - winsA;
  const needB = 3 - winsB;
  let p = 0;
  for (let losses = 0; losses < needB; losses++) {
    p += binom(needA - 1 + losses, losses) *
      Math.pow(g, needA) * Math.pow(1 - g, losses);
  }
  return p;
}

// ----------------------------------------------------------------------------
// Optional rivalry layer. Blends the Elo match prob toward the head-to-head
// record, weighted (and capped) by how many times this exact pair has played.
// A nudge, not the whole story. Use it or leave it out.
// ----------------------------------------------------------------------------
export function blendHeadToHead(
  eloProb: number,
  h2hWinsA: number,
  h2hWinsB: number,
  weightCap = 0.25,
): number {
  const n = h2hWinsA + h2hWinsB;
  if (n === 0) return eloProb;
  const empirical = (h2hWinsA + 1) / (n + 2);      // Laplace-smoothed rate
  const w = Math.min(weightCap, n / (n + 10));     // grows with sample, capped
  return (1 - w) * eloProb + w * empirical;
}

// ----------------------------------------------------------------------------
// Small helper: binomial coefficient, computed iteratively to stay exact for
// the small n we use here.
// ----------------------------------------------------------------------------
function binom(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  return result;
}
