// Contact-point resolution (port of resolution.py).
import { V2, add, scale, len, normDir, dist as vdist, clampNum } from "./vec";
import * as pitch from "./pitch";
import * as physics from "./physics";
import { Ball, Player } from "./entities";
import { RNG } from "./rng";

export function pressureOn(player: Player, opponents: Player[], radius = 6.0): number {
  let total = 0.0;
  for (const o of opponents) {
    const d = vdist(player.pos, o.pos);
    if (d < radius) total += (1.0 - d / radius) ** 2;
  }
  return Math.min(1.0, total);
}

export function isCross(passer: Player, receiver: Player, attackingRight: boolean): boolean {
  const thirdX = pitch.LENGTH * (2 / 3);
  const px = attackingRight ? passer.pos[0] : pitch.LENGTH - passer.pos[0];
  const wide = passer.pos[1] < 14.0 || passer.pos[1] > pitch.WIDTH - 14.0;
  return px > thirdX && wide && pitch.inPenaltyArea(receiver.pos, attackingRight);
}

export function executePass(rng: RNG, passer: Player, receiver: Player, ball: Ball,
                            opponents: Player[], attackingRight = true): Record<string, unknown> {
  const lead: V2 = add(receiver.pos, scale(receiver.vel, 0.6));
  const d = vdist(passer.pos, lead);
  const press = pressureOn(passer, opponents);
  const cross = isCross(passer, receiver, attackingRight);

  const skill = cross
    ? (0.6 * passer.eff("crossing") + 0.2 * passer.eff("vision") + 0.2 * passer.eff("composure")) / 100.0
    : (0.55 * passer.eff("passing") + 0.25 * passer.eff("vision") + 0.2 * passer.eff("composure")) / 100.0;
  const deg2rad = (x: number) => (x * Math.PI) / 180.0;
  const sigma = deg2rad(0.8 + (1.0 - skill) * 4.0) * (1.0 + d / 70.0) * (1.0 + 0.5 * press);
  const angErr = rng.normal(0.0, sigma);
  const distErr = rng.normal(0.0, 0.03 + (1.0 - skill) * 0.06 + 0.03 * press);

  let direction = normDir(passer.pos, lead);
  const cosE = Math.cos(angErr);
  const sinE = Math.sin(angErr);
  direction = [direction[0] * cosE - direction[1] * sinE, direction[0] * sinE + direction[1] * cosE];
  const travel = Math.max(2.0, d * (1.0 + distErr));

  physics.strikeBall(ball, direction, travel, cross ? "cross" : "pass", passer.pid,
    receiver.pid, { aerial: cross });
  return { distance: Math.round(d * 10) / 10, pressure: Math.round(press * 100) / 100, cross };
}

export function tryControl(rng: RNG, player: Player, ball: Ball, isIntendedReceiver: boolean,
                           synergy = 50.0): boolean {
  const ballSpeed = len(ball.vel);
  const aerial = Boolean(ball.flightMeta.aerial);
  let base: number;
  if (aerial) {
    const head = player.eff("heading") / 100.0;
    const mark = player.eff("marking") / 100.0;
    base = isIntendedReceiver ? 0.4 + 0.4 * head : 0.18 + 0.28 * head + 0.14 * mark;
  } else {
    const touch = player.eff("first_touch") / 100.0;
    const antic = player.eff("anticipation") / 100.0;
    base = isIntendedReceiver
      ? 0.76 + 0.22 * touch + 0.03 * ((synergy - 50.0) / 50.0)
      : 0.14 + 0.36 * antic;
  }
  const speedPen = Math.min(0.4, ballSpeed / 38.0);
  const p = Math.max(0.05, Math.min(0.98, base - speedPen));
  return rng.random() < p;
}

export function canReachFlight(player: Player, ball: Ball, horizon = 0.6): boolean {
  const segA = ball.pos;
  const segB: V2 = add(ball.pos, scale(ball.vel, horizon));
  const reach = physics.CONTROL_RADIUS + player.maxSpeed() * horizon * 0.5;
  return pitch.pointToSegmentDist(player.pos, segA, segB) < reach;
}

