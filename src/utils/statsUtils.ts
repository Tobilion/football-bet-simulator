import { Fixture } from "../types";

// ──────────────────────────────────────────────────────────────────────────
// Historical stat aggregation (pure — no engine imports).
//
// Turns a team's recorded match history into recency-weighted "for" and
// "against" rates for any counting stat, opponent-adjusts them, and shrinks the
// result toward a supplied prior (a squad-strength expectation for THIS match)
// by an effective-sample weight. Early in a season the strength prior dominates;
// as real matches accumulate, the recorded (opponent-adjusted) rate takes over.
// ──────────────────────────────────────────────────────────────────────────

export type StatKey = "goals" | "corners" | "cards" | "saves" | "shots";

// Prior weight in "virtual matches": how long the strength prior holds sway.
const SHRINK_K = 4;
// Exponential recency decay: a match i games back weighs RECENCY^i.
const RECENCY = 0.82;

function recordedValue(
  f: Fixture,
  teamId: string,
  stat: StatKey,
  side: "for" | "against",
): number {
  const isHome = f.homeTeamId === teamId;
  if (stat === "goals") {
    const gf = Math.floor(isHome ? f.homeScore : f.awayScore);
    const ga = Math.floor(isHome ? f.awayScore : f.homeScore);
    return side === "for" ? gf : ga;
  }
  const mine = isHome ? f.stats.home : f.stats.away;
  const theirs = isHome ? f.stats.away : f.stats.home;
  const block = side === "for" ? mine : theirs;
  if (!block) return 0;
  switch (stat) {
    case "corners": return block.corners ?? 0;
    case "saves": return block.saves ?? 0;
    case "shots": return block.shots ?? 0;
    case "cards": return (block.yellowCards ?? 0) + (block.redCards ?? 0);
  }
}

interface RateOpts {
  venue?: "home" | "away";
  window?: number;
}

/**
 * Recency-weighted recorded mean of `stat` for a team, plus the effective sample
 * size (sum of recency weights). Returns `mean: null` when no matches qualify.
 */
export function recordedMean(
  teamId: string,
  fixtures: Fixture[],
  stat: StatKey,
  side: "for" | "against",
  opts: RateOpts = {},
): { mean: number | null; effN: number } {
  const played = fixtures
    .filter(
      (f) =>
        f.status === "FT" &&
        (f.homeTeamId === teamId || f.awayTeamId === teamId) &&
        (opts.venue === undefined ||
          (opts.venue === "home" && f.homeTeamId === teamId) ||
          (opts.venue === "away" && f.awayTeamId === teamId)),
    )
    .sort((a, b) => a.roundIndex - b.roundIndex);

  let recent = played.slice().reverse();
  if (opts.window && opts.window > 0) recent = recent.slice(0, opts.window);

  let weightSum = 0;
  let valueSum = 0;
  recent.forEach((f, i) => {
    const w = Math.pow(RECENCY, i);
    weightSum += w;
    valueSum += w * recordedValue(f, teamId, stat, side);
  });

  if (weightSum === 0) return { mean: null, effN: 0 };
  return { mean: valueSum / weightSum, effN: weightSum };
}

/**
 * Opponent-adjusted, shrinkage-blended expected count of `stat` for both sides.
 * Takes each side's recorded "for" rate, opponent-adjusts by the other team's
 * recorded "against" rate (relative to the league baseline), then shrinks toward
 * the strength prior by how much history exists. No history → returns the prior.
 */
export function blendedExpected(
  homeId: string,
  awayId: string,
  fixtures: Fixture[],
  stat: StatKey,
  baseline: number,
  priorHome: number,
  priorAway: number,
): { home: number; away: number } {
  const base = Math.max(0.1, baseline);

  const homeFor = recordedMean(homeId, fixtures, stat, "for", { venue: "home" });
  const awayAgainst = recordedMean(awayId, fixtures, stat, "against", { venue: "away" });
  const awayFor = recordedMean(awayId, fixtures, stat, "for", { venue: "away" });
  const homeAgainst = recordedMean(homeId, fixtures, stat, "against", { venue: "home" });

  const combine = (
    forM: { mean: number | null; effN: number },
    againstM: { mean: number | null; effN: number },
    prior: number,
  ): number => {
    const f = forM.mean ?? base;
    const ag = againstM.mean ?? base;
    const observed = f * (ag / base);
    // The team's own production sample governs how far we move off the prior;
    // the opponent's "against" rate only tilts the estimate (defaults to neutral
    // when absent), so a team with strong history still updates even if this
    // particular opponent has none.
    const effN = forM.effN;
    return (observed * effN + prior * SHRINK_K) / (effN + SHRINK_K);
  };

  return {
    home: combine(homeFor, awayAgainst, priorHome),
    away: combine(awayFor, homeAgainst, priorAway),
  };
}
