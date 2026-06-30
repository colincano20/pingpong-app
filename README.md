# Ping Pong Stats Tracker

A full-stack web app for tracking table tennis matches in a small league, with an Elo rating system and a sportsbook-style odds engine that produces moneylines, point spreads, and live in-match win probabilities.

**Live site:** https://pingpong-app-mu.vercel.app

## Overview

Friends play best-of-5 matches (first to 3 games, each game to 11, win by 2). You log each match game by game, and the app keeps everyone's rating up to date, ranks the league, and generates betting odds for any matchup. It is mobile-first, since most matches get logged courtside on a phone.

The interesting part is the odds engine: it is a self-contained module of pure functions that turns two ratings into a moneyline, a point spread, and live odds that update after each game. The rest of the app is built around it.

## Features

- **Scoreboard** with recent results and upcoming matches. Schedule a matchup and it shows its live betting line before the game is played.
- **Match logging** with live odds. Enter each game's score and watch the win probability and spread shift after every game.
- **Standings** ranked by rating, with each player's win-loss record.
- **Sortable stats table.** Tap any column header to sort by Elo, wins, losses, win percentage, streak, point differential, or games played.
- **Player profiles** with record, current streak, head-to-head records, and a complete match history that links through to each box score.
- **Box scores.** Tap any game to see every game's points and the totals.
- **Dark and light themes** in a table-tennis color palette, remembered across visits.

## How the odds work

The whole model is built on a single Elo rating per player. Everything else is derived from it.

### Ratings

Each player starts at 1500. After a match, the rating update is the standard Elo formula with a margin-of-victory adjustment, so a 3-0 sweep moves ratings more than a 3-2 grind. The update is zero-sum: the loser drops exactly what the winner gains.

### Moneyline

The Elo expected score is the probability that player A wins the match:

```
P(A wins) = 1 / (1 + 10^((eloB - eloA) / 400))
```

That probability converts directly to American odds (a 62% favorite reads as about -163). Because it comes straight from the ratings, the moneyline is reliable from the first match onward.

### Point spread

The spread needs the distribution of final point margins, not just who wins, so it is simulation driven:

1. Take the match win probability from Elo.
2. Solve, by binary search, for the per-point win probability that reproduces that match probability once you account for games to 11 (win by 2) and a best-of-5 match. This step uses a closed-form expression for the chance of winning a single game given a per-point edge.
3. Run a Monte Carlo simulation of 10,000 full matches at that per-point probability, recording the total point margin each time.
4. The average margin is the spread line, and because the full distribution is available, the engine can also price alternate lines (the odds of a player covering -8.5 instead of -5.5).

### Live in-match odds

After each completed game, the match win probability is recomputed from the current game score using pure combinatorics (a negative-binomial race to 3 game wins), so the line updates with no new data beyond the score you already entered.

There is also an optional head-to-head layer that nudges the probability toward a pair's historical record, weighted and capped by how many times they have played, since some players match up oddly against a specific opponent.

## Tech stack

- **Frontend:** React, TypeScript, Vite
- **Routing:** React Router (real URLs, so deep links and the back button work)
- **Backend and database:** Supabase (hosted Postgres with an auto-generated API)
- **Hosting:** Vercel, with automatic deploys on every push to `main`

## Architecture

The code is split so the math, the data access, and the UI stay independent:

- **`engine.ts`** is the odds engine: pure functions for the Elo update, moneyline conversion, the per-point solve, the match simulator, and the live-odds calculator. No database or UI, so it can be unit tested in isolation.
- **`statsmath.ts`** holds the pure stat computations (streaks, records, head-to-head, rivalries, biggest blowout), also database-free and tested.
- **`data.ts`** is the only place that talks to Supabase. It reads and writes rows and runs match results through the engine, so the rest of the app never touches SQL directly.
- **Components** (`Scoreboard`, `Standings`, `LogMatch`, `Odds`, `Stats`, `Profile`, `MatchDetail`) handle presentation only.

A guiding principle in the database design: the `games` table is the single source of truth for all scoring. Winners, game counts, point margins, and standings are all derived in Postgres views, so there are no running totals that can drift out of sync.

## Data model

| Table | Purpose |
| --- | --- |
| `players` | One row per person, with their current rating |
| `matches` | The structural facts of a match: who played, which side, when |
| `games` | Every individual game's points (the source of truth for scoring) |
| `rating_history` | Rating before and after each match, for charting over time |
| `upcoming_matches` | Scheduled matchups shown with their odds |

Views (`match_results`, `player_match_stats`, `standings`) compute everything derived on top of those tables.

## Running locally

```bash
git clone https://github.com/colincano20/pingpong-app.git
cd pingpong-app
npm install
```

Create a `.env` file in the project root with your Supabase credentials:

```
VITE_SUPABASE_URL=https://yourproject.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Then start the dev server:

```bash
npm run dev
```

The database schema lives in `schema.sql`. Run it in the Supabase SQL editor to create the tables and views.

## Tests

The pure logic (the odds engine and the stat functions) is unit tested with Node's built-in test runner, no dependencies required:

```bash
node --test --experimental-strip-types
```

The engine tests cover the Elo math, the moneyline conversion, the per-point solve round-trip, and the simulated spread. The stat tests cover streak walking, head-to-head tallies, and the biggest-blowout pick.

## Deployment

The app deploys to Vercel from GitHub. Every push to `main` triggers a new build and updates the live site automatically. The two Supabase environment variables are set in the Vercel project settings (not committed to the repo). A `vercel.json` rewrite serves `index.html` for all routes so client-side routing works on direct links and refreshes.

## Possible additions

- Rating-over-time charts on player profiles (the `rating_history` data is already being collected)
- Profile pictures using Supabase storage
- A "play this" shortcut that turns an upcoming match into a logged result
- Authentication, so the app can be public without anyone being able to edit data