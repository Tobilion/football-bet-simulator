// Tick-loop orchestration (port of engine.py).
import { V2, add, scale, len, normDir } from "./vec";
import * as pitch from "./pitch";
import * as physics from "./physics";
import * as tactics from "./tactics";
import * as decisions from "./decisions";
import * as resolution from "./resolution";
import * as ratings from "./ratings";
import { Ball, Player, Team } from "./entities";
import { RNG } from "./rng";

export const KEY_TYPES = new Set([
  "goal", "shot", "save", "parry", "tackle_won", "turnover", "kickoff",
  "half_start", "foul", "yellow_card", "red_card", "penalty_awarded",
]);

export class Config {
  tickSeconds = 0.1;
  halfTicks = 27000;
  frameInterval = 5;
  decideInterval = 24;
  contestInterval = 5;
  duelEpisodeTicks = 60;
  duelGraceTicks = 25;
  carryLogInterval = 10;
  constructor(over: Partial<Config> = {}) {
    Object.assign(this, over);
  }
  toDict(): Record<string, number> {
    return {
      tickSeconds: this.tickSeconds, halfTicks: this.halfTicks,
      frameInterval: this.frameInterval, decideInterval: this.decideInterval,
      contestInterval: this.contestInterval, duelEpisodeTicks: this.duelEpisodeTicks,
      duelGraceTicks: this.duelGraceTicks, carryLogInterval: this.carryLogInterval,
    };
  }
}

type Ev = Record<string, unknown>;

export class MatchState {
  teams: [Team, Team];
  ball: Ball;
  rng: RNG;
  cfg: Config;
  tick = 0;
  half = 1;
  score: Record<string, number> = {};
  eventsGeneral: Ev[] = [];
  eventsKey: Ev[] = [];
  frames: Ev[] = [];
  stats: Record<string, Record<string, number>> = {};
  possessionTicks: Record<string, number> = {};
  pendingShot: Record<string, unknown> | null = null;
  prevOwner: string | null = null;
  carrierIntent = "hold";
  carrierIntentPid: string | null = null;
  lastPass: Map<string, [string, number]> = new Map();
  duelCooldown: Map<string, number> = new Map();
  carryStart: { pid: string; pos: V2 } | null = null;
  lastDecideTick = -999;
  lastContestTick = -999;
  lastCarryLog = -999;

  constructor(teams: [Team, Team], ball: Ball, rng: RNG, cfg: Config) {
    this.teams = teams;
    this.ball = ball;
    this.rng = rng;
    this.cfg = cfg;
  }

  player(pid: string): Player {
    for (const t of this.teams) for (const p of t.players) if (p.pid === pid) return p;
    throw new Error(`no player ${pid}`);
  }
  teamOf(pid: string): Team {
    for (const t of this.teams) if (t.players.some((p) => p.pid === pid)) return t;
    throw new Error(`no team for ${pid}`);
  }
  opponentsOf(team: Team): Team {
    return team === this.teams[0] ? this.teams[1] : this.teams[0];
  }
  bench(player: Player): void {
    player.sentOff = true;
    player.pos = [pitch.LENGTH / 2.0, 0.2];
    player.vel = [0, 0];
  }
  clock(): number {
    return Math.round(this.tick * this.cfg.tickSeconds * 10) / 10;
  }
  log(etype: string, actor: string | null = null, kw: Ev = {}): void {
    const ev: Ev = { t: this.clock(), tick: this.tick, half: this.half, type: etype, actor, ...kw };
    if (actor) ev.team = this.teamOf(actor).teamId;
    this.eventsGeneral.push(ev);
    if (KEY_TYPES.has(etype)) this.eventsKey.push(ev);
  }
  bump(pid: string, key: string, amount = 1.0): void {
    const s = this.stats[pid];
    s[key] = (s[key] ?? 0) + amount;
  }
}

function initState(teamA: Team, teamB: Team, cfg: Config, seed: number): MatchState {
  teamA.attackingRight = true;
  teamB.attackingRight = false;
  const st = new MatchState([teamA, teamB], new Ball([pitch.CENTER[0], pitch.CENTER[1]]), new RNG(seed), cfg);
  st.score = { [teamA.teamId]: 0, [teamB.teamId]: 0 };
  st.possessionTicks = { [teamA.teamId]: 0, [teamB.teamId]: 0 };
  for (const t of st.teams) for (const p of t.players) st.stats[p.pid] = {};
  return st;
}

