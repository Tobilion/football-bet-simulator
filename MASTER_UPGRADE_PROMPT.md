# Master Upgrade Prompt — Football Betting Simulator
## Phase 3: Depth, Engagement & Modularity Overhaul

---

## CRITICAL ARCHITECTURAL RULES — READ BEFORE TOUCHING ANY FILE

This codebase has a linter (Prettier) that silently truncates files over ~800 lines whenever the Edit tool is used. You MUST follow these rules on every single task:

1. **Never use the Edit tool on App.tsx, LiveMatches.tsx, FixturesOdds.tsx, Analytics.tsx, matchEngine.ts, or any file over 400 lines.** Use Python string replacement via Bash instead:
   ```bash
   python3 -c "
   with open('src/App.tsx','r') as f: s=f.read()
   s = s.replace('OLD_STRING', 'NEW_STRING', 1)
   with open('src/App.tsx','w') as f: f.write(s)
   "
   ```
2. **Run `npx tsc --noEmit 2>&1 | grep 'src/'` after every single file change.** No exceptions. Fix errors before moving to the next task.
3. **Hard file size limit: 400 lines per file.** If any file you're editing or creating would exceed 400 lines, split it before proceeding. Name splits clearly: `useRoundHandlers.ts`, `betUtils.ts`, `formGuideUtils.ts`.
4. **App.tsx is 1498 lines and must be reduced, not grown.** Every new feature's logic goes into a dedicated hook or utility file. App.tsx only wires things together.
5. **No multi-statement arrow functions inside JSX props** — `onClick={() => { stmt1; stmt2; }}` breaks the TypeScript JSX parser. Extract as named functions.
6. **For new modal components**, always follow the pattern: `useState<T | null>(null)` in App.tsx, render `{state && <Modal ... onClose={() => setState(null)} />}` at the bottom of App.tsx's return.

---

## MANDATORY REFACTOR — Do This First

Before adding any features, split App.tsx into hooks. App.tsx currently has 26 handler functions and 40 state declarations all in one file. Extract them as follows:

### `src/hooks/useSimulation.ts`
Move out: `isSimulating`, `ticks`, `simTimerRef`, `handleStartSimulation`, `handlePauseSimulation`, `handleSimulateTick`, `handleSimulateInstant`, `handleSimulateRemainingInstant`. Return them as a bundle. Import and destructure in App.tsx.

### `src/hooks/useBetting.ts`
Move out: `selectedBets`, `handleAddBetSelection`, `handleRemoveSelection`, `handlePlaceBet`, `handleCashOut`. Return as bundle.

### `src/hooks/useRoundAdvance.ts`
Move out: `handleAdvanceRound` (the largest function — handles fixture settlement, tipster resolution, relegation, passive income, ownership revenue, bankroll history). This one function alone is ~180 lines. It takes `userProfile`, `teams`, `fixtures`, `tipsters`, `tipsterTickets` and the state setters as parameters.

### `src/hooks/useProfile.ts`
Move out: `userProfile`, `setUserProfile`, `handleConfirmWalletTransaction`, `handleUpdateBalanceCasino`, `handleBuyVIPItem`, `handleBuyClub`.

### `src/utils/oddsUtils.ts`
Move out of `utils.ts`: `getLiveInPlayOdds`, `calculateImpliedProbability`, `applyOwnerBoost`. Keep `formatMoney` and `formatDate` in `utils.ts`.

After this refactor, App.tsx should be under 500 lines — just imports, state wiring, the tab router, and modal renders.

---

## FEATURE 1 — Transfer Market (Betting-Scoped, NOT Football Manager)

**Scope boundary:** This is a side market for bettors who own a club. It is NOT squad building, NOT tactics, NOT FM. The only thing that changes is a player's `teamId`. No formation changes, no training, no morale management through transfers. Think of it as a stock market for players — you buy low, sell high, and the player's performance in matches affects their value.

### New types (add to `src/types.ts`):
```ts
export interface TransferListing {
  id: string;
  playerId: string;
  fromTeamId: string;
  askingPrice: number;
  listedAtRound: number;
  expiresAtRound: number; // listing expires after 2 rounds
  status: "OPEN" | "SOLD" | "EXPIRED";
  bids: { bidderId: "USER" | string; amount: number; }[];
}
```

