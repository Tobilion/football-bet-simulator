// Dynamic attribute modifiers (port of modifiers.py).
export const CATEGORY: Record<string, string> = {
  passing: "tech", first_touch: "tech", tackling: "tech", marking: "tech",
  dribbling: "tech", finishing: "tech", crossing: "tech", heading: "tech",
  pace: "phys", acceleration: "phys", stamina: "phys", strength: "phys", agility: "phys",
  positioning: "mental", decisions: "mental", anticipation: "mental", composure: "mental",
  work_rate: "mental", teamwork: "mental", vision: "mental", aggression: "mental",
  shot_stopping: "tech", handling: "tech", reflexes: "tech",
  positioning_gk: "tech", command_of_area: "tech",
};

export const ROLE_GROUP: Record<string, string> = {
  GK: "GK",
  RB: "DEF", LB: "DEF", RCB: "DEF", LCB: "DEF",
  RCM: "MID", CM: "MID", LCM: "MID", RM: "MID", LM: "MID",
  RW: "ATT", LW: "ATT", ST: "ATT", RST: "ATT", LST: "ATT",
};

const ADJACENT = new Set(["DEF>MID", "MID>DEF", "MID>ATT", "ATT>MID"]);

export function roleFit(assigned: string, naturalPositions: string[]): number {
  if (naturalPositions.includes(assigned)) return 1.0;
  const a = ROLE_GROUP[assigned] ?? "MID";
  const groups = new Set(naturalPositions.map((r) => ROLE_GROUP[r] ?? "MID"));
  if (groups.has(a)) return 0.96;
  for (const g of groups) if (ADJACENT.has(`${a}>${g}`)) return 0.90;
  return 0.82;
}

export function staticMods(form: number, sharpness: number, fit: number): Record<string, number> {
  const formM = 0.92 + 0.16 * (form / 100.0);
  const sharpM = 0.90 + 0.10 * (sharpness / 100.0);
  return {
    tech: formM * sharpM * (0.6 + 0.4 * fit),
    mental: formM * sharpM * fit,
    phys: 1.0,
  };
}

export function liveMod(rating: number, staminaLevel: number, category: string): number {
  const streak = Math.max(-0.06, Math.min(0.06, (rating - 6.0) * 0.015));
  let m = 1.0 + streak;
  if (category === "mental") m *= 0.94 + 0.06 * staminaLevel;
  return m;
}
