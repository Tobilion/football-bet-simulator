# Betting Simulator Bugfix Design

## Overview

This document formalises the fix strategy for five interconnected bugs in the football tournament
betting simulator. All five bugs share a common root cause pattern: **stale closure capture of the
`balance` prop** inside asynchronous callbacks (`setTimeout`) and direct use of `balStart` refs
instead of functional state updaters. A sixth item covers a code modularity refactor.

The fix strategy is uniform across all casino components:
- Replace every absolute balance assignment (`onUpdateBalance(balance ± amount)`) inside any
  asynchronous callback with a **delta-only pattern** passed through `App.tsx`'s functional state
  updater: `setUserProfile(prev => ({ ...prev, balance: prev.balance + delta }))`.
- Fix the `LeagueStandings` container to allow vertical scroll so all 16 rows are reachable.
- Align the `SpinTheBottleGame` visual angle zones with the declared `UP`/`DOWN` outcome bands.

---

## Glossary

- **Bug_Condition (C)**: The specific input state that triggers each bug.
- **Property (P)**: The desired post-fix behaviour for inputs satisfying C.
- **Preservation**: Existing behaviours that must remain byte-for-byte identical after the fix.
- **Stale Closure**: A JavaScript variable captured by a `setTimeout` callback at render time,
  which no longer reflects the current React state value at the moment the callback fires.
- **Delta Pattern**: Calling `onUpdateBalance` with a signed delta amount rather than an absolute
  new balance, so `App.tsx` applies it as `prev.balance + delta` inside a functional state updater.
- **`handleUpdateBalanceCasino`**: The function in `src/App.tsx` that receives the casino balance
  update and also computes `netProfit`.
- **`balanceAtStartRef`**: A `useRef` in `RedOrBlackGame.tsx` that captures the wallet balance
  at the start of a streak — the primary source of the Red or Black desync bug.
- **`isBugCondition_*`**: Pseudocode predicates (one per bug) that identify buggy input states.
- **`safeStake`**: The clamped wager amount computed before a spin/round begins.

---

## Bug Details

### Bug 1 & 2 — Stale Closure in Casino Balance Updates (App.tsx + SpinTheBottleGame.tsx)

#### Bug Condition

The bug manifests whenever a casino game's `setTimeout` callback fires and references the `balance`
prop captured at render time. By then, `App.tsx`'s `userProfile.balance` state may have advanced
(from a prior deduction, a concurrent grant, or another game resolution).

**Formal Specification:**
```
FUNCTION isBugCondition_StaleClosureCasino(X)
  INPUT:  X = { balanceAtRender: number,
                balanceAtResolution: number,
                callbackUsesAbsoluteBalance: boolean }
  OUTPUT: boolean

  RETURN X.callbackUsesAbsoluteBalance = true
    AND X.balanceAtRender !== X.balanceAtResolution
END FUNCTION
```

**Concrete Examples:**
- Player balance = $500. Stake = $50. `onUpdateBalance(500 - 50)` fires immediately (correct).
  1 800 ms later callback fires: `onUpdateBalance(500 - 50 + 110)` uses stale $500, not $450.
  Result wallet = $560 instead of correct $510.
- FREEZE outcome: callback calls `onUpdateBalance(balance - safeStake + safeStake)` where
  `balance` = $500 (pre-deduction). State already = $450. Result = $500 (double return, +$50 ghost).
- Emergency funds clicked mid-spin: grant adds $500 to state → $950. Callback still uses $500.
  Final balance = $500 ± delta instead of $950 ± delta.

---

### Bug 3 — League Standings Shows Only ~9 Teams

#### Bug Condition

The standings table `<div>` wrapper has no `overflow-y` scroll and no constrained `max-height`,
so on typical viewport heights the table body is clipped at roughly row 9.

**Formal Specification:**
```
FUNCTION isBugCondition_StandingsOverflow(X)
  INPUT:  X = { numberOfTeams: number, containerHasScrollEnabled: boolean }
  OUTPUT: boolean

  RETURN X.numberOfTeams > 9
    AND X.containerHasScrollEnabled = false
END FUNCTION
```

