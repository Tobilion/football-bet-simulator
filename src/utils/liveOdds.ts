import { Fixture, MarketType } from "../types";

// ──────────────────────────────────────────────────────────────────────────
// Unified live (in-play) odds.
//
// ONE model prices every in-play market. The fixture's stored odds are the
// PRE-MATCH prices and never change during a match; this module recovers the
// implied expected-goals from them, scales what's left by the time remaining,
// adds what has already happened, and re-derives every market from the
// resulting final-score distribution.
//
// A market returns null ONLY when it is decided or impossible — never merely
// because the price is long or time is short.
// ──────────────────────────────────────────────────────────────────────────

const MARGIN = 1.08;
export const MAX_LIVE_ODDS = 99.0;
const MAXG = 8;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function factorial(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}
function poisson(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k);
}
function probTotalOver(line: number, lambda: number): number {
  let p = 0;
  for (let k = Math.ceil(line); k <= 40; k++) p += poisson(k, lambda);
  return clamp(p, 0, 1);
}
function oddsFromProb(p: number): number {
  const cp = clamp(p, 1e-4, 0.999);
  return clamp(Math.round((1 / (cp * MARGIN)) * 100) / 100, 1.01, MAX_LIVE_ODDS);
}

/** Invert an over-line price into the expected total (bisection; monotone). */
function lambdaFromOverProb(line: number, pOver: number, fallback: number): number {
  if (!(pOver > 0.01 && pOver < 0.99)) return fallback;
  let lo = 0.05, hi = 9.0;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (probTotalOver(line, mid) < pOver) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function impliedProb(odds: number | undefined): number | null {
  if (!odds || !Number.isFinite(odds) || odds <= 1.0) return null;
  return 1 / odds;
}

/** P(home wins) for a given split of the total expected goals. */
function homeWinProb(lh: number, la: number): number {
  let p = 0;
  for (let i = 0; i <= MAXG; i++)
    for (let j = 0; j < i; j++) p += poisson(i, lh) * poisson(j, la);
  return p;
}

/**
 * Recover pre-match expected goals for each side from the stored odds.
 * Falls back to league-average shape when a fixture has no stored odds.
 */
export function preMatchLambdas(fixture: Fixture): { home: number; away: number } {
  const o = fixture.odds ?? ({} as Fixture["odds"]);
  // total from the 2.5 line if present
  const pOver25 = impliedProb(o?.overUnder?.over2_5);
  const pUnder25 = impliedProb(o?.overUnder?.under2_5);
  let total = 2.7;
  if (pOver25 !== null && pUnder25 !== null) {
    const norm = pOver25 / (pOver25 + pUnder25); // strip the margin
    total = lambdaFromOverProb(2.5, norm, 2.7);
  }
  total = clamp(total, 0.6, 6.5);

  // split using the 1X2 skew if present
  let share = 0.55; // mild home tilt by default
  const ph = impliedProb(o?.homeWin), pd = impliedProb(o?.draw), pa = impliedProb(o?.awayWin);
  if (ph !== null && pd !== null && pa !== null) {
    const s = ph + pd + pa;
    const targetHome = ph / s;
    let lo = 0.2, hi = 0.85;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      if (homeWinProb(total * mid, total * (1 - mid)) < targetHome) lo = mid;
      else hi = mid;
    }
    share = (lo + hi) / 2;
  }
  return { home: clamp(total * share, 0.15, 5), away: clamp(total * (1 - share), 0.15, 5) };
}

/** Expected match total for a counting stat, recovered from its stored lines. */
function statTotalFromLines(
  lines: { line: number; over: number; under: number }[] | undefined,
  fallback: number,
): number {
  if (!lines || lines.length === 0) return fallback;
  // use the line whose over/under prices are closest to even — most informative
  let best = lines[0];
  let bestGap = Infinity;
  for (const l of lines) {
    const po = impliedProb(l.over), pu = impliedProb(l.under);
    if (po === null || pu === null) continue;
    const gap = Math.abs(po - pu);
    if (gap < bestGap) { bestGap = gap; best = l; }
  }
  const po = impliedProb(best.over), pu = impliedProb(best.under);
  if (po === null || pu === null) return fallback;
  return clamp(lambdaFromOverProb(best.line, po / (po + pu), fallback), 1, 25);
}

interface LiveState {
  lh: number;   // remaining expected goals, home
  la: number;   // remaining expected goals, away
  hs: number;   // goals already scored, home
  as: number;   // goals already scored, away
  frac: number; // fraction of the match still to play
}

function liveState(fixture: Fixture): LiveState {
  const min = clamp(fixture.currentMinute || 0, 0, 90);
  const frac = clamp((90 - min) / 90, 0.02, 1);
  const pre = preMatchLambdas(fixture);
  return {
    lh: pre.home * frac,
    la: pre.away * frac,
    hs: Math.floor(fixture.homeScore || 0),
    as: Math.floor(fixture.awayScore || 0),
    frac,
  };
}

/** Distribution over FINAL scores given the current score + remaining goals. */
function finalScoreMatrix(st: LiveState): { m: number[][]; sum: number; baseH: number; baseA: number } {
  const m: number[][] = [];
  let sum = 0;
  for (let i = 0; i <= MAXG; i++) {
    m[i] = [];
    for (let j = 0; j <= MAXG; j++) {
      const p = poisson(i, st.lh) * poisson(j, st.la);
      m[i][j] = p;
      sum += p;
    }
  }
  return { m, sum, baseH: st.hs, baseA: st.as };
}

