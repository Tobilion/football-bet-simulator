import { BetTicket, Fixture, MarketType } from "../types";
import { resolveSelection } from "./settlementEngine";
import { getLiveInPlayOdds } from "../utils";

/**
 * Builds the live-odds map for all selections in a ticket by calling getLiveInPlayOdds
 * on every LIVE fixture selection. Pass into calculateCashOutValue.
 */
export function buildCurrentOddsMap(
  ticket: BetTicket,
  fixtures: Fixture[],
): Record<string, number | null> {
  const map: Record<string, number | null> = {};
  for (const sel of ticket.selections) {
    const fix = fixtures.find((f) => f.id === sel.fixtureId);
    if (fix?.status === "LIVE") {
      map[`${sel.marketType}:${sel.selectionId}`] = getLiveInPlayOdds(
        fix,
        sel.marketType as MarketType,
        sel.selectionId,
        sel.odds,
      );
    }
  }
  return map;
}

/**
 * Returns true when a ticket has at least one selection in a LIVE fixture and is still PENDING.
 */
export function isCashOutEligible(ticket: BetTicket, fixtures: Fixture[]): boolean {
  if (ticket.status !== "PENDING") return false;
  return ticket.selections.some(
    (sel) => fixtures.find((f) => f.id === sel.fixtureId)?.status === "LIVE",
  );
}

/**
 * Calculates a fair live cash-out value.
 *
 * For each leg:
 *   - FT + WON  → factor 1.0 (locked in, full odds realised)
 *   - FT + LOST → dead ticket, returns 0
 *   - LIVE      → factor = originalOdds / currentOdds (risk-adjusted)
 *   - SCHEDULED → factor 1.0 (not yet started)
 *
 * cashOut = potentialPayout × ∏(factors) × 0.92 (8% book margin)
 * Returns null if any LIVE market is suspended (currentOdds === null).
 */
export function calculateCashOutValue(
  ticket: BetTicket,
  fixtures: Fixture[],
  currentOddsMap: Record<string, number | null>,
): number | null {
  // Multi-single tickets are valued per leg: one lost leg must not zero out
  // the other independent singles.
  if (ticket.type === "SINGLE" && ticket.selectionStakes) {
    let value = 0;
    for (const sel of ticket.selections) {
      const fix = fixtures.find((f) => f.id === sel.fixtureId);
      const stake = ticket.selectionStakes[`${sel.fixtureId}-${sel.marketType}-${sel.selectionId}`] || 0;
      if (!fix || stake === 0) continue;

      const legResult = resolveSelection(sel, fix);
      if (legResult === "LOST") continue;

      let legFactor = 1.0;
      if (legResult === "PENDING" && fix.status === "SCHEDULED") {
        // Unstarted leg: fair value is the implied win probability, not 1.0.
        legFactor = 1 / Math.max(1.01, sel.odds);
      }
      if (legResult === "PENDING" && fix.status === "LIVE") {
        const currentOdds = currentOddsMap[`${sel.marketType}:${sel.selectionId}`];
        if (currentOdds === null || currentOdds === undefined) return null; // suspended
        legFactor = sel.odds / Math.max(1.01, currentOdds);
      }
      value += stake * sel.odds * legFactor;
    }
    return Math.max(0, Math.round(value * 0.92 * 100) / 100);
  }

  let factor = 1.0;

  for (const sel of ticket.selections) {
    const fix = fixtures.find((f) => f.id === sel.fixtureId);
    if (!fix) continue;

    const legResult = resolveSelection(sel, fix);
    if (legResult === "LOST") return 0;

    if (legResult === "PENDING" && fix.status === "SCHEDULED") {
      // Unstarted leg: price at implied probability so pre-match cash-out ~ stake.
      factor *= 1 / Math.max(1.01, sel.odds);
    } else if (legResult === "PENDING" && fix.status === "LIVE") {
      const currentOdds = currentOddsMap[`${sel.marketType}:${sel.selectionId}`];
      if (currentOdds === null || currentOdds === undefined) return null;
      factor *= sel.odds / Math.max(1.01, currentOdds);
    }
    // legResult === "WON": factor stays 1.0
  }

  return Math.max(0, Math.round(ticket.potentialPayout * factor * 0.92 * 100) / 100);
}
