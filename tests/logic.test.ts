/**
 * Pure-logic test suite. Run with: npx vitest run tests/logic.test.ts
 */
import { describe, it, expect } from "vitest";
import { didSelectionWin, settlePendingTickets } from "../src/utils/betSettlement";
import { calculateBetBuilderOdds, validateBetBuilderSelections, settleBetBuilderTicket, computeAccaOdds } from "../src/utils/betBuilderUtils";
import { calculateCashOutValue, isCashOutEligible } from "../src/utils/cashOutUtils";
import { calculateImpliedProbability, applyOwnerBoost } from "../src/utils/oddsUtils";
import * as w from "../src/utils/wallet";
import { getLiveInPlayOdds } from "../src/utils";
import { dedupeForAccumulator, marketGroupKey } from "../src/utils/betSlipUtils";
import { simulateFullMatchInstantly, calculateTeamRating, simulateMatchTick } from "../src/engine/matchEngine";
import { computeMatchOdds } from "../src/engine/oddsEngine";
import { blendedExpected } from "../src/utils/statsUtils";
import { developPlayer } from "../src/utils/playerUtils";
import type { BetSelection, BetTicket, Fixture, Team } from "../src/types";

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

describe("betSettlement.didSelectionWin", () => {
  it("match winner / double chance / BTTS / exact score", () => {
    expect(didSelectionWin(sel("MATCH_WINNER", "HOME"), fx({ homeScore: 2, awayScore: 0 }))).toBe(true);
    expect(didSelectionWin(sel("MATCH_WINNER", "HOME"), fx({ homeScore: 0, awayScore: 2 }))).toBe(false);
    expect(didSelectionWin(sel("MATCH_WINNER", "DRAW"), fx({ homeScore: 1, awayScore: 1 }))).toBe(true);
    expect(didSelectionWin(sel("DOUBLE_CHANCE", "HOME_OR_DRAW"), fx({ homeScore: 1, awayScore: 1 }))).toBe(true);
    expect(didSelectionWin(sel("DOUBLE_CHANCE", "HOME_OR_DRAW"), fx({ homeScore: 0, awayScore: 1 }))).toBe(false);
    expect(didSelectionWin(sel("BOTH_TEAMS_TO_SCORE", "YES"), fx({ homeScore: 1, awayScore: 1 }))).toBe(true);
    expect(didSelectionWin(sel("BOTH_TEAMS_TO_SCORE", "NO"), fx({ homeScore: 2, awayScore: 0 }))).toBe(true);
    expect(didSelectionWin(sel("EXACT_SCORE", "2-1"), fx({ homeScore: 2, awayScore: 1 }))).toBe(true);
  });

  it("goalscorer market resolves by playerId in the events list", () => {
    expect(didSelectionWin(sel("ANYTIME_GOALSCORER", "p9"),
      fx({ events: [{ minute: 10, type: "GOAL", playerId: "p9", commentary: "" } as any] }))).toBe(true);
    expect(didSelectionWin(sel("ANYTIME_GOALSCORER", "p9"),
      fx({ events: [{ minute: 10, type: "GOAL", playerId: "p7", commentary: "" } as any] }))).toBe(false);
  });
});

describe("Over/Under goals — OVER_x_y selection id format", () => {
  it("underscore-decimal ids parse correctly (the OVER_2_5 format bug)", () => {
    expect(didSelectionWin(sel("OVER_UNDER_GOALS", "OVER_2_5"), fx({ homeScore: 2, awayScore: 1 }))).toBe(true);
    expect(didSelectionWin(sel("OVER_UNDER_GOALS", "OVER_2_5"), fx({ homeScore: 1, awayScore: 1 }))).toBe(false);
    expect(didSelectionWin(sel("OVER_UNDER_GOALS", "UNDER_2_5"), fx({ homeScore: 1, awayScore: 1 }))).toBe(true);
    expect(didSelectionWin(sel("OVER_UNDER_GOALS", "UNDER_0_5"), fx({ homeScore: 0, awayScore: 0 }))).toBe(true);
    expect(didSelectionWin(sel("OVER_UNDER_GOALS", "UNDER_0_5"), fx({ homeScore: 1, awayScore: 0 }))).toBe(false);
  });

  it("dot-decimal ids parse correctly (corners/cards use OVER_9.5)", () => {
    expect(didSelectionWin(sel("OVER_UNDER_CORNERS", "OVER_6.5"), fx())).toBe(true);
    expect(didSelectionWin(sel("OVER_UNDER_CORNERS", "UNDER_6.5"), fx())).toBe(false);
    expect(didSelectionWin(sel("OVER_UNDER_CARDS", "OVER_3.5"), fx())).toBe(true);
    expect(didSelectionWin(sel("OVER_UNDER_SAVES", "UNDER_5.5"), fx())).toBe(true);
  });
});