function parseLine(selectionId: string): { isOver: boolean; line: number } {
  const isOver = selectionId.startsWith("OVER_");
  const raw = selectionId.replace("OVER_", "").replace("UNDER_", "");
  const line = parseFloat(raw.replace("_", ".")) || 2.5;
  return { isOver, line };
}

/**
 * Price one in-play selection. Returns null only when the outcome is already
 * decided or impossible.
 */
export function computeLiveOdds(
  fixture: Fixture,
  marketType: MarketType,
  selectionId: string,
  baseOdds: number,
): number | null {
  if (fixture.status === "FT") return null;
  if (!Number.isFinite(baseOdds)) return null;
  if (fixture.status !== "LIVE") return baseOdds; // pre-match: stored price stands

  const st = liveState(fixture);
  const { m, sum } = finalScoreMatrix(st);
  const currentTotal = st.hs + st.as;

  const sumWhere = (pred: (fh: number, fa: number) => boolean): number => {
    let p = 0;
    for (let i = 0; i <= MAXG; i++)
      for (let j = 0; j <= MAXG; j++)
        if (pred(st.hs + i, st.as + j)) p += m[i][j] / sum;
    return clamp(p, 0, 1);
  };

  switch (marketType) {
    case "MATCH_WINNER": {
      const id = selectionId.toUpperCase();
      if (id === "HOME" || id === "1") return oddsFromProb(sumWhere((h, a) => h > a));
      if (id === "AWAY" || id === "2") return oddsFromProb(sumWhere((h, a) => a > h));
      if (id === "DRAW" || id === "X") return oddsFromProb(sumWhere((h, a) => h === a));
      return baseOdds;
    }
    case "DOUBLE_CHANCE": {
      const id = selectionId.toUpperCase();
      if (["HOME_OR_DRAW", "HOME_DRAW", "1X"].includes(id)) return oddsFromProb(sumWhere((h, a) => h >= a));
      if (["DRAW_OR_AWAY", "AWAY_DRAW", "X2"].includes(id)) return oddsFromProb(sumWhere((h, a) => a >= h));
      if (["HOME_OR_AWAY", "HOME_AWAY", "12"].includes(id)) return oddsFromProb(sumWhere((h, a) => h !== a));
      return baseOdds;
    }
    case "BOTH_TEAMS_TO_SCORE": {
      const yes = sumWhere((h, a) => h >= 1 && a >= 1);
      if (selectionId.toUpperCase() === "YES") {
        return yes >= 0.999 ? null : oddsFromProb(yes);   // already decided
      }
      return yes >= 0.999 ? null : oddsFromProb(1 - yes);
    }
    case "OVER_UNDER_GOALS": {
      const { isOver, line } = parseLine(selectionId);
      if (currentTotal > line) return null;               // decided: over hit / under lost
      const over = sumWhere((h, a) => h + a > line);
      return oddsFromProb(isOver ? over : 1 - over);
    }
    case "EXACT_SCORE": {
      const parts = selectionId.split("-");
      if (parts.length !== 2) return baseOdds;
      const th = parseInt(parts[0]) || 0;
      const ta = parseInt(parts[1]) || 0;
      if (st.hs > th || st.as > ta) return null;          // impossible now
      const need = m[th - st.hs]?.[ta - st.as];
      if (need === undefined) return null;
      return oddsFromProb(need / sum);
    }
    case "ANYTIME_GOALSCORER": {
      const scored = fixture.events.some((ev) => ev.type === "GOAL" && ev.playerId === selectionId);
      if (scored) return null;                            // already won
      const p0 = clamp(1 / (baseOdds * MARGIN), 0.005, 0.9);
      return oddsFromProb(clamp(p0 * st.frac, 0.002, 0.9));
    }
    case "OVER_UNDER_CORNERS":
    case "OVER_UNDER_CARDS":
    case "OVER_UNDER_SAVES": {
      const { isOver, line } = parseLine(selectionId);
      const s = fixture.stats;
      const current =
        marketType === "OVER_UNDER_CORNERS"
          ? (s.home.corners || 0) + (s.away.corners || 0)
          : marketType === "OVER_UNDER_SAVES"
          ? (s.home.saves || 0) + (s.away.saves || 0)
          : (s.home.yellowCards || 0) + (s.home.redCards || 0) + (s.away.yellowCards || 0) + (s.away.redCards || 0);
      if (current > line) return null;                    // decided
      const stored =
        marketType === "OVER_UNDER_CORNERS" ? fixture.odds?.overUnderCorners
        : marketType === "OVER_UNDER_SAVES" ? fixture.odds?.overUnderSaves
        : fixture.odds?.overUnderCards;
      const fallback = marketType === "OVER_UNDER_CORNERS" ? 10.5 : marketType === "OVER_UNDER_SAVES" ? 6.8 : 4.3;
      const expTotal = statTotalFromLines(stored, fallback);
      const remaining = Math.max(0.01, expTotal * st.frac);
      const need = line - current;
      const over = need < 0 ? 1 : probTotalOver(need, remaining);
      return oddsFromProb(isOver ? over : 1 - over);
    }
    default:
      return baseOdds > 0 ? baseOdds : null;
  }
}
