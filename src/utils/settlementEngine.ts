import { Fixture, MarketType } from "../types";

export type LegResult = "WON" | "LOST" | "PENDING";

export interface SelectionLike {
  marketType: MarketType | string;
  selectionId: string;
}

/**
 * Canonical Over/Under selection-id parser.
 * Accepts both historical shapes: "OVER_2_5" (goals) and "OVER_2.5" (corners/cards/saves).
 * Prefer emitting the dot form ("OVER_2.5") going forward.
 */
export function parseOverUnder(selectionId: string): { mode: "OVER" | "UNDER"; line: number } | null {
  const mode = selectionId.startsWith("OVER_") ? "OVER" : selectionId.startsWith("UNDER_") ? "UNDER" : null;
  if (!mode) return null;
  const line = parseFloat(selectionId.replace(/^(OVER|UNDER)_/, "").replace("_", "."));
  return Number.isFinite(line) ? { mode, line } : null;
}

function overUnderResult(selectionId: string, total: number): LegResult {
  const parsed = parseOverUnder(selectionId);
  if (!parsed) return "LOST";
  if (parsed.mode === "OVER") return total > parsed.line ? "WON" : "LOST";
  return total < parsed.line ? "WON" : "LOST";
}

/**
 * SINGLE SOURCE OF TRUTH for settling one selection against a fixture.
 * Returns PENDING while the fixture has not finished.
 */
export function resolveSelection(sel: SelectionLike, fixture: Fixture): LegResult {
  if (fixture.status !== "FT") return "PENDING";
  const h = Math.floor(fixture.homeScore);
  const a = Math.floor(fixture.awayScore);

  switch (sel.marketType) {
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
    case "OVER_UNDER_GOALS":
      return overUnderResult(sel.selectionId, h + a);
    case "OVER_UNDER_CORNERS":
      return overUnderResult(
        sel.selectionId,
        (fixture.stats?.home.corners ?? 0) + (fixture.stats?.away.corners ?? 0),
      );
    case "OVER_UNDER_CARDS":
      return overUnderResult(
        sel.selectionId,
        (fixture.stats?.home.yellowCards ?? 0) + (fixture.stats?.home.redCards ?? 0) +
        (fixture.stats?.away.yellowCards ?? 0) + (fixture.stats?.away.redCards ?? 0),
      );
    case "OVER_UNDER_SAVES":
      return overUnderResult(
        sel.selectionId,
        (fixture.stats?.home.saves ?? 0) + (fixture.stats?.away.saves ?? 0),
      );
    case "EXACT_SCORE":
      return sel.selectionId === `${h}-${a}` ? "WON" : "LOST";
    case "ANYTIME_GOALSCORER":
      return fixture.events.some((ev) => ev.type === "GOAL" && ev.playerId === sel.selectionId)
        ? "WON" : "LOST";
    default:
      return "LOST";
  }
}
