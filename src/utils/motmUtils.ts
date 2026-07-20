import { Fixture, MOTMResult, Team } from "../types";
import { computeMatchRatings, PlayerMatchRating } from "./playerRatingUtils";

function reasonFromRating(r: PlayerMatchRating): string {
  const parts: string[] = [];
  if (r.goals > 0) parts.push(`${r.goals} goal${r.goals > 1 ? "s" : ""}`);
  if (r.assists > 0) parts.push(`${r.assists} assist${r.assists > 1 ? "s" : ""}`);
  if (r.saves > 0) parts.push(`${r.saves} save${r.saves > 1 ? "s" : ""}`);
  if (r.yellows > 0) parts.push(`${r.yellows} yellow${r.yellows > 1 ? "s" : ""}`);
  if (r.reds > 0) parts.push(`red card`);
  return parts.length > 0 ? parts.join(", ") : "Solid performance";
}

interface PlayerScore {
  playerId: string;
  playerName: string;
  teamId: string;
  score: number;
  goals: number;
  assists: number;
  saves: number;
  yellows: number;
  reds: number;
}

function emptyScore(playerId: string, playerName: string, teamId: string): PlayerScore {
  return { playerId, playerName, teamId, score: 0, goals: 0, assists: 0, saves: 0, yellows: 0, reds: 0 };
}

function getOrCreate(
  map: Map<string, PlayerScore>,
  playerId: string,
  playerName: string,
  teamId: string,
): PlayerScore {
  if (!map.has(playerId)) {
    map.set(playerId, emptyScore(playerId, playerName, teamId));
  }
  return map.get(playerId)!;
}

function buildReason(ps: PlayerScore): string {
  const parts: string[] = [];
  if (ps.goals > 0) parts.push(`${ps.goals} goal${ps.goals > 1 ? "s" : ""}`);
  if (ps.assists > 0) parts.push(`${ps.assists} assist${ps.assists > 1 ? "s" : ""}`);
  if (ps.saves > 0) parts.push(`${ps.saves} save${ps.saves > 1 ? "s" : ""}`);
  if (ps.yellows > 0) parts.push(`${ps.yellows} yellow${ps.yellows > 1 ? "s" : ""}`);
  if (ps.reds > 0) parts.push(`red card`);
  return parts.length > 0 ? parts.join(", ") : "Solid performance";
}

/**
 * Calculates the Player of the Match for a completed fixture.
 * Returns null if the fixture has no player events.
 *
 * Scoring:
 *   GOAL:         +3 pts (scorer)
 *   ASSIST event: +2 pts (player)
 *   assistantPlayerId on GOAL: +2 pts
 *   SAVE:         +1.5 pts
 *   YELLOW_CARD:  -0.5 pts
 *   RED_CARD:     -2 pts
 *   Winning team: +1 base bonus
 *   Draw:         +0.25 base bonus
 */
// Player of the Match is now, by definition, the highest post-match player
// rating (`computeMatchRatings`), so the MOTM shown anywhere ALWAYS matches the
// top entry of the full-time ratings list. Delegating here keeps every surface
// (FT card, ratings panel, Teams history, awards) in agreement.
export function calculateMOTM(fixture: Fixture, teams: Team[]): MOTMResult | null {
  const { home, away } = computeMatchRatings(fixture, teams);
  const all = [...home, ...away];
  if (all.length === 0) return null;
  const top = all.find((r) => r.isMotm) ??
    all.reduce<PlayerMatchRating | null>((b, r) => (!b || r.rating > b.rating ? r : b), null);
  if (!top) return null;
  return {
    playerId: top.playerId,
    playerName: top.name,
    teamId: top.teamId,
    score: top.rating,
    reason: reasonFromRating(top),
  };
}
