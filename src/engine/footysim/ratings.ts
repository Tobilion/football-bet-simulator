// Live per-player match ratings (port of ratings.py).
import { Player } from "./entities";

export const DELTAS: Record<string, number> = {
  pass_completed: +0.006, pass_failed: -0.015, interception: +0.06,
  tackle_won: +0.05, dispossessed: -0.04, shot_on_target: +0.05,
  shot_off_target: -0.02, goal: +0.9, save: +0.06, goal_conceded_gk: -0.15,
  foul: -0.04, yellow_card: -0.15, red_card: -1.0, assist: +0.5, key_pass: +0.15,
};

export function finalize(player: Player, stats: Record<string, number>): void {
  const xg = Number(stats.xg ?? 0.0);
  const goals = Number(stats.goals ?? 0.0);
  if (xg > 0.2 || goals > 0) {
    const delta = Math.max(-0.5, Math.min(0.8, 0.3 * (goals - xg)));
    player.rating = Math.min(10.0, Math.max(3.0, player.rating + delta));
  }
}

export function adjust(player: Player, key: string, scale = 1.0): void {
  const delta = (DELTAS[key] ?? 0.0) * scale;
  player.rating = Math.min(10.0, Math.max(3.0, player.rating + delta));
}
