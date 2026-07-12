import { Team, Fixture, MatchOdds, GoalscorerOdds, Position } from "../types";
import { getStartingXI, strengthExpectedStats, STAT_BASELINE } from "./matchEngine";
import { blendedExpected } from "../utils/statsUtils";
import { getTeamForm, getHeadToHead } from "../utils/formUtils";

// ──────────────────────────────────────────────────────────────────────────
// Stats-driven odds engine.
//
// Every market comes from ONE model. Each side's expected count for every stat
// (goals, corners, cards, saves) is a blend of:
//   • a squad-strength prior (`strengthExpectedStats`, shared with the match
//     simulation so pricing and outcomes agree), and
//   • that team's recency-weighted recorded history — its own rate for the stat
//     AND the opponent's rate of conceding it — shrunk toward the prior by
//     sample size and split by home/away venue (`utils/statsUtils`).
// Goals feed a Poisson score matrix, so 1X2 / double chance / BTTS / over-unders
// / exact scores are mutually consistent. Corners / cards / saves are priced off
// their own Poisson totals from the same blended expectation.
// ──────────────────────────────────────────────────────────────────────────

const MARGIN = 1.08;
const MAX_GOALS = 8;

function factorial(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}
function poisson(k: number, lambda: number): number {
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k);
}
function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
function oddsFromProb(p: number): number {
  const cp = clamp(p, 1e-4, 0.999);
  return clamp(Math.round((1 / (cp * MARGIN)) * 100) / 100, 1.01, 501);
}
function probTotalOver(line: number, lambda: number): number {
  let p = 0;
  for (let k = Math.ceil(line); k <= 40; k++) p += poisson(k, lambda);
  return clamp(p, 0, 1);
}

function formNudge(teamId: string, fixtures: Fixture[]): number {
  const form = getTeamForm(teamId, fixtures);
  const score = form.reduce((s, r) => s + (r === "W" ? 1 : r === "L" ? -1 : 0), 0);
  return 1 + score * 0.02;
}

const EXACT_SCORELINES = [
  "1-0", "2-0", "2-1", "3-0", "3-1", "3-2",
  "0-0", "1-1", "2-2", "0-1", "0-2", "1-2",
  "0-3", "1-3", "2-3",
];

function goalscorerOdds(team: Team, teamXG: number): GoalscorerOdds[] {
  const xi = getStartingXI(team).filter((p) => p.position !== "GK");
  if (xi.length === 0) return [];
  const avgRating = xi.reduce((s, p) => s + p.rating, 0) / xi.length;
  const posBase: Record<string, number> = { ATT: 0.34, MID: 0.13, DEF: 0.05 };
  return xi.map((p) => {
    const base = posBase[p.position] ?? 0.08;
    const ratingFactor = p.rating / Math.max(50, avgRating);
    const share = teamXG / STAT_BASELINE.goals;
    const anytimeP = clamp(base * ratingFactor * share, 0.02, 0.85);
    return { playerId: p.id, name: p.name, position: p.position as Position, odds: oddsFromProb(anytimeP) };
  });
}

/**
 * The single source of truth for a fixture's odds. `allFixtures` supplies the
 * recorded history used for form / head-to-head / for-against rates; pass the
 * fixtures known so far when generating a round (empty at season kickoff, where
 * the model leans entirely on squad strength).
 */
