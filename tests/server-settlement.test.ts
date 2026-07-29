/**
 * Server-authoritative wallet/settlement test suite.
 * Run with: npx vitest run tests/server-settlement.test.ts
 *
 * Boots the real Express app (server/index.ts) against an ephemeral port and
 * a throwaway data directory, and drives it over real HTTP with fetch — this
 * exercises the actual trust boundary (client can only ever talk to the API,
 * never touch the stored balance directly), not just the underlying pure
 * functions (those are already covered by tests/logic.test.ts).
 *
 * These tests are intentionally sequential and share server-side state
 * (module-scoped variables carry the ticket id forward, same as the original
 * script-style version of this file) — they exercise one continuous session
 * against the same running server and scratch data directory, the same way
 * a real client would, rather than isolating each request.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { AddressInfo } from "net";
import type { BetSelection, Fixture, Profile } from "../src/types";
import type { Server } from "http";

let server: Server;
let base: string;
let scratchDir: string;
let ticketId: string;
let ticket2Id: string;

function fx(over: Partial<Fixture> = {}): Fixture {
  return {
    id: "m1", homeTeamId: "h", awayTeamId: "a", roundIndex: 0, status: "FT",
    homeScore: 2, awayScore: 0, currentMinute: 90, elapsedTicks: 0,
    events: [], odds: {} as any, weather: "Clear Sky",
    stats: {
      home: { corners: 4, yellowCards: 1, redCards: 0, saves: 3, shots: 5, shotsOnTarget: 3, fouls: 5 } as any,
      away: { corners: 3, yellowCards: 2, redCards: 1, saves: 2, shots: 4, shotsOnTarget: 2, fouls: 6 } as any,
    },
    ...over,
  } as Fixture;
}

const mkSel = (odds: number): BetSelection => ({
  fixtureId: "m1", marketType: "MATCH_WINNER", selectionId: "HOME", odds, details: "", marketName: "",
});

async function post(path: string, body: unknown) {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

beforeAll(async () => {
  // Point the store at a scratch directory BEFORE importing the app —
  // store.ts reads this env var once at module-load time, so it must be set
  // first. A dynamic import (not a static one) guarantees this assignment
  // runs before the module graph for server/index.ts is evaluated.
  scratchDir = mkdtempSync(join(tmpdir(), "cu-bet-server-test-"));
  process.env.CU_BET_DATA_DIR = scratchDir;
  const { app } = await import("../server/index.ts");
  server = app.listen(0);
  const port = (server.address() as AddressInfo).port;
  base = `http://localhost:${port}`;
});

afterAll(() => {
  server?.close();
  rmSync(scratchDir, { recursive: true, force: true });
});

describe("bootstrap", () => {
  it("seeds the server profile from the client on first contact", async () => {
    const startingProfile: Profile = {
      username: "tester", balance: 1000, netProfit: 0, tickets: [], currentRoundIndex: 0, createdTime: Date.now(),
    };
    const boot = await post("/api/wallet/bootstrap", { gameMode: "LEAGUE", slot: 999, profile: startingProfile });
    expect(boot.status).toBe(200);
    expect(boot.json.profile.balance).toBe(1000);
  });

  it("ignores the client's copy on re-bootstrap — server stays authoritative", async () => {
    const startingProfile: Profile = {
      username: "tester", balance: 1000, netProfit: 0, tickets: [], currentRoundIndex: 0, createdTime: Date.now(),
    };
    const boot2 = await post("/api/wallet/bootstrap", {
      gameMode: "LEAGUE", slot: 999,
      profile: { ...startingProfile, balance: 999999 }, // an attempted "inflate on re-bootstrap" attack
    });
    expect(boot2.json.profile.balance).toBe(1000);
  });
});

describe("place bet", () => {
  it("debits the server's own stored balance and computes payout server-side", async () => {
    const placed = await post("/api/bets/place", {
      gameMode: "LEAGUE", slot: 999, type: "ACCUMULATOR", totalStake: 100, selectedBets: [mkSel(2.5)],
    });
    expect(placed.status).toBe(200);
    expect(placed.json.profile.balance).toBe(900); // 1000 - 100 stake
    expect(placed.json.placedTickets[0].potentialPayout).toBe(250); // 100 x 2.5
    ticketId = placed.json.placedTickets[0].id;
  });

  it("rejects a stake exceeding the server-held balance (402)", async () => {
    const overStake = await post("/api/bets/place", {
      gameMode: "LEAGUE", slot: 999, type: "ACCUMULATOR", totalStake: 999999, selectedBets: [mkSel(2.5)],
    });
    expect(overStake.status).toBe(402);
  });

  it("ignores a fabricated 'balance' field in the request body (client-side tampering)", async () => {
    // Simulate a devtools-style attack: pretend the client thinks its balance
    // is huge and place a bet close to that fabricated number. The server
    // only ever consults its own stored balance, so this must still be rejected.
    const tamperAttempt = await post("/api/bets/place", {
      gameMode: "LEAGUE", slot: 999, type: "ACCUMULATOR", totalStake: 5000, selectedBets: [mkSel(1.5)],
      balance: 999999999, // extra field a tampered client might send — must be ignored entirely
    });
    expect(tamperAttempt.status).toBe(402);
  });
});

describe("settle", () => {
  it("pays out the winning ticket placed above and updates the balance", async () => {
    const settled = await post("/api/bets/settle", {
      gameMode: "LEAGUE", slot: 999, completedFixtures: [fx({ homeScore: 2, awayScore: 0 })],
    });
    expect(settled.status).toBe(200);
    expect(settled.json.totalWinPayoutSum).toBe(250);
    expect(settled.json.profile.balance).toBe(1150); // 900 + 250 payout
    const settledTicket = settled.json.profile.tickets.find((t: any) => t.id === ticketId);
    expect(settledTicket.status).toBe("WON");
  });
});

describe("cash-out ignores client-submitted offer amount", () => {
  it("places a fresh live ticket to cash out", async () => {
    const placed2 = await post("/api/bets/place", {
      gameMode: "LEAGUE", slot: 999, type: "ACCUMULATOR", totalStake: 20, selectedBets: [mkSel(2)],
    });
    expect(placed2.status).toBe(200);
    ticket2Id = placed2.json.placedTickets[0].id;
  });

  it("recomputes fair value server-side, ignoring a bogus client offer", async () => {
    const liveFixture = fx({ status: "LIVE", currentMinute: 60, homeScore: 1, awayScore: 0 });
    const cashout = await post("/api/bets/cashout", {
      gameMode: "LEAGUE", slot: 999, ticketId: ticket2Id, fixtures: [liveFixture],
      offerAmount: 999999, // a bogus client-proposed cash-out value — must be ignored
    });
    expect(cashout.status).toBe(200);
    expect(cashout.json.cashedOutAmount).toBeLessThan(999999);
    expect(cashout.json.cashedOutAmount).toBeLessThanOrEqual(40); // stays within the ticket's potential payout
  });
});
