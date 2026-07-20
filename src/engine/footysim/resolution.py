"""Contact-point resolution: passes, control/interception, shots, xG, tackles.

Every outcome here is computed from attributes + live geometry at the moment
of contact. There are no match-level probability rolls.
"""
from __future__ import annotations

import numpy as np

from . import pitch, physics
from .entities import Ball, Player


def pressure_on(player: Player, opponents: list[Player], radius: float = 6.0) -> float:
    """0..1 pressure from nearby opponents (closest counts most)."""
    total = 0.0
    for o in opponents:
        d = pitch.dist(player.pos, o.pos)
        if d < radius:
            total += (1.0 - d / radius) ** 2
    return float(min(1.0, total))


# ---------------------------------------------------------------- passing

def is_cross(passer: Player, receiver: Player, attacking_right: bool) -> bool:
    """Wide final-third delivery into the central box area."""
    third_x = pitch.LENGTH * (2 / 3)
    px = passer.pos[0] if attacking_right else pitch.LENGTH - passer.pos[0]
    wide = passer.pos[1] < 14.0 or passer.pos[1] > pitch.WIDTH - 14.0
    goal_at_right = attacking_right
    return bool(px > third_x and wide
                and pitch.in_penalty_area(receiver.pos, goal_at_right))


def execute_pass(rng: np.random.Generator, passer: Player, receiver: Player,
                 ball: Ball, opponents: list[Player],
                 attacking_right: bool = True) -> dict:
    """Strike a pass toward the receiver's near-future position.

    Directional error grows with poor passing/vision/composure, distance and
    pressure. Wide deliveries into the box are crosses: they use the crossing
    attribute and are contested in the air (heading) on arrival.
    """
    lead = receiver.pos + receiver.vel * 0.6  # lead the runner slightly
    d = pitch.dist(passer.pos, lead)
    press = pressure_on(passer, opponents)
    cross = is_cross(passer, receiver, attacking_right)

    if cross:
        skill = (0.60 * passer.eff("crossing") + 0.20 * passer.eff("vision")
                 + 0.20 * passer.eff("composure")) / 100.0
    else:
        skill = (0.55 * passer.eff("passing") + 0.25 * passer.eff("vision")
                 + 0.20 * passer.eff("composure")) / 100.0
    # error std in radians: great passers ~1deg short range; grows with dist+pressure
    sigma = np.deg2rad(0.8 + (1.0 - skill) * 4.0) * (1.0 + d / 70.0) * (1.0 + 0.5 * press)
    ang_err = float(rng.normal(0.0, sigma))
    # over/underhit: proportional distance error
    dist_err = float(rng.normal(0.0, 0.03 + (1.0 - skill) * 0.06 + 0.03 * press))

    direction = pitch.norm_dir(passer.pos, lead)
    cos_e, sin_e = np.cos(ang_err), np.sin(ang_err)
    direction = np.array([direction[0] * cos_e - direction[1] * sin_e,
                          direction[0] * sin_e + direction[1] * cos_e])
    travel = max(2.0, d * (1.0 + dist_err))

    physics.strike_ball(ball, direction, travel, "cross" if cross else "pass",
                        passer.pid, receiver.pid,
                        meta={"aerial": cross})
    return {"distance": round(d, 1), "pressure": round(press, 2),
            "cross": cross}


# ------------------------------------------------- control / interception

def try_control(rng: np.random.Generator, player: Player, ball: Ball,
                is_intended_receiver: bool, synergy: float = 50.0) -> bool:
    """Player within control radius attempts to bring the ball under control."""
    ball_speed = float(np.linalg.norm(ball.vel))
    aerial = bool(ball.flight_meta.get("aerial"))
    if aerial:
        # crosses are attacked with heading; defenders lean on marking too
        head = player.eff("heading") / 100.0
        mark = player.eff("marking") / 100.0
        if is_intended_receiver:
            base = 0.40 + 0.40 * head
        else:
            base = 0.18 + 0.28 * head + 0.14 * mark
    else:
        touch = player.eff("first_touch") / 100.0
        antic = player.eff("anticipation") / 100.0
        base = (0.76 + 0.22 * touch + 0.03 * ((synergy - 50.0) / 50.0)
                if is_intended_receiver else 0.14 + 0.36 * antic)
    speed_pen = min(0.40, ball_speed / 38.0)         # fast balls are hard
    p = max(0.05, min(0.98, base - speed_pen))
    return bool(rng.random() < p)


def can_reach_flight(player: Player, ball: Ball, horizon: float = 0.6) -> bool:
    """Cheap geometric gate: is the ball's near path within reach soon?"""
    seg_a = ball.pos
    seg_b = ball.pos + ball.vel * horizon
    reach = physics.CONTROL_RADIUS + player.max_speed() * horizon * 0.5
    return pitch.point_to_segment_dist(player.pos, seg_a, seg_b) < reach


# ---------------------------------------------------------------- shooting