describe("settlePendingTickets", () => {
  const accTicket: BetTicket = {
    id: "t1", type: "ACCUMULATOR", selections: [sel("MATCH_WINNER", "HOME", 2), sel("BOTH_TEAMS_TO_SCORE", "NO", 1.8)],
    totalOdds: 3.6, stake: 10, potentialPayout: 36, status: "PENDING", timestamp: 0,
  };

  it("acca wins when every leg wins; payout = stake x totalOdds", () => {
    const { finalTickets, totalWinPayoutSum } = settlePendingTickets([accTicket], [fx({ homeScore: 2, awayScore: 0 })]);
    expect(finalTickets[0].status).toBe("WON");
    expect(totalWinPayoutSum).toBe(36); // 10 x 3.6
  });

  it("acca loses when any leg loses", () => {
    const { finalTickets, totalWinPayoutSum } = settlePendingTickets([accTicket], [fx({ homeScore: 2, awayScore: 1 })]);
    expect(finalTickets[0].status).toBe("LOST");
    expect(totalWinPayoutSum).toBe(0);
  });

  it("stays PENDING when a leg's fixture hasn't completed", () => {
    const { finalTickets } = settlePendingTickets([accTicket], []);
    expect(finalTickets[0].status).toBe("PENDING");
  });

  it("multi-single: each leg is its own stake/payout", () => {
    const single: BetTicket = {
      id: "t2", type: "SINGLE",
      selections: [sel("MATCH_WINNER", "HOME", 2), sel("MATCH_WINNER", "DRAW", 3)],
      totalOdds: 1, stake: 20, potentialPayout: 0, status: "PENDING", timestamp: 0,
      selectionStakes: { "f1-MATCH_WINNER-HOME": 10, "f1-MATCH_WINNER-DRAW": 10 },
    };
    const { finalTickets, totalWinPayoutSum } = settlePendingTickets([single], [fx({ homeScore: 2, awayScore: 0 })]);
    expect(finalTickets[0].status).toBe("WON");
    expect(totalWinPayoutSum).toBe(20); // winning leg: 10 stake x 2 odds
  });
});

describe("betBuilderUtils", () => {
  it("combined odds apply the 7% same-game-multi discount", () => {
    // 2 x 2 = 4 raw, x 0.93 correlation discount = 3.72
    expect(Math.abs(calculateBetBuilderOdds([{ odds: 2 } as any, { odds: 2 } as any]) - 3.72)).toBeLessThan(1e-9);
    expect(calculateBetBuilderOdds([])).toBe(1);
  });

  it("validation rejects too-few legs and conflicting markets", () => {
    expect(validateBetBuilderSelections([sel("MATCH_WINNER", "HOME") as any])).not.toBeNull();
    expect(validateBetBuilderSelections([sel("MATCH_WINNER", "HOME") as any, sel("EXACT_SCORE", "1-0") as any])).not.toBeNull();
    expect(validateBetBuilderSelections([
      sel("OVER_UNDER_GOALS", "OVER_2_5") as any, sel("OVER_UNDER_GOALS", "UNDER_2_5") as any,
    ])).not.toBeNull();
    expect(validateBetBuilderSelections([
      sel("MATCH_WINNER", "HOME") as any, sel("OVER_UNDER_GOALS", "UNDER_2_5") as any,
    ])).toBeNull();
  });

  it("settles correctly: home win + under 2.5 with exactly 2 goals (was the bug)", () => {
    const t = { selections: [sel("MATCH_WINNER", "HOME"), sel("OVER_UNDER_GOALS", "UNDER_2_5")] } as any;
    expect(settleBetBuilderTicket(t, fx({ homeScore: 2, awayScore: 0 }))).toBe("WON");
    expect(settleBetBuilderTicket(t, fx({ homeScore: 2, awayScore: 1 }))).toBe("LOST");
  });
});