**Concrete Examples:**
- League mode with 16 teams: rows 10–16 invisible, no scrollbar present.
- Narrow laptop viewport (768 px height): cut off at row ~7.

---

### Bug 4 — Red or Black: `balStart` Ref Produces Incorrect Settlement

#### Bug Condition

`RedOrBlackGame.tsx` stores the balance at streak start in `balanceAtStartRef`. If the wallet
changes during the streak (emergency grant, concurrent game), the cashout / win settlement
`onUpdateBalance(balStart - origWager + newPool)` reconstructs an absolute balance from a stale
snapshot instead of applying a net delta.

**Formal Specification:**
```
FUNCTION isBugCondition_RedOrBlackBalStart(X)
  INPUT:  X = { balStart: number,
                currentStateBalance: number,
                origWager: number,
                newPool: number }
  OUTPUT: boolean

  RETURN X.balStart !== X.currentStateBalance
    AND settlement = X.balStart - X.origWager + X.newPool   // absolute, not delta
END FUNCTION
```

**Concrete Examples:**
- Streak start: balance = $500, wager = $50. `balStart` = $500. Emergency grant fires: state = $900.
  Round 4 WIN: `onUpdateBalance(500 - 50 + 1400)` = $1850. Correct: $900 + (1400 - 50) = $2250.
- Cashout after round 2: pool = $275. `onUpdateBalance(500 - 50 + 275)` = $725. Correct: $900 + 225 = $1125.

---

### Bug 5 — Spin the Bottle: Double Stake Deduction + Visual/Logic Desync

#### Bug Condition

`handleSpin` in `SpinTheBottleGame.tsx` calls `onUpdateBalance(balance - safeStake)` **before**
`setTimeout`, then calls `onUpdateBalance(balance - safeStake + payout)` **inside** `setTimeout`,
where `balance` is the same pre-spin stale value — effectively deducting the stake twice.

For the visual desync: the offset angle bands (±40° around 0° for UP, ±40° around 180° for DOWN)
may not align with the SVG bottle nozzle direction on edge cases near the midline.

**Formal Specification:**
```
FUNCTION isBugCondition_SpinBottleDoubleDeduct(X)
  INPUT:  X = { stakeDeductedBeforeSpin: boolean,
                callbackUsesPreSpinBalance: boolean,
                outcome: "UP" | "DOWN" | "FREEZE" }
  OUTPUT: boolean

  RETURN X.stakeDeductedBeforeSpin = true
    AND X.callbackUsesPreSpinBalance = true
END FUNCTION
```

**Concrete Examples:**
- WIN: balance = $200, stake = $50. Pre-spin: `onUpdateBalance(150)`. Callback:
  `onUpdateBalance(200 - 50 + 110)` = $260. Correct = $150 + 110 = $260? No: callback uses
  $200 not $150, so `200 - 50 + 110 = 260`. Appears correct numerically only when no concurrent
  state change occurred, masking the double-deduct when another update fires mid-spin.
- FREEZE: callback calls `onUpdateBalance(200 - 50 + 50)` = $200. State is already $150 (stake
  taken). Correct = $150 + 50 = $200. Numerically correct in isolation but wrong pattern when
  any mid-spin state update occurs.
- WIN with emergency grant mid-spin (state → $650): callback uses stale $200, produces
  $200 - 50 + 110 = $260 instead of correct $650 + 60 = $710.

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Sports bet settlement at round advance (via `handleAdvanceRound`) must continue to award correct
  payouts using the existing ticket evaluation path.
- Wallet modal deposit/withdraw via `handleConfirmWalletTransaction` must remain unmodified.
- Casino game multipliers, win conditions, and payout ratios must remain identical (2.4×/5.5×/12×/28×
  for Red or Black; 2.2× for Spin the Bottle; existing Joker/FREEZE probabilities of 2%).