def xg_model(shooter_pos: np.ndarray, attacking_right: bool,
             defenders_in_lane: int, gk_dist_from_line: float) -> float:
    """Geometric xG: distance + opening angle + lane traffic."""
    goal = pitch.goal_center(attacking_right)
    d = pitch.dist(shooter_pos, goal)
    angle = pitch.shot_angle(shooter_pos, attacking_right)
    base = 2.6 * (angle / np.pi) * np.exp(-d / 14.0)
    base *= (0.68 ** defenders_in_lane)
    base *= (1.0 + min(0.12, gk_dist_from_line / 50.0))
    return float(np.clip(base, 0.005, 0.70))


def resolve_shot(rng: np.random.Generator, shooter: Player, gk: Player,
                 ball: Ball, defenders: list[Player],
                 attacking_right: bool) -> dict:
    """Returns dict with outcome in {'goal','save','parry','off_target'} + xg."""
    goal = pitch.goal_center(attacking_right)
    lane = [d for d in defenders
            if not d.is_gk and pitch.point_to_segment_dist(d.pos, shooter.pos, goal) < 1.2]
    gk_line = pitch.own_goal_center(not attacking_right)
    # a well-positioned keeper narrows the effective angle
    gk_pos_q = gk.eff("positioning_gk") / 100.0
    xg = xg_model(shooter.pos, attacking_right, len(lane),
                  pitch.dist(gk.pos, gk_line))
    xg *= (1.10 - 0.20 * gk_pos_q)
    xg = float(np.clip(xg, 0.005, 0.70))

    press = pressure_on(shooter, defenders)
    fin = (0.7 * shooter.eff("finishing") + 0.3 * shooter.eff("composure")) / 100.0
    # probability the shot is on target
    p_on = np.clip(0.28 + 0.35 * fin - 0.22 * press + 0.35 * xg, 0.10, 0.85)
    on_target = rng.random() < p_on

    d_goal = pitch.dist(shooter.pos, goal)
    if not on_target:
        # ball struck wide/over: send it past the goal at an offset
        off = np.array([0.0, float(rng.choice([-1, 1])) * rng.uniform(4.5, 9.0)])
        direction = pitch.norm_dir(shooter.pos, goal + off)
        physics.strike_ball(ball, direction, d_goal + 8.0, "shot", shooter.pid,
                            max_speed=32.0)
        return {"outcome": "off_target", "xg": round(xg, 3)}

    # on target: GK save contest — shot quality vs stopper quality
    gk_q = (0.6 * gk.eff("shot_stopping") + 0.4 * gk.eff("reflexes")) / 100.0
    shot_q = xg * (0.85 + 0.45 * fin)
    p_goal = np.clip(shot_q * (2.75 - 1.15 * gk_q), 0.03, 0.88)
    goal_scored = rng.random() < p_goal
    # ball is ALWAYS struck: at the corner if goal, at the keeper if saved
    if goal_scored:
        aim = goal + np.array([0.0, float(rng.choice([-1, 1])) * 2.6])
        outcome = "goal"
    else:
        aim = gk.pos
        # handling decides catch vs parry (parry -> loose rebound)
        hand = gk.eff("handling") / 100.0
        p_catch = np.clip(0.35 + 0.55 * hand - 0.45 * xg, 0.10, 0.92)
        outcome = "save" if rng.random() < p_catch else "parry"
    physics.strike_ball(ball, pitch.norm_dir(shooter.pos, aim),
                        d_goal + 2.0, "shot", shooter.pid, max_speed=32.0)
    return {"outcome": outcome, "xg": round(xg, 3)}


# ------------------------------------------------------------- dispossession

def contest_dispossession(rng: np.random.Generator, defender: Player,
                          carrier: Player, box_caution: float = 1.0) -> str:
    """Close-quarters challenge. Returns 'won' | 'foul' | 'none'.

    Ball-winning reads tackling/anticipation/strength vs the carrier's
    dribbling/composure/agility/strength. Fouls come from aggression and
    from lunging while outmatched. box_caution < 1 models defenders holding
    back from risky challenges inside their own penalty area.
    """
    atk = (0.45 * carrier.eff("dribbling") + 0.25 * carrier.eff("composure")
           + 0.15 * carrier.eff("agility") + 0.15 * carrier.eff("strength")) / 100.0
    dfn = (0.50 * defender.eff("tackling") + 0.20 * defender.eff("anticipation")
           + 0.15 * defender.eff("strength") + 0.15 * defender.eff("marking")) / 100.0
    p_win = np.clip(0.34 + 0.55 * (dfn - atk) + 0.12, 0.08, 0.80)
    aggr = defender.eff("aggression") / 100.0
    # mistimed challenges: more likely when outskilled, and when aggressive
    p_foul = np.clip(0.100 + 0.140 * aggr + 0.09 * max(0.0, atk - dfn),
                     0.015, 0.34) * box_caution
    r = rng.random()
    if r < p_foul:
        return "foul"
    if r < p_foul + p_win:
        return "won"
    return "none"