export function xgModel(shooterPos: V2, attackingRight: boolean, defendersInLane: number,
                        gkDistFromLine: number): number {
  const goal = pitch.goalCenter(attackingRight);
  const d = vdist(shooterPos, goal);
  const angle = pitch.shotAngle(shooterPos, attackingRight);
  let base = 2.6 * (angle / Math.PI) * Math.exp(-d / 14.0);
  base *= 0.68 ** defendersInLane;
  base *= 1.0 + Math.min(0.12, gkDistFromLine / 50.0);
  return clampNum(base, 0.005, 0.7);
}

export function resolveShot(rng: RNG, shooter: Player, gk: Player, ball: Ball,
                            defenders: Player[], attackingRight: boolean): Record<string, unknown> {
  const goal = pitch.goalCenter(attackingRight);
  const lane = defenders.filter(
    (d) => !d.isGk && pitch.pointToSegmentDist(d.pos, shooter.pos, goal) < 1.2);
  const gkLine = pitch.ownGoalCenter(!attackingRight);
  const gkPosQ = gk.eff("positioning_gk") / 100.0;
  let xg = xgModel(shooter.pos, attackingRight, lane.length, vdist(gk.pos, gkLine));
  xg *= 1.1 - 0.2 * gkPosQ;
  xg = clampNum(xg, 0.005, 0.7);

  const press = pressureOn(shooter, defenders);
  const fin = (0.7 * shooter.eff("finishing") + 0.3 * shooter.eff("composure")) / 100.0;
  const pOn = clampNum(0.28 + 0.35 * fin - 0.22 * press + 0.35 * xg, 0.1, 0.85);
  const onTarget = rng.random() < pOn;

  const dGoal = vdist(shooter.pos, goal);
  if (!onTarget) {
    const off: V2 = [0.0, rng.choice([-1, 1]) * rng.uniform(4.5, 9.0)];
    const direction = normDir(shooter.pos, [goal[0] + off[0], goal[1] + off[1]]);
    physics.strikeBall(ball, direction, dGoal + 8.0, "shot", shooter.pid, null, null, 32.0);
    return { outcome: "off_target", xg: Math.round(xg * 1000) / 1000 };
  }

  const gkQ = (0.6 * gk.eff("shot_stopping") + 0.4 * gk.eff("reflexes")) / 100.0;
  const shotQ = xg * (0.85 + 0.45 * fin);
  const pGoal = clampNum(shotQ * (2.75 - 1.15 * gkQ), 0.03, 0.88);
  const goalScored = rng.random() < pGoal;
  let aim: V2;
  let outcome: string;
  if (goalScored) {
    aim = [goal[0], goal[1] + rng.choice([-1, 1]) * 2.6];
    outcome = "goal";
  } else {
    aim = [gk.pos[0], gk.pos[1]];
    const hand = gk.eff("handling") / 100.0;
    const pCatch = clampNum(0.35 + 0.55 * hand - 0.45 * xg, 0.1, 0.92);
    outcome = rng.random() < pCatch ? "save" : "parry";
  }
  physics.strikeBall(ball, normDir(shooter.pos, aim), dGoal + 2.0, "shot", shooter.pid, null, null, 32.0);
  return { outcome, xg: Math.round(xg * 1000) / 1000 };
}

export function contestDispossession(rng: RNG, defender: Player, carrier: Player,
                                     boxCaution = 1.0): string {
  const atk = (0.45 * carrier.eff("dribbling") + 0.25 * carrier.eff("composure") +
    0.15 * carrier.eff("agility") + 0.15 * carrier.eff("strength")) / 100.0;
  const dfn = (0.5 * defender.eff("tackling") + 0.2 * defender.eff("anticipation") +
    0.15 * defender.eff("strength") + 0.15 * defender.eff("marking")) / 100.0;
  const pWin = clampNum(0.34 + 0.55 * (dfn - atk) + 0.12, 0.08, 0.8);
  const aggr = defender.eff("aggression") / 100.0;
  const pFoul = clampNum(0.1 + 0.14 * aggr + 0.09 * Math.max(0.0, atk - dfn), 0.015, 0.34) * boxCaution;
  const r = rng.random();
  if (r < pFoul) return "foul";
  if (r < pFoul + pWin) return "won";
  return "none";
}
