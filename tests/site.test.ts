/**
 * Site-logic guard suite (match realism, transfers, settlement, promotion).
 * Run with: npx vitest run tests/site.test.ts
 */
import { describe, it, expect } from "vitest";
import { simulateFullMatchInstantly } from "../src/engine/matchEngine";
import { applyTransferResultsToTeams } from "../src/engine/transferEngine";
import { applyRelegationPromotion } from "../src/data/tournament";
import { settlePendingTickets } from "../src/utils/betSettlement";
import type { Team, Player, Fixture, TransferListing, BetTicket, ClubOwnership } from "../src/types";

let pid = 0;
const mkP = (r: number, pos: Player["position"]): Player => ({
  id: "p" + pid++, name: "P", teamId: "", position: pos, rating: r, age: 25, fatigue: 0,
  injured: false, injuryRecoveryMatches: 0, seasonStats: {} as any, goals: 0, assists: 0,
  saves: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0,
});
function mkTeam(id: string, avg: number, ownership?: ClubOwnership): Team {
  const ps: Player[] = [mkP(avg, "GK")];
  for (let i = 0; i < 4; i++) ps.push(mkP(avg, "DEF"));
  for (let i = 0; i < 4; i++) ps.push(mkP(avg, "MID"));
  for (let i = 0; i < 3; i++) ps.push(mkP(avg, "ATT"));
  ps.forEach((p) => (p.teamId = id));
  return {
    id, name: id, shortName: id, rating: avg, primaryColor: "#000", secondaryColor: "#fff",
    players: ps, wonMatches: 0, drawnMatches: 0, lostMatches: 0, goalsScored: 0, goalsConceded: 0,
    morale: 60, rivalClubIds: [], ownership,
  } as Team;
}
function mkFixture(id: string, homeId: string, awayId: string): Fixture {
  const emptyStats = { corners: 0, yellowCards: 0, redCards: 0, saves: 0, shots: 0, shotsOnTarget: 0, fouls: 0, possession: 50, passes: 0 };
  return {
    id, homeTeamId: homeId, awayTeamId: awayId, roundIndex: 0, status: "SCHEDULED",
    homeScore: 0, awayScore: 0, currentMinute: 0, elapsedTicks: 0, events: [], odds: {} as any,
    weather: "Clear Sky" as any, stats: { home: { ...emptyStats }, away: { ...emptyStats } } as any,
  } as Fixture;
}

describe("match realism", () => {
  it("strong (90) beats weak (58) most of the time", () => {
    const N = 800; let strongWins = 0;
    for (let i = 0; i < N; i++) {
      const d = simulateFullMatchInstantly(mkFixture("r0-f0", "H", "A"), mkTeam("H", 90), mkTeam("A", 58));
      if (d.homeScore > d.awayScore) strongWins++;
    }
    const rate = strongWins / N;
    expect(rate).toBeGreaterThan(0.75);
  });

  it("league matches can draw (ties allowed)", () => {
    const N = 600; let draws = 0;
    for (let i = 0; i < N; i++) {
      const d = simulateFullMatchInstantly(mkFixture("l-r0-f0", "H", "A"), mkTeam("H", 75), mkTeam("A", 75));
      if (d.homeScore === d.awayScore) draws++;
    }
    expect(draws).toBeGreaterThan(0);
  });

  it("second-season 'ls-' prefixed league fixtures also draw", () => {
    let lsDraws = 0;
    for (let i = 0; i < 400; i++) {
      const d = simulateFullMatchInstantly(mkFixture("ls-r0-f0", "H", "A"), mkTeam("H", 75), mkTeam("A", 75));
      if (d.homeScore === d.awayScore) lsDraws++;
    }
    expect(lsDraws).toBeGreaterThan(0);
  });
});

