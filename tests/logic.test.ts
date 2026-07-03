/**
 * Pure-logic test suite. Run with: npx tsx tests/logic.test.ts
 */
import { didSelectionWin, settlePendingTickets } from "../src/utils/betSettlement";
import { calculateBetBuilderOdds, validateBetBuilderSelections, settleBetBuilderTicket } from "../src/utils/betBuilderUtils";
import { calculateCashOutValue, isCashOutEligible } from "../src/utils/cashOutUtils";
import { calculateImpliedProbability, applyOwnerBoost } from "../src/utils/oddsUtils";
import * as w from "../src/utils/wallet";
import { getLiveInPlayOdds } from "../src/utils";
import { generateMatchOdds, simulateFullMatchInstantly, calculateTeamRating } from "../src/engine/matchEngine";
import type { BetSelection, BetTicket, Fixture, Team } from "../src/types";

let pass = 0, fail = 0;
function ok(cond: boolean, name: string) {
  if (cond) { pass++; } else { fail++; console.log("  ❌ FAIL:", name); }
}

// ---------- helpers ----------
function fx(over: Partial<Fixture> = {}): Fixture {
  return {
    id: "f1", homeTeamId: "h", awayTeamId: "a", roundIndex: 0, status: "FT",
    homeScore: 1, awayScore: 1, currentMinute: 90, elapsedTicks: 0,
    events: [], odds: {} as any, weather: "CLEAR" as any,
    stats: {
      home: { corners: 4, yellowCards: 1, redCards: 0, saves: 3, shots: 5, shotsOnTarget: 3, fouls: 5, possession: 50 },
      away: { corners: 3, yellowCards: 2, redCards: 1, saves: 2, shots: 4, shotsOnTarget: 2, fouls: 6, possession: 50 },
    } as any,
    ...over,
  } as Fixture;
}
function sel(marketType: string, selectionId: string, odds = 2): BetSelection {
  return { fixtureId: "f1", marketType: marketType as any, selectionId, odds, details: "", marketName: "" };
}

// ---------- Match winner / double chance / BTTS ----------
console.log("betSettlement.didSelectionWin");
ok(didSelectionWin(sel("MATCH_WINNER", "HOME"), fx({ homeScore: 2, awayScore: 0 })), "MW home win");
ok(!didSelectionWin(sel("MATCH_WINNER", "HOME"), fx({ homeScore: 0, awayScore: 2 })), "MW home loss");
ok(didSelectionWin(sel("MATCH_WINNER", "DRAW"), fx({ homeScore: 1, awayScore: 1 })), "MW draw");
ok(didSelectionWin(sel("DOUBLE_CHANCE", "HOME_OR_DRAW"), fx({ homeScore: 1, awayScore: 1 })), "DC 1X on draw");
ok(!didSelectionWin(sel("DOUBLE_CHANCE", "HOME_OR_DRAW"), fx({ homeScore: 0, awayScore: 1 })), "DC 1X on away win");
ok(didSelectionWin(sel("BOTH_TEAMS_TO_SCORE", "YES"), fx({ homeScore: 1, awayScore: 1 })), "BTTS yes");
ok(didSelectionWin(sel("BOTH_TEAMS_TO_SCORE", "NO"), fx({ homeScore: 2, awayScore: 0 })), "BTTS no");
ok(didSelectionWin(sel("EXACT_SCORE", "2-1"), fx({ homeScore: 2, awayScore: 1 })), "exact score");

// ---------- Over/Under parsing (the OVER_2_5 format bug) ----------
console.log("Over/Under goals — OVER_x_y selection id format");
ok(didSelectionWin(sel("OVER_UNDER_GOALS", "OVER_2_5"), fx({ homeScore: 2, awayScore: 1 })), "Over 2.5 wins with 3 goals");
ok(!didSelectionWin(sel("OVER_UNDER_GOALS", "OVER_2_5"), fx({ homeScore: 1, awayScore: 1 })), "Over 2.5 loses with 2 goals");
ok(didSelectionWin(sel("OVER_UNDER_GOALS", "UNDER_2_5"), fx({ homeScore: 1, awayScore: 1 })), "Under 2.5 WINS with exactly 2 goals (was the bug)");
ok(didSelectionWin(sel("OVER_UNDER_GOALS", "UNDER_0_5"), fx({ homeScore: 0, awayScore: 0 })), "Under 0.5 wins with 0 goals (was impossible)");
ok(!didSelectionWin(sel("OVER_UNDER_GOALS", "UNDER_0_5"), fx({ homeScore: 1, awayScore: 0 })), "Under 0.5 loses with 1 goal");
// dot format (corners/cards use OVER_9.5)
ok(didSelectionWin(sel("OVER_UNDER_CORNERS", "OVER_6.5"), fx()), "Over 6.5 corners wins with 7");
ok(!didSelectionWin(sel("OVER_UNDER_CORNERS", "UNDER_6.5"), fx()), "Under 6.5 corners loses with 7");
ok(didSelectionWin(sel("OVER_UNDER_CARDS", "OVER_3.5"), fx()), "Over 3.5 cards wins with 4");
ok(didSelectionWin(sel("OVER_UNDER_SAVES", "UNDER_5.5"), fx()), "Under 5.5 saves wins with 5");