function minBy<T>(arr: T[], key: (x: T) => number): T {
  let best = arr[0];
  for (const x of arr) if (key(x) < key(best)) best = x;
  return best;
}
function maxBy<T>(arr: T[], key: (x: T) => number): T {
  let best = arr[0];
  for (const x of arr) if (key(x) > key(best)) best = x;
  return best;
}

function doKickoff(st: MatchState, kicking: Team, reason: string): void {
  const other = st.opponentsOf(kicking);
  tactics.kickoffPositions(kicking, true);
  tactics.kickoffPositions(other, false);
  const outfield = kicking.active().filter((p) => !p.isGk);
  const taker = minBy(outfield, (p) => pitch.dist(p.pos, pitch.CENTER));
  st.ball = new Ball([pitch.CENTER[0], pitch.CENTER[1]], taker.pid);
  st.pendingShot = null;
  st.lastDecideTick = st.tick;
  st.log("kickoff", taker.pid, { reason, loc: [Math.round(pitch.CENTER[0] * 100) / 100, Math.round(pitch.CENTER[1] * 100) / 100] });
}

function restartPossession(st: MatchState, toTeam: Team, at: V2, reason: string): void {
  const spot = pitch.clampToPitch(at, 1.0);
  const taker = minBy(toTeam.active(), (p) => pitch.dist(p.pos, spot));
  taker.pos = [spot[0], spot[1]];
  st.ball = new Ball([spot[0], spot[1]], taker.pid);
  st.log("restart", taker.pid, { reason, loc: [Math.round(spot[0] * 100) / 100, Math.round(spot[1] * 100) / 100] });
}

function handleOutOfBounds(st: MatchState): void {
  const last = st.ball.flightFrom;
  const lastTeam = last ? st.teamOf(last) : st.teams[0];
  const toTeam = st.opponentsOf(lastTeam);
  st.log("out_of_bounds", last);
  restartPossession(st, toTeam, st.ball.pos, "out_of_bounds");
}

function finishShot(st: MatchState): void {
  const ps = st.pendingShot!;
  st.pendingShot = null;
  const shooter = st.player(ps.shooter as string);
  const sTeam = st.teamOf(shooter.pid);
  const dTeam = st.opponentsOf(sTeam);
  const gk = dTeam.gk();
  if (ps.outcome === "goal") {
    st.score[sTeam.teamId] += 1;
    st.bump(shooter.pid, "goals");
    ratings.adjust(shooter, "goal");
    ratings.adjust(gk, "goal_conceded_gk");
    st.bump(gk.pid, "goals_conceded");
    let assist: string | null = null;
    if (!ps.penalty) {
      const rec = st.lastPass.get(shooter.pid);
      if (rec && st.tick - rec[1] <= 100) {
        assist = rec[0];
        st.bump(assist, "assists");
        ratings.adjust(st.player(assist), "assist");
      }
    }
    st.log("goal", shooter.pid, { xg: ps.xg, assist, score: { ...st.score } });
    doKickoff(st, dTeam, "goal");
  } else if (ps.outcome === "save") {
    st.bump(gk.pid, "saves");
    ratings.adjust(gk, "save");
    st.log("save", gk.pid, { shooter: shooter.pid, xg: ps.xg });
    st.ball = new Ball([gk.pos[0], gk.pos[1]], gk.pid);
  } else if (ps.outcome === "parry") {
    st.bump(gk.pid, "saves");
    ratings.adjust(gk, "save", 0.7);
    st.log("parry", gk.pid, { shooter: shooter.pid, xg: ps.xg });
    let drop = add(gk.pos, scale(pitch.normDir(gk.pos, pitch.CENTER), 4.0));
    drop = add(drop, st.rng.normal2(0.0, 2.0));
    st.ball = new Ball(pitch.clampToPitch(drop, 0.5));
  } else {
    st.log("shot_off_target_result", shooter.pid);
    const spot: V2 = [dTeam.attackingRight ? 5.5 : pitch.LENGTH - 5.5, pitch.WIDTH / 2.0];
    gk.pos = [spot[0], spot[1]];
    st.ball = new Ball([spot[0], spot[1]], gk.pid);
  }
}