### New file: `src/engine/transferEngine.ts` (max 300 lines)
- `generateTransferListings(teams, roundIndex)` — at the start of each round, 3–6 random players are listed. AI clubs bid automatically each round tick using a budget derived from their rating. Prices start at `player.value ?? player.abilities.overall * 800`.
- `resolveTransferAuctions(listings, teams, userBid)` — called in `handleAdvanceRound`. Awards each player to highest bidder. If user wins: deduct from balance, move player to user's owned team. If AI wins: player moves between AI clubs (no effect on user except market noise).
- `calculatePlayerValue(player, team)` — base value from `overall`, scaled by age (peak 24–28), morale, recent goals/assists from `seasonStats`.
- `applyTransferResultsToTeams(teams, resolvedListings)` — returns updated teams array with players moved.

**No** formation updates. **No** role assignments. The moved player simply appears on the new team's player list and plays in the match engine as normal.

### New file: `src/hooks/useTransferMarket.ts`
- State: `transferListings: TransferListing[]`, `userBid: { listingId: string; amount: number } | null`
- `handlePlaceUserBid(listingId, amount)` — validates user has funds, sets bid
- `handleWithdrawBid(listingId)`
- Listings are generated in `useRoundAdvance` and stored in `Profile` so they persist.

### New component: `src/components/TransferMarket.tsx` (max 350 lines)
- Accessible as a new tab `"transfers"` in the header — only visible when user owns a club.
- Layout: two columns. Left: "Available Players" (listed for sale). Right: "My Club Incoming" (players your club is trying to buy, as AI).
- Each listing card shows: player name, position, age, overall rating, current asking price, time left (rounds), current highest bid, and a "Place Bid" button.
- Bid input is a simple number field. Submitting calls `handlePlaceUserBid`.
- A "SELLING" section below shows players from the user's club that AI clubs are bidding on — user can see but cannot block sales (keeps it passive).
- After round advance, a small toast shows auction results: "You signed [Player] for $X" or "Outbid on [Player]".

### Wire-up in App.tsx:
- Add `"transfers"` to the tab list in `Header` (conditionally, only if `userProfile.ownedTeamId` is set).
- Call `generateTransferListings` at the start of each round in `useRoundAdvance`.
- Call `resolveTransferAuctions` inside `handleAdvanceRound` before balance settlement.

---

## FEATURE 2 — Form Guide & Head-to-Head Stats

### New file: `src/utils/formUtils.ts` (max 250 lines)
```ts
// Returns last N results for a team from completed fixtures
export function getTeamForm(teamId: string, fixtures: Fixture[], n = 5): ("W"|"D"|"L")[]

// Returns H2H record between two teams
export function getHeadToHead(homeId: string, awayId: string, fixtures: Fixture[]): {
  played: number; homeWins: number; draws: number; awayWins: number;
  lastMeeting: { scoreline: string; roundIndex: number } | null;
}

// Returns a team's average goals scored/conceded over last N games
export function getTeamGoalAvg(teamId: string, fixtures: Fixture[], n = 5): {
  scored: number; conceded: number;
}
```

### Changes to `src/components/FixturesOdds.tsx`
In each fixture card, below the team names and above the 1X2 buttons, add a collapsible "FORM & H2H" row. It should be collapsed by default (one line) and expand on click:

**Collapsed view (always visible):**
```
MAN UTD  W W D L W   vs   0-3 H2H   W D L W W  ARSENAL
```
Form dots: W=green circle, D=yellow, L=red. Rendered as small colored pills.

**Expanded view (on click):**
- Last meeting scoreline + round label
- Home team: avg goals scored / conceded last 5
- Away team: avg goals scored / conceded last 5
- Head-to-head win % bar

No new modal needed — it's inline in the fixture card. Add `expandedFormFixtureId` state inside `FixturesOdds`.

### Changes to `src/components/LiveMatches.tsx`
In the match showcase panel, above the pitch graphic, add a horizontal strip showing both teams' last 5 form dots and the H2H record. This replaces the currently empty space between the weather banner and the pitch.

---

## FEATURE 3 — Bet Builder (Single-Match Accumulator)

