import { Fixture, MOTMResult, Team } from "../types";

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
export function calculateMOTM(fixture: Fixture, teams: Team[]): MOTMResult | null {
  const scores = new Map<string, PlayerScore>();

  // Determine winning team
  const h = Math.floor(fixture.homeScore);
  const a = Math.floor(fixture.awayScore);
  const winnerTeamId = h > a ? fixture.homeTeamId : a > h ? fixture.awayTeamId : null;
  const isDraw = h === a;

  // Build a playerId → teamId lookup from team rosters
  const playerTeam = new Map<string, string>();
  for (const team of teams) {
    for (const player of team.players ?? []) {
      playerTeam.set(player.id, team.id);
    }
  }

  for (const ev of fixture.events) {
    if (!ev.playerId || !ev.playerName) continue;
    const teamId = ev.teamId ?? playerTeam.get(ev.playerId) ?? "";
    const ps = getOrCreate(scores, ev.playerId, ev.playerName, teamId);

    if (ev.type === "GOAL") {
      ps.goals += 1;
      ps.score += 3;
      // Also credit the assistant
      if (ev.assistantPlayerId && ev.assistantPlayerName) {
        const assTeamId = ev.teamId ?? playerTeam.get(ev.assistantPlayerId) ?? "";
        const ass = getOrCreate(scores, ev.assistantPlayerId, ev.assistantPlayerName, assTeamId);
        ass.assists += 1;
        ass.score += 2;
      }
    } else if (ev.type === "ASSIST") {
      ps.assists += 1;
      ps.score += 2;
    } else if (ev.type === "SAVE") {
      ps.saves += 1;
      ps.score += 1.5;
    } else if (ev.type === "YELLOW_CARD") {
      ps.yellows += 1;
      ps.score -= 0.5;
    } else if (ev.type === "RED_CARD") {
      ps.reds += 1;
      ps.score -= 2;
    }
  }

  if (scores.size === 0) return null;

  // Apply team bonus
  for (const ps of scores.values()) {
    if (winnerTeamId && ps.teamId === winnerTeamId) {
      ps.score += 1;
    } else if (isDraw) {
      ps.score += 0.25;
    }
  }

  // Pick highest scorer
  let best: PlayerScore | null = null;
  for (const ps of scores.values()) {
    if (!best || ps.score > best.score) best = ps;
  }
  if (!best) return null;

  // Convert score to a 0–10 match rating (base 6, up to 10)
  const rawRating = Math.min(10, Math.max(5.5, 6 + best.score * 0.4));
  const matchRating = Math.round(rawRating * 10) / 10;

  return {
    playerId: best.playerId,
    playerName: best.playerName,
    teamId: best.teamId,
    score: matchRating,
    reason: buildReason(best),
  };
}
