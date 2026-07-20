// 2D vector helpers (replaces the small numpy usage in the Python engine).
export type V2 = [number, number];

export const v2 = (x = 0, y = 0): V2 => [x, y];
export const zeros = (): V2 => [0, 0];
export const copy = (a: V2): V2 => [a[0], a[1]];
export const add = (a: V2, b: V2): V2 => [a[0] + b[0], a[1] + b[1]];
export const sub = (a: V2, b: V2): V2 => [a[0] - b[0], a[1] - b[1]];
export const scale = (a: V2, s: number): V2 => [a[0] * s, a[1] * s];
export const dot = (a: V2, b: V2): number => a[0] * b[0] + a[1] * b[1];
export const len = (a: V2): number => Math.hypot(a[0], a[1]);
export const dist = (a: V2, b: V2): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function normDir(from: V2, to: V2): V2 {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const n = Math.hypot(dx, dy);
  if (n < 1e-9) return [0, 0];
  return [dx / n, dy / n];
}

export const clampNum = (x: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, x));