This is a major sportsbook feature. A Bet Builder lets the user combine multiple markets from ONE fixture into a single bet. The combined odds are multiplied together with a small correlation discount (typically 5–8%).

### New types (add to `src/types.ts`):
```ts
export interface BetBuilderSelection {
  marketType: MarketType;
  selectionId: string;
  odds: number;
  label: string; // "Man Utd Win", "Over 2.5 Goals", etc.
}

export interface BetBuilderTicket {
  id: string;
  fixtureId: string;
  selections: BetBuilderSelection[];
  combinedOdds: number;
  stake: number;
  potentialPayout: number;
  status: "PENDING" | "WON" | "LOST";
  placedAt: number; // roundIndex
}
```

### New file: `src/utils/betBuilderUtils.ts` (max 200 lines)
```ts
// Multiplies odds together with a correlation discount
export function calculateBetBuilderOdds(selections: BetBuilderSelection[]): number {
  const raw = selections.reduce((acc, s) => acc * s.odds, 1);
  const discount = 0.07 * (selections.length - 1); // 7% per extra leg
  return Math.round(raw * (1 - discount) * 100) / 100;
}

// Validates a set of selections (no conflicting markets)
export function validateBetBuilderSelections(selections: BetBuilderSelection[]): string | null {
  // e.g. can't have both "HOME WIN" and "AWAY WIN" selected
  // returns null if valid, or an error string
}

// Settles a BetBuilderTicket against completed fixture
export function settleBetBuilderTicket(ticket: BetBuilderTicket, fixture: Fixture): "WON" | "LOST"
```

### New component: `src/components/BetBuilder.tsx` (max 400 lines)
- Accessible via a "BET BUILDER" button that appears on each fixture card in FixturesOdds (below the standard markets).
- Opens a full-screen or large modal (not a sidebar — it needs space).
- Left panel: lists all available markets for that fixture grouped by category (MAIN, GOALS, PLAYERS).
- Right panel: your current builder — selected legs shown as chips, combined odds displayed large, stake input, Place Builder Bet button.
- Each market button toggles the selection into/out of the builder. Conflicting selections are auto-removed with a warning toast.
- The combined odds update live as legs are added/removed.
- On placement: deduct stake from balance, store `BetBuilderTicket` in `userProfile.betBuilderTickets[]`.

### Settlement (in `useRoundAdvance.ts`):
After match results are known, iterate `userProfile.betBuilderTickets` with status "PENDING" and fixtureId matching completed fixtures. Call `settleBetBuilderTicket` for each. Add winnings to the payout sum alongside regular tickets.

### `Profile` type update:
Add `betBuilderTickets: BetBuilderTicket[]` to `src/types.ts`.

---

## FEATURE 4 — Live Cash Out

### New file: `src/utils/cashOutUtils.ts` (max 150 lines)
```ts
// Calculates a fair cash-out value for a ticket given current live odds
export function calculateCashOutValue(
  ticket: BetTicket,
  currentOddsMap: Record<string, number | null> // marketType+selectionId -> current odds
): number | null {
  // For each selection in ticket, get current odds
  // cashOut = (originalOdds / currentOdds) * potentialPayout * 0.92
  // 0.92 = bookmaker's 8% margin on cashout
  // Returns null if any market is suspended (odds === null)
}

// Checks if a ticket is still in-play and eligible for cashout
export function isCashOutEligible(ticket: BetTicket, fixtures: Fixture[]): boolean
```

### Changes to `src/components/MyBets.tsx`
For each ticket with status "PENDING" that has at least one LIVE fixture:
- Show a green "CASH OUT" banner below the ticket.
- Display the current cash-out value (updates every render since it reacts to live fixture state).
- A "CASH OUT $X.XX" button that calls `handleCashOut(ticketId, cashOutValue)`.
- If value drops below stake (losing position), show it in red but still allow cashout.
- After cashing out, ticket status becomes `"CASHED_OUT"` with `cashedOutAt` amount stored.

### New `BetTicket` fields (update `src/types.ts`):
```ts
cashedOutAt?: number;  // amount received on cashout
cashedOutRound?: number;
```

