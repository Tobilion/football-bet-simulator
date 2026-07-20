// Deterministic seeded PRNG (mulberry32) replacing numpy's Generator.
// Determinism is within-JS only (the exact sequence differs from numpy, which
// is fine — the app stores results rather than re-running them).
import { V2 } from "./vec";

export class RNG {
  private s: number;
  private spare: number | null = null;

  constructor(seed: number) {
    this.s = seed >>> 0 || 1;
  }

  random(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  uniform(a: number, b: number): number {
    return a + (b - a) * this.random();
  }

  normal(mu = 0, sigma = 1): number {
    if (this.spare !== null) {
      const s = this.spare;
      this.spare = null;
      return mu + sigma * s;
    }
    let u = 0;
    while (u < 1e-12) u = this.random();
    const v = this.random();
    const mag = Math.sqrt(-2 * Math.log(u));
    this.spare = mag * Math.sin(2 * Math.PI * v);
    return mu + sigma * mag * Math.cos(2 * Math.PI * v);
  }

  normal2(mu: number, sigma: number): V2 {
    return [this.normal(mu, sigma), this.normal(mu, sigma)];
  }

  choice<T>(arr: T[]): T {
    return arr[Math.floor(this.random() * arr.length)];
  }
}
