// Assemble the match dataset (port of output.py).
import { MatchState } from "./engine";

export const PLAYER_STAT_KEYS = [
  "passes_attempted", "passes_completed", "passes_failed", "interceptions",
  "tackles_won", "dispossessed", "shots", "shots_on_target", "goals", "xg",
  "saves", "distance", "fouls", "fouls_won", "yellow_cards", "red_cards",
  "key_passes", "assists", "crosses", "crosses_completed", "touches",
  "progressive_passes", "passes_final_third", "progressive_carries",
  "dribbles_completed", "duels", "duels_won", "big_chances",
  "shots_inside_box", "shots_outside_box", "xg_faced", "goals_conceded",
];

export interface MatchResult {
  meta: Record<string, unknown>;
  final_score: Record<string, number>;
  events_general: Record<string, unknown>[];
  events_key: Record<string, unknown>[];
  frames: Record<string, unknown>[];
  boxscore: { teams: Record<string, Record<string, number>>; players: Record<string, Record<string, unknown>> };
  ratings: Record<string, number>;
}

function playerBoxscore(st: MatchState): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  for (const t of st.teams) {
    for (const p of t.players) {
      const s = st.stats[p.pid];
      const row: Record<string, unknown> = {};
      for (const k of PLAYER_STAT_KEYS) row[k] = s[k] ?? 0;
      const att = row.passes_attempted as number;
      row.pass_accuracy = att ? Math.round(((row.passes_completed as number) / att) * 1000) / 1000 : null;
      row.xg = Math.round(Number(row.xg) * 1000) / 1000;
      row.xg_faced = Math.round(Number(row.xg_faced) * 1000) / 1000;
      row.distance = Math.round(Number(row.distance) * 10) / 10;
      row.team = t.teamId;
      row.name = p.name;
      row.role = p.role;
      row.rating = Math.round(p.rating * 100) / 100;
      out[p.pid] = row;
    }
  }
  return out;
}

function teamBoxscore(st: MatchState, playerRows: Record<string, Record<string, unknown>>): Record<string, Record<string, number>> {
  const totalPoss = Object.values(st.possessionTicks).reduce((a, b) => a + b, 0) || 1;
  const out: Record<string, Record<string, number>> = {};
  for (const t of st.teams) {
    const rows = Object.values(playerRows).filter((r) => r.team === t.teamId);
    const agg: Record<string, number> = {};
    for (const k of PLAYER_STAT_KEYS) agg[k] = Math.round(rows.reduce((a, r) => a + Number(r[k] ?? 0), 0) * 1000) / 1000;
    const att = agg.passes_attempted;
    agg.pass_accuracy = att ? Math.round((agg.passes_completed / att) * 1000) / 1000 : 0;
    agg.possession_pct = Math.round((1000.0 * st.possessionTicks[t.teamId]) / totalPoss) / 10;
    agg.goals = st.score[t.teamId];
    out[t.teamId] = agg;
  }
  return out;
}

export function buildResult(st: MatchState, seed: number): MatchResult {
  const playerRows = playerBoxscore(st);
  const ratings: Record<string, number> = {};
  for (const t of st.teams) for (const p of t.players) ratings[p.pid] = Math.round(p.rating * 100) / 100;
  return {
    meta: {
      teams: Object.fromEntries(st.teams.map((t) => [t.teamId, { name: t.name, formation: t.formation }])),
      seed, final_score: { ...st.score }, engine: "footysim-ts",
    },
    final_score: { ...st.score },
    events_general: st.eventsGeneral,
    events_key: st.eventsKey,
    frames: st.frames,
    boxscore: { teams: teamBoxscore(st, playerRows), players: playerRows },
    ratings,
  };
}

export function decimateFrames(frames: Record<string, unknown>[], targetFrames: number): Record<string, unknown>[] {
  if (frames.length <= targetFrames || targetFrames < 2) return frames;
  const idx = Array.from({ length: targetFrames }, (_, i) => Math.round((i * (frames.length - 1)) / (targetFrames - 1)));
  return idx.map((i) => frames[i]);
}