describe("cashOutUtils", () => {
  it("eligibility: only PENDING tickets on a LIVE fixture", () => {
    const t: BetTicket = { id: "t1", type: "ACCUMULATOR", selections: [sel("MATCH_WINNER", "HOME", 2)], totalOdds: 2, stake: 10, potentialPayout: 20, status: "PENDING", timestamp: 0 };
    const liveFx = fx({ status: "LIVE", currentMinute: 60, homeScore: 1, awayScore: 0 });
    expect(isCashOutEligible(t, [liveFx])).toBe(true);
    expect(isCashOutEligible({ ...t, status: "WON" }, [liveFx])).toBe(false);
  });

  it("winning live position priced fairly: payout/currentOdds x 0.92", () => {
    const t: BetTicket = { id: "t1", type: "ACCUMULATOR", selections: [sel("MATCH_WINNER", "HOME", 2)], totalOdds: 2, stake: 10, potentialPayout: 20, status: "PENDING", timestamp: 0 };
    const liveFx = fx({ status: "LIVE", currentMinute: 60, homeScore: 1, awayScore: 0 });
    const v = calculateCashOutValue(t, [liveFx], { "MATCH_WINNER:HOME": 1.3 });
    // fair value = payout/currentOdds*0.92 = 20*(1/1.3)*0.92 ≈ 14.15, never above payout
    expect(v).not.toBeNull();
    expect(Math.abs(v! - 14.15)).toBeLessThan(0.02);
    expect(v!).toBeLessThanOrEqual(t.potentialPayout);
  });

  it("regression: near-certain under-corners must not balloon past payout", () => {
    // stake 500k @ 7.4 → payout 3.7M. Live odds collapse to 1.02 (near certain).
    const cornersT: BetTicket = { id: "t1", type: "ACCUMULATOR", selections: [sel("OVER_UNDER_CORNERS", "UNDER_9.5", 7.4)], totalOdds: 7.4, stake: 500000, potentialPayout: 3700000, status: "PENDING", timestamp: 0 };
    const cornersLive = fx({ status: "LIVE", currentMinute: 85 });
    const cv = calculateCashOutValue(cornersT, [cornersLive], { "OVER_UNDER_CORNERS:UNDER_9.5": 1.02 });
    expect(cv).not.toBeNull();
    expect(cv!).toBeGreaterThan(0);
    expect(cv!).toBeLessThanOrEqual(3700000);
  });

  it("suspended market and dead/won FT tickets price correctly", () => {
    const t: BetTicket = { id: "t1", type: "ACCUMULATOR", selections: [sel("MATCH_WINNER", "HOME", 2)], totalOdds: 2, stake: 10, potentialPayout: 20, status: "PENDING", timestamp: 0 };
    const liveFx = fx({ status: "LIVE", currentMinute: 60, homeScore: 1, awayScore: 0 });
    expect(calculateCashOutValue(t, [liveFx], { "MATCH_WINNER:HOME": null })).toBeNull();
    expect(calculateCashOutValue(t, [fx({ homeScore: 0, awayScore: 1 })], {})).toBe(0); // dead ticket (FT lost)
    const won = calculateCashOutValue(t, [fx({ homeScore: 2, awayScore: 0 })], {});
    expect(won).not.toBeNull();
    expect(Math.abs(won! - 18.4)).toBeLessThan(0.01); // FT won leg -> payout x 0.92 = 20*0.92

    // Under 2.5 leg at FT with 2 goals must count as WON post-fix.
    const t2: BetTicket = { id: "t2", type: "ACCUMULATOR", selections: [sel("OVER_UNDER_GOALS", "UNDER_2_5", 2)], totalOdds: 2, stake: 10, potentialPayout: 20, status: "PENDING", timestamp: 0 };
    const v2 = calculateCashOutValue(t2, [fx({ homeScore: 1, awayScore: 1 })], {});
    expect(v2).not.toBeNull();
    expect(v2!).toBeGreaterThan(0);
  });

  it("pre-match (SCHEDULED) cash-out prices near stake x 0.92, not payout", () => {
    const schedT: BetTicket = { id: "t3", type: "ACCUMULATOR", selections: [sel("MATCH_WINNER", "HOME", 2)], totalOdds: 2, stake: 10, potentialPayout: 20, status: "PENDING", timestamp: 0 };
    const pre = calculateCashOutValue(schedT, [fx({ status: "SCHEDULED" })], {});
    expect(pre).not.toBeNull();
    expect(Math.abs(pre! - 9.2)).toBeLessThan(0.01); // 10 x 0.92
  });
});

describe("oddsUtils", () => {
  it("implied probability and owner boost", () => {
    expect(calculateImpliedProbability(2)).toBe(0.5);
    expect(calculateImpliedProbability(0)).toBe(0);
    expect(applyOwnerBoost(null, true)).toBeNull();
    expect(applyOwnerBoost(2, false)).toBe(2);
    expect(applyOwnerBoost(1.02, true)!).toBeGreaterThanOrEqual(1.01);
  });
});