### Changes to `useBetting.ts`:
```ts
const handleCashOut = (ticketId: string, value: number) => {
  // Set ticket status to CASHED_OUT, add value to balance
}
```

---

## FEATURE 5 — Toast Notifications System

A `useToast` hook already exists at `src/hooks/useToast.ts` and a `Toast` component exists at `src/components/ui/Toast.tsx`. Wire them up properly — they appear to be stubs.

### Complete `src/hooks/useToast.ts`:
```ts
export type ToastType = "goal" | "win" | "loss" | "cashout" | "transfer" | "info" | "tip";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  duration?: number; // ms, default 4000
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const addToast = (toast: Omit<Toast, "id">) => { ... }
  const removeToast = (id: string) => { ... }
  return { toasts, addToast, removeToast };
}
```

### Complete `src/components/ui/Toast.tsx`:
- Renders a fixed stack of toasts in the bottom-right corner (z-index 200, above all modals).
- Each toast slides in from the right, auto-dismisses after `duration` ms.
- Style by type: goal=green pulse, win=gold, loss=red, tip=purple, info=slate.
- Include a small icon per type: ⚽ goal, 💰 win, 📊 loss, 💸 cashout, 🔄 transfer, 💡 tip.

### Wire into App.tsx:
Call `addToast` in:
- `handleAdvanceRound`: for each won ticket ("🏆 Ticket Won! +$X.XX"), each lost ticket ("Ticket Lost")
- `simulateMatchTick` callback: when a GOAL event fires for the selected (watched) fixture ("⚽ GOAL — [Player] scores for [Team]!")
- `handleCashOut`: "💸 Cashed Out $X.XX"
- Transfer auction resolution: "🔄 Signed [Player] for $X"
- Tipster tip fired: "[Tipster] just tipped [Team] to Win"

Pass `addToast` down to LiveMatches so it can fire goal toasts directly.

---

## FEATURE 6 — Bankroll Chart (Sparkline)

### New file: `src/components/charts/BankrollChart.tsx` (max 200 lines)
- Pure SVG sparkline — no chart library needed.
- Props: `history: { round: number; balance: number; label: string }[]`
- Renders an SVG path connecting all points, with:
  - A filled area gradient below the line (emerald at top, transparent at bottom).
  - Dots at each point, tooltip on hover showing round label + balance.
  - Horizontal dashed reference line at starting balance.
  - Colored positive (green) vs negative (red) segments based on whether balance is above/below starting value.
- Size: full-width, 120px tall. Responsive via viewBox.

### Changes to `src/components/Analytics.tsx`
At the top of the Analytics page, before the existing stat cards, add a "BANKROLL CURVE" section that renders `<BankrollChart history={userProfile.bankrollHistory} />`. The `bankrollHistory` array already exists on `Profile` — just needs to be read and displayed.

---

## FEATURE 7 — Player of the Match

### New file: `src/utils/motmUtils.ts` (max 150 lines)
```ts
export interface MOTMResult {
  playerId: string;
  playerName: string;
  teamId: string;
  score: number; // internal rating
  reason: string; // "2 goals, 1 assist" etc.
}

export function calculateMOTM(fixture: Fixture, teams: Team[]): MOTMResult | null {
  // Score each player based on events in fixture.events:
  // GOAL by player: +3 pts
  // ASSIST: +2 pts (check event.assistPlayerId)
  // SAVE (goalkeeper): +1.5 pts per save event
  // YELLOW_CARD: -0.5 pts
  // RED_CARD: -2 pts
  // Winning team players get +1 base bonus
  // Return player with highest score, or null if no events
}
```

### Changes to `src/components/LiveMatches.tsx`
After a fixture reaches FT status, at the bottom of the commentary feed, render a MOTM card:
```
┌──────────────────────────────────┐
│  ⭐ PLAYER OF THE MATCH           │
│  Marcus Rashford  •  Man United  │
│  2 Goals, 1 Assist               │
│  Match Rating: 9.2               │
└──────────────────────────────────┘
```
Gold border, slightly larger font. Call `calculateMOTM(selectedFixture, teams)` inline — no state needed, it's deterministic from fixture events.

### Changes to `useRoundAdvance.ts`
After all fixtures are settled, calculate MOTM for each and store in `fixture.motm?: MOTMResult` — add this optional field to the `Fixture` type. Used by highlights replay (Feature 11).

