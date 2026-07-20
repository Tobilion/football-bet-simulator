import { Fixture, MarketType } from "./types";
import { computeLiveOdds, MAX_LIVE_ODDS } from "./utils/liveOdds";

export { MAX_LIVE_ODDS };

/**
 * Formats a number as a money string with commas and 2 decimal places.
 * e.g. 1234.5 → "1,234.50"
 */
export function formatMoney(amount: number, decimals: number = 2): string {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Live (in-play) odds for a selection.
 *
 * Delegates to the single unified model in `utils/liveOdds.ts`, which recovers
 * the implied expected goals from the fixture's PRE-MATCH odds, scales the
 * remainder by time left, adds what has already happened, and re-derives the
 * market from the resulting final-score distribution. Returns null only when the
 * outcome is decided or impossible.
 */
export function getLiveInPlayOdds(
  fixture: Fixture,
  marketType: MarketType,
  selectionId: string,
  baseOdds: number,
): number | null {
  return computeLiveOdds(fixture, marketType, selectionId, baseOdds);
}