describe("getLiveInPlayOdds", () => {
  it("basic O/U sanity, FT -> null, SCHEDULED -> base odds, covered lines suspend", () => {
    const liveFx = fx({ status: "LIVE", currentMinute: 30, homeScore: 0, awayScore: 0 });
    const o = getLiveInPlayOdds(liveFx, "OVER_UNDER_GOALS", "OVER_2_5", 1.9);
    expect(o === null || (typeof o === "number" && o >= 1.01)).toBe(true);
    expect(getLiveInPlayOdds(fx(), "MATCH_WINNER", "HOME", 2)).toBeNull();
    expect(getLiveInPlayOdds(fx({ status: "SCHEDULED" }), "MATCH_WINNER", "HOME", 2)).toBe(2);
    const covered = fx({ status: "LIVE", currentMinute: 50, homeScore: 2, awayScore: 1 });
    expect(getLiveInPlayOdds(covered, "OVER_UNDER_GOALS", "OVER_2_5", 1.9)).toBeNull();
  });

  it("suspension audit: no O/U market is suspended at kickoff (0-0, min 1)", () => {
    const kickoff = fx({
      status: "LIVE", currentMinute: 1, homeScore: 0, awayScore: 0,
      stats: {
        home: { corners: 0, yellowCards: 0, redCards: 0, saves: 0, shots: 0, shotsOnTarget: 0, fouls: 0, possession: 50 },
        away: { corners: 0, yellowCards: 0, redCards: 0, saves: 0, shots: 0, shotsOnTarget: 0, fouls: 0, possession: 50 },
      } as any,
    });
    expect(typeof getLiveInPlayOdds(kickoff, "OVER_UNDER_GOALS", "OVER_4_5", 13)).toBe("number");
    expect(typeof getLiveInPlayOdds(kickoff, "OVER_UNDER_GOALS", "OVER_2_5", 1.9)).toBe("number");
    expect(typeof getLiveInPlayOdds(kickoff, "OVER_UNDER_CORNERS", "OVER_9.5", 1.9)).toBe("number");
  });

  it("unmet overs are priced (capped), not suspended, even late", () => {
    const late = fx({ status: "LIVE", currentMinute: 85, homeScore: 0, awayScore: 0 });
    expect(typeof getLiveInPlayOdds(late, "OVER_UNDER_GOALS", "OVER_4_5", 13)).toBe("number");
  });

  it("Over 2.5 suspends only after the 3rd goal (settles as won)", () => {
    const twoGoals = fx({ status: "LIVE", currentMinute: 40, homeScore: 1, awayScore: 1 });
    expect(typeof getLiveInPlayOdds(twoGoals, "OVER_UNDER_GOALS", "OVER_2_5", 1.9)).toBe("number");
    const threeGoals = fx({ status: "LIVE", currentMinute: 41, homeScore: 2, awayScore: 1 });
    expect(getLiveInPlayOdds(threeGoals, "OVER_UNDER_GOALS", "OVER_2_5", 1.9)).toBeNull();
  });
});

describe("matchEngine (200 simulated matches)", () => {
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

  it("team rating and 1X2 odds are sane", () => {
    const home = mkTeam("alpha"), away = mkTeam("beta");
    expect(calculateTeamRating(home)).toBeGreaterThan(0);
    const odds = computeMatchOdds(home, away);
    expect(odds.homeWin).toBeGreaterThanOrEqual(1.01);
    expect(odds.draw).toBeGreaterThanOrEqual(1.01);
    expect(odds.awayWin).toBeGreaterThanOrEqual(1.01);
    const impliedSum = 1 / odds.homeWin + 1 / odds.draw + 1 / odds.awayWin;
    expect(impliedSum).toBeGreaterThan(1);
    expect(impliedSum).toBeLessThan(1.4);
  });

  it("#1 stats-driven odds: a much stronger side is a clear favourite; even teams are near-even", () => {
    const strong = mkTeam("strong"); strong.players.forEach((p: any) => (p.rating = 90));
    const weak = mkTeam("weak"); weak.players.forEach((p: any) => (p.rating = 60));
    const lop = computeMatchOdds(strong, weak);
    expect(lop.homeWin).toBeLessThan(lop.awayWin - 0.5);
    const even = computeMatchOdds(mkTeam("x"), mkTeam("y"));
    expect(Math.abs(even.homeWin - even.awayWin)).toBeLessThan(1.2);
    expect(even.homeWin).toBeLessThanOrEqual(even.awayWin); // home carries a slight edge when equal
  });

  it("all 200 sims produce valid FT results", () => {
    const home = mkTeam("alpha"), away = mkTeam("beta");
    const odds = computeMatchOdds(home, away);
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
    expect(bad).toBe(0);
  });
});