describe("transfers: no player is ever deleted", () => {
  it("AI-to-AI transfer conserves players and moves the right one", () => {
    const seller = mkTeam("SELL", 70);
    const buyer = mkTeam("BUY", 70);
    const movingPlayer = seller.players[5];
    const before = seller.players.length + buyer.players.length;
    const listing: TransferListing = {
      id: "L1", playerId: movingPlayer.id, fromTeamId: "SELL", askingPrice: 1000,
      listedAtRound: 0, expiresAtRound: 2, status: "SOLD",
      bids: [{ bidderId: "BUY", amount: 1000 }], highestBidder: "BUY", finalPrice: 1000,
    };
    const after = applyTransferResultsToTeams([seller, buyer], [listing]);
    const total = after.reduce((s, t) => s + t.players.length, 0);
    expect(total).toBe(before);
    expect(after.find((t) => t.id === "BUY")!.players.some((p) => p.id === movingPlayer.id)).toBe(true);
    expect(after.find((t) => t.id === "SELL")!.players.some((p) => p.id === movingPlayer.id)).toBe(false);
  });

  it("USER win: player joins owned club and slots into the XI if an upgrade", () => {
    const seller = mkTeam("SELL", 70);
    const star = seller.players[9]; star.rating = 99; star.position = "ATT";
    const ownership: ClubOwnership = {
      clubId: "MINE", purchasedAt: 0, purchasePrice: 0, trainingFacilityLevel: 1, stadiumLevel: 1,
      totalInvested: 0, passiveIncomePerMatch: 0, formation: "4-4-2", mentality: "Balanced",
      pressingStyle: "Mid Block", starterIds: [], matchesManaged: 0, wins: 0, draws: 0, losses: 0,
      totalGoalsFor: 0, totalGoalsAgainst: 0,
    };
    const mine = mkTeam("MINE", 60, ownership);
    mine.ownership!.starterIds = mine.players.slice(0, 11).map((p) => p.id); // full XI of 60s
    const listing: TransferListing = {
      id: "L2", playerId: star.id, fromTeamId: "SELL", askingPrice: 1, listedAtRound: 0,
      expiresAtRound: 2, status: "SOLD", bids: [], highestBidder: "USER", finalPrice: 5000,
    };
    const after = applyTransferResultsToTeams([seller, mine], [listing], "MINE");
    const myTeam = after.find((t) => t.id === "MINE")!;
    expect(myTeam.players.some((p) => p.id === star.id)).toBe(true);
    expect(myTeam.ownership!.starterIds.includes(star.id)).toBe(true);
  });
});

describe("settlement: missing-fixture leg holds ticket pending", () => {
  it("multi-single with an unplayed leg stays PENDING (not cut)", () => {
    const ticket: BetTicket = {
      id: "T1", type: "SINGLE", selections: [
        { fixtureId: "r0-f0", marketType: "MATCH_WINNER", selectionId: "HOME", odds: 2, details: "", marketName: "" } as any,
        { fixtureId: "r0-f9", marketType: "MATCH_WINNER", selectionId: "HOME", odds: 2, details: "", marketName: "" } as any,
      ],
      selectionStakes: { "r0-f0-MATCH_WINNER-HOME": 10, "r0-f9-MATCH_WINNER-HOME": 10 },
      stake: 20, potentialPayout: 0, status: "PENDING",
    } as any;
    const played = mkFixture("r0-f0", "H", "A"); played.status = "FT"; played.homeScore = 2; played.awayScore = 0;
    const { finalTickets } = settlePendingTickets([ticket], [played]); // r0-f9 not played
    expect(finalTickets[0].status).toBe("PENDING");
  });
});

describe("promotion is merit-based", () => {
  it("strongest Division 2 club is promoted, weakest is not", () => {
    // Division 1 teams that played (D1a..D1p, 16) + Division 2 pool with varied ratings.
    const d1: Team[] = [];
    for (let i = 0; i < 16; i++) { const t = mkTeam("D1_" + i, 70); (t as any).division = 1; d1.push(t); }
    const strongD2 = mkTeam("D2_STRONG", 88); (strongD2 as any).division = 2;
    const midD2a = mkTeam("D2_MIDA", 72); (midD2a as any).division = 2;
    const midD2b = mkTeam("D2_MIDB", 68); (midD2b as any).division = 2;
    const midD2c = mkTeam("D2_MIDC", 62); (midD2c as any).division = 2;
    const weakD2 = mkTeam("D2_WEAK", 48); (weakD2 as any).division = 2; // weakest of 5 -> should stay down
    // Season fixtures: only D1 teams played; make D1_0 the worst (loses every game -> relegated).
    const fixtures: Fixture[] = [];
    for (let i = 1; i < 16; i++) {
      const f = mkFixture("l-r0-f" + i, "D1_" + i, "D1_0"); f.status = "FT"; f.homeScore = 3; f.awayScore = 0;
      fixtures.push(f);
    }
    const result = applyRelegationPromotion([...d1, strongD2, midD2a, midD2b, midD2c, weakD2], fixtures);
    const strongNow = result.find((t) => t.id === "D2_STRONG")!.division;
    const weakNow = result.find((t) => t.id === "D2_WEAK")!.division;
    expect(strongNow).toBe(1);
    expect(weakNow).toBe(2);
  });
});
