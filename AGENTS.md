# AGENTS.md

Matchday Exchange (formerly "CU Bet") — football tournament simulation with betting markets: a single-page React app with match simulation, betting markets, a casino suite, club management, and a transfer market. All state is client-side (localStorage via `src/utils/storage.ts`); no backend.

## Stack

- React 19 + TypeScript 5.8, Vite 6, Tailwind CSS 4 (via `@tailwindcss/vite`)
- Redux Toolkit is in dependencies but app state largely lives in `App.tsx` + custom hooks
- recharts (charts), motion (animations), lucide-react (icons)
- Tests: plain TypeScript run with `tsx` (no test framework)

## Commands

- `npm run dev` — dev server on port 3000 (host 0.0.0.0)
- `npm run build` — Vite build to `dist/`
- `npm run lint` — `tsc --noEmit` (type-check only, no ESLint)
- `npm test` — runs `tests/logic.test.ts`, `tests/casino.test.ts`, `tests/site.test.ts` via tsx

## Structure

- `src/App.tsx` — root component; owns most top-level state and view routing
- `src/components/` — UI; subfolders: `casino/` (14 casino games + `shared.tsx`), `modals/`, `charts/`, `ui/` (Toast, Skeleton, InfoButton)
- `src/engine/` — simulation logic: `matchEngine`, `transferEngine`, `weatherEngine`, `foulCardEngine`
- `src/hooks/` — `useBetting`, `useSimulation`, `useRoundAdvance`, `useProfile`, `useChallenges`, `useTransferMarket`, `useToast`
- `src/utils/` — bet settlement (`betSettlement`, `settlementEngine`, `cashOutUtils`), odds (`oddsUtils`), wallet, storage, player/career/form/MOTM/highlights utils
- `src/data/` — static data: teams, tournament, challenges, tipsters, luxuryItems
- `src/types.ts` — shared types
- `tests/` — test scripts
- `.kiro/specs/` — feature specs; `MASTER_UPGRADE_PROMPT.md` — large upgrade spec doc

## Gotchas