// ---------- Goalscorer ----------
ok(didSelectionWin(sel("ANYTIME_GOALSCORER", "p9"),
  fx({ events: [{ minute: 10, type: "GOAL", playerId: "p9", commentary: "" } as any] })), "goalscorer win");
ok(!didSelectionWin(sel("ANYTIME_GOALSCORER", "p9"),
  fx({ events: [{ minute: 10, type: "GOAL", playerId: "p7", commentary: "" } as any] })), "goalscorer loss");

// ---------- Ticket settlement ----------
console.log("settlePendingTickets");
const accTicket: BetTicket = {
  id: "t1", type: "ACCUMULATOR", selections: [sel("MATCH_WINNER", "HOME", 2), sel("BOTH_TEAMS_TO_SCORE", "NO", 1.8)],
  totalOdds: 3.6, stake: 10, potentialPayout: 36, status: "PENDING", timestamp: 0,
};
{
  const { finalTickets, totalWinPayoutSum } = settlePendingTickets([accTicket], [fx({ homeScore: 2, awayScore: 0 })]);
  ok(finalTickets[0].status === "WON" && totalWinPayoutSum === 36, "acca wins, payout 36");
}
{
  const { finalTickets, totalWinPayoutSum } = settlePendingTickets([accTicket], [fx({ homeScore: 2, awayScore: 1 })]);
  ok(finalTickets[0].status === "LOST" && totalWinPayoutSum === 0, "acca loses on one leg");
}
{
  // fixture not completed → stays pending
  const { finalTickets } = settlePendingTickets([accTicket], []);
  ok(finalTickets[0].status === "PENDING", "acca stays pending when fixture missing");
}
{
  const single: BetTicket = {
    id: "t2", type: "SINGLE",
    selections: [sel("MATCH_WINNER", "HOME", 2), sel("MATCH_WINNER", "DRAW", 3)],
    totalOdds: 1, stake: 20, potentialPayout: 0, status: "PENDING", timestamp: 0,
    selectionStakes: { "f1-MATCH_WINNER-HOME": 10, "f1-MATCH_WINNER-DRAW": 10 },
  };
  const { finalTickets, totalWinPayoutSum } = settlePendingTickets([single], [fx({ homeScore: 2, awayScore: 0 })]);
  ok(finalTickets[0].status === "WON" && totalWinPayoutSum === 20, "multi-single: winning leg pays 10×2");
}

// ---------- Bet builder ----------
console.log("betBuilderUtils");
ok(Math.abs(calculateBetBuilderOdds([{ odds: 2 } as any, { odds: 2 } as any]) - 3.72) < 1e-9, "builder odds 2×2 with 7% discount = 3.72");
ok(calculateBetBuilderOdds([]) === 1, "empty builder = 1");
ok(validateBetBuilderSelections([sel("MATCH_WINNER", "HOME") as any]) !== null, "builder needs 2+ legs");
ok(validateBetBuilderSelections([sel("MATCH_WINNER", "HOME") as any, sel("EXACT_SCORE", "1-0") as any]) !== null, "two outcome markets rejected");
ok(validateBetBuilderSelections([
  sel("OVER_UNDER_GOALS", "OVER_2_5") as any, sel("OVER_UNDER_GOALS", "UNDER_2_5") as any,
]) !== null, "conflicting O/U same line rejected");
ok(validateBetBuilderSelections([
  sel("MATCH_WINNER", "HOME") as any, sel("OVER_UNDER_GOALS", "UNDER_2_5") as any,
]) === null, "valid builder passes");
{
  const t = { selections: [sel("MATCH_WINNER", "HOME"), sel("OVER_UNDER_GOALS", "UNDER_2_5")] } as any;
  ok(settleBetBuilderTicket(t, fx({ homeScore: 2, awayScore: 0 })) === "WON", "builder settles: home win + under 2.5 with 2 goals (was the bug)");
  ok(settleBetBuilderTicket(t, fx({ homeScore: 2, awayScore: 1 })) === "LOST", "builder loses on over line");
}

