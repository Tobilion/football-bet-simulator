/**
 * Thin client for the optional wallet/settlement server (server/index.ts).
 *
 * Design goal: CU Bet must keep working exactly as it always has when the
 * server isn't running (it's still "offline-first, no backend required" per
 * the README) — this module is additive. Every function here returns
 * `{ ok: true, ... }` on success, `{ ok: false, reason: "unreachable" }` if
 * the server can't be reached at all (caller should silently fall back to
 * local computation, unchanged from before this existed), or
 * `{ ok: false, reason: "rejected", error }` if the server WAS reached but
 * refused the request (e.g. insufficient funds) — that's an authoritative
 * answer and should NOT be papered over with local logic, since the server's
 * balance is the real one once it's in play.
 */
import type { BetBuilderSelection, BetBuilderTicket, BetSelection, BetTicket, Fixture, Profile } from "../types";

const TIMEOUT_MS = 1200;

// In local dev the Vite proxy forwards a relative `/api/*` path to the wallet
// server (see vite.config.ts), so API_BASE stays "". In production the
// frontend (Vercel) and this server (e.g. Render) are different origins with
// no proxy in between, so a deployed build needs an absolute URL — set
// VITE_API_BASE_URL at build time (e.g. in Vercel's project env vars) to the
// deployed server's origin, no trailing slash. Left unset, the app behaves
// exactly as it always has: no server reachable, falls back to local logic.
const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || "";

// Kept as a separate, non-generic union so callers can cast to it after
// checking `result.ok === false`. TypeScript's control-flow narrowing does
// not reliably eliminate the `{ ok: true } & T` member of `ServerResult<T>`
// for generic T (a known limitation with discriminated unions over generic
// intersection types), so call sites use `result as ServerFailure` instead
// of relying on narrowing alone once they've handled the `result.ok` case.
export type ServerFailure =
  | { ok: false; reason: "unreachable" }
  | { ok: false; reason: "rejected"; error: string; status: number };

type ServerResult<T> = ({ ok: true } & T) | ServerFailure;

async function callApi<T>(path: string, body: unknown): Promise<ServerResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/api${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, reason: "rejected", error: json?.error || `Server error (${res.status})`, status: res.status };
    }
    return { ok: true, ...json } as ServerResult<T>;
  } catch {
    clearTimeout(timer);
    // Network error, timeout, or the server simply isn't running — this is
    // the expected offline case, not a bug. Caller falls back to local logic.
    return { ok: false, reason: "unreachable" };
  }
}

export type GameModeSlot = { gameMode: "TOURNAMENT" | "LEAGUE"; slot: number };

/** First-contact call: seeds the server's copy of the wallet from the client's on first use. */
export function bootstrapWallet(ctx: GameModeSlot, profile: Profile) {
  return callApi<{ profile: Profile }>("/wallet/bootstrap", { ...ctx, profile });
}

export function placeBetOnServer(
  ctx: GameModeSlot,
  args: {
    type: "SINGLE" | "ACCUMULATOR";
    totalStake: number;
    selectedBets: BetSelection[];
    selectionStakes?: { [key: string]: number };
  },
) {
  return callApi<{ profile: Profile; placedTickets: BetTicket[] }>("/bets/place", { ...ctx, ...args });
}

export function placeBetBuilderOnServer(
  ctx: GameModeSlot,
  args: { fixtureId: string; selections: BetBuilderSelection[]; stake: number },
) {
  return callApi<{ profile: Profile; placedTicket: BetBuilderTicket }>("/bets/place-builder", { ...ctx, ...args });
}

export function cashOutOnServer(ctx: GameModeSlot, ticketId: string, fixtures: Fixture[]) {
  return callApi<{ profile: Profile; cashedOutAmount: number }>("/bets/cashout", { ...ctx, ticketId, fixtures });
}

/** Settles BOTH regular tickets and Bet Builder tickets against the given completed fixtures. */
export function settleOnServer(ctx: GameModeSlot, completedFixtures: Fixture[]) {
  return callApi<{ profile: Profile; totalWinPayoutSum: number; bbPayoutSum: number }>(
    "/bets/settle", { ...ctx, completedFixtures },
  );
}

/**
 * Generic credit for non-bet revenue (club ownership income, transfer-bid
 * refunds) so the server's stored balance stays the single number everything
 * downstream is checked against. Pass a negative amount to debit.
 */
export function creditWalletOnServer(ctx: GameModeSlot, amount: number, reason?: string) {
  return callApi<{ profile: Profile }>("/wallet/credit", { ...ctx, amount, reason });
}