- League standings sort order (Points → GD → Goals Scored → Name) must remain unchanged.
- Colour highlights (Champions League top 4, Europa League 5–6, relegation 15–16) must persist.
- Team row click → global entity modal must continue to fire.
- Emergency funds button logic (amount calculation, display) must continue to work correctly for
  non-concurrent scenarios.
- All `localStorage` key schemas (`fs_profile_v3_*`, etc.) must remain unchanged so saved games
  load correctly after the fix.
- Match simulation engine, round advancement, and fixture generation are untouched.

**Scope:**
All inputs where `isBugCondition_*(X)` returns `false` — i.e., casino resolutions where no
concurrent state change occurred between render and callback — must produce the same user-visible
result as before the fix. The fix must be transparent for the common case.

---

## Hypothesized Root Cause

### 1. Direct Prop Capture in Async Callbacks (Bugs 1, 2, 5)

`SpinTheBottleGame.tsx` reads `balance` (a React prop) directly inside the `handleSpin` closure
and again inside the `setTimeout` callback. Because React props are captured by value at render
time, the `setTimeout` callback always sees the balance from the render cycle when `handleSpin`
was called, not the current state. The same pattern exists in `FootballSlotsGame`,
`OverUnderDiceGame`, `PaddockRushGame`, and `PenaltyShootoutGame` (not the primary focus but
affected by the same pattern).

### 2. Absolute Balance Reconstruction from Stale Ref (Bugs 1, 4)

`RedOrBlackGame.tsx` stores the balance at streak start in `balanceAtStartRef` and reconstructs
the final balance as `balStart - origWager + newPool`. This pattern is semantically wrong: it
assumes the balance hasn't changed since streak start. The correct pattern is to apply only the
net change: `currentState + (newPool - origWager)`.

### 3. Missing Overflow Scroll on Standings Container (Bug 3)

`LeagueStandings.tsx` wraps the `<table>` in a `<div className="overflow-x-auto font-sans">`.
`overflow-x-auto` does not enable vertical scroll. No `max-height` is set, so the browser renders
the full table height, which overflows the parent panel and gets clipped.

### 4. `onUpdateBalance` API Signature Mismatch (Bugs 1, 2, 4, 5)

The current `GameProps` interface declares `onUpdateBalance: (newBalance: number) => void`,
implying an absolute new balance. However, correct closure-safe usage requires a **delta**. The
fix can either (a) change the signature to accept a delta and update `App.tsx` accordingly, or
(b) keep the existing signature but ensure `App.tsx`'s handler uses a functional updater
(`prev => prev + delta`) and refactor all casino games to pass delta values. Option (b) is the
lower-risk change, requiring no prop interface breaking change.

### 5. Visual Angle Zone Boundary (Bug 5)

The SVG bottle nozzle (green triangle at the top of the SVG) points upward at 0°. After adding
`finalRot` (always a multiple of 360°), the bottle is at the same orientation as `offsetDeg`.
For `UP` outcome, `offsetDeg ∈ [-40, +40]` — nozzle points upward ✓. For `DOWN`, `offsetDeg ∈
[140, 220]` — nozzle points downward ✓. For `FREEZE`, `offsetDeg ∈ {90, 270}` — nozzle points
sideways ✓. The visual zones appear correct in the common case; the perceived desync is more
likely caused by the double-deduct producing an unexpected commentary string, not a true angle
mismatch. Minor improvement: tighten `FREEZE` to use the exact 90°/270° values (already done).

---

## Correctness Properties

Property 1: Bug Condition — Casino Balance Uses Delta, Not Stale Absolute

_For any_ input where `isBugCondition_StaleClosureCasino(X)` holds (i.e., the casino callback
fires after a concurrent state update), the fixed `handleUpdateBalanceCasino` in `App.tsx` SHALL
produce a final `userProfile.balance` equal to `prevState.balance + delta`, where `delta` is the
net gain/loss of the casino round, regardless of any state changes that occurred between render
and callback resolution.

