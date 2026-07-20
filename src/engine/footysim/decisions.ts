// Per-agent decision loop (port of decisions.py).
import { V2, add, scale, normDir, dist as vdist } from "./vec";
import * as pitch from "./pitch";
import * as resolution from "./resolution";
import { Player, Team } from "./entities";
import { RNG } from "./rng";

export interface OnBallChoice {
  action: "shoot" | "pass" | "dribble";
  target: Player | null;
}

export const SHOOT_RANGE = 26.0;

function minOr(vals: number[], dflt: number): number {
  return vals.length ? Math.min(...vals) : dflt;
}

function passOptionScore(passer: Player, mate: Player, opponents: Player[],
                         attackingRight: boolean, synergy = 50.0, mentality = 50.0): number {
  const d = vdist(passer.pos, mate.pos);
  if (d < 3.0 || d > 40.0) return -1.0;
  const goal = pitch.goalCenter(attackingRight);
  const progress = (vdist(passer.pos, goal) - vdist(mate.pos, goal)) / 45.0;
  const openness = Math.min(1.0, minOr(opponents.map((o) => vdist(mate.pos, o.pos)), 30.0) / 12.0);
  const support = 0.06 * (mate.eff("teamwork") / 100.0) + 0.05 * ((synergy - 50.0) / 50.0);
  let laneBlock = 0;
  for (const o of opponents)
    if (pitch.pointToSegmentDist(o.pos, passer.pos, mate.pos) < 2.0) laneBlock += 1;
  const risk = 0.3 * laneBlock + 0.01 * d;
  const progW = 0.45 + 0.06 * ((mentality - 50.0) / 50.0);
  return 0.48 * openness + progW * progress + support - risk + 0.45;
}

export function chooseOnBall(rng: RNG, carrier: Player, team: Team, opponents: Player[]): OnBallChoice {
  const goal = pitch.goalCenter(team.attackingRight);
  const dGoal = vdist(carrier.pos, goal);
  const press = resolution.pressureOn(carrier, opponents);
  const mental = (0.6 * carrier.eff("decisions") + 0.4 * carrier.eff("vision")) / 100.0;
  const mentIns = team.instructions.mentality;

  let shootU = -1.0;
  if (dGoal < SHOOT_RANGE) {
    const angle = pitch.shotAngle(carrier.pos, team.attackingRight);
    let lane = 0;
    for (const o of opponents)
      if (pitch.pointToSegmentDist(o.pos, carrier.pos, goal) < 1.5) lane += 1;
    shootU = 0.26 + 2.6 * (angle / Math.PI) * Math.exp(-dGoal / 16.0) +
      0.18 * (carrier.eff("finishing") / 100.0) + 0.04 * ((mentIns - 50.0) / 50.0) -
      0.22 * press - 0.1 * lane;
    if (dGoal < 10.0) shootU += 0.2;
  }

  const mates = team.active().filter((m) => m.pid !== carrier.pid);
  let bestMate: Player | null = null;
  let bestPassU = -1.0;
  for (const m of mates) {
    const s = passOptionScore(carrier, m, opponents, team.attackingRight, team.synergy, mentIns);
    if (s > bestPassU) { bestMate = m; bestPassU = s; }
  }
  let passU = bestPassU + 0.3 * press;

  const ownHalf = team.attackingRight
    ? carrier.pos[0] < pitch.LENGTH / 2.0
    : carrier.pos[0] > pitch.LENGTH / 2.0;
  if (ownHalf && bestPassU < 0.5 && mates.length) {
    const sign = team.attackingRight ? 1.0 : -1.0;
    const outfielders = mates.filter((m) => !m.isGk);
    if (outfielders.length) {
      let outlet = outfielders[0];
      for (const m of outfielders) if (sign * m.pos[0] > sign * outlet.pos[0]) outlet = m;
      const dOut = vdist(carrier.pos, outlet.pos);
      if (dOut > 20.0) {
        const uLong = 0.46 + 0.12 * (carrier.eff("passing") / 100.0) - 0.1 * press;
        if (uLong > bestPassU) { bestMate = outlet; bestPassU = uLong; passU = bestPassU + 0.3 * press; }
      }
    }
  }

  const ahead: V2 = add(carrier.pos, scale(normDir(carrier.pos, goal), 7.0));
  const space = minOr(opponents.map((o) => vdist(ahead, o.pos)), 30.0);
  const dribbleU = 0.1 + 0.35 * (carrier.eff("dribbling") / 100.0) +
    0.25 * Math.min(1.0, space / 10.0) - 0.65 * press;

  const thirdX = pitch.LENGTH * (2 / 3);
  const inFinalThird = team.attackingRight
    ? carrier.pos[0] > thirdX
    : carrier.pos[0] < pitch.LENGTH - thirdX;
  if (inFinalThird) {
    passU -= 0.05;
    if (shootU > -1.0) shootU += 0.03;
  }

  const noise = 0.22 * (1.0 - mental) + 0.08 * (1.0 - carrier.staminaLevel);
  const utilities: Record<string, number> = {
    shoot: shootU + rng.normal(0, noise),
    pass: passU + rng.normal(0, noise),
    dribble: dribbleU + rng.normal(0, noise),
  };
  let action = "shoot";
  for (const k of Object.keys(utilities)) if (utilities[k] > utilities[action]) action = k;
  if (action === "pass" && bestMate === null) action = "dribble";
  return { action: action as OnBallChoice["action"], target: action === "pass" ? bestMate : null };
}

