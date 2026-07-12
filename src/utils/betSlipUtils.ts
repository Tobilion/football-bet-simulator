import { BetSelection, MarketType } from "../types";

// Match-result markets are all the same mutually-exclusive outcome group:
// you can't win both "Home Win" and "Away Win", nor pair them with a
// double-chance / exact-score pick for the same match inside one accumulator.
const RESULT_MARKETS: MarketType[] = ["MATCH_WINNER", "DOUBLE_CHANCE", "EXACT_SCORE"];

/**
 * Key identifying the mutually-exclusive market group a selection belongs to.
 * Two selections sharing a key (same match) cannot both win, so they may be
 * placed as separate SINGLES but never combined into one accumulator.
 * Anytime-goalscorer picks are never exclusive (many players can score).
 */
export function marketGroupKey(sel: BetSelection): string {
  if (sel.marketType === "ANYTIME_GOALSCORER") {
    return `GS:${sel.fixtureId}:${sel.selectionId}`;
  }
  if (RESULT_MARKETS.includes(sel.marketType)) {
    return `RESULT:${sel.fixtureId}`;
  }
  return `${sel.marketType}:${sel.fixtureId}`;
}

/**
 * Collapses mutually-exclusive same-match picks to the first of each group for
 * accumulator use, returning both the kept selections and the dropped ones so
 * the UI can tell the user what was removed.
 */
export function dedupeForAccumulator(selections: BetSelection[]): {
  kept: BetSelection[];
  dropped: BetSelection[];
} {
  const seen = new Set<string>();
  const kept: BetSelection[] = [];
  const dropped: BetSelection[] = [];
  for (const sel of selections) {
    const key = marketGroupKey(sel);
    if (seen.has(key)) dropped.push(sel);
    else {
      seen.add(key);
      kept.push(sel);
    }
  }
  return { kept, dropped };
}
