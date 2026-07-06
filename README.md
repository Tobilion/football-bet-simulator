# CU Bet — Football Simulation & Sportsbook

**Live demo: [football-bet-simulator.vercel.app](https://football-bet-simulator.vercel.app/)**

![Demo](demo.gif)

CU Bet is an offline-first, 32-team knockout/league football simulation and betting game that runs entirely in the browser — no backend, no account, no API keys. A real-time match engine drives live odds, and every bet you place settles against matches actually simulated tick by tick.

---

## Features

- **Real-time match simulation** — tick-by-tick engine simulating possession, shots, goals, fouls, cards, injuries and weather, weighted by team ratings, tactics and form
- **Full sportsbook** — 1X2, BTTS, over/under and player markets with live-shifting odds, single & accumulator slips, Bet Builder (combine markets from one match), and mid-match Cash Out with live valuation
- **Multi-club ownership** — buy multiple clubs simultaneously with your winnings; each club has its own squad, tactics, stadium, and training facility. A multi-club switcher appears in ClubManager and TransferMarket whenever you own more than one club
- **Injury-aware squad management** — 18-player squads (11 starters + 7 reserves). Injured and suspended players are automatically excluded from the starting XI, with fit bench players filling in automatically. The ClubManager visually marks unavailable players (INJ / SUSP) and prevents them from being selected as starters
- **Transfer Market** — multi-bid system: you can now bid on multiple players simultaneously. Each bid is reserved immediately from your wallet on placement, refunded automatically if outbid or withdrawn, and your active bids panel shows Leading / Outbid status in real time. Auctions settle at round advance
- **Career layer** — player development (fatigue, morale, form), promotion/relegation, Player of the Match awards, form guides and head-to-head stats before every fixture
- **Casino suite** — 14 mini-games (roulette, crash, blackjack and more) sharing one wallet with the sportsbook
- **Challenges & tipsters** — daily missions, win-streak challenges, and AI tipster leaderboards
- **Offline-first** — all state persists in localStorage; close the tab and pick up where you left off
- **Polished UI** — glassmorphism panels, glow orbs, spotlight cards, smooth micro-animations, custom toast system and empty-state components

---

## Tech stack

React 19 · TypeScript 5.8 · Vite 6 · Tailwind CSS 4 · Recharts · Motion. Fully client-side.

---

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

---

## Running it as a live site

Because the app is 100% static after building, hosting is simple:

1. `npm run build` — produces the `dist/` folder.
2. Deploy `dist/` to any static host:
   - **Netlify / Vercel** (easiest): connect the GitHub repo, set build command `npm run build` and output directory `dist`. Every push auto-deploys.
   - **GitHub Pages:** push `dist/` to a `gh-pages` branch (or use an action).
   - **Any web server:** copy `dist/` to the server's web root.

No environment variables, database or server-side code required.

---

## Changelog (latest)

### July 2026 — Multi-club, Squad & Transfer Overhaul

**Bug Fixes:**
- Multi-club owners now see a club switcher in both ClubManager and TransferMarket
- Transfer bids are now reserved immediately from wallet, and refunded automatically if outbid or on withdrawal
- Bid history is correctly logged in the bankroll history
- Squads now contain 18 players (11 starters + 7 reserves) instead of just 11 — enough bench depth to cover injuries
- Injured / suspended players are now excluded from the starting XI automatically, with the best available healthy bench player filling in
- The starting XI picker in ClubManager now prevents selecting injured players, and visually flags INJ/SUSP bench players
- Multiple bids can be placed simultaneously (one per listing) instead of only one at a time

**UI Improvements:**
- New active bids panel in TransferMarket showing Leading/Outbid status per bid
- TransferMarket now shows a multi-club switcher for players owning more than one team
- Squad tab shows "X fit · Y unavailable" bench count

---

## Troubleshooting

- **Blank page after opening `index.html` directly** — the app must be served over http(s); use `npm run dev` or `npm run preview`, not double-clicking the file.
- **Port 3000 already in use** — stop the other process or run `npm run dev -- --port 3001`.
- **Progress gone** — game state lives in your browser's localStorage; clearing site data resets the game (different browsers/profiles have separate saves).
- **`npm install` errors after switching OS** — delete `node_modules` and `package-lock.json`, then `npm install` again.
- **My starting XI has fewer than 11 players** — this means most of your squad is injured. Advance a round to let players recover, or visit the Transfer Market to sign healthy players.

---

## Project structure

```
src/
  App.tsx          root component & view routing
  components/      UI (casino/, modals/, charts/, ui/)
  engine/          match, transfer, weather & foul/card engines
  hooks/           useBetting, useSimulation, useRoundAdvance, useTransferMarket, ...
  utils/           bet settlement, odds, cash-out, storage
  data/            teams, tournament, challenges, tipsters
tests/             logic, casino and site test suites
```
