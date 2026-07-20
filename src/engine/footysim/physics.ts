// Movement integration (port of physics.py).
import { V2, len, normDir, scale, add, sub } from "./vec";
import * as pitch from "./pitch";
import { Ball, Player } from "./entities";

export const BALL_FRICTION = 5.2;
export const BALL_ARRIVE_SPEED = 3.0;
export const CONTROL_RADIUS = 1.3;
export const CARRY_OFFSET = 0.5;

export function movePlayerToward(player: Player, target: V2, dt: number, speedScale = 1.0): void {
  const desired = scale(normDir(player.pos, target), player.maxSpeed() * speedScale);
  let dv = sub(desired, player.vel);
  const dvNorm = len(dv);
  const maxDv = player.maxAccel() * dt;
  if (dvNorm > maxDv) dv = scale(dv, maxDv / dvNorm);
  player.vel = add(player.vel, dv);
  player.pos = add(player.pos, scale(player.vel, dt));
}

export function holdPosition(player: Player, dt: number): void {
  const speed = len(player.vel);
  if (speed < 1e-3) {
    player.vel = [0, 0];
    return;
  }
  const decel = Math.min(speed, player.maxAccel() * dt);
  player.vel = scale(player.vel, 1.0 - decel / speed);
  player.pos = add(player.pos, scale(player.vel, dt));
}

export function drainStamina(player: Player, dt: number): void {
  const speed = len(player.vel);
  const effort = speed / 8.6;
  const drainRate = 0.000012 + 0.000075 * effort * effort;
  const attrFactor = 2.0 - player.attrs.stamina / 100.0;
  player.staminaLevel = Math.max(0.5, player.staminaLevel - drainRate * attrFactor * dt * 60.0);
}

export function strikeBall(ball: Ball, direction: V2, travelDist: number, kind: string,
                           fromPid: string, targetPid: string | null = null,
                           meta: Record<string, unknown> | null = null, maxSpeed = 26.0): void {
  let v0 = Math.sqrt(Math.max(0.0, 2.0 * BALL_FRICTION * travelDist + BALL_ARRIVE_SPEED ** 2));
  v0 = Math.min(v0, maxSpeed);
  ball.vel = scale(direction, v0);
  ball.owner = null;
  ball.inFlight = true;
  ball.flightKind = kind;
  ball.flightFrom = fromPid;
  ball.flightTarget = targetPid;
  ball.flightMeta = meta ?? {};
}

export function stepBall(ball: Ball, carrier: Player | null, dt: number): void {
  if (carrier !== null) {
    const heading = carrier.vel;
    const n = len(heading);
    const offset: V2 = n > 0.3 ? scale(heading, CARRY_OFFSET / n) : [0, 0];
    ball.pos = add(carrier.pos, offset);
    ball.vel = [carrier.vel[0], carrier.vel[1]];
    return;
  }
  const speed = len(ball.vel);
  if (speed < 0.05) {
    ball.vel = [0, 0];
    ball.inFlight = false;
    return;
  }
  const decel = Math.min(speed, BALL_FRICTION * dt);
  ball.vel = scale(ball.vel, 1.0 - decel / speed);
  ball.pos = add(ball.pos, scale(ball.vel, dt));
  if (len(ball.vel) < 0.5) ball.inFlight = false;
}
