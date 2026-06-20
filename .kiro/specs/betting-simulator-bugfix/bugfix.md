# Bugfix Requirements Document

## Introduction

This document covers five interconnected bugs in the football tournament betting simulator app, plus a code modularity improvement request. The bugs affect core gameplay systems: the player wallet, casino game outcomes, league standings rendering, and two casino mini-game display/logic desync issues. Together they degrade the reliability of the financial feedback loop and the accuracy of game results.

---

## Bug Analysis

### Current Behavior (Defect)

**Bug 1: Wallet Balance Not Correctly Incremented After Casino Games**

1.1 WHEN a casino game calls `onUpdateBalance(newBalance)` with an absolute new balance value THEN the system incorrectly computes `netProfit` as `newBalance - prev.balance`, using a stale captured `balance` prop instead of the functional state value, causing net profit to drift or double-count.

1.2 WHEN a casino game resolves a win or payout inside a `setTimeout` callback THEN the system reads the `balance` variable from the outer component closure (captured at render time), which may be stale by the time the callback fires, producing an incorrect final balance value.

1.3 WHEN multiple rapid casino interactions occur in sequence THEN the system produces an incorrect cumulative balance because each callback independently captures the same stale `balance` snapshot rather than chaining off the latest state.

**Bug 2: Emergency Funds Button Shows "+0.00" in Live Rolling Spins and Balance Glitches**

1.4 WHEN the emergency funds grant is triggered during a live spin animation (inside a `setTimeout`) THEN the system displays "+0.00" in the live rolling payout display instead of the actual granted amount, because the grant amount is computed from a stale `balance` prop captured before the spin deducted the stake.

1.5 WHEN the Spin the Bottle FREEZE outcome fires THEN the system calls `onUpdateBalance(balance - safeStake + safeStake)` where `balance` is the pre-spin render-time value (before deduction), effectively applying a no-op instead of returning the stake to the already-decremented state balance.

1.6 WHEN the emergency funds button is clicked while a casino round is in progress THEN the system applies the grant to a stale balance snapshot, causing the wallet to "glitch" by briefly showing an incorrect intermediate value before re-rendering.

**Bug 3: League Standings Table Only Shows 9 Teams**

1.7 WHEN the League Standings component renders with 16 teams THEN the system displays only approximately 9 team rows, with the remaining rows visually cut off due to an absent or insufficient overflow/scroll setting on the standings table container.

1.8 WHEN the user scrolls within the standings panel THEN the system does not allow scrolling through the full 16-row table because the standings table's container `div` does not have overflow-y scroll enabled with an appropriate max height.

**Bug 4: Red or Black Game — Display vs. Logic Desync**

1.9 WHEN the Red or Black game calls `onUpdateBalance` to settle a multi-round streak THEN the system passes `balStart - origWager + newPool` where `balStart` is the balance captured at the very start of the streak (before any rounds), causing incorrect balance settlement when the balance has changed between streak rounds (e.g., from a concurrent emergency funds grant or other state update).

1.10 WHEN the Red or Black game resolves a WIN or JOKER outcome inside `setTimeout` THEN the system calls `setRound(0)` and then immediately calls `onUpdateBalance(balStart - origWager + newPool)`, but `balStart` is captured in a ref at streak start rather than reacting to the most recent balance, potentially applying a double-deduction or incorrect payout if the wallet state changed during the streak.

**Bug 5: Spin the Bottle — Visual Spin Result Does Not Match Declared Outcome**

1.11 WHEN the Spin the Bottle game deducts the stake and then resolves inside a `setTimeout` THEN the system calls `onUpdateBalance(balance - safeStake + payout)` using the `balance` value captured from the closure at render time (which is the pre-deduction balance), effectively double-applying the deduction and producing a wallet value that is `safeStake` lower than expected on a win.

