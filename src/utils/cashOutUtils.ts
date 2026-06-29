import { BetSelection, BetTicket, Fixture, MarketType } from "../types";
import { getLiveInPlayOdds } from "../utils";

/** Check whether a single settled selection won against the completed fixture. */
function checkLegResult(sel: BetSelection, fixture: Fixture): "WON" | "LOST" | "PENDING" {
  if (fixture.status !== "FT") return "PENDING";
  const h = Math.floor(fixture.homeScore);
  const a = Math.floor(fixture.awayScore);

  switch (sel.marketType as MarketType) {
    case "MATCH_WINNER": {
      const outcome = h > a ? "HOME" : a > h ? "AWAY" : "DRAW";
      return sel.selectionId === outcome ? "WON" : "LOST";
    }
    case "DOUBLE_CHANCE": {
      const outcome = h > a ? "HOME" : a > h ? "AWAY" : "DRAW";
      if (sel.selectionId === "HOME_OR_DRAW") return outcome !== "AWAY" ? "WON" : "LOST";
      if (sel.selectionId === "HOME_OR_AWAY") return outcome !== "DRAW" ? "WON" : "LOST";
      if (sel.selectionId === "DRAW_OR_AWAY") return outcome !== "HOME" ? "WON" : "LOST";
      return "LOST";
    }
    case "BOTH_TEAMS_TO_SCORE": {
      const both = h > 0 && a > 0;
      return (sel.selectionId === "YES") === both ? "WON" : "LOST";
    }
    case "OVER_UNDER_GOALS": {
      const total = h + a;
      const [mode, lineStr] = sel.selectionId.split("_");
      const line = parseFloat(lineStr.replace("_", "."));
      return (mode === "OVER" ? total > line : total < line) ? "WON" : "LOST";
    }
    case "OVER_UNDER_CORNERS": {
      const total = (fixture.stats?.home.corners ?? 0) + (fixture.stats?.away.corners ?? 0);
      const [mode, lineStr] = sel.selectionId.split("_");
      const line = parseFloat(lineStr);
      return (mode === "OVER" ? total > line : total < line) ? "WON" : "LOST";
    }
    case "OVER_UNDER_CARDS": {
      const total =
        (fixture.stats?.home.yellowCards ?? 0) + (fixture.stats?.home.redCards ?? 0) +
        (fixture.stats?.away.yellowCards ?? 0) + (fixture.stats?.away.redCards ?? 0);
      const [mode, lineStr] = sel.selectionId.split("_");
      const line = parseFloat(lineStr);
      return (mode === "OVER" ? total > line : total < line) ? "WON" : "LOST";
    }
    case "EXACT_SCORE":
      return sel.selectionId === `${h}-${a}` ? "WON" : "LOST";
    case "ANYTIME_GOALSCORER":
      return fixture.events.some(
        (ev) => ev.type === "GOAL" && ev.playerId === sel.selectionId,
      ) ? "WON" : "LOST";
    default:
      return "PENDING";
  }
}

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
  let factor = 1.0;

  for (const sel of ticket.selections) {
    const fix = fixtures.find((f) => f.id === sel.fixtureId);
    if (!fix) continue;

    const legResult = checkLegResult(sel, fix);
    if (legResult === "LOST") return 0;

    if (legResult === "PENDING" && fix.status === "LIVE") {
      const currentOdds = currentOddsMap[`${sel.marketType}:${sel.selectionId}`];
      if (currentOdds === null || currentOdds === undefined) return null;
      factor *= sel.odds / Math.max(1.01, currentOdds);
    }
    // legResult === "WON" or fixture === "SCHEDULED": factor stays 1.0
  }

  return Math.max(0, Math.round(ticket.potentialPayout * factor * 0.92 * 100) / 100);
}