**Validates: Requirements 2.1, 2.2, 2.3**

---

Property 2: Bug Condition — FREEZE Returns Exact Stake to Current State

_For any_ spin where `isBugCondition_FreezeStakeReturn(X)` holds (FREEZE outcome with stale
closure), the fixed `SpinTheBottleGame` SHALL call `onUpdateBalance` with a delta of `+safeStake`,
causing `App.tsx` to set `balance = prev.balance + safeStake`, exactly reversing the pre-spin
deduction that already reduced the state balance.

**Validates: Requirements 2.4, 2.12**

---

Property 3: Bug Condition — All 16 Standings Rows Are Accessible

_For any_ rendering of `LeagueStandings` with 16 teams, the fixed component SHALL render all 16
`<tr>` rows inside a vertically scrollable container, such that every row is reachable by the user
without horizontal scroll, on any viewport height ≥ 400 px.

**Validates: Requirements 2.7, 2.8**

---

Property 4: Bug Condition — Red or Black Settlement Uses Net Delta

_For any_ Red or Black round where `isBugCondition_RedOrBlackBalStart(X)` holds (state changed
since streak start), the fixed `resolveRound` SHALL call `onUpdateBalance` with a net delta of
`newPool - origWager` (WIN/CASHOUT) or `0 - origWager` (already deducted at streak start — no
additional deduction on loss/JOKER), causing `App.tsx` to set
`balance = prev.balance + (newPool - origWager)`.

**Validates: Requirements 2.9, 2.10**

---

Property 5: Bug Condition — Spin the Bottle No Double Deduction

_For any_ spin where `isBugCondition_SpinBottleDoubleDeduct(X)` holds, the fixed `handleSpin`
SHALL deduct the stake exactly once (before the spin, synchronously), and all subsequent callback
calls SHALL use only delta values (`+payout` for WIN, `+safeStake` for FREEZE, `+0` for LOSS),
so the total balance change equals `payout - safeStake` for WIN, `0` for FREEZE, and `-safeStake`
for LOSS.

**Validates: Requirements 2.11, 2.12, 2.13**

---

Property 6: Preservation — Non-Buggy Inputs Unchanged

_For any_ input where none of `isBugCondition_*(X)` hold (no concurrent state change between
render and callback), the fixed functions SHALL produce the same user-visible wallet balance,
net profit, standings sort, casino payout, and game state as the original code.

**Validates: Requirements 3.1–3.17**

---

## Fix Implementation

### Changes Required

Assuming the root cause analysis is correct, all fixes are contained within four files.

---

**File:** `src/App.tsx`

**Function:** `handleUpdateBalanceCasino`

**Specific Changes:**
1. **Change signature accepted value from absolute to delta**: Rename parameter from `newBalance`
   to `delta` (or keep the same name but document the contract change). Update the body to:
   ```typescript
   const handleUpdateBalanceCasino = (delta: number) => {
     if (!userProfile) return;
     setUserProfile(prev => {
       if (!prev) return prev;
       const updated = {
         ...prev,
         balance: Math.round((prev.balance + delta) * 100) / 100,
         netProfit: Math.round((prev.netProfit + delta) * 100) / 100
       };
       if (gameMode) {
         localStorage.setItem(
           getKeysForMode(gameMode, activeSlot).profile,
           JSON.stringify(updated)
         );
       }
       return updated;
     });
   };
   ```
2. **Update `GameProps` interface** in `src/components/casino/shared.tsx`: rename
   `onUpdateBalance: (newBalance: number) => void` to `onUpdateBalance: (delta: number) => void`
   and update the JSDoc comment to clarify it accepts a signed delta (positive = gain, negative = loss).

---

**File:** `src/components/casino/SpinTheBottleGame.tsx`

**Function:** `handleSpin`

**Specific Changes:**
1. **Remove pre-spin absolute call** — replace `onUpdateBalance(balance - safeStake)` with
   `onUpdateBalance(-safeStake)`.