- Vite alias `@` points to the **project root**, not `src/`.
- Duplicate `InfoButton` exists at `src/components/InfoButton.tsx` and `src/components/ui/InfoButton.tsx` — check which one a file imports.
- **"Built by" credit** lives in `src/components/ui/site-footer.tsx` (exports `LINKS`, `AvatarCredit`, `HeaderCredit`, `NameReveal`, default `SiteFooter`). Rendered in two places: `Header.tsx` (`AvatarCredit`, tap the "TO" avatar — visible at all breakpoints, but on mobile the bottom betting-slip drawer shares the header's z-40 and can visually crowd it) and `WelcomeScreen.tsx` (inline block built from `LINKS`, always shown pre-kickoff, unobstructed). `HeaderCredit`/`NameReveal` use `dark:` Tailwind variants tied to OS preference, not the app's own dark theme — avoid them outside a context that's always dark; `WelcomeScreen`'s block hardcodes dark styling instead.
- **Entry flow is forced on every full page load** (App.tsx): brief `booting` loader (900ms) → `SplashGate.tsx` (click-through branded gate, must click "Enter Matchday Exchange") → `WelcomeScreen` (save-slot picker). `gameMode` now always initializes to `null` on mount — the old behavior of reading `fs_selected_game_mode` from localStorage and silently auto-resuming straight to the dashboard was removed intentionally, since it meant returning users never saw the WelcomeScreen/credit. `WelcomeScreen` reads `fs_selected_game_mode`/`fs_selected_game_slot` itself (`getLastUsed()`) to preselect the mode tab, write-slot, and username, and tags the matching saved slot "Last Played" — so resuming is still a single click, it's just no longer automatic. If you ever need instant-resume behavior back, that's the `useState<...>(null)` at the top of `App.tsx` to revert.
- No ESLint/Prettier config; "lint" means type-checking. No test runner — tests are scripts that throw on failure.
- Money display uses comma formatting; default sim speed is 90s.
- **Running tests in a Linux sandbox:** `npm test`/`tsx` fail if `node_modules` was installed on Windows (esbuild native binary mismatch). Workaround that needs no reinstall: compile to CommonJS in a temp dir and run with node — `node node_modules/typescript/lib/tsc.js tests/logic.test.ts --outDir /tmp/build --module commonjs --moduleResolution node --target ES2020 --esModuleInterop --skipLibCheck` then `node /tmp/build/tests/logic.test.js`. Plain `tsc --noEmit` (via `node node_modules/typescript/lib/tsc.js`) works for type-checking; add `--incremental --tsBuildInfoFile /tmp/tsb.json` to stay under short shell timeouts.
- **File truncation on large files (recurring, serious):** past sessions repeatedly saw big files (`App.tsx` 1400+ lines, `FixturesOdds`, `LiveMatches`) silently truncated mid-file after edits — writes report success but the tail is cut. For any file over ~400 lines: avoid partial in-place edits; prefer Python string-replacement scripts on the file, and run `npm run lint` (`tsc --noEmit`) **after every single edit**, not at the end of a batch. If truncation is found, recover the file from git before patching. Long-term fix is keeping files small — continue splitting App.tsx.

## Key mechanics (post bug-fix batch)

- **Live cash-out** (`utils/cashOutUtils.ts`): fair value of a LIVE leg is `1/currentOdds` (NOT `odds/currentOdds` — that double-counts the odds and balloons the payout). Result is clamped to `potentialPayout`. Tests in `tests/logic.test.ts`.
- **Ticket settlement**: round-advance settles via `useRoundAdvance`, but tickets also auto-settle at full time via `useBetting.settleFinishedTickets()`, called from an App effect on `[fixtures]`. `settlePendingTickets` skips non-PENDING tickets, so there's no double credit.
- **CASHED_OUT counts as a win** everywhere (MyBets, Leaderboard, Analytics, `careerUtils`). Keep these consistent if adding new stat surfaces.
- **Permanent history across seasons/tournaments**: trophies live on `team.ownership.trophies`; season-by-season records on `team.seasonHistory` (`TeamSeasonRecord[]`, appended in `useRoundAdvance.appendSeasonRecords`). `App.handleResetAndGenerate(keepRecords=true)` re-attaches `ownership`+`seasonHistory` onto freshly generated teams by id, and preserves owned-team/career profile fields. Team history is viewable in the Teams page "history" sub-tab.
- **Career tab** shows a live in-progress season card (`CareerStats` gets `liveProfile`+`gameMode`, computed via `buildSeasonRecord`); completed seasons still recorded at season end into `fs_career_v1`.
- **Casino balance**: all 16 games settle through the single `useProfile.handleUpdateBalanceCasino` using functional updaters (`prev => prev ± delta`) — never a stale `balance` prop. It rejects non-finite/overdraw and caps at `1e15`. Don't pass raw absolute numbers computed from the `balance` prop. Integrity test in `tests/casino.test.ts`.
- **Reserve players**: names are clean; reserve status is `Player.isReserve` (badge shown as "RES"). Legacy saves may still carry a " (Res)" tag — strip at display with `cleanPlayerName`/`isReservePlayer` from `utils/playerUtils`.
- **Transfer window** (`engine/transferEngine.ts`): `WINDOW_TARGET`=16, position-balanced via `POSITION_QUOTA`. `refreshTransferListings` powers the "Refresh list" button ($25k fee in `useTransferMarket`, keeps listings the user has bid on).
- **VIP Store football clubs** (`VIPStore.tsx`): `CLUB_ITEM_CONFIG` maps item ids to actions — club1/2/3 = buy (tier-filtered via `teamTier`), club4 = naming rights (renames owned club's stadium, no ownership), club5 = training upgrade (+2 ratings to owned club). Naming/training call `handleRenameStadium`/`handleBoostClubRatings` in `useProfile`.
- **Live chat = `SocialFeed.tsx`** (fan zone). Posts react to every recent match event across active fixtures; feed clears on new round (roundLabel change) and on reset/new campaign (`fs_social_posts` removed in App).
- **One shared expected-stats model drives BOTH odds and simulation.** `matchEngine.strengthExpectedStats(home,away)` returns per-side opponent-adjusted expected goals/shots/corners/saves/cards from `lineupStrength` (with `STAT_BASELINE` per-team league means). The SIM (`applyVolumeStats`, called each tick in `simulateMatchTick`) uses it to generate realistic corner/save/card/shot counts (~10.7 corners, ~6.7 saves, ~4.5 cards per match — previously ~0.7/1.7/1.1, which made every Under auto-win). The ODDS (`engine/oddsEngine.ts` `computeMatchOdds`) use the same numbers as the Bayesian PRIOR, then blend recorded history over it — so pricing and pitch agree. Calibrated so odds-implied 1X2 ≈ simulated win rates (even ≈ 40/27/33, 90-vs-64 ≈ 76% home). If you change `applyVolumeStats` rates, re-tune the goals prior exponent in `expectedForSide` and re-run the calibration probe.
- **Historical blending (`utils/statsUtils.ts`, pure):** `blendedExpected` takes each team's recency-weighted (`RECENCY=0.82`) recorded for-rate, opponent-adjusts by the other team's against-rate vs baseline, then shrinks toward the strength prior by effective sample size (`SHRINK_K=4`, `effN` = the team's own for-sample). Venue-split (home/away). So corner/card/save odds DO reflect this season's recorded averages + team performance + opponent, not just ratings. No history → returns the prior exactly.
- **Odds are centralized in `oddsEngine.computeMatchOdds`.** A Poisson score matrix yields 1X2/DC/BTTS/over-unders/exact scores (never disagree); corners/cards/saves priced off their own Poisson totals from `blendedExpected`. `generateMatchOdds` was removed from matchEngine (one-way dep: oddsEngine→matchEngine). `tournament.ts` calls it per fixture; `generateNextRoundFixtures` passes `currentFixtures` so form/H2H/recorded rates feed in. Live odds still come from `getLiveInPlayOdds` adjusting the stored engine odds by match state.
- **Live suspension rules (`utils.ts` `getLiveInPlayOdds`):** a market suspends (`null`) ONLY when decided (line already passed) or impossible — never on time/long-price alone. Unlikely outcomes are capped at `MAX_LIVE_ODDS` (99), not suspended. So all O/U markets are open at 0-0 kickoff; Over 2.5 suspends only after the 3rd goal. Tests in `tests/logic.test.ts`.
- **Post-match player ratings (`utils/playerRatingUtils.ts` `computeMatchRatings`):** 4.0–10.0 for each team's starting XI from events + goals conceded (GK/DEF) + result + deterministic seeded variance; top overall flagged `isMotm`. Rendered in the LiveMatches FT panel, color-coded via `ratingColorClass`.
- **Singles are separate tickets:** `useBetting.handlePlaceBet` creates ONE ticket per selection for SINGLE mode (each its own stake/odds/cashout); only ACCUMULATOR makes a multi-leg ticket. Selection add is a pure toggle (`handleAddBetSelection`), so mutually-exclusive picks can coexist as singles.
- **Mutual exclusivity (`utils/betSlipUtils.ts`):** `marketGroupKey` groups same-match exclusive outcomes (result markets share `RESULT:<fixture>`; goalscorers never conflict). `dedupeForAccumulator` runs in `BettingSlip` whenever in acca mode to drop conflicts with a notice. Stake-distribution ("Split total"/"Same each") lives in BettingSlip's SINGLE footer.
- **Half-time pause toggle:** `LiveMatches` persists `fs_pause_at_halftime` (default on); `useSimulation` reads it — when `"false"`, the sim runs through HT without stopping.

- **Spatial match engine (footysim, ported).** Your Python physics/decision engine is ported to TS under `src/engine/footysim/` (12 modules + a `vec`/`rng` shim for numpy). Real 0.1s-tick sim: 22 players moved with vector physics, per-player decisions, duels, xG, ratings, positional playback frames. Entry: `footysim/sim.ts` `simulateMatch(teamDictA, teamDictB, config, seed)`. Heavy (~1.5-2s/match at a coarse 0.2s tick) so it's used ONLY for the watched match; the classic `matchEngine` tick sim stays the default/fallback for live + bulk "sim all round".
- **Bridge `engine/footysimBridge.ts`** `simulateFixtureFootysim(home,away,seed)`: derives footysim's 26 attributes from each site player's `abilities`/`rating` (no schema migration), assigns the XI to 4-3-3 roles, runs the sim, and maps output back to `{homeScore, awayScore, stats(MatchStats, corners synthesised — footysim doesn't track them), events(MatchEvent[]), playerRatings, frames}` (frames decimated to 240 for playback).
- **2D viewer:** `components/FootballPitch2D.tsx` (SVG pitch, real player/ball positions coloured by `<teamId>__` pid prefix) + `components/FootysimMatchViewer.tsx` (modal: simulates, plays back frames, reveals events by minute, play/pause/speed/skip, "Apply Result"). Opened from a "🛰️ WATCH IN 2D" button in `LiveMatches` (prop `onWatch2D`); App holds `footysim2DId` state and `applyFootysimResult` writes the FT scoreline/stats/events onto the fixture (then the normal settlement pipeline runs).

- **Player development is stats-driven (`utils/playerUtils.developPlayer`).** Growth = age curve x game time x performance, capped by a per-player `potential` (derived once from an id hash, then persisted on `Player.potential`). Benchwarmers stagnate (19yo starter +3.6 vs bench +0.7), prime plateaus, 30+ declines (softened for regular starters). Abilities drift with the rating so the spatial engine sees development, and `seasonStats` reset at rollover. Called from `initializeNewLeagueSeason`.
- **Dixon-Coles correction in `oddsEngine`** (`DC_RHO = -0.06`): plain Poisson under-prices draws, so 0-0/1-1 are lifted and 1-0/0-1 trimmed. ALL goal markets (1X2, DC, BTTS, over/unders, exact scores) are now derived from that one corrected matrix — `P(under 0.5)` provably equals `P(exact 0-0)` (tested).
- **Goalscorer odds use real scoring history**: goals-per-appearance → `P(scores ≥ once)`, shrunk toward the positional baseline by appearances (`SCORER_SHRINK = 4`). A prolific striker is priced shorter than an identical one who never scores (tested).
- **Morale is opponent-adjusted** (`tournament.ts`): beating a stronger side lifts morale much more; losing to a giant stings less than losing to a minnow.
- **Transfer valuations factor upside**: `calculatePlayerValue` multiplies by a potential factor (headroom to `potential`, weighted down with age), so high-potential youngsters cost a premium.

## Audit fixes applied (July 2026)

- **Phase 1 — Security:** removed emergency grant buttons from CasinoSuite (balance injection backdoors); hardened `handleUpdateBalanceCasino` to reject `MAX_SINGLE_TX` > 100k and accept only signed deltas (no functional updaters); added FNV-1a save integrity hashing (`storage.ts` `signSave`/`verifySave`/`loadSigned`) — tampered saves detected and trigger reset.
- **Phase 2 — Logic bugs:** transient `SETTLING` status prevents double-settlement race between auto-settle effect and round advance; fixed cash-out JSDoc (`cashOutUtils.ts`); footysim 2D seed now includes a session-random `footysimSessionSeed` that rotates after each apply, making replays non-deterministic.
- **Phase 4 — High severity:** `validateSinglesNoArbitrage` blocks same-match Home+Away singles; `useRoundAdvance` calls `applyUserWinsToOwnedTeam` before `applyTransferResultsToTeams` so user wins aren't lost; updated GAMES_LIST RTP values (Plinko 97.8%, Dice 97.9%, Spin the Bottle 97.0%) with Monte Carlo verification tests.
- **Phase 5 — Performance:** footysim runs in a web worker (`footysimWorker.ts`); simulation localStorage writes debounced to 2s; form/H2H computation in LiveMatches memoized.

## Maintenance

Keep this file concise. Replace stale info rather than appending.

## Imported Claude Cowork project instructions

Every session: read CLAUDE.md in the relevant project folder before working. After completing fixes or discovering issues, update CLAUDE.md with new findings.keep CLAUDE.md concise, replace stale info rather than appending.
