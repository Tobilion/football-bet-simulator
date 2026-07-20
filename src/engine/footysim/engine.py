"""Tick-loop orchestration: the match engine.

State machine per tick: ball is OWNED (carrier acts), IN FLIGHT (pass/shot
resolves against geometry), or LOOSE (nearest players chase). Everything is
recorded into the two-tier event log, frames, and live box score.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from . import decisions, physics, pitch, ratings, resolution, tactics
from .entities import Ball, Player, Team

KEY_TYPES = {"goal", "shot", "save", "parry", "tackle_won", "turnover",
             "kickoff", "half_start", "foul", "yellow_card", "red_card",
             "penalty_awarded"}


@dataclass
class Config:
    tick_seconds: float = 0.1
    half_ticks: int = 27_000          # 45 min per half at 0.1 s
    frame_interval: int = 5           # record frames every N ticks (0.5 s)
    decide_interval: int = 24          # carrier re-decides every N ticks
    contest_interval: int = 5       # min gap between any two duels
    duel_episode_ticks: int = 60    # gap between duels vs same carrier
    duel_grace_ticks: int = 25      # untouchable window on gaining the ball         # dispossession contests every N ticks
    carry_log_interval: int = 10      # log carry progress every N ticks

    def to_dict(self) -> dict:
        return self.__dict__.copy()


@dataclass
class MatchState:
    teams: tuple[Team, Team]
    ball: Ball
    rng: np.random.Generator
    cfg: Config
    tick: int = 0
    half: int = 1
    score: dict[str, int] = field(default_factory=dict)
    events_general: list[dict] = field(default_factory=list)
    events_key: list[dict] = field(default_factory=list)
    frames: list[dict] = field(default_factory=list)
    stats: dict[str, dict] = field(default_factory=dict)      # pid -> counters
    possession_ticks: dict[str, int] = field(default_factory=dict)
    pending_shot: dict | None = None
    prev_owner: str | None = None
    carrier_intent: str = "hold"
    carrier_intent_pid: str | None = None
    last_pass: dict = field(default_factory=dict)   # receiver_pid -> (passer, tick)
    duel_cooldown: dict = field(default_factory=dict)  # (def,car) -> tick of last duel
    carry_start: dict | None = None                 # {"pid":, "pos":} for carries
    last_decide_tick: int = -999
    last_contest_tick: int = -999
    last_carry_log: int = -999

    # ---------------------------------------------------------- helpers
    def player(self, pid: str) -> Player:
        for t in self.teams:
            for p in t.players:
                if p.pid == pid:
                    return p
        raise KeyError(pid)

    def team_of(self, pid: str) -> Team:
        for t in self.teams:
            if any(p.pid == pid for p in t.players):
                return t
        raise KeyError(pid)

    def opponents_of(self, team: Team) -> Team:
        return self.teams[1] if team is self.teams[0] else self.teams[0]

    def bench(self, player: Player) -> None:
        """Remove a sent-off player from play."""
        player.sent_off = True
        player.pos = np.array([pitch.LENGTH / 2.0, 0.2])
        player.vel = np.zeros(2)

    def clock(self) -> float:
        return round(self.tick * self.cfg.tick_seconds, 1)

    def log(self, etype: str, actor: str | None = None, **kw) -> None:
        ev = {"t": self.clock(), "tick": self.tick, "half": self.half,
              "type": etype, "actor": actor, **kw}
        if actor:
            ev["team"] = self.team_of(actor).team_id
        self.events_general.append(ev)
        if etype in KEY_TYPES:
            self.events_key.append(ev)

    def bump(self, pid: str, key: str, amount: float = 1.0) -> None:
        self.stats[pid][key] = self.stats[pid].get(key, 0) + amount


# ================================================================ setup

def init_state(team_a: Team, team_b: Team, cfg: Config, seed: int) -> MatchState:
    team_a.attacking_right = True
    team_b.attacking_right = False
    st = MatchState(teams=(team_a, team_b), ball=Ball(pos=pitch.CENTER.copy()),
                    rng=np.random.default_rng(seed), cfg=cfg)
    st.score = {team_a.team_id: 0, team_b.team_id: 0}
    st.possession_ticks = {team_a.team_id: 0, team_b.team_id: 0}
    for t in st.teams:
        for p in t.players:
            st.stats[p.pid] = {}
    return st


def do_kickoff(st: MatchState, kicking: Team, reason: str) -> None:
    other = st.opponents_of(kicking)
    tactics.kickoff_positions(kicking, has_kickoff=True)
    tactics.kickoff_positions(other, has_kickoff=False)
    taker = min((p for p in kicking.active() if not p.is_gk),
                key=lambda p: pitch.dist(p.pos, pitch.CENTER))
    st.ball = Ball(pos=pitch.CENTER.copy(), owner=taker.pid)
    st.pending_shot = None
    st.last_decide_tick = st.tick  # brief hold before first decision
    st.log("kickoff", actor=taker.pid, reason=reason,
           loc=[round(float(x), 2) for x in pitch.CENTER])


# ============================================================ tick logic

def _restart_possession(st: MatchState, to_team: Team, at: np.ndarray, reason: str) -> None:
    """Simplified throw-in / goal-kick: nearest player of to_team takes over."""
    spot = pitch.clamp_to_pitch(at, margin=1.0)
    taker = min(to_team.active(), key=lambda p: pitch.dist(p.pos, spot))
    taker.pos = spot.copy()
    st.ball = Ball(pos=spot.copy(), owner=taker.pid)
    st.log("restart", actor=taker.pid, reason=reason,
           loc=[round(float(spot[0]), 2), round(float(spot[1]), 2)])


def _handle_out_of_bounds(st: MatchState) -> None:
    last = st.ball.flight_from
    last_team = st.team_of(last) if last else st.teams[0]
    to_team = st.opponents_of(last_team)
    st.log("out_of_bounds", actor=last)
    _restart_possession(st, to_team, st.ball.pos, "out_of_bounds")


def _finish_shot(st: MatchState) -> None:
    """Apply the pre-resolved shot outcome once the ball reaches the goal area."""
    ps = st.pending_shot
    st.pending_shot = None
    shooter = st.player(ps["shooter"])
    s_team = st.team_of(shooter.pid)
    d_team = st.opponents_of(s_team)
    gk = d_team.gk()
    if ps["outcome"] == "goal":
        st.score[s_team.team_id] += 1
        st.bump(shooter.pid, "goals")
        ratings.adjust(shooter, "goal")
        ratings.adjust(gk, "goal_conceded_gk")
        st.bump(gk.pid, "goals_conceded")
        assist = None
        if not ps.get("penalty"):
            rec = st.last_pass.get(shooter.pid)
            if rec and st.tick - rec[1] <= 100:      # within 10 s of receiving
                assist = rec[0]
                st.bump(assist, "assists")
                ratings.adjust(st.player(assist), "assist")
        st.log("goal", actor=shooter.pid, xg=ps["xg"], assist=assist,
               score=dict(st.score))
        do_kickoff(st, d_team, reason="goal")
    elif ps["outcome"] == "save":
        st.bump(gk.pid, "saves")
        ratings.adjust(gk, "save")
        st.log("save", actor=gk.pid, shooter=shooter.pid, xg=ps["xg"])
        st.ball = Ball(pos=gk.pos.copy(), owner=gk.pid)
    elif ps["outcome"] == "parry":
        st.bump(gk.pid, "saves")
        ratings.adjust(gk, "save", scale=0.7)
        st.log("parry", actor=gk.pid, shooter=shooter.pid, xg=ps["xg"])
        # spilled: loose ball in front of goal
        drop = gk.pos + pitch.norm_dir(gk.pos, pitch.CENTER) * 4.0
        drop = drop + st.rng.normal(0.0, 2.0, size=2)
        st.ball = Ball(pos=pitch.clamp_to_pitch(drop, 0.5))
    else:  # off target -> goal kick
        st.log("shot_off_target_result", actor=shooter.pid)
        spot = np.array([5.5 if d_team.attacking_right else pitch.LENGTH - 5.5,
                         pitch.WIDTH / 2.0])
        gk.pos = spot.copy()
        st.ball = Ball(pos=spot.copy(), owner=gk.pid)


def _start_carry(st: MatchState, player: Player) -> None:
    st.carry_start = {"pid": player.pid, "pos": player.pos.copy()}


def _end_carry(st: MatchState, player: Player) -> None:
    """Close a carry; credit progressive carries (>=10 m toward goal)."""
    cs = st.carry_start
    st.carry_start = None
    if not cs or cs["pid"] != player.pid:
        return
    team = st.team_of(player.pid)
    sign = 1.0 if team.attacking_right else -1.0
    advance = sign * (player.pos[0] - cs["pos"][0])
    if advance >= 10.0:
        st.bump(player.pid, "progressive_carries")


def _handle_foul(st: MatchState, offender: Player, victim: Player) -> None:
    v_team = st.team_of(victim.pid)
    o_team = st.team_of(offender.pid)
    spot = victim.pos.copy()
    st.bump(offender.pid, "fouls")
    st.bump(victim.pid, "fouls_won")
    ratings.adjust(offender, "foul")
    st.log("foul", actor=offender.pid, victim=victim.pid,
           loc=[round(float(spot[0]), 2), round(float(spot[1]), 2)])

    # cards: aggression + how dangerous the stopped attack was
    rng = st.rng
    goal = pitch.goal_center(v_team.attacking_right)
    dangerous = pitch.dist(spot, goal) < 20.0
    aggr = offender.attrs.aggression / 100.0
    p_yellow = 0.06 + 0.10 * aggr + (0.10 if dangerous else 0.0)
    p_straight_red = 0.004 * aggr
    r = rng.random()
    if r < p_straight_red and not offender.is_gk:
        offender.yellow_cards = 2
        st.bump(offender.pid, "red_cards")
        ratings.adjust(offender, "red_card")
        st.log("red_card", actor=offender.pid, straight=True)
        st.bench(offender)
    elif r < p_yellow:
        offender.yellow_cards += 1
        st.bump(offender.pid, "yellow_cards")
        ratings.adjust(offender, "yellow_card")
        st.log("yellow_card", actor=offender.pid)
        if offender.yellow_cards >= 2 and not offender.is_gk:
            st.bump(offender.pid, "red_cards")
            ratings.adjust(offender, "red_card")
            st.log("red_card", actor=offender.pid, second_yellow=True)
            st.bench(offender)

    # in the offender's own box -> penalty; otherwise free kick at the spot
    goal_at_right = not o_team.attacking_right   # the goal o_team defends
    if pitch.in_penalty_area(spot, goal_at_right):
        st.log("penalty_awarded", actor=victim.pid)
        _resolve_penalty(st, v_team, o_team, goal_at_right)
    else:
        _restart_possession(st, v_team, spot, "free_kick")


def _resolve_penalty(st: MatchState, attackers: Team, defenders: Team,
                     goal_at_right: bool) -> None:
    """Penalty kick: best finisher vs GK from the spot. Positions are not
    re-choreographed (Phase 2 simplification); the outcome and restart are."""
    rng = st.rng
    taker = max(attackers.active(),
                key=lambda p: p.attrs.finishing + 0.5 * p.attrs.composure)
    gk = defenders.gk()
    spot = pitch.penalty_spot(goal_at_right)
    taker.pos = spot.copy()
    fin = (0.6 * taker.attrs.finishing + 0.4 * taker.attrs.composure) / 100.0
    gk_q = (0.5 * gk.attrs.shot_stopping + 0.3 * gk.attrs.reflexes
            + 0.2 * gk.attrs.positioning_gk) / 100.0
    xg = 0.76
    p_goal = float(np.clip(0.61 + 0.28 * fin - 0.18 * gk_q, 0.55, 0.90))
    st.bump(taker.pid, "shots")
    st.bump(taker.pid, "shots_on_target")
    st.bump(taker.pid, "xg", xg)
    outcome = "goal" if rng.random() < p_goal else "save"
    st.log("shot", actor=taker.pid, xg=xg, outcome=outcome, penalty=True,
           loc=[round(float(spot[0]), 2), round(float(spot[1]), 2)])
    st.ball = Ball(pos=spot.copy())
    st.pending_shot = {"shooter": taker.pid, "outcome": outcome,
                       "xg": xg, "penalty": True}
    _finish_shot(st)


def _step_flight(st: MatchState) -> None:
    ball, cfg, rng = st.ball, st.cfg, st.rng
    physics.step_ball(ball, None, cfg.tick_seconds)

    # shots: wait until ball nears goal line / leaves pitch, then apply outcome
    if st.pending_shot is not None:
        if not pitch.in_bounds(ball.pos) or not ball.in_flight:
            _finish_shot(st)
        return

    if not pitch.in_bounds(ball.pos):
        _handle_out_of_bounds(st)
        return

    if not ball.in_flight:   # pass rolled dead -> loose ball
        return

    passer_pid = ball.flight_from
    passer_team = st.team_of(passer_pid) if passer_pid else st.teams[0]
    for t in st.teams:
        for p in t.active():
            if p.pid == passer_pid:
                continue
            if pitch.dist(p.pos, ball.pos) > physics.CONTROL_RADIUS:
                continue
            intended = p.pid == ball.flight_target
            if resolution.try_control(rng, p, ball, intended,
                                      synergy=t.synergy if intended else 50.0):
                ball.owner = p.pid
                ball.in_flight = False
                ball.vel = np.zeros(2)
                if t is not passer_team:
                    st.bump(p.pid, "touches")
                    _start_carry(st, p)
                if t is passer_team:
                    st.bump(passer_pid, "passes_completed")
                    st.bump(p.pid, "touches")
                    if ball.flight_meta.get("aerial"):
                        st.bump(passer_pid, "crosses_completed")
                    origin = ball.flight_meta.get("origin")
                    if origin is not None:
                        sign = 1.0 if t.attacking_right else -1.0
                        if sign * (p.pos[0] - origin[0]) >= 10.0:
                            st.bump(passer_pid, "progressive_passes")
                    ft_x = pitch.LENGTH * (2 / 3)
                    in_ft = (p.pos[0] > ft_x if t.attacking_right
                             else p.pos[0] < pitch.LENGTH - ft_x)
                    if in_ft:
                        st.bump(passer_pid, "passes_final_third")
                    ratings.adjust(st.player(passer_pid), "pass_completed")
                    st.last_pass[p.pid] = (passer_pid, st.tick)
                    st.log("pass_complete", actor=passer_pid, receiver=p.pid)
                    _start_carry(st, p)
                else:
                    st.bump(passer_pid, "passes_failed")
                    st.bump(p.pid, "interceptions")
                    ratings.adjust(st.player(passer_pid), "pass_failed")
                    ratings.adjust(p, "interception")
                    st.log("turnover", actor=p.pid, kind="interception",
                           from_player=passer_pid)
                st.last_decide_tick = st.tick
                return


def _carrier_tick(st: MatchState, carrier: Player) -> None:
    team = st.team_of(carrier.pid)
    opp_team = st.opponents_of(team)
    opps = opp_team.active()
    cfg, rng = st.cfg, st.rng

    # dispossession contest from the best-placed nearby defender.
    # A duel only triggers when the carrier is taking his man on (dribbling)
    # or a defender has gotten properly tight; shielded possession is safe.
    is_dribbling = (st.carrier_intent == "dribble"
                    and st.carrier_intent_pid == carrier.pid)
    duel_r = 1.2 if is_dribbling else 0.8
    close = [o for o in opps if not o.is_gk
             and pitch.dist(o.pos, carrier.pos) < duel_r]
    presser = max(close, key=lambda o: o.attrs.tackling) if close else None
    press_ins = opp_team.instructions.pressing
    episode = max(15, int(round(cfg.duel_episode_ticks
                                * (1.15 - 0.3 * press_ins / 100.0))))
    if (presser is not None
            and st.tick - st.last_contest_tick >= cfg.contest_interval
            and st.tick - st.duel_cooldown.get(carrier.pid, -9999) >= episode):
        st.last_contest_tick = st.tick
        st.duel_cooldown[carrier.pid] = st.tick
        # the box the DEFENDER (presser's team) protects
        own_box_right = not st.team_of(presser.pid).attacking_right
        caution = 0.15 if pitch.in_penalty_area(carrier.pos, own_box_right) else 1.0
        duel = resolution.contest_dispossession(rng, presser, carrier,
                                                box_caution=caution)
        st.bump(presser.pid, "duels")
        st.bump(carrier.pid, "duels")
        if duel == "won":
            _end_carry(st, carrier)
            st.ball.owner = presser.pid
            st.bump(presser.pid, "tackles_won")
            st.bump(presser.pid, "duels_won")
            st.bump(carrier.pid, "dispossessed")
            ratings.adjust(presser, "tackle_won")
            ratings.adjust(carrier, "dispossessed")
            st.log("tackle_won", actor=presser.pid, victim=carrier.pid)
            st.last_decide_tick = st.tick
            return
        if duel == "foul":
            _end_carry(st, carrier)
            _handle_foul(st, presser, carrier)
            return
        # survived the challenge: beat the man
        st.bump(carrier.pid, "duels_won")
        st.bump(carrier.pid, "dribbles_completed")

    # tempo: quick teams decide sooner on the ball
    tempo = team.instructions.tempo
    eff_decide = max(3, int(round(cfg.decide_interval * (1.15 - 0.3 * tempo / 100.0))))
    if st.tick - st.last_decide_tick < eff_decide:
        if (st.carrier_intent == "dribble"
                and st.carrier_intent_pid == carrier.pid):
            tgt = decisions.dribble_target(carrier, team, opps)
            jockeyed = any(pitch.dist(o.pos, carrier.pos) < 1.6
                           for o in opps if not o.is_gk)
            physics.move_player_toward(carrier, tgt, cfg.tick_seconds,
                                       speed_scale=0.62 if jockeyed else 0.85)
        else:
            # shield: drift slowly away from the nearest opponent
            near = min(opps, key=lambda o: pitch.dist(o.pos, carrier.pos))
            away = carrier.pos + pitch.norm_dir(near.pos, carrier.pos) * 2.0
            physics.move_player_toward(carrier, pitch.clamp_to_pitch(away, 0.5),
                                       cfg.tick_seconds, speed_scale=0.35)
        return

    st.last_decide_tick = st.tick
    choice = decisions.choose_on_ball(rng, carrier, team, opps)
    st.carrier_intent = choice.action
    st.carrier_intent_pid = carrier.pid

    if choice.action == "shoot":
        _end_carry(st, carrier)
        gk = opp_team.gk()
        res = resolution.resolve_shot(rng, carrier, gk, st.ball, opps,
                                      team.attacking_right)
        st.bump(carrier.pid, "shots")
        st.bump(carrier.pid, "touches")
        st.bump(carrier.pid, "xg", res["xg"])
        in_box = pitch.in_penalty_area(carrier.pos, team.attacking_right)
        st.bump(carrier.pid, "shots_inside_box" if in_box else "shots_outside_box")
        if res["xg"] >= 0.3:
            st.bump(carrier.pid, "big_chances")
        if res["outcome"] in ("goal", "save", "parry"):
            st.bump(gk.pid, "xg_faced", res["xg"])
        rec = st.last_pass.get(carrier.pid)
        if rec and st.tick - rec[1] <= 100:
            st.bump(rec[0], "key_passes")
            ratings.adjust(st.player(rec[0]), "key_pass")
        on = res["outcome"] in ("goal", "save", "parry")
        if on:
            st.bump(carrier.pid, "shots_on_target")
        ratings.adjust(carrier, "shot_on_target" if on else "shot_off_target")
        st.log("shot", actor=carrier.pid, xg=res["xg"], outcome=res["outcome"],
               loc=[round(float(carrier.pos[0]), 2), round(float(carrier.pos[1]), 2)])
        st.pending_shot = {"shooter": carrier.pid, **res}
    elif choice.action == "pass" and choice.target is not None:
        _end_carry(st, carrier)
        meta = resolution.execute_pass(rng, carrier, choice.target, st.ball,
                                       opps, team.attacking_right)
        st.ball.flight_meta["origin"] = [float(carrier.pos[0]), float(carrier.pos[1])]
        st.bump(carrier.pid, "passes_attempted")
        st.bump(carrier.pid, "touches")
        if meta.get("cross"):
            st.bump(carrier.pid, "crosses")
        st.log("pass", actor=carrier.pid, target=choice.target.pid, **meta)
    else:
        tgt = decisions.dribble_target(carrier, team, opps)
        physics.move_player_toward(carrier, tgt, cfg.tick_seconds, speed_scale=0.85)
        if st.tick - st.last_carry_log >= cfg.carry_log_interval:
            st.last_carry_log = st.tick
            st.log("carry", actor=carrier.pid,
                   loc=[round(float(carrier.pos[0]), 2), round(float(carrier.pos[1]), 2)])


def _off_ball_movement(st: MatchState, carrier: Player | None) -> None:
    ball = st.ball
    cfg = st.cfg
    loose = carrier is None and not ball.in_flight
    flight_target = ball.flight_target if ball.in_flight else None

    # who effectively has the ball (carrier, or passer's team during flight)
    poss_team = None
    if carrier is not None:
        poss_team = st.team_of(carrier.pid)
    elif ball.in_flight and ball.flight_from:
        poss_team = st.team_of(ball.flight_from)

    for team in st.teams:
        in_poss = poss_team is team
        chasers: set[str] = set()
        pressers: set[str] = set()
        marks: dict[str, str] = {}
        if loose:
            chasers = decisions.pick_chasers(team.active(), ball.pos)
        elif poss_team is not None and not in_poss:
            # defend: press the ball (or its landing spot) and mark runners
            focus = carrier.pos if carrier is not None else ball.pos
            press_ins = team.instructions.pressing
            n_press = 1 if press_ins < 34 else (2 if press_ins < 67 else 3)
            pressers = decisions.pick_pressers(team.active(), focus, n=n_press)
            og_ = pitch.own_goal_center(team.attacking_right)
            exclude = carrier.pid if carrier is not None else None
            threats = [q for q in poss_team.active()
                       if q.pid != exclude and not q.is_gk
                       and pitch.dist(q.pos, og_) < 35.0]
            markers_pool = [p for p in team.active()
                            if not p.is_gk and p.pid not in pressers]
            marks = decisions.assign_markers(markers_pool, threats, og_)

        gk = team.gk()
        own_goal = pitch.own_goal_center(team.attacking_right)
        claim_r = 6.0 + 5.0 * (gk.attrs.command_of_area / 100.0)
        gk_claims = (ball.in_flight and not in_poss
                     and pitch.dist(ball.pos, own_goal) < 14.0
                     and pitch.dist(gk.pos, ball.pos) < claim_r)

        for p in team.active():
            if carrier is not None and p.pid == carrier.pid:
                continue
            if p.is_gk and gk_claims:
                physics.move_player_toward(p, ball.pos, cfg.tick_seconds)
            elif p.pid == flight_target:
                # intended receiver attacks the ball's path
                meet = ball.pos + ball.vel * 0.3
                physics.move_player_toward(p, meet, cfg.tick_seconds)
            elif ball.in_flight and not p.is_gk \
                    and resolution.can_reach_flight(p, ball) \
                    and pitch.dist(p.pos, ball.pos) < 6.0:
                physics.move_player_toward(p, ball.pos, cfg.tick_seconds)
            elif p.pid in chasers:
                physics.move_player_toward(p, ball.pos, cfg.tick_seconds)
            elif (not in_poss and carrier is not None and not p.is_gk
                  and pitch.dist(p.pos, carrier.pos)
                      < 6.5 + 3.0 * (team.instructions.pressing / 100.0)):
                # engage a driving carrier: intercept his path, then jockey
                # a metre off goal-side; intense pressing engages from
                # further out and burns more energy
                tgt = (carrier.pos + carrier.vel * 0.6
                       + pitch.norm_dir(carrier.pos, own_goal) * 1.0)
                physics.move_player_toward(p, tgt, cfg.tick_seconds)
                p.stamina_level = max(
                    0.5, p.stamina_level
                    - 0.00004 * (team.instructions.pressing / 100.0))
            elif p.pid in pressers:
                if carrier is not None:
                    tgt = decisions.press_point(p, carrier, own_goal)
                else:
                    tgt = ball.pos + ball.vel * 0.4
                physics.move_player_toward(p, tgt, cfg.tick_seconds,
                                           speed_scale=0.92)
            elif p.pid in marks:
                threat = st.player(marks[p.pid])
                physics.move_player_toward(
                    p, decisions.marking_point(threat, own_goal, p),
                    cfg.tick_seconds, speed_scale=0.88)
            else:
                tgt = tactics.target_position(p, team, ball.pos, in_poss)
                d_tgt = pitch.dist(p.pos, tgt)
                if d_tgt < 2.2:
                    physics.hold_position(p, cfg.tick_seconds)
                else:
                    # support runs when in possession; jog into shape when not
                    if in_poss:
                        sc = 0.62 if d_tgt < 14.0 else 0.78
                    else:
                        sc = 0.48 if d_tgt < 14.0 else 0.72
                    physics.move_player_toward(p, tgt, cfg.tick_seconds,
                                               speed_scale=sc)


def _try_loose_pickup(st: MatchState) -> None:
    ball, rng = st.ball, st.rng
    cands = [p for t in st.teams for p in t.active()
             if pitch.dist(p.pos, ball.pos) < physics.CONTROL_RADIUS]
    cands.sort(key=lambda p: pitch.dist(p.pos, ball.pos))
    for p in cands:
        if resolution.try_control(rng, p, ball, is_intended_receiver=True):
            ball.owner = p.pid
            ball.in_flight = False
            ball.vel = np.zeros(2)
            st.bump(p.pid, "touches")
            _start_carry(st, p)
            st.log("pickup", actor=p.pid)
            st.last_decide_tick = st.tick
            return


# =============================================================== main loop

def run_match(team_a: Team, team_b: Team, cfg: Config, seed: int) -> MatchState:
    st = init_state(team_a, team_b, cfg, seed)
    kickoff_first = st.teams[0] if st.rng.random() < 0.5 else st.teams[1]

    for half in (1, 2):
        st.half = half
        if half == 2:  # swap ends, partial stamina recovery
            for t in st.teams:
                t.attacking_right = not t.attacking_right
                for p in t.players:
                    p.stamina_level = min(1.0, p.stamina_level + 0.15)
        kicking = kickoff_first if half == 1 else st.opponents_of(kickoff_first)
        st.log("half_start", half=half)
        do_kickoff(st, kicking, reason=f"half_{half}_start")

        end_tick = half * cfg.half_ticks
        while st.tick < end_tick:
            carrier = st.player(st.ball.owner) if st.ball.owner else None
            if st.ball.owner != st.prev_owner:
                st.prev_owner = st.ball.owner
                if st.ball.owner is not None:
                    # fresh carrier: brief protected window before any duel
                    st.duel_cooldown[st.ball.owner] = (
                        st.tick - cfg.duel_episode_ticks + cfg.duel_grace_ticks)

            if carrier is not None:
                st.possession_ticks[st.team_of(carrier.pid).team_id] += 1
                _carrier_tick(st, carrier)
                carrier = st.player(st.ball.owner) if st.ball.owner else None
            elif st.ball.in_flight or float(np.linalg.norm(st.ball.vel)) > 0.05:
                _step_flight(st)
                carrier = st.player(st.ball.owner) if st.ball.owner else None
            else:
                _try_loose_pickup(st)
                carrier = st.player(st.ball.owner) if st.ball.owner else None
                if carrier is None and not pitch.in_bounds(st.ball.pos):
                    _handle_out_of_bounds(st)
                    carrier = st.player(st.ball.owner) if st.ball.owner else None

            _off_ball_movement(st, carrier)
            physics.step_ball(st.ball, carrier, cfg.tick_seconds)

            for t in st.teams:
                for p in t.active():
                    p.pos = pitch.clamp_to_pitch(p.pos, margin=0.2)
                    physics.drain_stamina(p, cfg.tick_seconds)
                    st.bump(p.pid, "distance",
                            float(np.linalg.norm(p.vel)) * cfg.tick_seconds)

            if st.tick % cfg.frame_interval == 0:
                st.frames.append(_frame(st))
            st.tick += 1

    for t in st.teams:
        for p in t.players:
            ratings.finalize(p, st.stats[p.pid])
    return st


def _frame(st: MatchState) -> dict:
    return {
        "tick": st.tick,
        "t": st.clock(),
        "ball": [round(float(st.ball.pos[0]), 2), round(float(st.ball.pos[1]), 2)],
        "players": {p.pid: [round(float(p.pos[0]), 2), round(float(p.pos[1]), 2)]
                    for t in st.teams for p in t.players},
        "owner": st.ball.owner,
    }