// ---------- Cash out ----------
console.log("cashOutUtils");
{
  const t: BetTicket = { ...accTicket, selections: [sel("MATCH_WINNER", "HOME", 2)] , potentialPayout: 20};
  const liveFx = fx({ status: "LIVE", currentMinute: 60, homeScore: 1, awayScore: 0 });
  ok(isCashOutEligible(t, [liveFx]), "eligible when live");
  ok(!isCashOutEligible({ ...t, status: "WON" }, [liveFx]), "not eligible when settled");
  const v = calculateCashOutValue(t, [liveFx], { "MATCH_WINNER:HOME": 1.3 });
  // factor = 2/1.3, payout 20 → 20*(2/1.3)*0.92 ≈ 28.31
  ok(v !== null && Math.abs(v - 28.31) < 0.02, `winning live position pays above stake (got ${v})`);
  ok(calculateCashOutValue(t, [liveFx], { "MATCH_WINNER:HOME": null }) === null, "suspended market → null");
  ok(calculateCashOutValue(t, [fx({ homeScore: 0, awayScore: 1 })], {}) === 0, "dead ticket (FT lost) → 0");
  const won = calculateCashOutValue(t, [fx({ homeScore: 2, awayScore: 0 })], {});
  ok(won !== null && Math.abs(won - 18.4) < 0.01, "FT won leg → payout × 0.92");
  // Under 2.5 leg at FT with 2 goals must count as WON post-fix
  const t2: BetTicket = { ...accTicket, selections: [sel("OVER_UNDER_GOALS", "UNDER_2_5", 2)], potentialPayout: 20 };
  const v2 = calculateCashOutValue(t2, [fx({ homeScore: 1, awayScore: 1 })], {});
  ok(v2 !== null && v2 > 0, "cashout: under 2.5 with 2 goals is WON (was the bug)");
  // SCHEDULED leg: pre-match cash-out should be ~ stake (implied prob), not payout
  const schedT: BetTicket = { ...accTicket, selections: [sel("MATCH_WINNER", "HOME", 2)], stake: 10, potentialPayout: 20 };
  const pre = calculateCashOutValue(schedT, [fx({ status: "SCHEDULED" })], {});
  ok(pre !== null && Math.abs(pre - 9.2) < 0.01, `pre-match cashout ~= stake x 0.92 (got ${pre})`);

}

// ---------- Odds utils ----------
console.log("oddsUtils");
ok(calculateImpliedProbability(2) === 0.5, "implied prob 2.0 → 0.5");
ok(calculateImpliedProbability(0) === 0, "implied prob 0 → 0");
ok(applyOwnerBoost(null, true) === null, "owner boost null-safe");
ok(applyOwnerBoost(2, false) === 2, "no boost when not owner match");
ok(applyOwnerBoost(1.02, true)! >= 1.01, "boost floors at 1.01");

// ---------- Live in-play odds sanity ----------
console.log("getLiveInPlayOdds");
{
  const liveFx = fx({ status: "LIVE", currentMinute: 30, homeScore: 0, awayScore: 0 });
  const o = getLiveInPlayOdds(liveFx, "OVER_UNDER_GOALS", "OVER_2_5", 1.9);
  ok(o === null || (typeof o === "number" && o >= 1.01), "O/U live odds valid or suspended");
  ok(getLiveInPlayOdds(fx(), "MATCH_WINNER", "HOME", 2) === null, "FT fixture → null");
  ok(getLiveInPlayOdds(fx({ status: "SCHEDULED" }), "MATCH_WINNER", "HOME", 2) === 2, "scheduled → base odds");
  // covered line suspends
  const covered = fx({ status: "LIVE", currentMinute: 50, homeScore: 2, awayScore: 1 });
  ok(getLiveInPlayOdds(covered, "OVER_UNDER_GOALS", "OVER_2_5", 1.9) === null, "already-covered O/U line suspended");
}