describe("round settlement integration (money path)", () => {
  it("mixed tickets settle against one completed round; balance math end-to-end", () => {
    const round = [
      fx({ id: "m1", homeScore: 2, awayScore: 1 }),
      fx({ id: "m2", homeScore: 0, awayScore: 0 }),
    ];
    const mkSel = (fid: string, mt: string, sid: string, odds: number): BetSelection =>
      ({ fixtureId: fid, marketType: mt as any, selectionId: sid, odds, details: "", marketName: "" });
    const tickets: BetTicket[] = [
      { id: "a", type: "ACCUMULATOR", selections: [mkSel("m1", "MATCH_WINNER", "HOME", 2), mkSel("m2", "OVER_UNDER_GOALS", "UNDER_2.5", 1.5)],
        totalOdds: 3, stake: 10, potentialPayout: 30, status: "PENDING", timestamp: 0 },
      { id: "b", type: "ACCUMULATOR", selections: [mkSel("m2", "BOTH_TEAMS_TO_SCORE", "YES", 1.8)],
        totalOdds: 1.8, stake: 5, potentialPayout: 9, status: "PENDING", timestamp: 0 },
      { id: "c", type: "SINGLE", selections: [mkSel("m1", "EXACT_SCORE", "2-1", 8), mkSel("m1", "MATCH_WINNER", "AWAY", 4)],
        totalOdds: 1, stake: 4, potentialPayout: 0, status: "PENDING", timestamp: 0,
        selectionStakes: { "m1-EXACT_SCORE-2-1": 2, "m1-MATCH_WINNER-AWAY": 2 } },
    ];
    const { finalTickets, totalWinPayoutSum } = settlePendingTickets(tickets, round);
    expect(finalTickets[0].status).toBe("WON"); // acca (dot-form UNDER_2.5) wins
    expect(finalTickets[1].status).toBe("LOST"); // BTTS yes loses on 0-0
    expect(finalTickets[2].status).toBe("WON");
    expect(finalTickets[2].settledPayout).toBe(16); // multi-single pays only exact-score leg (2x8)
    expect(totalWinPayoutSum).toBe(46); // 30 + 16
  });
});

describe("wallet", () => {
  it("debit/credit rounding and rejection rules", () => {
    expect(w.debit(100, 30)).toBe(70);
    expect(w.debit(100, 100.005)).toBeNull(); // overdraft rejected
    expect(w.debit(100, 0)).toBeNull(); // zero debit rejected
    expect(w.debit(100, -5)).toBeNull(); // negative debit rejected
    expect(w.credit(10.111, 0.111)).toBe(10.22); // rounds to cents
    expect(w.credit(50, -10)).toBe(50); // negative credit ignored
  });
});

describe("betSlipUtils.dedupeForAccumulator", () => {
  it("mutually-exclusive market-winner picks conflict; different scorers don't", () => {
    const home = sel("MATCH_WINNER", "HOME", 2);
    const away = sel("MATCH_WINNER", "AWAY", 3);
    const over = sel("OVER_UNDER_GOALS", "OVER_2_5", 1.9);
    expect(marketGroupKey(home)).toBe(marketGroupKey(away)); // share a market group
    expect(marketGroupKey(home)).not.toBe(marketGroupKey(over));
    const { kept, dropped } = dedupeForAccumulator([home, away, over]);
    expect(kept.length).toBe(2);
    expect(dropped.length).toBe(1);
    // keeps the LAST exclusive pick (Away), drops the earlier (Home) — tapping
    // a new option switches, it doesn't stack.
    expect(dropped[0].selectionId).toBe("HOME");

    const gsA = sel("ANYTIME_GOALSCORER", "p1", 3);
    const gsB = sel("ANYTIME_GOALSCORER", "p2", 4);
    expect(dedupeForAccumulator([gsA, gsB]).dropped.length).toBe(0);
  });

  it("acca combined odds = straight product of legs (no hidden discount)", () => {
    const legs = [1.49, 2.78, 2.0, 3.07, 1.67, 1.72].map((o, i) => ({ fixtureId: `m${i}`, odds: o }));
    const prod = Math.round(legs.reduce((a, l) => a * l.odds, 1) * 100) / 100;
    expect(Math.abs(computeAccaOdds(legs) - prod)).toBeLessThan(0.01);
  });
});

describe("statsUtils shrinkage + odds calibration", () => {
  it("no history → prior returned exactly", () => {
    const be0 = blendedExpected("H", "A", [], "corners", 5.2, 6, 4);
    expect(Math.abs(be0.home - 6)).toBeLessThan(1e-9);
    expect(Math.abs(be0.away - 4)).toBeLessThan(1e-9);
  });

  it("recorded history lifts the expectation toward the observed rate", () => {
    const mkFx = (i: number, hc: number): any => ({
      id: `lh${i}`, homeTeamId: "H", awayTeamId: `Z${i}`, roundIndex: i, status: "FT",
      homeScore: 1, awayScore: 1, currentMinute: 90, elapsedTicks: 15, events: [],
      stats: {
        home: { corners: hc, yellowCards: 2, redCards: 0, saves: 4, shots: 12, shotsOnTarget: 5, fouls: 8, possession: 50, passes: 400 },
        away: { corners: 3, yellowCards: 2, redCards: 0, saves: 4, shots: 12, shotsOnTarget: 5, fouls: 8, possession: 50, passes: 400 },
      },
      odds: {}, weather: "Clear Sky",
    });
    const hist = [0, 1, 2, 3, 4, 5].map((i) => mkFx(i, 15));
    const be1 = blendedExpected("H", "A", hist, "corners", 5.2, 6, 4);
    expect(be1.home).toBeGreaterThan(8);
  });

  it("odds calibration: even teams fair near the line; big favourite priced short", () => {
    const teamR = (id: string, r: number): any => ({
      id, name: id, shortName: id, rating: 3.5, primaryColor: "#fff", secondaryColor: "#000",
      players: [
        { id: id + "gk", name: "gk", teamId: id, position: "GK", rating: r, age: 25, fatigue: 0, injured: false, injuryRecoveryMatches: 0, goals: 0, assists: 0, saves: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, seasonStats: { goals: 0, assists: 0, saves: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, motmAwards: 0 } },
        ...["DEF", "DEF", "DEF", "DEF", "MID", "MID", "MID", "MID", "ATT", "ATT", "ATT"].map((pos, i) => ({ id: id + i, name: "p" + i, teamId: id, position: pos, rating: r, age: 25, fatigue: 0, injured: false, injuryRecoveryMatches: 0, goals: 0, assists: 0, saves: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, seasonStats: { goals: 0, assists: 0, saves: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, motmAwards: 0 } })),
      ],
      wonMatches: 0, drawnMatches: 0, lostMatches: 0, goalsScored: 0, goalsConceded: 0, morale: 60, rivalClubIds: [],
    });
    const oc = computeMatchOdds(teamR("H", 78), teamR("A", 78), []);
    const l105 = oc.overUnderCorners!.find((l) => l.line === 10.5)!;
    expect(Math.abs(l105.over - l105.under)).toBeLessThan(0.7);
    const strong = computeMatchOdds(teamR("H", 90), teamR("A", 64), []);
    expect(strong.homeWin).toBeLessThan(1.6);
    expect(strong.awayWin).toBeGreaterThan(4);
  });
});