---

## FEATURE 8 — League Table Form Column

### Changes to `src/components/LeagueStandings.tsx`
In the table, add a "FORM" column after the Points column. For each team, call `getTeamForm(team.id, fixtures, 5)` (from `formUtils.ts` — Feature 2) and render 5 small colored dots: 🟢 W, 🟡 D, 🔴 L. Most recent result on the right.

This is a pure display change — no new state, just import `getTeamForm` and render the dots.

---

## FEATURE 9 — Betting Challenges / Daily Missions

### New types (add to `src/types.ts`):
```ts
export type ChallengeType =
  | "WIN_ACCUMULATORS"      // Win N acca bets
  | "BET_ON_UNDERDOG_WIN"   // Bet on team with odds > 3.0 and they win
  | "CASHOUT_PROFIT"        // Cash out a bet in profit
  | "BET_BUILDER_WIN"       // Win a Bet Builder
  | "WIN_STREAK"            // Win bets 3 rounds in a row
  | "BET_ON_DRAW";          // Bet on a draw that actually happens

export interface Challenge {
  id: string;
  type: ChallengeType;
  title: string;
  description: string;
  target: number;    // e.g. 3 for "Win 3 accumulators"
  progress: number;
  reward: number;    // cash reward
  bonusXP?: number;
  status: "ACTIVE" | "COMPLETED" | "EXPIRED";
  expiresAtRound: number;
}
```

### New file: `src/data/challenges.ts` (max 200 lines)
- `CHALLENGE_POOL: Omit<Challenge, "id" | "progress" | "status" | "expiresAtRound">[]` — a pool of ~20 challenges.
- `generateRoundChallenges(roundIndex: number): Challenge[]` — picks 3 random challenges from the pool, sets `expiresAtRound = roundIndex + 2`, assigns unique IDs.
- `evaluateChallenges(challenges, settledTickets, fixtures): Challenge[]` — checks each active challenge against round results and increments progress. Marks as COMPLETED if target reached.

### New file: `src/hooks/useChallenges.ts`
- State: `activeChallenges: Challenge[]`
- Loaded from `userProfile.challenges` (add to Profile type)
- `handleGenerateChallenges(roundIndex)` — called at round start if fewer than 3 active
- `handleEvaluateChallenges(settledTickets, fixtures)` — called in `useRoundAdvance` after settlement

### New component: `src/components/Challenges.tsx` (max 300 lines)
- Accessible as a tab or as a section within MyBets (preferred — keeps it near betting).
- Shows 3 active challenge cards with: title, description, progress bar, reward, expiry round.
- Completed challenges show a gold "CLAIM REWARD" button. Claiming adds cash to balance and dismisses.
- Expired challenges show greyed out with "EXPIRED".

---

## FEATURE 10 — Match Highlights Replay

### New file: `src/utils/highlightsUtils.ts` (max 150 lines)
```ts
export interface HighlightMoment {
  minute: number;
  type: "GOAL" | "RED_CARD" | "PENALTY" | "MOTM";
  playerName: string;
  teamId: string;
  description: string; // "45' ⚽ Rashford fires home from 20 yards"
}

export function buildHighlightsReel(fixture: Fixture): HighlightMoment[] {
  // Filter fixture.events for GOAL, RED_CARD events
  // Map each to a HighlightMoment
  // Append MOTM as a final moment if fixture.motm is set
  // Return sorted by minute
}
```

### New component: `src/components/modals/MatchHighlightsModal.tsx` (max 250 lines)
- Opens when user clicks "HIGHLIGHTS" button on any FT fixture card.
- Shows a vertical timeline: each moment has a colored left-border stripe (green=goal, red=red card, gold=MOTM), the minute badge, and the description text.
- At the top: final scoreline, big and bold.
- At the bottom: MOTM card (reuse the same display as Feature 7).
- Close button dismisses. No state needed beyond the fixture object passed as prop.