1.12 WHEN the FREEZE outcome occurs inside the `setTimeout` THEN the system calls `onUpdateBalance(balance - safeStake + safeStake)` where `balance` is the stale pre-spin closure value, resulting in the stake being deducted twice instead of being returned to the player.

1.13 WHEN the spin animation finalises and `setRotationDegrees` is called with the final offset THEN the system may not reliably reflect whether the visual bottle nozzle points to the upper or lower zone in edge cases near the midline (within the 40° variance window), causing the visual and declared result to appear inconsistent to the player.

**Bug 6: Code Modularity — Codebase Needs Refactoring**

1.14 WHEN a developer needs to modify wallet balance logic THEN the system requires changes in multiple disconnected locations (`App.tsx` `handleUpdateBalanceCasino`, each individual casino game component) because balance update logic is duplicated rather than centralised.

1.15 WHEN a developer reads `App.tsx` THEN the system presents a single monolithic file containing simulation control, bet placement, round advancement, casino integration, wallet management, and UI navigation, making it difficult to isolate and reason about individual concerns.

1.16 WHEN a casino game component resolves an outcome THEN the system requires each component to independently manage the balance arithmetic (stake deduction + payout addition) rather than delegating it to a shared, tested utility.

---

### Expected Behavior (Correct)

**Bug 1: Wallet Balance Not Correctly Incremented After Casino Games**

2.1 WHEN a casino game calls `onUpdateBalance(newBalance)` THEN the system SHALL compute `netProfit` as a delta relative to the most recent `prev.balance` value at the moment the state updater function executes, not the value captured in an earlier closure.

2.2 WHEN a casino game resolves inside a `setTimeout` callback THEN the system SHALL derive the final balance from the most up-to-date functional state, ensuring the payout calculation reflects any balance changes that occurred since the spin/round began.

2.3 WHEN multiple sequential casino interactions complete THEN the system SHALL correctly accumulate balance changes so that the final displayed balance equals the sum of all applied deltas from the starting balance.

**Bug 2: Emergency Funds Button Shows "+0.00" in Live Rolling Spins and Balance Glitches**

2.4 WHEN the FREEZE outcome resolves THEN the system SHALL return the exact `safeStake` amount to the current functional balance state (not a captured closure value), so the player's balance returns to exactly what it was before the spin.

2.5 WHEN the emergency funds grant is applied THEN the system SHALL compute the new balance by adding the grant amount as a delta to the latest functional state balance, regardless of any in-flight spin state.

2.6 WHEN the live payout display renders a grant amount THEN the system SHALL display the correct non-zero grant figure.

**Bug 3: League Standings Table Only Shows 9 Teams**

2.7 WHEN the League Standings component renders THEN the system SHALL display all 16 team rows in the standings table, either by making the container scrollable or by ensuring the layout allocates sufficient vertical space.

2.8 WHEN the user views the standings on a constrained-height viewport THEN the system SHALL allow vertical scrolling within the standings table container so that all 16 rows are reachable.

**Bug 4: Red or Black Game — Display vs. Logic Desync**

2.9 WHEN a Red or Black round resolves with a WIN or CASHOUT THEN the system SHALL compute the payout as a delta applied to the current functional balance state (i.e., add `newPool - origWager` to the latest state balance), rather than reconstructing the absolute balance from `balStart`.

2.10 WHEN any round of the Red or Black streak ends THEN the system SHALL update the balance in a way that is consistent with the displayed "Rolling Pool" value, so the shown pool amount matches exactly what is added to the wallet.

**Bug 5: Spin the Bottle — Visual Spin Result Does Not Match Declared Outcome**

2.11 WHEN a win outcome resolves THEN the system SHALL apply only the net payout delta (add `payout - safeStake` to the current functional state balance), ensuring the single stake deduction performed before the spin is not re-applied inside the callback.

2.12 WHEN the FREEZE outcome resolves THEN the system SHALL add `safeStake` as a delta to the current functional state balance, returning exactly the stake that was previously deducted.

