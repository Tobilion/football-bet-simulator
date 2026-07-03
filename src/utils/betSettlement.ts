import { BetSelection, BetTicket, Fixture } from "../types";
import { resolveSelection } from "./settlementEngine";
import { round2 } from "./wallet";

/** Returns true if a single selection won against a completed fixture. */
export function didSelectionWin(sel: BetSelection, match: Fixture): boolean {
  return resolveSelection(sel, match) === "WON";
}

/**
 * Settles pending tickets against a round's completed fixtures.
 * Returns updated tickets plus the total payout for won tickets.
 */
export function settlePendingTickets(
  tickets: BetTicket[],
  completedFixtures: Fixture[],
): { finalTickets: BetTicket[]; totalWinPayoutSum: number } {
  let totalWinPayoutSum = 0;
  const finalTickets = tickets.map((ticket) => {
    if (ticket.status !== "PENDING") return ticket;

    // Multi-single tickets settle per leg: each winning leg pays its own
    // stake x odds, independent of the other legs.
    if (ticket.type === "SINGLE" && ticket.selectionStakes) {
      let payout = 0;
      ticket.selections.forEach((sel) => {
        const match = completedFixtures.find((f) => f.id === sel.fixtureId);
        if (match && resolveSelection(sel, match) === "WON") {
          const key = `${sel.fixtureId}-${sel.marketType}-${sel.selectionId}`;
          payout += (ticket.selectionStakes?.[key] || 0) * sel.odds;
        }
      });
      payout = round2(payout);
      totalWinPayoutSum += payout;
      return {
        ...ticket,
        status: payout > 0 ? ("WON" as const) : ("LOST" as const),
        settledPayout: payout,
      };
    }

    // If any leg's fixture hasn't completed yet, leave the ticket pending.
    const anyMissing = ticket.selections.some(
      (sel) => !completedFixtures.find((f) => f.id === sel.fixtureId),
    );
    if (anyMissing) return ticket;

    // Accumulators (and legacy singles without per-leg stakes): all legs must win.
    const wonAll = ticket.selections.every((sel) => {
      const match = completedFixtures.find((f) => f.id === sel.fixtureId);
      return match ? resolveSelection(sel, match) === "WON" : false;
    });
    if (wonAll) totalWinPayoutSum += ticket.potentialPayout;
    return {
      ...ticket,
      status: wonAll ? ("WON" as const) : ("LOST" as const),
      settledPayout: wonAll ? ticket.potentialPayout : 0,
    };
  });
  return { finalTickets, totalWinPayoutSum };
}