export function computeMatchOdds(
  homeTeam: Team,
  awayTeam: Team,
  allFixtures: Fixture[] = [],
): MatchOdds {
  const exp = strengthExpectedStats(homeTeam, awayTeam);

  // Blend a stat's (opponent-adjusted) recorded history with the squad-strength
  // prior for this match. exp.home[stat]/exp.away[stat] are already
  // opponent-adjusted, so they serve directly as the priors.
  const blend = (stat: "goals" | "corners" | "cards" | "saves", baseline: number) =>
    blendedExpected(
      homeTeam.id,
      awayTeam.id,
      allFixtures,
      stat,
      baseline,
      exp.home[stat],
      exp.away[stat],
    );

  // ── Goals → Poisson score matrix ──
  const g = blend("goals", STAT_BASELINE.goals);
  let lambdaHome = g.home * formNudge(homeTeam.id, allFixtures);
  let lambdaAway = g.away * formNudge(awayTeam.id, allFixtures);
  const h2h = getHeadToHead(homeTeam.id, awayTeam.id, allFixtures);
  if (h2h.played > 0) {
    const edge = (h2h.homeWins - h2h.awayWins) / h2h.played;
    lambdaHome *= 1 + edge * 0.05;
    lambdaAway *= 1 - edge * 0.05;
  }
  lambdaHome = clamp(lambdaHome, 0.2, 4.5);
  lambdaAway = clamp(lambdaAway, 0.2, 4.5);

  const matrix: number[][] = [];
  let matrixSum = 0;
  for (let i = 0; i <= MAX_GOALS; i++) {
    matrix[i] = [];
    for (let j = 0; j <= MAX_GOALS; j++) {
      const p = poisson(i, lambdaHome) * poisson(j, lambdaAway);
      matrix[i][j] = p;
      matrixSum += p;
    }
  }

  let homeWinP = 0, drawP = 0, awayWinP = 0, bttsYesP = 0;
  for (let i = 0; i <= MAX_GOALS; i++) {
    for (let j = 0; j <= MAX_GOALS; j++) {
      const p = matrix[i][j] / matrixSum;
      if (i > j) homeWinP += p;
      else if (i === j) drawP += p;
      else awayWinP += p;
      if (i >= 1 && j >= 1) bttsYesP += p;
    }
  }

  const exactScores = EXACT_SCORELINES.map((score) => {
    const [hs, as_] = score.split("-").map((n) => parseInt(n));
    const p = hs <= MAX_GOALS && as_ <= MAX_GOALS ? matrix[hs][as_] / matrixSum : 1e-4;
    return { score, odds: oddsFromProb(p) };
  });

  const lambdaTotalGoals = lambdaHome + lambdaAway;
  const ouLine = (line: number) => {
    const over = probTotalOver(line, lambdaTotalGoals);
    return { over: oddsFromProb(over), under: oddsFromProb(1 - over) };
  };
  const overUnder = {
    over0_5: ouLine(0.5).over, under0_5: ouLine(0.5).under,
    over1_5: ouLine(1.5).over, under1_5: ouLine(1.5).under,
    over2_5: ouLine(2.5).over, under2_5: ouLine(2.5).under,
    over3_5: ouLine(3.5).over, under3_5: ouLine(3.5).under,
    over4_5: ouLine(4.5).over, under4_5: ouLine(4.5).under,
  };

  const doubleChance = {
    homeOrDraw: oddsFromProb(homeWinP + drawP),
    homeOrAway: oddsFromProb(homeWinP + awayWinP),
    drawOrAway: oddsFromProb(drawP + awayWinP),
  };
  const bothTeamsToScore = {
    yes: oddsFromProb(bttsYesP),
    no: oddsFromProb(1 - bttsYesP),
  };

  // ── Corners / cards / saves — same blended model, priced off a Poisson total ──
  const cornersE = blend("corners", STAT_BASELINE.corners);
  const cardsE = blend("cards", STAT_BASELINE.cards);
  const savesE = blend("saves", STAT_BASELINE.saves);
  const cornersTotal = clamp(cornersE.home + cornersE.away, 4, 16);
  const cardsTotal = clamp(cardsE.home + cardsE.away, 1.5, 9);
  const savesTotal = clamp(savesE.home + savesE.away, 2, 14);

  const buildLines = (lines: number[], lambda: number) =>
    lines.map((line) => {
      const over = probTotalOver(line, lambda);
      return { line, over: oddsFromProb(over), under: oddsFromProb(1 - over) };
    });

  const overUnderCorners = buildLines([7.5, 8.5, 9.5, 10.5, 11.5], cornersTotal);
  const overUnderCards = buildLines([2.5, 3.5, 4.5, 5.5], cardsTotal);
  const overUnderSaves = buildLines([4.5, 5.5, 6.5, 7.5, 8.5], savesTotal);

  const goalscorers = [
    ...goalscorerOdds(homeTeam, lambdaHome),
    ...goalscorerOdds(awayTeam, lambdaAway),
  ]
    .sort((a, b) => a.odds - b.odds)
    .slice(0, 16);

  return {
    homeWin: oddsFromProb(homeWinP),
    draw: oddsFromProb(drawP),
    awayWin: oddsFromProb(awayWinP),
    exactScores,
    goalscorers,
    doubleChance,
    bothTeamsToScore,
    overUnder,
    overUnderCorners,
    overUnderCards,
    overUnderSaves,
  };
}
