// Formations & tactical target positions (port of tactics.py).
import { V2, add, scale, sub, dist as vdist, clampNum } from "./vec";
import * as pitch from "./pitch";
import { Player, Team } from "./entities";

export const FORMATIONS: Record<string, Record<string, [number, number]>> = {
  "4-3-3": {
    GK: [0.04, 0.5],
    RB: [0.22, 0.15], RCB: [0.16, 0.37], LCB: [0.16, 0.63], LB: [0.22, 0.85],
    RCM: [0.42, 0.28], CM: [0.38, 0.5], LCM: [0.42, 0.72],
    RW: [0.68, 0.15], ST: [0.72, 0.5], LW: [0.68, 0.85],
  },
  "4-4-2": {
    GK: [0.04, 0.5],
    RB: [0.22, 0.15], RCB: [0.16, 0.37], LCB: [0.16, 0.63], LB: [0.22, 0.85],
    RM: [0.45, 0.14], RCM: [0.4, 0.38], LCM: [0.4, 0.62], LM: [0.45, 0.86],
    RST: [0.7, 0.4], LST: [0.7, 0.6],
  },
};

export function basePosition(role: string, formation: string, attackingRight: boolean): V2 {
  let [nx, ny] = FORMATIONS[formation][role];
  if (!attackingRight) { nx = 1.0 - nx; ny = 1.0 - ny; }
  return [nx * pitch.LENGTH, ny * pitch.WIDTH];
}

export function kickoffPositions(team: Team, hasKickoff: boolean): void {
  const sign = team.attackingRight ? 1.0 : -1.0;
  const halfLine = pitch.LENGTH / 2.0;
  for (const p of team.players) {
    if (p.sentOff) continue;
    const base = basePosition(p.role, team.formation, team.attackingRight);
    let x = base[0];
    const y = base[1];
    if (team.attackingRight) x = Math.min(x, halfLine - 2.0);
    else x = Math.max(x, halfLine + 2.0);
    p.pos = [x, y];
    p.vel = [0, 0];
  }
  if (hasKickoff) {
    const center: V2 = [halfLine, pitch.WIDTH / 2.0];
    const takers = team.active()
      .filter((p) => !p.isGk)
      .sort((a, b) =>
        vdist(center, basePosition(a.role, team.formation, team.attackingRight)) -
        vdist(center, basePosition(b.role, team.formation, team.attackingRight)))
      .slice(0, 2);
    takers[0].pos = [pitch.CENTER[0], pitch.CENTER[1]];
    takers[1].pos = [pitch.CENTER[0] - sign * 2.5, pitch.CENTER[1] + 1.5];
  }
}

export function targetPosition(player: Player, team: Team, ballPos: V2, inPossession: boolean): V2 {
  let base = basePosition(player.role, team.formation, team.attackingRight);
  if (player.isGk) {
    const gx = team.attackingRight ? 2.5 : pitch.LENGTH - 2.5;
    const gy = pitch.WIDTH / 2.0 + clampNum(ballPos[1] - pitch.WIDTH / 2.0, -6.0, 6.0) * 0.5;
    return [gx, gy];
  }
  const sign = team.attackingRight ? 1.0 : -1.0;
  const ins = team.instructions;
  const widthF = 0.85 + 0.3 * (ins.width / 100.0);
  base = [base[0], pitch.WIDTH / 2.0 + (base[1] - pitch.WIDTH / 2.0) * widthF];
  const lineShift = sign * (ins.lineHeight - 50.0) * 0.12;
  const shiftX = 0.3 * (ballPos[0] - pitch.CENTER[0]);
  const shiftY = 0.2 * (ballPos[1] - pitch.CENTER[1]);
  const ment = (ins.mentality - 50.0) * 0.05;
  const push = sign * ((inPossession ? 6.0 : -9.0) + ment);
  const disc = 0.7 + 0.3 * (player.eff("positioning") / 100.0);
  let tgt: V2 = add(base, scale([shiftX + push + lineShift, shiftY], disc));

  if (!inPossession) {
    const ownGoal = pitch.ownGoalCenter(team.attackingRight);
    const dBallGoal = vdist(ballPos, ownGoal);
    if (dBallGoal < 45.0) {
      const lanePt: V2 = add(ballPos, scale(sub(ownGoal, ballPos), 0.5));
      const wgt = 0.7 * (1.0 - dBallGoal / 45.0) + 0.18;
      tgt = add(scale(tgt, 1.0 - wgt), scale(lanePt, wgt));
    }
  }
  return pitch.clampToPitch(tgt, 1.0);
}