// ---------- Match engine ----------
console.log("matchEngine (200 simulated matches)");
{
  const mkPlayer = (i: number, teamId: string, pos: string) => ({
    id: `${teamId}-p${i}`, name: `P${i}`, teamId, position: pos, rating: 60 + (i % 30), age: 25,
    fatigue: 0, injured: false, injuryRecoveryMatches: 0, goals: 0, assists: 0, saves: 0,
    yellowCards: 0, redCards: 0, matchesPlayed: 0,
    seasonStats: { goals: 0, assists: 0, saves: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, motmAwards: 0 },
  });
  const mkTeam = (id: string): Team => ({
    id, name: id, shortName: id.slice(0, 3).toUpperCase(), rating: 3, primaryColor: "#fff", secondaryColor: "#000",
    players: [mkPlayer(0, id, "GK"), ...Array.from({ length: 10 }, (_, i) => mkPlayer(i + 1, id, i < 4 ? "DF" : i < 8 ? "MF" : "FW"))] as any,
    wonMatches: 0, drawnMatches: 0, lostMatches: 0, goalsScored: 0, goalsConceded: 0, morale: 60, rivalClubIds: [],
  });
  const home = mkTeam("alpha"), away = mkTeam("beta");
  ok(calculateTeamRating(home) > 0, "team rating positive");
  const odds = generateMatchOdds(home, away);
  ok(odds.homeWin >= 1.01 && odds.draw >= 1.01 && odds.awayWin >= 1.01, "generated odds all >= 1.01");
  const impliedSum = 1 / odds.homeWin + 1 / odds.draw + 1 / odds.awayWin;
  ok(impliedSum > 1 && impliedSum < 1.4, `1X2 overround sane (${impliedSum.toFixed(3)})`);

  let bad = 0;
  for (let i = 0; i < 200; i++) {
    const f = fx({ status: "SCHEDULED", homeScore: 0, awayScore: 0, currentMinute: 0, odds, events: [] });
    const done = simulateFullMatchInstantly(JSON.parse(JSON.stringify(f)), JSON.parse(JSON.stringify(home)), JSON.parse(JSON.stringify(away)));
    const h = Math.floor(done.homeScore), a = Math.floor(done.awayScore);
    if (done.status !== "FT") bad++;
    if (h < 0 || a < 0 || h > 15 || a > 15 || !Number.isFinite(h) || !Number.isFinite(a)) bad++;
    const goalEvents = done.events.filter((e) => e.type === "GOAL").length;
    if (goalEvents !== h + a) bad++;
    const st = done.stats;
    if (st && (st.home.corners < 0 || st.away.corners < 0 || st.home.yellowCards < 0)) bad++;
  }
  ok(bad === 0, `all 200 sims valid (FT status, scores 0–15, GOAL events == scoreline, stats ≥ 0) — ${bad} bad`);
}


// ---------- Round-settlement integration (money path) ----------
console.log("round settlement integration");
{
  // Mixed tickets settled against one completed round, balance math end-to-end
  const round = [
    fx({ id: "m1", homeScore: 2, awayScore: 1 }),
    fx({ id: "m2", homeScore: 0, awayScore: 0 }),
  ];
  const mkSel = (fid: string, mt: string, sid: string, odds: number): BetSelection =>
    ({ fixtureId: fid, marketType: mt as any, selectionId: sid, odds, details: "", marketName: "" });
  const tickets: BetTicket[] = [
    { id: "a", type: "ACCUMULATOR", selections: [mkSel("m1","MATCH_WINNER","HOME",2), mkSel("m2","OVER_UNDER_GOALS","UNDER_2.5",1.5)],
      totalOdds: 3, stake: 10, potentialPayout: 30, status: "PENDING", timestamp: 0 },
    { id: "b", type: "ACCUMULATOR", selections: [mkSel("m2","BOTH_TEAMS_TO_SCORE","YES",1.8)],
      totalOdds: 1.8, stake: 5, potentialPayout: 9, status: "PENDING", timestamp: 0 },
    { id: "c", type: "SINGLE", selections: [mkSel("m1","EXACT_SCORE","2-1",8), mkSel("m1","MATCH_WINNER","AWAY",4)],
      totalOdds: 1, stake: 4, potentialPayout: 0, status: "PENDING", timestamp: 0,
      selectionStakes: { "m1-EXACT_SCORE-2-1": 2, "m1-MATCH_WINNER-AWAY": 2 } },
  ];
  const { finalTickets, totalWinPayoutSum } = settlePendingTickets(tickets, round);
  ok(finalTickets[0].status === "WON", "acca (dot-form UNDER_2.5) wins");
  ok(finalTickets[1].status === "LOST", "BTTS yes loses on 0-0");
  ok(finalTickets[2].status === "WON" && finalTickets[2].settledPayout === 16, "multi-single pays only exact-score leg (2x8)");
  ok(totalWinPayoutSum === 46, `total payout 30+16=46 (got ${totalWinPayoutSum})`);
}

// ---------- Wallet helpers ----------
console.log("wallet");
{
  ok(w.debit(100, 30) === 70, "debit ok");
  ok(w.debit(100, 100.005) === null, "overdraft rejected");
  ok(w.debit(100, 0) === null, "zero debit rejected");
  ok(w.debit(100, -5) === null, "negative debit rejected");
  ok(w.credit(10.111, 0.111) === 10.22, "credit rounds to cents");
  ok(w.credit(50, -10) === 50, "negative credit ignored");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
