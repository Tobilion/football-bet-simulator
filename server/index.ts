/**
 * CU Bet — authoritative wallet/settlement server.
 *
 * WHY THIS EXISTS: every balance, odds, and payout calculation used to run
 * entirely in the browser. That's fine for gameplay, but it means the ONE
 * thing a betting product can't let the client own — the money — was owned
 * by the client. Anyone with devtools open could edit their own balance in
 * Redux/React state or in localStorage directly.
 *
 * This server becomes the source of truth for the wallet balance and for
 * settling bets. The client still runs the match simulation locally (that
 * hasn't changed — see the "Known limitation" note in README.md) and still
 * shows an optimistic UI, but the balance the game actually uses comes from
 * here, and every debit/credit/payout is recomputed server-side from the
 * SAME pure functions the client used to run unchecked (src/utils/wallet.ts,
 * betSettlement.ts, cashOutUtils.ts) — nothing was reimplemented, it was
 * relocated to a place the player can't edit directly.
 *
 * Run with: npm run server   (see package.json)
 * The Vite dev server proxies /api/* to this process (see vite.config.ts).
 */
import express from "express";
import type { BetBuilderSelection, BetBuilderTicket, BetSelection, BetTicket, Fixture, Profile } from "../src/types";
import { credit, debit, round2 } from "../src/utils/wallet";
import { settlePendingTickets } from "../src/utils/betSettlement";
import { calculateCashOutValue, buildCurrentOddsMap, isCashOutEligible } from "../src/utils/cashOutUtils";
import {
  computeAccaOdds,
  calculateBetBuilderOdds,
  validateBetBuilderSelections,
  settleBetBuilderTicket,
} from "../src/utils/betBuilderUtils";
import { bootstrapProfile, readProfile, writeProfile } from "./store";

const app = express();

// CORS: when this server is deployed separately from the static frontend
// (e.g. Render for this, Vercel for the app), requests arrive cross-origin.
// Allowlist rather than wildcard-open, since this endpoint moves money.
// CU_BET_ALLOWED_ORIGINS is a comma-separated list; defaults to the Vite dev
// server origin so local development keeps working with zero config.
const ALLOWED_ORIGINS = (process.env.CU_BET_ALLOWED_ORIGINS || "http://localhost:3001")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(express.json({ limit: "2mb" }));

type GameMode = "TOURNAMENT" | "LEAGUE";

function isGameMode(v: unknown): v is GameMode {
  return v === "TOURNAMENT" || v === "LEAGUE";
}