2. **Fix FREEZE callback** — replace `onUpdateBalance(balance - safeStake + safeStake)` with
   `onUpdateBalance(safeStake)` (returns the stake that was just deducted).
3. **Fix WIN callback** — replace `onUpdateBalance(balance - safeStake + payout)` with
   `onUpdateBalance(payout - safeStake + safeStake)` = `onUpdateBalance(payout)`. Since the stake
   was already deducted in the pre-spin call, the callback delta is simply `+payout` (the full
   win amount including stake return): net = `-safeStake + payout`. Simplest form:
   pre-spin sends `-safeStake`, callback sends `+payout` on WIN (2.2× includes stake return), so
   callback delta = `payout` = `safeStake * 2.2`.
4. **Fix LOSS callback** — no `onUpdateBalance` call needed; stake was already deducted.
   Remove the existing (implicit) no-op.
5. **Visual angle verification** — confirm the `offsetDeg` bands match the nozzle geometry:
   UP → `[-40, +40]`, DOWN → `[140, 220]`, FREEZE → `{90, 270}`. No code change needed here
   unless a regression is found during exploratory testing.

---

**File:** `src/components/casino/RedOrBlackGame.tsx`

**Functions:** `selectColor`, `resolveRound`, `handleCashout`

**Specific Changes:**
1. **Remove `balanceAtStartRef`** — this ref is the source of Bug 4. It is no longer needed once
   we switch to delta-based updates.
2. **Fix `selectColor` initial deduction** — replace `onUpdateBalance(balance - wager)` with
   `onUpdateBalance(-wager)`.
3. **Fix `resolveRound` WIN branch** — replace
   `onUpdateBalance(balStart - origWager + newPool)` with `onUpdateBalance(newPool)`.
   Rationale: the stake was already deducted at streak start; the win payout is the full `newPool`
   value (which already represents the multiplied amount on the original wager). Net delta from
   streak start = `-origWager + newPool`. The deduction is already applied, so callback = `+newPool`.
4. **Fix `handleCashout`** — replace `onUpdateBalance(balStart - origWager + finalPool)` with
   `onUpdateBalance(finalPool)`.
5. **JOKER and LOSS branches** — no `onUpdateBalance` call needed (stake already deducted at
   streak start). Verify that neither branch currently calls `onUpdateBalance` — confirmed: they do
   not. No change needed for those branches.

---

**File:** `src/components/LeagueStandings.tsx`

**Component:** `LeagueStandings` — standings table wrapper

**Specific Changes:**
1. **Add `overflow-y-auto` and `max-height`** to the `<div>` that wraps the `<table>`:
   ```tsx
   // Before:
   <div className="overflow-x-auto font-sans">
   // After:
   <div className="overflow-x-auto overflow-y-auto max-h-[480px] font-sans">
   ```
   `480px` accommodates all 16 rows (each ~48px) with a small buffer. The exact value can be
   adjusted to `max-h-[500px]` or use a responsive class. The key requirement is that all 16 rows
   are scrollable on any viewport height ≥ 400px.

---

**File:** `src/components/casino/shared.tsx` (minor)

**Interface:** `GameProps`

**Specific Changes:**
1. Update the JSDoc on `onUpdateBalance` to document the delta contract.
2. No runtime behaviour change in this file.

---

### Other Casino Components

The same stale-closure pattern exists in `FootballSlotsGame.tsx`, `OverUnderDiceGame.tsx`,
`PaddockRushGame.tsx`, `PenaltyShootoutGame.tsx`, and `PlinkoGame.tsx`. These are not listed as
primary bugs but should be migrated to delta-based `onUpdateBalance` calls in the same pass to
prevent identical bugs resurfacing. The task list should include a sweep of all casino components.

---

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach:
1. **Exploratory** — run tests against the unfixed code to observe failures and confirm the root
   cause hypotheses. If a test passes unexpectedly on unfixed code, the hypothesis needs revision.
