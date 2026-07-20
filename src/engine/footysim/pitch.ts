// Pitch geometry (port of pitch.py). Continuous 2D, origin at a corner.
import { V2, dist as vdist, dot, normDir, clampNum } from "./vec";

export const LENGTH = 105.0;
export const WIDTH = 68.0;
export const CENTER: V2 = [LENGTH / 2.0, WIDTH / 2.0];

export const GOAL_WIDTH = 7.32;
export const GOAL_Y_MIN = WIDTH / 2.0 - GOAL_WIDTH / 2.0;
export const GOAL_Y_MAX = WIDTH / 2.0 + GOAL_WIDTH / 2.0;

export const PENALTY_AREA_DEPTH = 16.5;
export const PENALTY_AREA_HALF_WIDTH = 20.16;
export const PENALTY_SPOT_DIST = 11.0;

export const goalCenter = (attackingRight: boolean): V2 => [attackingRight ? LENGTH : 0.0, WIDTH / 2.0];
export const ownGoalCenter = (attackingRight: boolean): V2 => goalCenter(!attackingRight);

export function clampToPitch(pos: V2, margin = 0.0): V2 {
  return [
    Math.min(Math.max(pos[0], margin), LENGTH - margin),
    Math.min(Math.max(pos[1], margin), WIDTH - margin),
  ];
}

export const inBounds = (pos: V2): boolean =>
  pos[0] >= 0.0 && pos[0] <= LENGTH && pos[1] >= 0.0 && pos[1] <= WIDTH;

export const dist = vdist;
export { normDir };

export function shotAngle(pos: V2, attackingRight: boolean): number {
  const gx = attackingRight ? LENGTH : 0.0;
  const v1: V2 = [gx - pos[0], GOAL_Y_MIN - pos[1]];
  const v2v: V2 = [gx - pos[0], GOAL_Y_MAX - pos[1]];
  const n1 = Math.hypot(v1[0], v1[1]);
  const n2 = Math.hypot(v2v[0], v2v[1]);
  if (n1 < 1e-9 || n2 < 1e-9) return Math.PI;
  const cosang = clampNum(dot(v1, v2v) / (n1 * n2), -1.0, 1.0);
  return Math.acos(cosang);
}

export function pointToSegmentDist(p: V2, a: V2, b: V2): number {
  const ab: V2 = [b[0] - a[0], b[1] - a[1]];
  const denom = dot(ab, ab);
  if (denom < 1e-9) return vdist(p, a);
  const t = clampNum((dot([p[0] - a[0], p[1] - a[1]], ab)) / denom, 0.0, 1.0);
  const proj: V2 = [a[0] + t * ab[0], a[1] + t * ab[1]];
  return vdist(p, proj);
}

export function inPenaltyArea(pos: V2, goalAtRight: boolean): boolean {
  const inX = goalAtRight ? pos[0] >= LENGTH - PENALTY_AREA_DEPTH : pos[0] <= PENALTY_AREA_DEPTH;
  return inX && Math.abs(pos[1] - WIDTH / 2.0) <= PENALTY_AREA_HALF_WIDTH;
}

export const penaltySpot = (goalAtRight: boolean): V2 => [
  goalAtRight ? LENGTH - PENALTY_SPOT_DIST : PENALTY_SPOT_DIST,
  WIDTH / 2.0,
];