describe("playerUtils.developPlayer", () => {
  const mkP = (id: string, age: number, rating: number, apps: number, goals: number): any => ({
    id, name: id, teamId: "T", position: "ATT", rating, age, fatigue: 0, injured: false,
    injuryRecoveryMatches: 0, goals, assists: 0, saves: 0, yellowCards: 0, redCards: 0,
    matchesPlayed: apps,
    seasonStats: { goalsScored: goals, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: apps, cleanSheets: 0 },
    abilities: { pace: rating, shooting: rating, passing: rating, dribbling: rating, defending: rating, physical: rating },
  });

  it("growth is age x game-time x performance driven", () => {
    const starter = developPlayer(mkP("dev-starter", 19, 68, 14, 10));
    const bench = developPlayer(mkP("dev-bench", 19, 68, 1, 0));
    expect(starter.rating).toBeGreaterThan(68);
    expect(starter.rating - 68).toBeGreaterThan((bench.rating - 68) * 2); // game time drives growth
    const old = developPlayer(mkP("dev-old", 34, 79, 3, 0));
    expect(old.rating).toBeLessThan(79); // 34-year-old declines
    expect(starter.abilities.shooting).toBeGreaterThan(68); // abilities develop with rating
    expect(starter.seasonStats.matchesPlayed).toBe(0); // season stats reset at rollover
  });

  it("growth never exceeds the player's potential ceiling", () => {
    let p: any = mkP("dev-cap", 18, 66, 14, 9);
    for (let i = 0; i < 8; i++) {
      p = developPlayer(p);
      p.seasonStats = { goalsScored: 9, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 14, cleanSheets: 0 };
    }
    expect(p.rating).toBeLessThanOrEqual((p.potential ?? 99) + 0.001);
  });
});

describe("oddsEngine DC + scorer history", () => {
  const teamR = (id: string, r: number, strikerGoals = 0, apps = 0): any => ({
    id, name: id, shortName: id, rating: 3.5, primaryColor: "#fff", secondaryColor: "#000",
    players: [
      { id: id + "gk", name: "gk", teamId: id, position: "GK", rating: r, age: 25, fatigue: 0, injured: false, injuryRecoveryMatches: 0, goals: 0, assists: 0, saves: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, seasonStats: { goalsScored: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, cleanSheets: 0 } },
      ...["DEF", "DEF", "DEF", "DEF", "MID", "MID", "MID", "MID", "ATT", "ATT", "ATT"].map((pos, i) => ({
        id: id + i, name: "p" + i, teamId: id, position: pos, rating: r, age: 25, fatigue: 0, injured: false,
        injuryRecoveryMatches: 0, goals: i === 8 ? strikerGoals : 0, assists: 0, saves: 0, yellowCards: 0, redCards: 0,
        matchesPlayed: i === 8 ? apps : 0,
        seasonStats: { goalsScored: i === 8 ? strikerGoals : 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: i === 8 ? apps : 0, cleanSheets: 0 },
      })),
    ],
    wonMatches: 0, drawnMatches: 0, lostMatches: 0, goalsScored: 0, goalsConceded: 0, morale: 60, rivalClubIds: [],
  });

  it("every goal market comes from the same corrected matrix", () => {
    const o = computeMatchOdds(teamR("H", 78), teamR("A", 78), []);
    // P(under 0.5) must equal P(exact 0-0) — same Dixon-Coles-corrected matrix.
    const pUnder05 = 1 / o.overUnder!.under0_5;
    const p00 = 1 / o.exactScores.find((e) => e.score === "0-0")!.odds;
    expect(Math.abs(pUnder05 - p00)).toBeLessThan(0.01);
    const overround = 1 / o.homeWin + 1 / o.draw + 1 / o.awayWin;
    expect(overround).toBeGreaterThan(1);
    expect(overround).toBeLessThan(1.4);
  });

  it("a prolific striker is priced shorter than an identical one who never scores", () => {
    const prolific = computeMatchOdds(teamR("P", 78, 12, 14), teamR("A2", 78), []);
    const barren = computeMatchOdds(teamR("B", 78, 0, 14), teamR("A3", 78), []);
    const best = (odds: any) => Math.min(...odds.goalscorers.map((g: any) => g.odds));
    expect(best(prolific)).toBeLessThan(best(barren));
  });
});