2. **Fix + Preservation** — after applying fixes, verify all bug-condition tests pass and all
   preservation tests continue to pass.

---

### Exploratory Bug Condition Checking

**Goal:** Surface counterexamples demonstrating each bug on unfixed code. Confirm or refute the
stale-closure hypothesis for each casino component.

**Test Plan:** Create a test harness that mocks `onUpdateBalance` and simulates a concurrent state
change between render and `setTimeout` resolution. Assert the expected delta; observe the actual
incorrect absolute value on unfixed code.

**Test Cases:**
1. **SpinTheBottleGame — WIN with mid-spin state change** (will fail on unfixed code):
   Render with `balance = 200`, stake = 50. Simulate emergency grant firing mid-spin (state → 650).
   Assert final balance = 760 (650 + 110). Observe: 260 (uses stale $200).

2. **SpinTheBottleGame — FREEZE with mid-spin state change** (will fail on unfixed code):
   Render with `balance = 200`, stake = 50. Deduction fires → state = 150. Emergency grant → 650.
   FREEZE callback: assert balance = 700 (650 + 50). Observe: 200 (balStart - stake + stake).

3. **RedOrBlackGame — WIN with mid-streak balance change** (will fail on unfixed code):
   Streak start balance = 500, wager = 50. Mid-streak grant → state = 900. Round 4 WIN, pool = 1400.
   Assert balance = 2250 (900 + 1350). Observe: 1850 (500 - 50 + 1400).

4. **RedOrBlackGame — CASHOUT with mid-streak balance change** (will fail on unfixed code):
   Streak start = 500, wager = 50. Grant mid-streak → 900. Cashout round 2, pool = 275.
   Assert balance = 1125 (900 + 225). Observe: 725 (500 - 50 + 275).

5. **LeagueStandings — All 16 rows rendered** (will fail on unfixed code):
   Render with 16 teams. Assert rendered `<tr>` count = 16 AND container has
   `overflow-y: auto` or `overflow-y: scroll`. Observe: 16 `<tr>` exist in DOM but are visually
   clipped; container has no scroll style.

**Expected Counterexamples:**
- Casino callbacks produce balances `safeStake` lower or higher than expected when mid-spin
  state changes occur.
- Possible root causes confirmed: stale `balance` prop, `balStart` ref reconstructing absolute value.

---

### Fix Checking

**Goal:** Verify that for all inputs where the bug condition holds, the fixed functions produce the
expected correct behavior.

**Pseudocode:**
```
FOR ALL X WHERE isBugCondition_StaleClosureCasino(X) DO
  result := handleUpdateBalanceCasino_fixed(X.delta)
  ASSERT result.balance = prevState.balance + X.delta
END FOR

FOR ALL X WHERE isBugCondition_FreezeStakeReturn(X) DO
  result := handleSpin_fixed(X)
  ASSERT result.balance = X.stateBeforeCallback + X.safeStake
END FOR

FOR ALL X WHERE isBugCondition_StandingsOverflow(X) DO
  renderedRows := LeagueStandings_fixed(X)
  ASSERT renderedRows.count = 16
  ASSERT containerOverflowY IN ["auto", "scroll"]
END FOR

FOR ALL X WHERE isBugCondition_RedOrBlackBalStart(X) DO
  result := resolveRound_fixed(X)
  ASSERT result.balance = X.currentStateBalance + (X.newPool - X.origWager)
END FOR

FOR ALL X WHERE isBugCondition_SpinBottleDoubleDeduct(X) DO
  result := handleSpin_fixed(X)
  net_change = result.balance - X.balanceBeforeSpin
  ASSERT net_change = X.payout - X.safeStake   // WIN
  OR net_change = 0                              // FREEZE
  OR net_change = -X.safeStake                  // LOSS
END FOR
```

---

### Preservation Checking

**Goal:** Verify that for all inputs where no bug condition holds (no concurrent state change),
the fixed functions produce the same result as the original functions.