function startCarry(st: MatchState, player: Player): void {
  st.carryStart = { pid: player.pid, pos: [player.pos[0], player.pos[1]] };
}
function endCarry(st: MatchState, player: Player): void {
  const cs = st.carryStart;
  st.carryStart = null;
  if (!cs || cs.pid !== player.pid) return;
  const team = st.teamOf(player.pid);
  const sign = team.attackingRight ? 1.0 : -1.0;
  const advance = sign * (player.pos[0] - cs.pos[0]);
  if (advance >= 10.0) st.bump(player.pid, "progressive_carries");
}

function handleFoul(st: MatchState, offender: Player, victim: Player): void {
  const vTeam = st.teamOf(victim.pid);
  const oTeam = st.teamOf(offender.pid);
  const spot: V2 = [victim.pos[0], victim.pos[1]];
  st.bump(offender.pid, "fouls");
  st.bump(victim.pid, "fouls_won");
  ratings.adjust(offender, "foul");
  st.log("foul", offender.pid, { victim: victim.pid, loc: [Math.round(spot[0] * 100) / 100, Math.round(spot[1] * 100) / 100] });

  const rng = st.rng;
  const goal = pitch.goalCenter(vTeam.attackingRight);
  const dangerous = pitch.dist(spot, goal) < 20.0;
  const aggr = offender.attrs.aggression / 100.0;
  const pYellow = 0.06 + 0.1 * aggr + (dangerous ? 0.1 : 0.0);
  const pStraightRed = 0.004 * aggr;
  const r = rng.random();
  if (r < pStraightRed && !offender.isGk) {
    offender.yellowCards = 2;
    st.bump(offender.pid, "red_cards");
    ratings.adjust(offender, "red_card");
    st.log("red_card", offender.pid, { straight: true });
    st.bench(offender);
  } else if (r < pYellow) {
    offender.yellowCards += 1;
    st.bump(offender.pid, "yellow_cards");
    ratings.adjust(offender, "yellow_card");
    st.log("yellow_card", offender.pid);
    if (offender.yellowCards >= 2 && !offender.isGk) {
      st.bump(offender.pid, "red_cards");
      ratings.adjust(offender, "red_card");
      st.log("red_card", offender.pid, { second_yellow: true });
      st.bench(offender);
    }
  }

  const goalAtRight = !oTeam.attackingRight;
  if (pitch.inPenaltyArea(spot, goalAtRight)) {
    st.log("penalty_awarded", victim.pid);
    resolvePenalty(st, vTeam, oTeam, goalAtRight);
  } else {
    restartPossession(st, vTeam, spot, "free_kick");
  }
}

function resolvePenalty(st: MatchState, attackers: Team, defenders: Team, goalAtRight: boolean): void {
  const rng = st.rng;
  const taker = maxBy(attackers.active(), (p) => p.attrs.finishing + 0.5 * p.attrs.composure);
  const gk = defenders.gk();
  const spot = pitch.penaltySpot(goalAtRight);
  taker.pos = [spot[0], spot[1]];
  const fin = (0.6 * taker.attrs.finishing + 0.4 * taker.attrs.composure) / 100.0;
  const gkQ = (0.5 * gk.attrs.shot_stopping + 0.3 * gk.attrs.reflexes + 0.2 * gk.attrs.positioning_gk) / 100.0;
  const xg = 0.76;
  const pGoal = Math.min(0.9, Math.max(0.55, 0.61 + 0.28 * fin - 0.18 * gkQ));
  st.bump(taker.pid, "shots");
  st.bump(taker.pid, "shots_on_target");
  st.bump(taker.pid, "xg", xg);
  const outcome = rng.random() < pGoal ? "goal" : "save";
  st.log("shot", taker.pid, { xg, outcome, penalty: true, loc: [Math.round(spot[0] * 100) / 100, Math.round(spot[1] * 100) / 100] });
  st.ball = new Ball([spot[0], spot[1]]);
  st.pendingShot = { shooter: taker.pid, outcome, xg, penalty: true };
  finishShot(st);
}

