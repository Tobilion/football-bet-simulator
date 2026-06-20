# Implementation Plan: Betting Simulator Bugfix

## Overview

Fix five interconnected bugs (stale closure balance updates in casino games, missing overflow scroll in league standings, and a red-or-black `balStart` ref desync) by migrating all casino `onUpdateBalance` calls to a delta-based pattern and applying a one-line CSS fix to `LeagueStandings`. A bug-condition exploration test runs first to confirm each root cause on unfixed code before any changes are applied.

## Tasks

- [ ] 1. Write bug condition exploration property test
  - Create a test file `src/__tests__/bugConditionExploration.test.ts` using Vitest
  - Test 1: SpinTheBottleGame WIN with mid-spin state change — render with `balance=200, stake=50`, simulate emergency grant mid-spin (state→650), assert final balance=760, observe 260 on unfixed code
  - Test 2: SpinTheBottleGame FREEZE with mid-spin state change — balance=200, stake=50, deduction→150, grant→650, FREEZE callback, assert balance=700, observe 200 on unfixed code
  - Test 3: RedOrBlackGame WIN with mid-streak balance change — streak start=500, wager=50, grant→900, round 4 WIN pool=1400, assert balance=2250, observe 1850 on unfixed code
  - Test 4: RedOrBlackGame CASHOUT with mid-streak balance change — start=500, wager=50, grant→900, cashout pool=275, assert balance=1125, observe 725 on unfixed code
  - Test 5: LeagueStandings — render with 16 teams, assert all 16 `<tr>` rows rendered AND container has `overflow-y: auto` or `overflow-y: scroll`, observe visual clip on unfixed code
  - These tests are EXPECTED TO FAIL on unfixed code (failure confirms bugs exist)

- [ ] 2. Fix `handleUpdateBalanceCasino` in App.tsx to use delta-based functional updater
  - Change the `handleUpdateBalanceCasino` function to accept a `delta: number` parameter instead of an absolute `newBalance`
  - Update the body to use `setUserProfile(prev => ({ ...prev, balance: Math.round((prev.balance + delta) * 100) / 100, netProfit: Math.round((prev.netProfit + delta) * 100) / 100 }))` with localStorage persistence
  - Update the `GameProps` interface in `src/components/casino/shared.tsx`: rename `onUpdateBalance: (newBalance: number) => void` to `onUpdateBalance: (delta: number) => void` and update JSDoc
  - Do NOT change `handleConfirmWalletTransaction` or any sports-bet/round-advance balance paths
  - _Requires_: 1

- [ ] 3. Fix SpinTheBottleGame stale closure and double deduction (Bug 5)
  - In `handleSpin`, replace pre-spin call `onUpdateBalance(balance - safeStake)` with `onUpdateBalance(-safeStake)`
  - In the `setTimeout` WIN branch, replace `onUpdateBalance(balance - safeStake + payout)` with `onUpdateBalance(payout)` (stake already deducted; payout = 2.2× stake including stake return)
  - In the `setTimeout` FREEZE branch, replace `onUpdateBalance(balance - safeStake + safeStake)` with `onUpdateBalance(safeStake)` (return the exact stake previously deducted)
  - In the `setTimeout` LOSS branch, remove any `onUpdateBalance` call (stake already deducted, no further change)
  - Verify UP/DOWN/FREEZE angle bands: UP `[-40, +40]`, DOWN `[140, 220]`, FREEZE `{90, 270}` — no code change needed unless a mismatch is found
  - _Requires_: 2

- [ ] 4. Fix RedOrBlackGame stale balStart ref (Bug 4)
  - Remove `balanceAtStartRef` — no longer needed with delta pattern
  - In `selectColor` (streak start), replace `onUpdateBalance(balance - wager)` with `onUpdateBalance(-wager)`
  - In `resolveRound` WIN branch, replace `onUpdateBalance(balStart - origWager + newPool)` with `onUpdateBalance(newPool)` (stake already deducted at streak start; net gain = newPool)
  - In `handleCashout`, replace `onUpdateBalance(balStart - origWager + finalPool)` with `onUpdateBalance(finalPool)`
  - Verify JOKER and LOSS branches make no `onUpdateBalance` call (stake was already deducted) — no change needed if confirmed
  - _Requires_: 2

- [ ] 5. Fix LeagueStandings container overflow (Bug 3)
  - In `LeagueStandings.tsx`, find the `<div className="overflow-x-auto font-sans">` wrapper around the `<table>`
  - Add `overflow-y-auto` and `max-h-[480px]` to that div: `<div className="overflow-x-auto overflow-y-auto max-h-[480px] font-sans">`
  - Ensure sort order (Points → GD → Goals Scored → Name), colour highlights (CL top 4, EL 5–6, relegation 15–16), and team row click handler remain unchanged
  - _Requires_: 1

- [ ] 6. Migrate remaining casino components to delta pattern (Bug 1 sweep)
  - Update `FootballSlotsGame.tsx` — replace all `onUpdateBalance(balance ± amount)` calls inside `setTimeout` with delta calls
  - Update `OverUnderDiceGame.tsx` — same migration
  - Update `PaddockRushGame.tsx` — same migration
  - Update `PenaltyShootoutGame.tsx` — same migration
  - Update `PlinkoGame.tsx` — same migration
  - Confirm `SpinTheBottleGame.tsx` and `RedOrBlackGame.tsx` are complete (covered in tasks 3 and 4)
  - In each component, ensure pre-spin/pre-round stake deductions send `-safeStake` and callbacks send only the net payout delta
  - _Requires_: 2, 3, 4

- [ ] 7. Write fix-verification and preservation tests
  - Write fix-checking tests: delta-based `handleUpdateBalanceCasino` produces `prev.balance + delta` for any `prevBalance ∈ [0, 100000]` and any delta
  - Write SpinTheBottleGame outcome net-change tests: WIN net = `payout - safeStake`, FREEZE net = 0, LOSS net = `-safeStake`
  - Write RedOrBlackGame delta tests: WIN round 4 delta = `origWager × 28 - origWager`, CASHOUT round 2 delta = `origWager × 5.5 - origWager`, JOKER delta = 0
  - Write LeagueStandings tests: 16 `<tr>` rows rendered, container has `overflow-y: auto` or `scroll`, sort order and colour highlights intact
  - Write preservation tests: non-concurrent spin scenarios produce same result; sports bet `handleAdvanceRound` calculation unchanged; wallet modal deposit/withdraw unchanged
  - Run all tests and confirm they pass
  - _Requires_: 3, 4, 5, 6

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"] },
    { "wave": 2, "tasks": ["2"] },
    { "wave": 3, "tasks": ["3", "4", "5"] },
    { "wave": 4, "tasks": ["6"] },
    { "wave": 5, "tasks": ["7"] }
  ]
}
```

## Notes

- All casino game fixes follow the same pattern: synchronous pre-spin sends `-safeStake`; async callback sends only the net payout delta. This makes each call closure-safe because `App.tsx` applies the delta to `prev.balance` inside a functional state updater.
- The `onUpdateBalance` API contract change (absolute → delta) is a breaking change to `GameProps`. All casino components must be updated in the same pass (tasks 3, 4, 6) before the TypeScript build will succeed.
- The LeagueStandings fix (task 5) is independent of the delta migration and can be validated in isolation.
- Task 1 (exploration tests) is expected to FAIL on unfixed code. The sub-agent should treat test failures as confirmation of the bug and mark the task complete once counterexamples are captured.
