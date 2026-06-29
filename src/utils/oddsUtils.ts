// Re-export from the main utils for backwards compat; direct callers should import from here.
export { getLiveInPlayOdds } from "../utils";

export function calculateImpliedProbability(odds: number): number {
  if (!odds || odds <= 0) return 0;
  return 1 / odds;
}

export function applyOwnerBoost(
  odds: number | null,
  isOwnerMatch: boolean,
): number | null {
  if (odds === null) return null;
  if (!isOwnerMatch) return odds;
  // Slight odds improvement for matches involving owned club (cosmetic only)
  return Math.max(1.01, Math.round(odds * 0.97 * 100) / 100);
}