**Pseudocode:**
```
FOR ALL X WHERE NOT isBugCondition_*(X) DO
  ASSERT F_original(X) = F_fixed(X)
  // Balance arithmetic unchanged for non-concurrent casino resolves
  // Sports betting settlement, wallet modal unchanged
  // Standings sort, color highlights, row click unchanged
  // Casino multipliers, payout ratios, JOKER/FREEZE probabilities unchanged
  // localStorage keys and schema unchanged
END FOR
```

**Testing Approach:** Property-based testing is well-suited here because:
- It generates many random stake values, balance levels, and game outcomes automatically.
- It catches arithmetic edge cases (zero balance, balance exactly equal to stake, large balances).
- It provides a strong guarantee that the delta refactor didn't introduce off-by-one or rounding errors.

**Test Cases:**
1. **Isolation test — no concurrent change** (must pass on both unfixed and fixed code):
   Render SpinTheBottleGame with fixed balance; let spin resolve with no mid-spin state change.
   Assert balance = `initialBalance - safeStake + payout` (WIN), `initialBalance` (FREEZE),
   `initialBalance - safeStake` (LOSS). This must be identical before and after the fix.

2. **Standings sort preservation**: Render LeagueStandings before and after adding scroll. Assert
   the `team.id` order in rendered rows is identical. Assert row click fires `open-global-entity`.

3. **Red or Black multipliers preservation**: Run 1000 simulated rounds with mocked random.
   Assert that WIN round 4 produces exactly `28.0 × origWager`, CASHOUT round 2 produces `5.5 ×
   origWager`, JOKER produces 0 payout. Values must match pre-fix.

4. **Sports bet settlement preservation**: Call `handleAdvanceRound` before and after changes to
   `App.tsx`. Assert `totalWinPayoutSum` calculation and `netProfit` recalculation are unchanged.

---

### Unit Tests

- Test `handleUpdateBalanceCasino` with a functional state updater mock: assert `prev.balance + delta`
  is used, not an absolute value.
- Test `SpinTheBottleGame.handleSpin` WIN/LOSS/FREEZE outcomes in isolation with a spy on
  `onUpdateBalance`: verify exactly one delta call per outcome type, correct delta value.
- Test `RedOrBlackGame.resolveRound` WIN/CASHOUT outcomes: verify `onUpdateBalance` receives
  `+newPool` (not `balStart - origWager + newPool`).
- Test `LeagueStandings` renders exactly 16 `<tr>` elements with 16 teams in props.
- Test `LeagueStandings` table wrapper has `overflow-y: auto` computed style.
- Test edge cases: zero balance (casino games reject the spin), stake = full balance (FREEZE returns
  all), round 1 cashout (disabled — only allowed from round 2+).

### Property-Based Tests

- **Delta arithmetic invariant**: For any `prevBalance ∈ [0, 100000]` and `delta ∈ [-prevBalance, prevBalance * 5]`,
  `handleUpdateBalanceCasino(delta)` produces `prevBalance + delta` (rounded to 2 dp).
- **Spin outcome net change**: For any `safeStake ∈ [1, balance]` and any outcome, the net balance
  change equals exactly `payout - safeStake` (WIN), `0` (FREEZE), `-safeStake` (LOSS).
- **Red or Black pool invariant**: For any `origWager ∈ [1, balance]` and any round ∈ [1, 4], the
  balance delta on WIN = `origWager × ROUND_MULTIS[round-1] - origWager`. Verify across many wager/
  round combinations.
- **Standings idempotency**: For any permutation of 16 teams, sorted standings order is stable and
  deterministic.

### Integration Tests

- Full casino session: play Spin the Bottle and Red or Black back-to-back, assert cumulative balance
  matches the sum of individual deltas from a tracked `netProfit` baseline.
- Concurrent emergency-grant + spin resolve: assert balance reflects both changes additively.
- League mode full render: navigate to standings tab, scroll container, verify all 16 team rows
  are reachable without layout overflow.
- Round advance after casino play: assert sports bet payout is correctly added on top of
  casino-modified balance.