/** Small helper: every route needs {gameMode, slot} and a stored profile to exist. */
function requireProfile(
  req: express.Request,
  res: express.Response,
): { gameMode: GameMode; slot: number; profile: Profile } | null {
  const { gameMode, slot } = req.body ?? {};
  if (!isGameMode(gameMode) || typeof slot !== "number") {
    res.status(400).json({ error: "gameMode ('TOURNAMENT'|'LEAGUE') and numeric slot are required." });
    return null;
  }
  const profile = readProfile(gameMode, slot);
  if (!profile) {
    res.status(409).json({
      error: "No server-side profile for this slot yet. Call /api/wallet/bootstrap first.",
    });
    return null;
  }
  return { gameMode, slot, profile };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

/**
 * First contact for a save slot: seeds the server's copy of the profile from
 * the client's current one if the server has never seen this slot before.
 * After this call, the server's stored profile — not the client's — is truth.
 */
app.post("/api/wallet/bootstrap", (req, res) => {
  const { gameMode, slot, profile } = req.body ?? {};
  if (!isGameMode(gameMode) || typeof slot !== "number" || !profile) {
    res.status(400).json({ error: "gameMode, slot, and profile are required." });
    return;
  }
  const canonical = bootstrapProfile(gameMode, slot, profile as Profile);
  res.json({ profile: canonical });
});

/**
 * Place a bet. Mirrors src/hooks/useBetting.ts's handlePlaceBet exactly, but
 * the debit and ticket construction happen against the SERVER's stored
 * balance, not whatever balance the client claims to have.
 */
app.post("/api/bets/place", (req, res) => {
  const ctx = requireProfile(req, res);
  if (!ctx) return;
  const { gameMode, slot, profile } = ctx;

  const {
    type,
    totalStake,
    selectedBets,
    selectionStakes,
  }: {
    type: "SINGLE" | "ACCUMULATOR";
    totalStake: number;
    selectedBets: BetSelection[];
    selectionStakes?: { [key: string]: number };
  } = req.body;

  if (!Number.isFinite(totalStake) || totalStake <= 0) {
    res.status(400).json({ error: "Stake must be greater than zero." });
    return;
  }
  if (!Array.isArray(selectedBets) || selectedBets.length === 0) {
    res.status(400).json({ error: "No selections provided." });
    return;
  }
  if (type === "SINGLE" && selectionStakes) {
    const sum = round2(Object.values(selectionStakes).reduce((a, b) => a + (b || 0), 0));
    if (Math.abs(sum - totalStake) > 0.01) {
      res.status(400).json({ error: "Per-selection stakes must add up to the total stake." });
      return;
    }
  }

  const debited = debit(profile.balance, totalStake);
  if (debited === null) {
    res.status(402).json({ error: "Insufficient wallet balance." });
    return;
  }

  let newTickets: BetTicket[];
  if (type === "SINGLE") {
    const ts = Date.now();
    newTickets = selectedBets.map((b, i) => {
      const key = `${b.fixtureId}-${b.marketType}-${b.selectionId}`;
      const stake = round2(selectionStakes?.[key] ?? totalStake / selectedBets.length);
      return {
        id: `ticket-${ts}-${i}-${Math.floor(Math.random() * 1000)}`,
        type: "SINGLE" as const,
        selections: [b],
        totalOdds: b.odds,
        stake,
        potentialPayout: round2(stake * b.odds),
        status: "PENDING" as const,
        timestamp: ts,
      };
    });
  } else {
    const totalOdds = computeAccaOdds(selectedBets);
    newTickets = [
      {
        id: `ticket-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type,
        selections: [...selectedBets],
        totalOdds,
        stake: totalStake,
        potentialPayout: round2(totalStake * totalOdds),
        status: "PENDING",
        timestamp: Date.now(),
      },
    ];
  }

  const nextProfile: Profile = {
    ...profile,
    balance: debited,
    tickets: [...profile.tickets, ...newTickets],
  };
  writeProfile(gameMode, slot, nextProfile);
  res.json({ profile: nextProfile, placedTickets: newTickets });
});

/**
 * Place a Bet Builder (same-game multi). NOTE: despite the "BetBuilderTicket"
 * type existing in src/types.ts, the live client (useBetting.handlePlaceBetBuilder)
 * actually stores these as regular ACCUMULATOR `BetTicket`s in `profile.tickets`
 * — the separate `betBuilderTickets` array is never populated by the current
 * UI, so this endpoint mirrors what the app ACTUALLY does, not the unused type.
 * Unlike the client version, combinedOdds is recomputed here via
 * calculateBetBuilderOdds (the 7%-per-extra-leg correlation-discount pricing)
 * rather than trusting whatever odds the client sends, and the leg
 * combination is re-validated server-side too.
 */
app.post("/api/bets/place-builder", (req, res) => {
  const ctx = requireProfile(req, res);
  if (!ctx) return;
  const { gameMode, slot, profile } = ctx;

  const {
    fixtureId,
    selections,
    stake,
  }: { fixtureId: string; selections: BetBuilderSelection[]; stake: number } = req.body;

  if (!Number.isFinite(stake) || stake <= 0) {
    res.status(400).json({ error: "Stake must be greater than zero." });
    return;
  }
  const validationError = validateBetBuilderSelections(selections ?? []);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  const debited = debit(profile.balance, stake);
  if (debited === null) {
    res.status(402).json({ error: "Insufficient wallet balance." });
    return;
  }

  const combinedOdds = calculateBetBuilderOdds(selections);
  const ticket: BetTicket = {
    id: `sgm-${Date.now()}`,
    type: "ACCUMULATOR",
    selections: selections.map((s) => ({
      fixtureId,
      marketType: s.marketType,
      selectionId: s.selectionId,
      odds: s.odds,
      details: s.label,
      marketName: "Same Game Multi",
    })),
    totalOdds: combinedOdds,
    stake,
    potentialPayout: round2(stake * combinedOdds),
    status: "PENDING",
    timestamp: Date.now(),
  };

  const nextProfile: Profile = {
    ...profile,
    balance: debited,
    tickets: [...profile.tickets, ticket],
  };
  writeProfile(gameMode, slot, nextProfile);
  res.json({ profile: nextProfile, placedTicket: ticket });
});

/**
 * Cash out a ticket. The server recomputes the fair value itself from the
 * submitted fixtures — it never trusts a client-supplied offer amount, which
 * is the whole point (a client could otherwise just send any number it likes).
 */
app.post("/api/bets/cashout", (req, res) => {
  const ctx = requireProfile(req, res);
  if (!ctx) return;
  const { gameMode, slot, profile } = ctx;

  const { ticketId, fixtures }: { ticketId: string; fixtures: Fixture[] } = req.body;
  const ticket = profile.tickets.find((t) => t.id === ticketId);
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found." });
    return;
  }
  if (!Array.isArray(fixtures) || !isCashOutEligible(ticket, fixtures)) {
    res.status(409).json({ error: "Ticket is not eligible for cash-out." });
    return;
  }

  const currentOddsMap = buildCurrentOddsMap(ticket, fixtures);
  const fairValue = calculateCashOutValue(ticket, fixtures, currentOddsMap);
  if (fairValue === null) {
    res.status(409).json({ error: "A live market is currently suspended — try again shortly." });
    return;
  }

  const nextTickets = profile.tickets.map((t) =>
    t.id === ticketId && t.status === "PENDING"
      ? { ...t, status: "CASHED_OUT" as const, cashedOutAmount: fairValue, cashedOutRound: profile.currentRoundIndex }
      : t,
  );
  const nextProfile: Profile = {
    ...profile,
    balance: credit(profile.balance, fairValue),
    tickets: nextTickets,
  };
  writeProfile(gameMode, slot, nextProfile);
  res.json({ profile: nextProfile, cashedOutAmount: fairValue });
});

/**
 * Settle every pending ticket (regular AND Bet Builder) whose fixtures have
 * completed. Called after a round advance, or from the "auto-settle finished
 * tickets" tick that runs the moment a match reaches full time — either way,
 * it re-derives WON/LOST purely from the fixture data using the same
 * settlement rules used everywhere else in the app, never from a client-sent
 * status.
 */
app.post("/api/bets/settle", (req, res) => {
  const ctx = requireProfile(req, res);
  if (!ctx) return;
  const { gameMode, slot, profile } = ctx;

  const { completedFixtures }: { completedFixtures: Fixture[] } = req.body;
  if (!Array.isArray(completedFixtures)) {
    res.status(400).json({ error: "completedFixtures array is required." });
    return;
  }

  const { finalTickets, totalWinPayoutSum } = settlePendingTickets(profile.tickets, completedFixtures);

  let bbPayoutSum = 0;
  const finalBbTickets: BetBuilderTicket[] = (profile.betBuilderTickets ?? []).map((ticket) => {
    if (ticket.status !== "PENDING") return ticket;
    const match = completedFixtures.find((f) => f.id === ticket.fixtureId);
    if (!match) return ticket;
    const result = settleBetBuilderTicket(ticket, match);
    if (result === "WON") bbPayoutSum += ticket.potentialPayout;
    return { ...ticket, status: result };
  });

  const nextProfile: Profile = {
    ...profile,
    balance: credit(profile.balance, totalWinPayoutSum + bbPayoutSum),
    tickets: finalTickets,
    betBuilderTickets: finalBbTickets,
  };
  writeProfile(gameMode, slot, nextProfile);
  res.json({ profile: nextProfile, totalWinPayoutSum, bbPayoutSum });
});

/**
 * Generic wallet credit for revenue sources that aren't bet settlement
 * (club-ownership passive income, transfer-bid outbid refunds). These are
 * derived from team/fixture state the client already holds (not a value a
 * modified client could invent out of thin air the way a fabricated payout
 * could), but routing them through here means the server's stored balance —
 * not a client-side sum — stays the one number everything else is checked
 * against. `reason` is stored for the bankroll history log.
 */
app.post("/api/wallet/credit", (req, res) => {
  const ctx = requireProfile(req, res);
  if (!ctx) return;
  const { gameMode, slot, profile } = ctx;

  const { amount, reason }: { amount: number; reason?: string } = req.body;
  if (!Number.isFinite(amount)) {
    res.status(400).json({ error: "amount must be a finite number." });
    return;
  }

  const nextProfile: Profile = {
    ...profile,
    balance: amount >= 0 ? credit(profile.balance, amount) : profile.balance - Math.min(-amount, profile.balance),
    bankrollHistory: reason
      ? [...(profile.bankrollHistory ?? []), { timestamp: Date.now(), balance: profile.balance + amount, detail: reason }]
      : profile.bankrollHistory,
  };
  writeProfile(gameMode, slot, nextProfile);
  res.json({ profile: nextProfile });
});

// Exported (not started here) so tests/server-settlement.test.ts can mount
// this exact app on an ephemeral port instead of duplicating route logic
// against a second copy. `npm run server` starts it via server/start.ts.
export { app };