export function dribbleTarget(carrier: Player, team: Team, opponents: Player[]): V2 {
  const goal = pitch.goalCenter(team.attackingRight);
  let direction = normDir(carrier.pos, goal);
  let near: Player | null = null;
  for (const o of opponents) if (near === null || vdist(carrier.pos, o.pos) < vdist(carrier.pos, near.pos)) near = o;
  if (near !== null && vdist(carrier.pos, near.pos) < 5.0) {
    const away = normDir(near.pos, carrier.pos);
    direction = normDir([0, 0], [direction[0] + 0.8 * away[0], direction[1] + 0.8 * away[1]]);
  }
  return pitch.clampToPitch(add(carrier.pos, scale(direction, 8.0)), 0.5);
}

export function pickChasers(players: Player[], ballPos: V2, n = 2): Set<string> {
  const effDist = (p: Player) => vdist(p.pos, ballPos) * (1.1 - 0.2 * p.eff("work_rate") / 100.0);
  const ranked = [...players].sort((a, b) => effDist(a) - effDist(b));
  return new Set(ranked.slice(0, n).map((p) => p.pid));
}

export function pickPressers(players: Player[], carrierPos: V2, n = 2): Set<string> {
  const cands = players.filter((p) => !p.isGk).sort((a, b) => vdist(a.pos, carrierPos) - vdist(b.pos, carrierPos));
  return new Set(cands.slice(0, n).map((p) => p.pid));
}

export function pressPoint(_presser: Player, carrier: Player, ownGoal: V2): V2 {
  return add(carrier.pos, scale(normDir(carrier.pos, ownGoal), 1.3));
}

export function assignMarkers(defenders: Player[], threats: Player[], ownGoal: V2): Record<string, string> {
  const order = [...threats].sort((a, b) => vdist(a.pos, ownGoal) - vdist(b.pos, ownGoal));
  const free = new Map<string, Player>();
  for (const d of defenders) if (!d.isGk) free.set(d.pid, d);
  const out: Record<string, string> = {};
  for (const t of order) {
    if (free.size === 0) break;
    let best: Player | null = null;
    for (const d of free.values()) if (best === null || vdist(d.pos, t.pos) < vdist(best.pos, t.pos)) best = d;
    if (best) { out[best.pid] = t.pid; free.delete(best.pid); }
  }
  return out;
}

export function markingPoint(threat: Player, ownGoal: V2, marker: Player | null = null): V2 {
  let gap = 1.3;
  if (marker !== null) gap = 1.5 - 0.8 * (marker.attrs.marking / 100.0);
  return add(threat.pos, scale(normDir(threat.pos, ownGoal), gap));
}
