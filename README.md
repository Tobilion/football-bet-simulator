# CU Bet — Football Simulation & Sportsbook

**Live demo: [football-bet-simulator.vercel.app](https://football-bet-simulator.vercel.app/)**

![Demo](demo.gif)

CU Bet is an offline-first, 32-team knockout football simulation and betting game that runs entirely in the browser — no backend, no account, no API keys. A real-time match engine drives live odds, and every bet you place settles against matches actually simulated tick by tick.

## Features

- **Real-time match simulation** — tick-by-tick engine simulating possession, shots, goals, fouls, cards, injuries and weather, weighted by team ratings, tactics and form
- **Full sportsbook** — 1X2, BTTS, over/under and player markets with live-shifting odds, single & accumulator slips, Bet Builder (combine markets from one match), and mid-match Cash Out with live valuation
- **Club ownership** — buy clubs with your winnings, manage squads, sign players on the transfer market, bid in auctions against AI clubs, earn per-club trophies
- **Career layer** — player development (fatigue, morale, form), promotion/relegation, Player of the Match awards, form guides and head-to-head stats before every fixture
- **Casino suite** — 14 mini-games (roulette, crash, blackjack and more) sharing one wallet with the sportsbook
- **Challenges & tipsters** — daily missions, win-streak challenges, and AI tipster leaderboards
- **Offline-first** — all state persists in localStorage; close the tab and pick up where you left off

## Tech stack

React 19 · TypeScript 5.8 · Vite 6 · Tailwind CSS 4 · Recharts · Motion. Fully client-side.

## Getting started

Prerequisite: Node.js 18+ ([nodejs.org](https://nodejs.org)). Then, in a terminal:

```bash
git clone https://github.com/Tobilion/football-bet-simulator.git
cd football-tournament-betting-simulator
npm install
npm run dev
```

Open **http://localhost:3000**. The dev server hot-reloads as you edit.

### All commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server on http://localhost:3000 |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally to test it |
| `npm run lint` | Type-check the codebase (`tsc --noEmit`) |
| `npm test` | Run the logic, casino and site test suites |

## Running it as a live site

Because the app is 100% static after building, hosting is simple:

1. `npm run build` — produces the `dist/` folder.
2. Deploy `dist/` to any static host:
   - **Netlify / Vercel** (easiest): connect the GitHub repo, set build command `npm run build` and output directory `dist`. Every push auto-deploys.
   - **GitHub Pages:** push `dist/` to a `gh-pages` branch (or use an action).
   - **Any web server:** copy `dist/` to the server's web root.

No environment variables, database or server-side code required.

## Troubleshooting

- **Blank page after opening `index.html` directly** — the app must be served over http(s); use `npm run dev` or `npm run preview`, not double-clicking the file.
- **Port 3000 already in use** — stop the other process or run `npm run dev -- --port 3001`.
- **Progress gone** — game state lives in your browser's localStorage; clearing site data resets the game (different browsers/profiles have separate saves).
- **`npm install` errors after switching OS** — delete `node_modules` and `package-lock.json`, then `npm install` again.

## Project structure

```
src/
  App.tsx          root component & view routing
  components/      UI (casino/, modals/, charts/, ui/)
  engine/          match, transfer, weather & foul/card engines
  hooks/           useBetting, useSimulation, useRoundAdvance, ...
  utils/           bet settlement, odds, cash-out, storage
  data/            teams, tournament, challenges, tipsters
tests/             logic, casino and site test suites
```
