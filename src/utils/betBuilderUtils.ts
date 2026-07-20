import { BetBuilderSelection, BetBuilderTicket, Fixture, MarketType } from "../types";
import { resolveSelection } from "./settlementEngine";

/** Multiply odds with a 7%-per-extra-leg correlation discount */
export function calculateBetBuilderOdds(selections: BetBuilderSelection[]): number {
  if (selections.length === 0) return 1;
  const raw = selections.reduce((acc, s) => acc * s.odds, 1);
  const discount = 0.07 * Math.max(0, selections.length - 1);
  return Math.max(1.01, Math.round(raw * (1 - discount) * 100) / 100);
}

const OUTCOME_MARKETS: MarketType[] = ["MATCH_WINNER", "DOUBLE_CHANCE", "EXACT_SCORE"];

/** Returns null if valid, or an error message string */
export function validateBetBuilderSelections(
  selections: BetBuilderSelection[],
): string | null {
  if (selections.length < 2) return "Add at least 2 legs to place a Bet Builder.";

  // Only one outcome market allowed
  const outcomeLegs = selections.filter((s) => OUTCOME_MARKETS.includes(s.marketType));
  if (outcomeLegs.length > 1) return "Only one match outcome market allowed per builder.";

  // Only one BTTS selection
  const bttsLegs = selections.filter((s) => s.marketType === "BOTH_TEAMS_TO_SCORE");
  if (bttsLegs.length > 1) return "Conflicting Both Teams to Score selections.";

  // Only one Over/Under per line
  const ouSeen = new Map<string, number>();
  for (const s of selections) {
    if (
      s.marketType === "OVER_UNDER_GOALS" ||
      s.marketType === "OVER_UNDER_CORNERS" ||
      s.marketType === "OVER_UNDER_CARDS" ||
      s.marketType === "OVER_UNDER_SAVES"
    ) {
      const lineKey = `${s.marketType}_${s.selectionId.replace(/^(OVER|UNDER)_/, "")}`;
      ouSeen.set(lineKey, (ouSeen.get(lineKey) ?? 0) + 1);
      if ((ouSeen.get(lineKey) ?? 0) > 1) return `Conflicting Over/Under selections on same line.`;
    }
  }

  return null;
}

/** Settle a builder ticket against the completed fixture */
export function settleBetBuilderTicket(
  ticket: BetBuilderTicket,
  fixture: Fixture,
): "WON" | "LOST" {
  const allWon = ticket.selections.every((sel) => resolveSelection(sel, fixture) === "WON");
  return allWon ? "WON" : "LOST";
}

/**
 * Combined accumulator odds = the straight product of every leg's odds, exactly
 * as a standard accumulator pays (the displayed total always equals the product
 * of the shown legs — no hidden correlation discount). Correlated same-game
 * pricing lives in the dedicated Bet Builder (`calculateBetBuilderOdds`), not
 * here.
 */
export function computeAccaOdds(
  selections: { fixtureId: string; odds: number }[],
): number {
  if (selections.length === 0) return 1;
  const total = selections.reduce((acc, s) => acc * s.odds, 1);
  return Math.max(1.01, Math.round(total * 100) / 100);
}
