import { Position, PlayerSeasonStats, Player } from "../types";

/**
 * Reserve status used to leak into player names as a " (Res)" / "(GK - Res)"
 * suffix. Names are now clean and reserve status lives on Player.isReserve, but
 * older saved games persist the tag — strip it defensively at display time.
 */
export function cleanPlayerName(name: string): string {
  return name
    .replace(/\s*\(GK - Res\)/gi, " (GK)")
    .replace(/\s*\(Res\)/gi, "")
    .trim();
}

/** True if a player is a reserve, from the flag or a legacy name tag. */
export function isReservePlayer(player: Pick<Player, "isReserve" | "name">): boolean {
  return !!player.isReserve || /\(\s*(GK - )?Res\s*\)/i.test(player.name);
}

export function generatePlayerAge(position: Position): number {
  switch (position) {
    case "GK":
      return Math.floor(Math.random() * (38 - 22 + 1)) + 22; // 22-38
    case "DEF":
      return Math.floor(Math.random() * (35 - 20 + 1)) + 20; // 20-35
    case "MID":
      return Math.floor(Math.random() * (33 - 19 + 1)) + 19; // 19-33
    case "ATT":
      return Math.floor(Math.random() * (32 - 18 + 1)) + 18; // 18-32
    default:
      return 25;
  }
}

export function generateEmptySeasonStats(): PlayerSeasonStats {
  return {
    goalsScored: 0,
    assists: 0,
    yellowCards: 0,
    redCards: 0,
    matchesPlayed: 0,
    cleanSheets: 0,
  };
}

const clampN = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Deterministic soft ceiling for a player (stable across sessions via id hash). */
function derivePotential(player: Player): number {
  let h = 2166136261;
  for (let i = 0; i < player.id.length; i++) {
    h ^= player.id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const u = ((h >>> 0) % 1000) / 1000;              // 0..1
  const youthRoom = Math.max(0, 24 - player.age);   // the young have more headroom
  const ceiling = player.rating + 2 + u * 8 + youthRoom * 0.9;
  return Math.round(clampN(ceiling, player.rating, 99));
}

/**
 * Season-rollover development. Growth is driven by REAL inputs rather than age
 * alone: the age curve sets the potential rate, game time gates it (benchwarmers
 * stagnate), performance (goals/assists, clean sheets for GK/DEF, red cards)
 * modulates it, and a per-player `potential` caps it. Decline after ~30 is
 * softened slightly for players who keep playing regularly. Abilities drift with
 * the rating so the spatial engine sees the development too, and season stats
 * reset for the new campaign.
 */
export function developPlayer(player: Player, seasonMatches = 14): Player {
  const potential = player.potential ?? derivePotential(player);
  const ss = player.seasonStats;
  const apps = ss?.matchesPlayed ?? player.matchesPlayed ?? 0;
  const gameTime = clampN(apps / Math.max(1, seasonMatches), 0, 1);

  const age = player.age;
  let ageBase: number;
  if (age <= 20) ageBase = 2.2;
  else if (age <= 23) ageBase = 1.6;
  else if (age <= 26) ageBase = 0.9;
  else if (age <= 29) ageBase = 0.3;
  else if (age <= 32) ageBase = -0.6;
  else ageBase = -1.4;

  const perGame = apps > 0 ? (ss.goalsScored + 0.6 * ss.assists) / apps : 0;
  const cleanSheetRate = apps > 0 ? ss.cleanSheets / apps : 0;
  const defensive = player.position === "GK" || player.position === "DEF";
  const perf = clampN(
    perGame * 1.6 + (defensive ? cleanSheetRate * 1.2 : 0) - (ss?.redCards ?? 0) * 0.15,
    -0.5, 1.4,
  );

  let delta: number;
  if (ageBase >= 0) {
    // Growth needs minutes; performance accelerates it.
    delta = ageBase * (0.25 + 0.75 * gameTime) * (1 + perf * 0.6);
    const room = Math.max(0, potential - player.rating);
    delta = Math.min(delta, room * 0.55);   // approach the ceiling, never blow past
  } else {
    // Ageing: regular starters hold their level a little better.
    delta = ageBase * (1 - 0.35 * gameTime);
  }

  const nextRating = clampN(Math.round((player.rating + delta) * 10) / 10, 45, 99);
  const shift = nextRating - player.rating;

  let abilities = player.abilities;
  if (abilities) {
    const next: Record<string, number> = {};
    for (const [k, v] of Object.entries(abilities)) {
      if (typeof v === "number") next[k] = clampN(Math.round((v + shift) * 10) / 10, 30, 99);
    }
    abilities = next as typeof abilities;
  }

  return {
    ...player,
    age: age + 1,
    rating: nextRating,
    potential,
    abilities,
    seasonStats: generateEmptySeasonStats(),
  };
}