function stepFlight(st: MatchState): void {
  const { ball, rng } = st;
  physics.stepBall(ball, null, st.cfg.tickSeconds);

  if (st.pendingShot !== null) {
    if (!pitch.inBounds(ball.pos) || !ball.inFlight) finishShot(st);
    return;
  }
  if (!pitch.inBounds(ball.pos)) { handleOutOfBounds(st); return; }
  if (!ball.inFlight) return;

  const passerPid = ball.flightFrom;
  const passerTeam = passerPid ? st.teamOf(passerPid) : st.teams[0];
  for (const t of st.teams) {
    for (const p of t.active()) {
      if (p.pid === passerPid) continue;
      if (pitch.dist(p.pos, ball.pos) > physics.CONTROL_RADIUS) continue;
      const intended = p.pid === ball.flightTarget;
      if (resolution.tryControl(rng, p, ball, intended, intended ? t.synergy : 50.0)) {
        ball.owner = p.pid;
        ball.inFlight = false;
        ball.vel = [0, 0];
        if (t !== passerTeam) { st.bump(p.pid, "touches"); startCarry(st, p); }
        if (t === passerTeam) {
          st.bump(passerPid!, "passes_completed");
          st.bump(p.pid, "touches");
          if (ball.flightMeta.aerial) st.bump(passerPid!, "crosses_completed");
          const origin = ball.flightMeta.origin as number[] | undefined;
          if (origin) {
            const sign = t.attackingRight ? 1.0 : -1.0;
            if (sign * (p.pos[0] - origin[0]) >= 10.0) st.bump(passerPid!, "progressive_passes");
          }
          const ftX = pitch.LENGTH * (2 / 3);
          const inFt = t.attackingRight ? p.pos[0] > ftX : p.pos[0] < pitch.LENGTH - ftX;
          if (inFt) st.bump(passerPid!, "passes_final_third");
          ratings.adjust(st.player(passerPid!), "pass_completed");
          st.lastPass.set(p.pid, [passerPid!, st.tick]);
          st.log("pass_complete", passerPid, { receiver: p.pid });
          startCarry(st, p);
        } else {
          st.bump(passerPid!, "passes_failed");
          st.bump(p.pid, "interceptions");
          ratings.adjust(st.player(passerPid!), "pass_failed");
          ratings.adjust(p, "interception");
          st.log("turnover", p.pid, { kind: "interception", from_player: passerPid });
        }
        st.lastDecideTick = st.tick;
        return;
      }
    }
  }
}