2.13 WHEN a LOSS outcome resolves THEN the system SHALL make no further balance changes (the stake was already deducted before the spin), preserving the correct post-spin balance.

2.14 WHEN the final rotation angle is set THEN the visual bottle nozzle direction SHALL match the declared UP/DOWN/FREEZE outcome with no observable mismatch.

**Bug 6: Code Modularity — Codebase Needs Refactoring**

2.15 WHEN balance-related operations are needed in casino games THEN the system SHALL provide a shared utility or hook (e.g., `useCasinoBalance`) so that stake deduction, payout application, and delta computation are defined in one place and reused across all casino game components.

2.16 WHEN `App.tsx` grows with new features THEN the system SHALL be structured so that simulation logic, bet-placement logic, round-advancement logic, and wallet logic are separated into dedicated modules or hooks that `App.tsx` composes, rather than containing all logic inline.

2.17 WHEN a new casino game is added THEN the system SHALL allow the developer to import a shared `resolveOutcome(delta: number)` function that handles functional state updates correctly, rather than rewriting the closure-capture pattern from scratch.

---

### Unchanged Behavior (Regression Prevention)

**Bug 1: Wallet Balance Not Correctly Incremented After Casino Games**

3.1 WHEN the user places a sports bet and it is resolved at round advance THEN the system SHALL CONTINUE TO correctly add the payout to the balance using the existing `handleAdvanceRound` calculation path.

3.2 WHEN the user deposits or withdraws funds via the Wallet Modal THEN the system SHALL CONTINUE TO correctly update the balance via `handleConfirmWalletTransaction`.

3.3 WHEN the user has a zero or near-zero balance THEN the system SHALL CONTINUE TO prevent casino games from accepting a stake larger than the available balance.

**Bug 2: Emergency Funds Button Shows "+0.00" in Live Rolling Spins and Balance Glitches**

3.4 WHEN the FREEZE outcome does not occur THEN the system SHALL CONTINUE TO correctly deduct the stake and apply win/loss payouts for all other spin outcomes.

3.5 WHEN the emergency funds button is not clicked THEN the system SHALL CONTINUE TO leave the balance unaffected until the next casino game resolution.

**Bug 3: League Standings Table Only Shows 9 Teams**

3.6 WHEN the league standings renders THEN the system SHALL CONTINUE TO sort teams by Points, then Goal Difference, then Goals Scored, then Name, as currently implemented.

3.7 WHEN the top 4, spots 5–6, or bottom 2 rows render THEN the system SHALL CONTINUE TO apply the correct Champions League, Europa League, and relegation zone colour highlights.

3.8 WHEN the user clicks a team row THEN the system SHALL CONTINUE TO trigger the global entity modal for that team.

**Bug 4: Red or Black Game — Display vs. Logic Desync**

3.9 WHEN the player correctly guesses the color on all 4 rounds THEN the system SHALL CONTINUE TO award the 28.0x multiplier on the original wager amount.

3.10 WHEN the JOKER card appears THEN the system SHALL CONTINUE TO zero out the rolling pool without returning the stake.

3.11 WHEN the player cashes out between rounds 2 and 4 THEN the system SHALL CONTINUE TO award the current pool value.

3.12 WHEN the player guesses the wrong color THEN the system SHALL CONTINUE TO show a loss message and zero the pool with no payout.

**Bug 5: Spin the Bottle — Visual Spin Result Does Not Match Declared Outcome**

3.13 WHEN the spin animation runs THEN the system SHALL CONTINUE TO animate the bottle rotation for approximately 1800ms before showing the result.

3.14 WHEN the player has insufficient balance THEN the system SHALL CONTINUE TO reject the spin and display an error message without deducting any funds.

3.15 WHEN the player wins THEN the system SHALL CONTINUE TO award a 2.2x payout on the stake.

**Bug 6: Code Modularity — Codebase Needs Refactoring**