describe("liveOdds unification (one model, coherent markets)", () => {
  const preOdds: any = {
    homeWin: 2.1, draw: 3.4, awayWin: 3.6,
    overUnder: {
      over0_5: 1.1, under0_5: 7, over1_5: 1.35, under1_5: 3.1,
      over2_5: 2.0, under2_5: 1.8, over3_5: 3.4, under3_5: 1.3,
      over4_5: 6.5, under4_5: 1.1,
    },
    exactScores: [], goalscorers: [],
  };
  const live = (over: Partial<Fixture>) => fx({ status: "LIVE", odds: preOdds, ...over });

  it("1X2 stays a coherent book in-play", () => {
    const f0 = live({ currentMinute: 30, homeScore: 0, awayScore: 0 });
    const h = getLiveInPlayOdds(f0, "MATCH_WINNER", "HOME", 2.1)!;
    const d = getLiveInPlayOdds(f0, "MATCH_WINNER", "DRAW", 3.4)!;
    const a = getLiveInPlayOdds(f0, "MATCH_WINNER", "AWAY", 3.6)!;
    const book = 1 / h + 1 / d + 1 / a;
    expect(book).toBeGreaterThan(1.0);
    expect(book).toBeLessThan(1.2);

    const hd = getLiveInPlayOdds(f0, "DOUBLE_CHANCE", "HOME_OR_DRAW", 1.4)!;
    expect(Math.abs(1 / hd - (1 / h + 1 / d))).toBeLessThan(0.02); // double chance == home + draw

    const ov = getLiveInPlayOdds(f0, "OVER_UNDER_GOALS", "OVER_2_5", 2.0)!;
    const un = getLiveInPlayOdds(f0, "OVER_UNDER_GOALS", "UNDER_2_5", 1.8)!;
    expect(Math.abs(1 / ov + 1 / un - (book / 3) * 3) < 0.2 || Math.abs(1 / ov + 1 / un - 1.08) < 0.05).toBe(true);
  });

  it("a lead is worth more as the clock runs down; trailing side lengthens but stays priced", () => {
    const early = getLiveInPlayOdds(live({ currentMinute: 20, homeScore: 1, awayScore: 0 }), "MATCH_WINNER", "HOME", 2.1)!;
    const late = getLiveInPlayOdds(live({ currentMinute: 85, homeScore: 1, awayScore: 0 }), "MATCH_WINNER", "HOME", 2.1)!;
    expect(late).toBeLessThan(early);

    const trailing = getLiveInPlayOdds(live({ currentMinute: 85, homeScore: 0, awayScore: 1 }), "MATCH_WINNER", "HOME", 2.1);
    expect(typeof trailing).toBe("number");
    expect(trailing as number).toBeGreaterThan(early);
  });

  it("the tick simulation never mutates the stored pre-match odds", () => {
    const before = { ...preOdds };
    const teamFor = (id: string): any => ({
      id, name: id, shortName: id, rating: 3.5, primaryColor: "#fff", secondaryColor: "#000",
      players: [
        { id: id + "gk", name: "gk", teamId: id, position: "GK", rating: 75, age: 25, fatigue: 0, injured: false, injuryRecoveryMatches: 0, goals: 0, assists: 0, saves: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, seasonStats: { goalsScored: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, cleanSheets: 0 } },
        ...["DEF", "DEF", "DEF", "DEF", "MID", "MID", "MID", "MID", "ATT", "ATT", "ATT"].map((pos, i) => ({ id: id + i, name: "p" + i, teamId: id, position: pos, rating: 75, age: 25, fatigue: 0, injured: false, injuryRecoveryMatches: 0, goals: 0, assists: 0, saves: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, seasonStats: { goalsScored: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, cleanSheets: 0 } })),
      ],
      wonMatches: 0, drawnMatches: 0, lostMatches: 0, goalsScored: 0, goalsConceded: 0, morale: 60, rivalClubIds: [],
    });
    let f: any = fx({ id: "l-tick", status: "SCHEDULED", homeScore: 0, awayScore: 0, currentMinute: 0, elapsedTicks: 0, events: [], odds: { ...preOdds } });
    for (let t = 1; t <= 8; t++) f = simulateMatchTick(f, teamFor("h"), teamFor("a"), t);
    expect(f.odds.homeWin).toBe(before.homeWin);
    expect(f.odds.draw).toBe(before.draw);
    expect(f.odds.awayWin).toBe(before.awayWin);
  });
});