function carrierTick(st: MatchState, carrier: Player): void {
  const team = st.teamOf(carrier.pid);
  const oppTeam = st.opponentsOf(team);
  const opps = oppTeam.active();
  const { cfg, rng } = st;

  const isDribbling = st.carrierIntent === "dribble" && st.carrierIntentPid === carrier.pid;
  const duelR = isDribbling ? 1.2 : 0.8;
  const close = opps.filter((o) => !o.isGk && pitch.dist(o.pos, carrier.pos) < duelR);
  const presser = close.length ? maxBy(close, (o) => o.attrs.tackling) : null;
  const pressIns = oppTeam.instructions.pressing;
  const episode = Math.max(15, Math.round(cfg.duelEpisodeTicks * (1.15 - 0.3 * pressIns / 100.0)));
  if (presser !== null &&
      st.tick - st.lastContestTick >= cfg.contestInterval &&
      st.tick - (st.duelCooldown.get(carrier.pid) ?? -9999) >= episode) {
    st.lastContestTick = st.tick;
    st.duelCooldown.set(carrier.pid, st.tick);
    const ownBoxRight = !st.teamOf(presser.pid).attackingRight;
    const caution = pitch.inPenaltyArea(carrier.pos, ownBoxRight) ? 0.15 : 1.0;
    const duel = resolution.contestDispossession(rng, presser, carrier, caution);
    st.bump(presser.pid, "duels");
    st.bump(carrier.pid, "duels");
    if (duel === "won") {
      endCarry(st, carrier);
      st.ball.owner = presser.pid;
      st.bump(presser.pid, "tackles_won");
      st.bump(presser.pid, "duels_won");
      st.bump(carrier.pid, "dispossessed");
      ratings.adjust(presser, "tackle_won");
      ratings.adjust(carrier, "dispossessed");
      st.log("tackle_won", presser.pid, { victim: carrier.pid });
      st.lastDecideTick = st.tick;
      return;
    }
    if (duel === "foul") { endCarry(st, carrier); handleFoul(st, presser, carrier); return; }
    st.bump(carrier.pid, "duels_won");
    st.bump(carrier.pid, "dribbles_completed");
  }

  const tempo = team.instructions.tempo;
  const effDecide = Math.max(3, Math.round(cfg.decideInterval * (1.15 - 0.3 * tempo / 100.0)));
  if (st.tick - st.lastDecideTick < effDecide) {
    if (st.carrierIntent === "dribble" && st.carrierIntentPid === carrier.pid) {
      const tgt = decisions.dribbleTarget(carrier, team, opps);
      const jockeyed = opps.some((o) => !o.isGk && pitch.dist(o.pos, carrier.pos) < 1.6);
      physics.movePlayerToward(carrier, tgt, cfg.tickSeconds, jockeyed ? 0.62 : 0.85);
    } else {
      const near = minBy(opps, (o) => pitch.dist(o.pos, carrier.pos));
      const away = add(carrier.pos, scale(pitch.normDir(near.pos, carrier.pos), 2.0));
      physics.movePlayerToward(carrier, pitch.clampToPitch(away, 0.5), cfg.tickSeconds, 0.35);
    }
    return;
  }

  st.lastDecideTick = st.tick;
  const choice = decisions.chooseOnBall(rng, carrier, team, opps);
  st.carrierIntent = choice.action;
  st.carrierIntentPid = carrier.pid;

  if (choice.action === "shoot") {
    endCarry(st, carrier);
    const gk = oppTeam.gk();
    const res = resolution.resolveShot(rng, carrier, gk, st.ball, opps, team.attackingRight);
    st.bump(carrier.pid, "shots");
    st.bump(carrier.pid, "touches");
    st.bump(carrier.pid, "xg", res.xg as number);
    const inBox = pitch.inPenaltyArea(carrier.pos, team.attackingRight);
    st.bump(carrier.pid, inBox ? "shots_inside_box" : "shots_outside_box");
    if ((res.xg as number) >= 0.3) st.bump(carrier.pid, "big_chances");
    if (["goal", "save", "parry"].includes(res.outcome as string)) st.bump(gk.pid, "xg_faced", res.xg as number);
    const rec = st.lastPass.get(carrier.pid);
    if (rec && st.tick - rec[1] <= 100) { st.bump(rec[0], "key_passes"); ratings.adjust(st.player(rec[0]), "key_pass"); }
    const on = ["goal", "save", "parry"].includes(res.outcome as string);
    if (on) st.bump(carrier.pid, "shots_on_target");
    ratings.adjust(carrier, on ? "shot_on_target" : "shot_off_target");
    st.log("shot", carrier.pid, { xg: res.xg, outcome: res.outcome, loc: [Math.round(carrier.pos[0] * 100) / 100, Math.round(carrier.pos[1] * 100) / 100] });
    st.pendingShot = { shooter: carrier.pid, ...res };
  } else if (choice.action === "pass" && choice.target !== null) {
    endCarry(st, carrier);
    const meta = resolution.executePass(rng, carrier, choice.target, st.ball, opps, team.attackingRight);
    st.ball.flightMeta.origin = [carrier.pos[0], carrier.pos[1]];
    st.bump(carrier.pid, "passes_attempted");
    st.bump(carrier.pid, "touches");
    if (meta.cross) st.bump(carrier.pid, "crosses");
    st.log("pass", carrier.pid, { target: choice.target.pid, ...meta });
  } else {
    const tgt = decisions.dribbleTarget(carrier, team, opps);
    physics.movePlayerToward(carrier, tgt, cfg.tickSeconds, 0.85);
    if (st.tick - st.lastCarryLog >= cfg.carryLogInterval) {
      st.lastCarryLog = st.tick;
      st.log("carry", carrier.pid, { loc: [Math.round(carrier.pos[0] * 100) / 100, Math.round(carrier.pos[1] * 100) / 100] });
    }
  }
}

