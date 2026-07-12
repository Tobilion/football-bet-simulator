import { Fixture, Team } from "../types";
import { getStartingXI } from "../engine/matchEngine";

export interface PlayerMatchRating {
  playerId: string;
  name: string;
  teamId: string;
  position: string;
  rating: number; // 4.0 - 10.0 (FotMob-style)
  isMotm: boolean;
  goals: number;
  assists: number;
  yellows: number;
  reds: number;
  saves: number;
}

// Small deterministic pseudo-random in [0,1) from a string seed, so a player's
// match rating is stable across re-renders (no flicker) but still varies.
function seededUnit(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // map to [0,1)
  return ((h >>> 0) % 1000) / 1000;
}

function clampRating(r: number): number {
  return Math.round(Math.min(10, Math.max(4.0, r)) * 10) / 10;
}

/**
 * Post-match ratings (FotMob-style) for every player in both starting XIs.
 * Derived from match events (goals, assists, cards, saves), goals conceded for
 * defenders/keepers, the team result, and a small deterministic variance. The
 * single highest rating is flagged as Player of the Match.
 */
export function computeMatchRatings(
  fixture: Fixture,
  teams: Team[],
): { home: PlayerMatchRating[]; away: PlayerMatchRating[] } {
  const homeTeam = teams.find((t) => t.id === fixture.homeTeamId);
  const awayTeam = teams.find((t) => t.id === fixture.awayTeamId);

  const h = Math.floor(fixture.homeScore);
  const a = Math.floor(fixture.awayScore);
  const winnerId = h > a ? fixture.homeTeamId : a > h ? fixture.awayTeamId : null;
  const isDraw = h === a;

  // Tally per-player event contributions.
  type Tally = { goals: number; assists: number; yellows: number; reds: number; saves: number };
  const tally = new Map<string, Tally>();
  const bump = (id: string, key: keyof Tally) => {
    const t = tally.get(id) ?? { goals: 0, assists: 0, yellows: 0, reds: 0, saves: 0 };
    t[key] += 1;
    tally.set(id, t);
  };
  for (const ev of fixture.events) {
    if (!ev.playerId) continue;
    if (ev.type === "GOAL") {
      bump(ev.playerId, "goals");
      if (ev.assistantPlayerId) bump(ev.assistantPlayerId, "assists");
    } else if (ev.type === "ASSIST") bump(ev.playerId, "assists");
    else if (ev.type === "SAVE") bump(ev.playerId, "saves");
    else if (ev.type === "YELLOW_CARD") bump(ev.playerId, "yellows");
    else if (ev.type === "RED_CARD") bump(ev.playerId, "reds");
  }

  const rateTeam = (team: Team | undefined, goalsConceded: number): PlayerMatchRating[] => {
    if (!team) return [];
    const xi = getStartingXI(team);
    const cleanSheet = goalsConceded === 0;
    const result: "W" | "D" | "L" = winnerId === team.id ? "W" : isDraw ? "D" : "L";
    return xi.map((p) => {
      const t = tally.get(p.id) ?? { goals: 0, assists: 0, yellows: 0, reds: 0, saves: 0 };
      let r = 6.2; // baseline for a full shift
      r += t.goals * 1.1;
      r += t.assists * 0.6;
      r += Math.min(1.2, t.saves * 0.25); // keepers/defenders making saves
      r -= t.yellows * 0.4;
      r -= t.reds * 1.8;
      // Result influence
      r += result === "W" ? 0.35 : result === "L" ? -0.25 : 0;
      // Defensive players rated on the back line's performance
      if (p.position === "GK" || p.position === "DEF") {
        r += cleanSheet ? 0.6 : -0.25 * goalsConceded;
      }
      // Attackers who did nothing tangible dip slightly
      if (p.position === "ATT" && t.goals === 0 && t.assists === 0) r -= 0.1;
      // Deterministic variance ±0.35
      r += (seededUnit(`${fixture.id}:${p.id}`) - 0.5) * 0.7;
      return {
        playerId: p.id,
        name: p.name,
        teamId: team.id,
        position: p.position,
        rating: clampRating(r),
        isMotm: false,
        goals: t.goals,
        assists: t.assists,
        yellows: t.yellows,
        reds: t.reds,
        saves: t.saves,
      };
    });
  };

  const home = rateTeam(homeTeam, a);
  const away = rateTeam(awayTeam, h);

  // Flag the single top rating across both teams as Player of the Match.
  let best: PlayerMatchRating | null = null;
  for (const r of [...home, ...away]) {
    if (!best || r.rating > best.rating) best = r;
  }
  if (best) best.isMotm = true;

  return { home, away };
}

/** Color band for a rating, used for the badge styling. */
export function ratingColorClass(rating: number): string {
  if (rating >= 8) return "bg-violet-500/20 text-violet-300 border-violet-500/40";
  if (rating >= 7) return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
  if (rating >= 6) return "bg-amber-500/15 text-amber-300 border-amber-500/30";
  return "bg-red-500/20 text-red-300 border-red-500/40";
}
