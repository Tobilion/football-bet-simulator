# CU Bet — Live Site Bug Hunt

Read `CLAUDE.md` first. **No new features, no refactors** — this session is find-and-log only (fixes come in a later session, prioritized from the log).

## Mission
Systematically test the live site at **https://football-bet-simulator.vercel.app/** using the Chrome browser tools and log every bug found into `BUGS.md` in this folder.

## Known bug to start with (confirmed)
Casino "Live Sessions" showed **Paddock Rush +$71,013,020,941.96 at 2.02x cashout** — a payout worth $71 billion from a ~2x multiplier. Likely a payout/multiplier calculation or compounding overflow in the casino engine. Reproduce, find the root cause in `src/components/casino/`, and log it first.

## Test plan — walk every flow in this order
1. **Betting core:** place 2–3 singles in one slip (different stakes), an ACCA, and a Bet Builder ticket. Note wallet deductions. Advance/watch matches. Verify every ticket settles with the mathematically correct payout (stake × odds per winning single; combined odds for ACCA). Check My Bets displays match reality.
2. **Live matches:** watch a match live — check score consistency between commentary, scoreboard, and final result; check in-play odds react; try Cash Out mid-match (value sane? suspends correctly?).
3. **Casino (all 16 games):** play each briefly. Watch for: payouts inconsistent with stated multipliers (see known bug), balance going negative, NaN/undefined displays, games that freeze or double-pay.
4. **Club ownership & transfers:** buy a club, sign a player, sell the club, re-buy. Check money conservation at every step (no cash appearing/vanishing).
5. **Round advance & season:** advance several rounds; check league table math, fixtures generation, champion crowned correctly, challenges progress/expire sanely.
6. **Wallet & profile:** deposit/adjust wallet, check net profit math against actual bet history; refresh page mid-flow to test localStorage persistence.
7. **Console:** keep checking read_console_messages after each flow — log every error/warning with its trigger.

## Logging format — append to `BUGS.md`
For each bug:
```
## BUG-NN: <one-line title>
- Severity: critical | major | minor | cosmetic
- Where: <page/component>
- Repro: <numbered steps>
- Expected vs actual: <one line each>
- Suspected cause: <file/function if identifiable from the codebase>
- Console output: <if any>
```
Order the final file by severity. End the session with a summary: total bugs by severity, and the top 3 to fix first.

## Rules
- Test in the browser like a user; use the codebase only to identify suspected causes.
- If a flow can't be tested (needs long waits), note it as UNTESTED rather than guessing.
- Do not fix anything in this session — log only.