### Wire-up:
- Add `[showHighlightsFixture, setShowHighlightsFixture] = useState<Fixture | null>(null)` to App.tsx.
- In `LiveMatches.tsx` and `FixturesOdds.tsx`, add a "📋 HIGHLIGHTS" button on FT fixture cards. On click: dispatch a custom event `"open-highlights"` with the fixture id. App.tsx listens and sets `showHighlightsFixture`.
- Render `{showHighlightsFixture && <MatchHighlightsModal fixture={showHighlightsFixture} teams={teams} onClose={() => setShowHighlightsFixture(null)} />}` at the bottom of App.tsx.

---

## FEATURE 11 — Multi-Season Career Stats

### New types (add to `src/types.ts`):
```ts
export interface SeasonRecord {
  seasonNumber: number;
  mode: "TOURNAMENT" | "LEAGUE";
  startBalance: number;
  endBalance: number;
  netProfit: number;
  totalBetsPlaced: number;
  totalBetsWon: number;
  winRate: number;
  biggestWin: number;
  completedAt: string; // ISO date string
  champion?: string; // team name that won the tournament/league
}

export interface CareerProfile {
  totalSeasonsPlayed: number;
  allTimeProfit: number;
  allTimeWinRate: number;
  bestSeason: SeasonRecord | null;
  records: SeasonRecord[];
  prestigeLevel: number; // floor(totalSeasonsPlayed / 3)
  prestigeTitle: string; // "Amateur" -> "Pro" -> "Elite" -> "Legend"
}
```

### New file: `src/utils/careerUtils.ts` (max 200 lines)
```ts
const PRESTIGE_TITLES = ["Punter", "Sharp", "Pro", "Elite", "Legend", "GOAT"];

export function getPrestigeTitle(seasonsPlayed: number): string
export function buildSeasonRecord(userProfile: Profile, champion: string): SeasonRecord
export function updateCareerProfile(career: CareerProfile, newRecord: SeasonRecord): CareerProfile
```

### Storage:
Career stats live in `localStorage` under `fs_career_v1` — separate from the per-slot save. They persist across resets and new seasons. Load them on app mount alongside the normal save data.

### New component: `src/components/CareerStats.tsx` (max 300 lines)
A dedicated tab ("CAREER") that shows:
- Prestige badge at the top (large icon + title, e.g. "🏅 ELITE")
- All-time profit, win rate, seasons played — three big stat cards.
- A scrollable table of season records: Season #, Mode, Net Profit, Win Rate, Champion.
- Best season highlighted in gold.
- A "PRESTIGE PROGRESS" bar showing progress to next title.

### Wire-up in `useRoundAdvance.ts`:
When a tournament/league ends (the block that currently calls `setShowWinnerCelebration`), also call `buildSeasonRecord` and `updateCareerProfile`, then save to `fs_career_v1`.

---

## IMPLEMENTATION ORDER

Tackle in this sequence to minimise merge conflicts:

1. **Mandatory refactor** (hooks split) — reduces App.tsx first so all subsequent edits are safer
2. **Feature 6** (Bankroll Chart) — pure display, zero state changes, quickest win
3. **Feature 8** (Form Column) — one-line import + render in LeagueStandings
4. **Feature 5** (Toast system) — infrastructure used by everything else
5. **Feature 7** (MOTM) — utility function + small LiveMatches change
6. **Feature 2** (Form Guide & H2H) — builds on formUtils, affects FixturesOdds + LiveMatches
7. **Feature 4** (Cash Out) — extends existing BetTicket flow
8. **Feature 3** (Bet Builder) — self-contained module, largest Quick Win
9. **Feature 10** (Highlights Replay) — builds on MOTM (Feature 7)
10. **Feature 9** (Challenges) — new tab, isolated state
11. **Feature 11** (Career Stats) — new localStorage key, new tab
12. **Feature 1** (Transfer Market) — last because it depends on toasts + round advance being clean

---

## FILE SIZE BUDGET (enforce strictly)

| File | Max Lines |
|---|---|
| `src/App.tsx` | 500 (after refactor) |
| Any hook in `src/hooks/` | 300 |
| Any component in `src/components/` | 400 |
| Any modal in `src/components/modals/` | 300 |
| Any utility in `src/utils/` | 250 |
| Any engine file in `src/engine/` | 400 |
| `src/types.ts` | 500 (it grows with new types) |

If a file would exceed its budget, split it. Name the split descriptively. Update all imports.