function offBallMovement(st: MatchState, carrier: Player | null): void {
  const { ball, cfg } = st;
  const loose = carrier === null && !ball.inFlight;
  const flightTarget = ball.inFlight ? ball.flightTarget : null;

  let possTeam: Team | null = null;
  if (carrier !== null) possTeam = st.teamOf(carrier.pid);
  else if (ball.inFlight && ball.flightFrom) possTeam = st.teamOf(ball.flightFrom);

  for (const team of st.teams) {
    const inPoss = possTeam === team;
    let chasers = new Set<string>();
    let pressers = new Set<string>();
    let marks: Record<string, string> = {};
    if (loose) {
      chasers = decisions.pickChasers(team.active(), ball.pos);
    } else if (possTeam !== null && !inPoss) {
      const focus = carrier !== null ? carrier.pos : ball.pos;
      const pressIns = team.instructions.pressing;
      const nPress = pressIns < 34 ? 1 : pressIns < 67 ? 2 : 3;
      pressers = decisions.pickPressers(team.active(), focus, nPress);
      const og = pitch.ownGoalCenter(team.attackingRight);
      const exclude = carrier !== null ? carrier.pid : null;
      const threats = possTeam.active().filter((q) => q.pid !== exclude && !q.isGk && pitch.dist(q.pos, og) < 35.0);
      const markersPool = team.active().filter((p) => !p.isGk && !pressers.has(p.pid));
      marks = decisions.assignMarkers(markersPool, threats, og);
    }

    const gk = team.gk();
    const ownGoal = pitch.ownGoalCenter(team.attackingRight);
    const claimR = 6.0 + 5.0 * (gk.attrs.command_of_area / 100.0);
    const gkClaims = ball.inFlight && !inPoss && pitch.dist(ball.pos, ownGoal) < 14.0 && pitch.dist(gk.pos, ball.pos) < claimR;

    for (const p of team.active()) {
      if (carrier !== null && p.pid === carrier.pid) continue;
      if (p.isGk && gkClaims) {
        physics.movePlayerToward(p, ball.pos, cfg.tickSeconds);
      } else if (p.pid === flightTarget) {
        const meet = add(ball.pos, scale(ball.vel, 0.3));
        physics.movePlayerToward(p, meet, cfg.tickSeconds);
      } else if (ball.inFlight && !p.isGk && resolution.canReachFlight(p, ball) && pitch.dist(p.pos, ball.pos) < 6.0) {
        physics.movePlayerToward(p, ball.pos, cfg.tickSeconds);
      } else if (chasers.has(p.pid)) {
        physics.movePlayerToward(p, ball.pos, cfg.tickSeconds);
      } else if (!inPoss && carrier !== null && !p.isGk &&
                 pitch.dist(p.pos, carrier.pos) < 6.5 + 3.0 * (team.instructions.pressing / 100.0)) {
        const tgt = add(add(carrier.pos, scale(carrier.vel, 0.6)), scale(pitch.normDir(carrier.pos, ownGoal), 1.0));
        physics.movePlayerToward(p, tgt, cfg.tickSeconds);
        p.staminaLevel = Math.max(0.5, p.staminaLevel - 0.00004 * (team.instructions.pressing / 100.0));
      } else if (pressers.has(p.pid)) {
        const tgt = carrier !== null ? decisions.pressPoint(p, carrier, ownGoal) : add(ball.pos, scale(ball.vel, 0.4));
        physics.movePlayerToward(p, tgt, cfg.tickSeconds, 0.92);
      } else if (p.pid in marks) {
        const threat = st.player(marks[p.pid]);
        physics.movePlayerToward(p, decisions.markingPoint(threat, ownGoal, p), cfg.tickSeconds, 0.88);
      } else {
        const tgt = tactics.targetPosition(p, team, ball.pos, inPoss);
        const dTgt = pitch.dist(p.pos, tgt);
        if (dTgt < 2.2) {
          physics.holdPosition(p, cfg.tickSeconds);
        } else {
          const sc = inPoss ? (dTgt < 14.0 ? 0.62 : 0.78) : (dTgt < 14.0 ? 0.48 : 0.72);
          physics.movePlayerToward(p, tgt, cfg.tickSeconds, sc);
        }
      }
    }
  }
}

