/**
 * Pure state machine for a user's transfer-market bid lifecycle.
 *
 * Extracted (CU Bet hardening prompt, Phase 2) from what used to be implicit
 * logic spread across `useTransferMarket`'s callbacks and `useRoundAdvance`'s
 * step-7 refund loop. No React/Redux imports, no side effects — just
 * `transition(bid, event) -> { bid, walletDelta }`. Callers apply the
 * returned `walletDelta` to the wallet exactly once per transition.
 *
 * States: PLACED, LEADING, OUTBID, WITHDRAWN, SETTLED.
 *
 * What actually produces a wallet delta in this game:
 *   - PLACE   — first bid on a listing: debits the full amount.
 *   - UPDATE  — replacing an existing bid with a new amount: refunds the old
 *     amount and debits the new one in the same step (net delta only).
 *   - WITHDRAW — refunds the currently-reserved amount.
 *   - SETTLE(won=false) — the bid lost the auction (outbid or the listing
 *     expired with no winner): refunds the reserved amount.
 *   - SETTLE(won=true) — the bid won: no wallet delta here. The money was
 *     already reserved at PLACE/UPDATE time and is spent, not refunded.
 *
 * MARK_LEADING / MARK_OUTBID are informational only (drive the "Leading" /
 * "Outbid" badge in TransferMarket.tsx) and never move money.
 *
 * WITHDRAWN and SETTLED are terminal: once a bid reaches either, every
 * further transition (including a duplicate WITHDRAW or a duplicate SETTLE —
 * the exact race the hardening prompt calls out) is a no-op that returns the
 * bid unchanged with `walletDelta: 0`. This is what makes double-refund /
 * double-charge impossible even if a caller fires the same event twice.
 */

export type BidStatus = "PLACED" | "LEADING" | "OUTBID" | "WITHDRAWN" | "SETTLED";

export interface Bid {
  listingId: string;
  amount: number;
  status: BidStatus;
  outcome?: "WON" | "LOST";
}

export type BidEvent =
  | { type: "PLACE"; amount: number }
  | { type: "UPDATE"; amount: number }
  | { type: "MARK_LEADING" }
  | { type: "MARK_OUTBID" }
  | { type: "WITHDRAW" }
  | { type: "SETTLE"; won: boolean };

export interface TransitionResult {
  /** `null` only when there was no bid and the event wasn't PLACE. */
  bid: Bid | null;
  walletDelta: number;
}

const TERMINAL: ReadonlySet<BidStatus> = new Set(["WITHDRAWN", "SETTLED"]);

/** Round to cents, same convention as the rest of the wallet code. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function transition(bid: Bid | null, event: BidEvent, listingId?: string): TransitionResult {
  switch (event.type) {
    case "PLACE": {
      // Placing when a live (non-terminal) bid already exists on the same
      // listing is really an update — treat it the same way so callers don't
      // need to branch on "does a bid already exist" themselves.
      if (bid && !TERMINAL.has(bid.status)) {
        return transition(bid, { type: "UPDATE", amount: event.amount });
      }
      if (event.amount <= 0) return { bid, walletDelta: 0 };
      return {
        bid: { listingId: bid?.listingId ?? listingId ?? "", amount: event.amount, status: "PLACED" },
        walletDelta: -event.amount,
      };
    }

    case "UPDATE": {
      if (!bid || TERMINAL.has(bid.status)) {
        // No live bid to update — fall back to a fresh placement.
        return transition(bid, { type: "PLACE", amount: event.amount }, bid?.listingId);
      }
      if (event.amount <= 0) return { bid, walletDelta: 0 };
      const delta = round2(bid.amount - event.amount); // refund old, debit new
      return {
        bid: { ...bid, amount: event.amount, status: "PLACED" },
        walletDelta: delta,
      };
    }

    case "MARK_LEADING": {
      if (!bid || TERMINAL.has(bid.status)) return { bid, walletDelta: 0 };
      return { bid: { ...bid, status: "LEADING" }, walletDelta: 0 };
    }

    case "MARK_OUTBID": {
      if (!bid || TERMINAL.has(bid.status)) return { bid, walletDelta: 0 };
      return { bid: { ...bid, status: "OUTBID" }, walletDelta: 0 };
    }

    case "WITHDRAW": {
      if (!bid || TERMINAL.has(bid.status)) {
        // Already withdrawn/settled (or never existed) — refund already
        // happened once, or never should. Idempotent no-op.
        return { bid, walletDelta: 0 };
      }
      return { bid: { ...bid, status: "WITHDRAWN" }, walletDelta: bid.amount };
    }

    case "SETTLE": {
      if (!bid || TERMINAL.has(bid.status)) {
        // Already settled (or withdrawn before settlement reached it) —
        // never re-apply a payout/refund for the same bid twice.
        return { bid, walletDelta: 0 };
      }
      if (event.won) {
        return { bid: { ...bid, status: "SETTLED", outcome: "WON" }, walletDelta: 0 };
      }
      return { bid: { ...bid, status: "SETTLED", outcome: "LOST" }, walletDelta: bid.amount };
    }

    default: {
      const _exhaustive: never = event;
      return { bid, walletDelta: 0 };
    }
  }
}

/**
 * Batch helper for round-advance: applies a SETTLE event to every bid whose
 * listing is in `wonListingIds`, in one pass, and sums the wallet deltas.
 * Each bid transitions exactly once regardless of how many listings resolve
 * in the same tick — there is no shared mutable state between bids, so
 * overlapping settlements on different listings can never cross-contaminate
 * each other's wallet delta.
 */
export function settleAllBids(
  bids: Bid[],
  wonListingIds: ReadonlySet<string>,
): { bids: Bid[]; totalWalletDelta: number } {
  let totalWalletDelta = 0;
  const nextBids = bids.map((bid) => {
    const { bid: nextBid, walletDelta } = transition(bid, {
      type: "SETTLE",
      won: wonListingIds.has(bid.listingId),
    });
    totalWalletDelta = round2(totalWalletDelta + walletDelta);
    return nextBid ?? bid;
  });
  return { bids: nextBids, totalWalletDelta };
}
