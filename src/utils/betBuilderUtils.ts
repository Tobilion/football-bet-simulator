import { BetBuilderSelection, BetBuilderTicket, Fixture, MarketType } from "../types";

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

/** Checks one selection against a completed fixture result */
function checkSelection(sel: BetBuilderSelection, fixture: Fixture): boolean {
  const hScore = Math.floor(fixture.homeScore);
  const aScore = Math.floor(fixture.awayScore);

  switch (sel.marketType) {
    case "MATCH_WINNER": {
      const outcome = hScore > aScore ? "HOME" : aScore > hScore ? "AWAY" : "DRAW";
      return sel.selectionId === outcome;
    }
    case "DOUBLE_CHANCE": {
      const outcome = hScore > aScore ? "HOME" : aScore > hScore ? "AWAY" : "DRAW";
      if (sel.selectionId === "HOME_OR_DRAW") return outcome !== "AWAY";
      if (sel.selectionId === "HOME_OR_AWAY") return outcome !== "DRAW";
      if (sel.selectionId === "DRAW_OR_AWAY") return outcome !== "HOME";
      return false;
    }
    case "BOTH_TEAMS_TO_SCORE": {
      const both = hScore > 0 && aScore > 0;
      return sel.selectionId === "YES" ? both : !both;
    }
    case "OVER_UNDER_GOALS": {
      const total = hScore + aScore;
      const [mode, lineStr] = sel.selectionId.split("_");
      const line = parseFloat(lineStr.replace("_", "."));
      return mode === "OVER" ? total > line : total < line;
    }
    case "EXACT_SCORE":
      return sel.selectionId === `${hScore}-${aScore}`;
    case "ANYTIME_GOALSCORER":
      return fixture.events.some(
        (ev) => ev.type === "GOAL" && ev.playerId === sel.selectionId,
      );
    case "OVER_UNDER_CORNERS": {
      const total =
        (fixture.stats?.home.corners ?? 0) + (fixture.stats?.away.corners ?? 0);
      const [mode, lineStr] = sel.selectionId.split("_");
      const line = parseFloat(lineStr);
      return mode === "OVER" ? total > line : total < line;
    }
    case "OVER_UNDER_CARDS": {
      const total =
        (fixture.stats?.home.yellowCards ?? 0) +
        (fixture.stats?.home.redCards ?? 0) +
        (fixture.stats?.away.yellowCards ?? 0) +
        (fixture.stats?.away.redCards ?? 0);
      const [mode, lineStr] = sel.selectionId.split("_");
      const line = parseFloat(lineStr);
      return mode === "OVER" ? total > line : total < line;
    }
    default:
      return false;
  }
}

/** Settle a builder ticket against the completed fixture */
export function settleBetBuilderTicket(
  ticket: BetBuilderTicket,
  fixture: Fixture,
): "WON" | "LOST" {
  const allWon = ticket.selections.every((sel) => checkSelection(sel, fixture));
  return allWon ? "WON" : "LOST";
}
