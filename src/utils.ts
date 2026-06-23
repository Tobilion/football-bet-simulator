import { Fixture, MarketType } from "./types";

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
 * Calculates dynamically shifted live in-play odds based on elapsed minutes, current score, and match state.
 * Returns a number for active odds, or null if the selection/market is closed, suspended, or already covered.
 */
export function getLiveInPlayOdds(
  fixture: Fixture,
  marketType: MarketType,
  selectionId: string,
  baseOdds: number
): number | null {
  if (fixture.status === "FT") return null;
  if (!Number.isFinite(baseOdds)) return null;
  if (fixture.status !== "LIVE") return baseOdds;

  const min = Math.min(89, Math.max(1, fixture.currentMinute || 1));
  const homeScore = Math.floor(fixture.homeScore || 0);
  const awayScore = Math.floor(fixture.awayScore || 0);
  const currentTotalGoals = homeScore + awayScore;
  const scoreDiff = homeScore - awayScore;

  // Time decay factor (ranges from 1.0 down to 0.02 at minute 89)
  const timeFactor = (90 - min) / 90;

  switch (marketType) {
    case "MATCH_WINNER": {
      // Cap at 99.00 — never suspend as long as it's mathematically possible.
      // Only suspend when score diff is 5+ goals (truly no way back) or match is FT.
      const MAX_LIVE_ODDS = 99.00;
      if (Math.abs(scoreDiff) >= 5) {
        const losingIsHome = scoreDiff <= -5;
        const losingIsAway = scoreDiff >= 5;
        if (losingIsHome && (selectionId === "HOME" || selectionId === "1")) return null;
        if (losingIsAway && (selectionId === "AWAY" || selectionId === "2")) return null;
        if (losingIsHome || losingIsAway) {
          if (selectionId === "DRAW" || selectionId === "X") return null;
        }
      }

      if (selectionId === "HOME" || selectionId === "1") {
        if (scoreDiff > 0) {
          // Home leading: odds drop as time decays
          const leadMultiplier = 1 + scoreDiff * 3.0 + (min * 0.25);
          return Math.max(1.02, Math.min(baseOdds, baseOdds / leadMultiplier));
        } else if (scoreDiff < 0) {
          // Home losing: odds rise — cap at MAX_LIVE_ODDS, never suspend while time remains
          const deficit = Math.abs(scoreDiff);
          const timePlea = 1.05 / Math.max(0.01, timeFactor);
          const newOdds = baseOdds * (1 + deficit * 4.0) * timePlea;
          return Math.min(MAX_LIVE_ODDS, Number(newOdds.toFixed(2)));
        } else {
          // Tied: drift up toward draw
          const newOdds = baseOdds * (1.1 + (1 - timeFactor) * 1.5);
          return Math.min(MAX_LIVE_ODDS, Number(newOdds.toFixed(2)));
        }
      }

      if (selectionId === "AWAY" || selectionId === "2") {
        if (scoreDiff < 0) {
          // Away leading: odds drop
          const leadMultiplier = 1 + Math.abs(scoreDiff) * 3.0 + (min * 0.25);
          return Math.max(1.02, Math.min(baseOdds, baseOdds / leadMultiplier));
        } else if (scoreDiff > 0) {
          // Away losing: odds rise — cap, never suspend
          const deficit = scoreDiff;
          const timePlea = 1.05 / Math.max(0.01, timeFactor);
          const newOdds = baseOdds * (1 + deficit * 4.0) * timePlea;
          return Math.min(MAX_LIVE_ODDS, Number(newOdds.toFixed(2)));
        } else {
          const newOdds = baseOdds * (1.1 + (1 - timeFactor) * 1.5);
          return Math.min(MAX_LIVE_ODDS, Number(newOdds.toFixed(2)));
        }
      }

      if (selectionId === "DRAW" || selectionId === "X") {
        if (scoreDiff === 0) {
          return Math.max(1.05, Number((baseOdds * Math.max(0.1, timeFactor * 1.1)).toFixed(2)));
        } else {
          // Draw still possible at any scoreline while time remains — cap, don't suspend
          const deficit = Math.abs(scoreDiff);
          const drawMultiplier = 1 + deficit * 3.5;
          const timeModifier = 1.25 / Math.max(0.02, timeFactor);
          const newOdds = baseOdds * drawMultiplier * timeModifier;
          return Math.min(MAX_LIVE_ODDS, Number(newOdds.toFixed(2)));
        }
      }
      break;
    }

    case "DOUBLE_CHANCE": {
      // Suspended if score difference is 3+ goals
      if (Math.abs(scoreDiff) >= 3) {
        return null;
      }

      const isHomeDraw = selectionId === "HOME_OR_DRAW" || selectionId === "HOME_DRAW" || selectionId === "1X";
      const isAwayDraw = selectionId === "DRAW_OR_AWAY" || selectionId === "AWAY_DRAW" || selectionId === "X2";
      const isNoDraw = selectionId === "HOME_OR_AWAY" || selectionId === "HOME_AWAY" || selectionId === "12";

      if (isHomeDraw) {
        if (scoreDiff > 0) {
          // Home leading: home/draw is extremely safe, odds collapse or suspend
          return Math.max(1.01, Number((baseOdds * Math.max(0.02, timeFactor * 0.5)).toFixed(2)));
        } else if (scoreDiff < 0) {
          // Home losing: gets harder as timer runs out
          const newOdds = baseOdds * (1 + Math.abs(scoreDiff) * 2.0) / Math.max(0.05, timeFactor);
          return newOdds > 25 ? null : Number(newOdds.toFixed(2));
        } else {
          // Draw: safe as time goes down
          return Math.max(1.03, Number((baseOdds * Math.max(0.3, timeFactor)).toFixed(2)));
        }
      }

      if (isAwayDraw) {
        if (scoreDiff < 0) {
          // Away leading: safe, odds drop
          return Math.max(1.01, Number((baseOdds * Math.max(0.02, timeFactor * 0.5)).toFixed(2)));
        } else if (scoreDiff > 0) {
          // Away losing: gets riskier
          const newOdds = baseOdds * (1 + scoreDiff * 2.0) / Math.max(0.05, timeFactor);
          return newOdds > 25 ? null : Number(newOdds.toFixed(2));
        } else {
          // Draw: safe
          return Math.max(1.03, Number((baseOdds * Math.max(0.3, timeFactor)).toFixed(2)));
        }
      }

      if (isNoDraw) {
        if (scoreDiff !== 0) {
          // Someone is winning, no draw is safer as time decays
          return Math.max(1.01, Number((baseOdds * Math.max(0.15, timeFactor)).toFixed(2)));
        } else {
          // Still a draw: odds of resolving dry spell rise as time runs out
          const newOdds = baseOdds * 1.8 / Math.max(0.05, timeFactor);
          return newOdds > 20 ? null : Number(newOdds.toFixed(2));
        }
      }
      break;
    }

    case "BOTH_TEAMS_TO_SCORE": {
      const hasBothScored = homeScore > 0 && awayScore > 0;

      // Once both teams have scored, BTTS YES is already won — market resolved
      if (hasBothScored) {
        return null;
      }

      // BTTS NO: if one team has already scored and neither zeroes matter for NO,
      // it can still be resolved at full time. Keep available but price accordingly.
      const bttsYes = selectionId === "YES";
      const homeZero = homeScore === 0;
      const awayZero = awayScore === 0;
      const zeroes = (homeZero ? 1 : 0) + (awayZero ? 1 : 0);

      if (bttsYes) {
        // Yes: gets exponentially harder as time runs down and scorelines stay 0
        const scoreMod = 1 + zeroes * 2.2;
        const newOdds = baseOdds * scoreMod / Math.max(0.06, timeFactor);
        // Only suspend when odds exceed 200 (near-impossible but respect the market)
        return newOdds > 200 ? null : Number(newOdds.toFixed(2));
      } else {
        // No: gets safer as time passes without both scoring
        return Math.max(1.02, Number((baseOdds * Math.max(0.1, timeFactor)).toFixed(2)));
      }
    }

    case "OVER_UNDER_GOALS": {
      const isOver = selectionId.startsWith("OVER_");
      const lineStr = selectionId.replace("OVER_", "").replace("UNDER_", "");
      const line = parseFloat(lineStr.replace("_", ".")) || 2.5;

      const goalsNeeded = line - currentTotalGoals;

      // "Bets already covered should be marked unavailable"
      if (goalsNeeded < 0) {
        // Over/Under line already resolved (e.g., currently 3 goals, line is 1.5 or 2.5).
        // The over was already hit, under is lost. Both selections are closed/suspended.
        return null;
      }

      // If it's late in-play and goals needed is very high, suspend it
      if (min >= 75 && goalsNeeded >= 1.5) {
        return null;
      }

      if (isOver) {
        // Over: odds increase exponentially as time decreases since goals needed are not yet met
        const baseMult = 1 + goalsNeeded * 2.5;
        const newOdds = baseOdds * baseMult / Math.max(0.04, timeFactor);
        return newOdds > 150 ? null : Number(newOdds.toFixed(2));
      } else {
        // Under: odds collapse down to 1.01 as time decays and goal line has not been hit
        const safetyFactor = Math.max(0.01, timeFactor / (1 + goalsNeeded * 1.5));
        return Math.max(1.01, Number((baseOdds * safetyFactor).toFixed(2)));
      }
    }

    case "EXACT_SCORE": {
      // Suspended if scoreDiff >= 3 or time is very late (min >= 75)
      if (Math.abs(scoreDiff) >= 3 || min >= 72) {
        return null;
      }
      const parts = selectionId.split("-");
      if (parts.length !== 2) return baseOdds;
      const homeTarget = parseInt(parts[0]) || 0;
      const awayTarget = parseInt(parts[1]) || 0;

      if (homeScore > homeTarget || awayScore > awayTarget) {
        // Market is dead (already covered/exceeded)
        return null;
      }

      const totalTarget = homeTarget + awayTarget;
      const missingGoals = totalTarget - currentTotalGoals;

      if (missingGoals === 0) {
        // Current score matches target score! Odds decay towards 1.01 as time runs out
        return Math.max(1.05, Number((baseOdds * Math.max(0.05, timeFactor)).toFixed(2)));
      } else {
        // Target score requires more goals. Gets harder as times decays.
        const newOdds = baseOdds * (1 + missingGoals * 2.8) / Math.max(0.05, timeFactor);
        return newOdds > 150 ? null : Number(newOdds.toFixed(2));
      }
    }

    case "ANYTIME_GOALSCORER": {
      // Suspended if min >= 80
      if (min >= 80) return null;

      // "Bets already covered should be marked unavailable"
      // Any Time Goalscorer is won the moment the player scores.
      // Let's check if there is a GOAL event for this player in the fixture events list.
      const alreadyScored = fixture.events.some(
        ev => ev.type === "GOAL" && ev.playerId === selectionId
      );
      if (alreadyScored) {
        return null;
      }

      // Otherwise, dynamic adjustment
      const strengthFactor = 1.0 + (min * 0.015);
      const newOdds = baseOdds * strengthFactor;
      return newOdds > 100 ? null : Number(newOdds.toFixed(2));
    }

    case "OVER_UNDER_CORNERS": {
      const isOver = selectionId.startsWith("OVER_");
      const lineStr = selectionId.replace("OVER_", "").replace("UNDER_", "");
      const line = parseFloat(lineStr) || 9.5;

      const currentCorners = (fixture.stats.home.corners || 0) + (fixture.stats.away.corners || 0);
      const cornersNeeded = line - currentCorners;

      // Already covered
      if (cornersNeeded < 0) {
        return null;
      }

      // Too late & high target
      if (min >= 80 && cornersNeeded >= 2.5) {
        return null;
      }

      if (isOver) {
        const newOdds = baseOdds * (1 + cornersNeeded * 1.5) / Math.max(0.05, timeFactor);
        return newOdds > 100 ? null : Number(newOdds.toFixed(2));
      } else {
        return Math.max(1.01, Number((baseOdds * (timeFactor / (1 + cornersNeeded))).toFixed(2)));
      }
    }

    case "OVER_UNDER_CARDS": {
      const isOver = selectionId.startsWith("OVER_");
      const lineStr = selectionId.replace("OVER_", "").replace("UNDER_", "");
      const line = parseFloat(lineStr) || 3.5;

      const currentCards =
        (fixture.stats.home.yellowCards || 0) +
        (fixture.stats.home.redCards || 0) +
        (fixture.stats.away.yellowCards || 0) +
        (fixture.stats.away.redCards || 0);

      const cardsNeeded = line - currentCards;

      // Already covered
      if (cardsNeeded < 0) {
        return null;
      }

      // Too late
      if (min >= 80 && cardsNeeded >= 1.5) {
        return null;
      }

      if (isOver) {
        const newOdds = baseOdds * (1 + cardsNeeded * 1.8) / Math.max(0.05, timeFactor);
        return newOdds > 100 ? null : Number(newOdds.toFixed(2));
      } else {
        return Math.max(1.01, Number((baseOdds * (timeFactor / (1 + cardsNeeded))).toFixed(2)));
      }
    }

    case "OVER_UNDER_SAVES": {
      const isOver = selectionId.startsWith("OVER_");
      const lineStr = selectionId.replace("OVER_", "").replace("UNDER_", "");
      const line = parseFloat(lineStr) || 6.5;

      const currentSaves = (fixture.stats.home.saves || 0) + (fixture.stats.away.saves || 0);
      const savesNeeded = line - currentSaves;

      // Already covered
      if (savesNeeded < 0) {
        return null;
      }

      // Too late
      if (min >= 80 && savesNeeded >= 2.5) {
        return null;
      }

      if (isOver) {
        const newOdds = baseOdds * (1 + savesNeeded * 1.4) / Math.max(0.05, timeFactor);
        return newOdds > 100 ? null : Number(newOdds.toFixed(2));
      } else {
        return Math.max(1.01, Number((baseOdds * (timeFactor / (1 + savesNeeded))).toFixed(2)));
      }
    }

    default:
      break;
  }

  return baseOdds > 0 ? baseOdds : null;
}
