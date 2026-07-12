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

export function developPlayer(player: Player): Player {
  let statGrowth = 0;
  if (player.age >= 18 && player.age <= 21) {
    statGrowth = 0.3;
  } else if (player.age > 30) {
    statGrowth = -0.5; // Natural decline
  }
  
  return {
    ...player,
    age: player.age + 1,
    rating: Math.max(50, Math.min(99, player.rating + statGrowth))
  };
}