/**
 * Hand-computed odds/payout math (Phase 3 acceptance criterion): each case
 * below states the arithmetic in a comment so a reviewer can check the
 * expected value themselves without running the code, then asserts the
 * actual utility function matches it exactly.
 */
describe("hand-computed odds math (reviewer-verifiable arithmetic)", () => {
  it("single bet: stake 10 @ 2.5 -> payout 25", () => {
    // payout = stake x odds = 10 x 2.5 = 25
    const ticket: BetTicket = {
      id: "hc1", type: "SINGLE", selections: [sel("MATCH_WINNER", "HOME", 2.5)],
      totalOdds: 2.5, stake: 10, potentialPayout: 25, status: "PENDING", timestamp: 0,
    };
    const { finalTickets, totalWinPayoutSum } = settlePendingTickets([ticket], [fx({ homeScore: 1, awayScore: 0 })]);
    expect(finalTickets[0].status).toBe("WON");
    expect(totalWinPayoutSum).toBe(25);
  });

  it("3-leg accumulator: stake 20, legs 2.0 x 1.8 x 1.5 -> combined 5.4, payout 108", () => {
    // combined odds = 2.0 x 1.8 x 1.5 = 5.4
    // payout = stake x combined = 20 x 5.4 = 108
    const legs = [
      { fixtureId: "m1", odds: 2.0 },
      { fixtureId: "m2", odds: 1.8 },
      { fixtureId: "m3", odds: 1.5 },
    ];
    const combined = computeAccaOdds(legs);
    expect(combined).toBe(5.4);
    const ticket: BetTicket = {
      id: "hc2", type: "ACCUMULATOR",
      selections: [
        { fixtureId: "m1", marketType: "MATCH_WINNER", selectionId: "HOME", odds: 2.0, details: "", marketName: "" } as any,
        { fixtureId: "m2", marketType: "MATCH_WINNER", selectionId: "HOME", odds: 1.8, details: "", marketName: "" } as any,
        { fixtureId: "m3", marketType: "MATCH_WINNER", selectionId: "HOME", odds: 1.5, details: "", marketName: "" } as any,
      ],
      totalOdds: combined, stake: 20, potentialPayout: 20 * combined, status: "PENDING", timestamp: 0,
    };
    const round = [
      fx({ id: "m1", homeScore: 1, awayScore: 0 }),
      fx({ id: "m2", homeScore: 2, awayScore: 0 }),
      fx({ id: "m3", homeScore: 1, awayScore: 0 }),
    ];
    const { finalTickets, totalWinPayoutSum } = settlePendingTickets([ticket], round);
    expect(finalTickets[0].status).toBe("WON");
    expect(totalWinPayoutSum).toBe(108);
  });

  it("bet builder (same-game multi): 2 legs @ 2.0 each, 7% correlation discount -> 3.72, stake 15 -> payout 55.8", () => {
    // raw = 2.0 x 2.0 = 4.0; correlation-discounted = 4.0 x 0.93 = 3.72
    // payout = stake x combined = 15 x 3.72 = 55.8
    const combined = calculateBetBuilderOdds([{ odds: 2 } as any, { odds: 2 } as any]);
    expect(Math.abs(combined - 3.72)).toBeLessThan(1e-9);
    const payout = Math.round(15 * combined * 100) / 100;
    expect(payout).toBe(55.8);
  });

  it("cash-out mid-match: stake 10 @ 2.0 (payout 20), live odds shorten to 1.3 -> fair value ~14.15", () => {
    // fair value = potentialPayout / currentOdds x 0.92 (8% cash-out margin)
    //            = 20 / 1.3 x 0.92 = 15.3846... x 0.92 = 14.1538... ≈ 14.15
    const t: BetTicket = { id: "hc4", type: "SINGLE", selections: [sel("MATCH_WINNER", "HOME", 2)], totalOdds: 2, stake: 10, potentialPayout: 20, status: "PENDING", timestamp: 0 };
    const liveFx = fx({ status: "LIVE", currentMinute: 55, homeScore: 1, awayScore: 0 });
    const v = calculateCashOutValue(t, [liveFx], { "MATCH_WINNER:HOME": 1.3 });
    expect(v).not.toBeNull();
    expect(Math.abs(v! - 14.15)).toBeLessThan(0.02);
  });
});