function tryLoosePickup(st: MatchState): void {
  const { ball, rng } = st;
  const cands = st.teams.flatMap((t) => t.active())
    .filter((p) => pitch.dist(p.pos, ball.pos) < physics.CONTROL_RADIUS)
    .sort((a, b) => pitch.dist(a.pos, ball.pos) - pitch.dist(b.pos, ball.pos));
  for (const p of cands) {
    if (resolution.tryControl(rng, p, ball, true)) {
      ball.owner = p.pid;
      ball.inFlight = false;
      ball.vel = [0, 0];
      st.bump(p.pid, "touches");
      startCarry(st, p);
      st.log("pickup", p.pid);
      st.lastDecideTick = st.tick;
      return;
    }
  }
}

function frame(st: MatchState): Ev {
  const players: Record<string, [number, number]> = {};
  for (const t of st.teams) for (const p of t.players)
    players[p.pid] = [Math.round(p.pos[0] * 100) / 100, Math.round(p.pos[1] * 100) / 100];
  return {
    tick: st.tick, t: st.clock(),
    ball: [Math.round(st.ball.pos[0] * 100) / 100, Math.round(st.ball.pos[1] * 100) / 100],
    players, owner: st.ball.owner,
  };
}

export function runMatch(teamA: Team, teamB: Team, cfg: Config, seed: number): MatchState {
  const st = initState(teamA, teamB, cfg, seed);
  const kickoffFirst = st.rng.random() < 0.5 ? st.teams[0] : st.teams[1];

  for (const half of [1, 2]) {
    st.half = half;
    if (half === 2) {
      for (const t of st.teams) {
        t.attackingRight = !t.attackingRight;
        for (const p of t.players) p.staminaLevel = Math.min(1.0, p.staminaLevel + 0.15);
      }
    }
    const kicking = half === 1 ? kickoffFirst : st.opponentsOf(kickoffFirst);
    st.log("half_start", null, { half });
    doKickoff(st, kicking, `half_${half}_start`);

    const endTick = half * cfg.halfTicks;
    while (st.tick < endTick) {
      let carrier = st.ball.owner ? st.player(st.ball.owner) : null;
      if (st.ball.owner !== st.prevOwner) {
        st.prevOwner = st.ball.owner;
        if (st.ball.owner !== null)
          st.duelCooldown.set(st.ball.owner, st.tick - cfg.duelEpisodeTicks + cfg.duelGraceTicks);
      }

      if (carrier !== null) {
        st.possessionTicks[st.teamOf(carrier.pid).teamId] += 1;
        carrierTick(st, carrier);
        carrier = st.ball.owner ? st.player(st.ball.owner) : null;
      } else if (st.ball.inFlight || len(st.ball.vel) > 0.05) {
        stepFlight(st);
        carrier = st.ball.owner ? st.player(st.ball.owner) : null;
      } else {
        tryLoosePickup(st);
        carrier = st.ball.owner ? st.player(st.ball.owner) : null;
        if (carrier === null && !pitch.inBounds(st.ball.pos)) {
          handleOutOfBounds(st);
          carrier = st.ball.owner ? st.player(st.ball.owner) : null;
        }
      }

      offBallMovement(st, carrier);
      physics.stepBall(st.ball, carrier, cfg.tickSeconds);

      for (const t of st.teams) {
        for (const p of t.active()) {
          p.pos = pitch.clampToPitch(p.pos, 0.2);
          physics.drainStamina(p, cfg.tickSeconds);
          st.bump(p.pid, "distance", len(p.vel) * cfg.tickSeconds);
        }
      }

      if (st.tick % cfg.frameInterval === 0) st.frames.push(frame(st));
      st.tick += 1;
    }
  }

  for (const t of st.teams) for (const p of t.players) ratings.finalize(p, st.stats[p.pid]);
  return st;
}