3.16 WHEN the refactoring is applied THEN the system SHALL CONTINUE TO produce identical user-facing behaviour for all existing casino games, sports betting, simulation, and wallet features.

3.17 WHEN the refactoring is applied THEN the system SHALL CONTINUE TO persist state to `localStorage` with the same key schema so existing saved games are not invalidated.

---

## Derived Bug Conditions & Properties

### Bug Condition Functions

```pascal
FUNCTION isBugCondition_WalletStaleClosureCasino(X)
  INPUT: X = { casinoGame, balanceAtRender, balanceAtResolution }
  OUTPUT: boolean
  RETURN X.balanceAtRender !== X.balanceAtResolution
    AND casinoGame resolves balance inside setTimeout using balanceAtRender
END FUNCTION

FUNCTION isBugCondition_FreezeStakeReturn(X)
  INPUT: X = { spinOutcome, balanceProp, currentStateBalance }
  OUTPUT: boolean
  RETURN X.spinOutcome = "FREEZE"
    AND X.balanceProp is stale (captured before stake deduction)
END FUNCTION

FUNCTION isBugCondition_StandingsOverflow(X)
  INPUT: X = { numberOfTeams, containerHeight }
  OUTPUT: boolean
  RETURN X.numberOfTeams = 16
    AND containerHeight insufficient to show all rows without overflow-y scroll
END FUNCTION

FUNCTION isBugCondition_RedOrBlackBalStart(X)
  INPUT: X = { balStart, currentBalance, payout }
  OUTPUT: boolean
  RETURN X.balStart !== X.currentBalance
    AND payout is computed as balStart - origWager + newPool
END FUNCTION

FUNCTION isBugCondition_SpinBottleDoubleDeduct(X)
  INPUT: X = { stakeDeductedBeforeSpin, callbackUsesPreSpinBalance }
  OUTPUT: boolean
  RETURN X.stakeDeductedBeforeSpin = true
    AND X.callbackUsesPreSpinBalance = true
END FUNCTION
```

### Fix Checking Properties

```pascal
// Property: Wallet Casino Balance Correctness
FOR ALL X WHERE isBugCondition_WalletStaleClosureCasino(X) DO
  result ← handleUpdateBalanceCasino'(X)
  ASSERT result.balance = X.currentStateBalance + delta
  ASSERT result.netProfit correctly reflects cumulative delta
END FOR

// Property: FREEZE Stake Return
FOR ALL X WHERE isBugCondition_FreezeStakeReturn(X) DO
  result ← handleSpin'(X)
  ASSERT result.balance = X.currentStateBalance + safeStake
END FOR

// Property: Standings Full Team Display
FOR ALL X WHERE isBugCondition_StandingsOverflow(X) DO
  renderedRows ← LeagueStandings'(X)
  ASSERT renderedRows.length = 16
  ASSERT all 16 rows are visually accessible via scroll
END FOR

// Property: Red or Black Balance Settlement
FOR ALL X WHERE isBugCondition_RedOrBlackBalStart(X) DO
  result ← resolveRound'(X)
  ASSERT result.balance = X.currentStateBalance + (newPool - origWager)
END FOR

// Property: Spin Bottle No Double Deduction
FOR ALL X WHERE isBugCondition_SpinBottleDoubleDeduct(X) DO
  result ← handleSpin'(X)
  ASSERT result.balance = X.balanceBeforeSpin - safeStake + payout
  // Only one deduction total; callback uses delta only
END FOR
```

### Preservation Properties

```pascal
// Property: Preservation Checking (applies to all fixes)
FOR ALL X WHERE NOT isBugCondition_*(X) DO
  ASSERT F(X) = F'(X)
  // Sports betting settlement unchanged
  // Wallet modal deposit/withdraw unchanged
  // Casino game multipliers and win conditions unchanged
  // Match simulation engine unchanged
  // Round advancement and standings sort logic unchanged
END FOR
```
