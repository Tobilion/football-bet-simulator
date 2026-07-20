"""Per-agent decision loop.

On-ball: choose shoot / pass (to whom) / dribble by scoring options with the
player's mental attributes. Off-ball: chase loose balls, press the carrier,
or hold tactical shape.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from . import pitch, resolution
from .entities import Player, Team


@dataclass
class OnBallChoice:
    action: str                 # "shoot" | "pass" | "dribble"
    target: Player | None = None


SHOOT_RANGE: float = 26.0


def _pass_option_score(passer: Player, mate: Player, opponents: list[Player],
                       attacking_right: bool, synergy: float = 50.0,
                       mentality: float = 50.0) -> float:
    """Utility of passing to this teammate right now."""
    d = pitch.dist(passer.pos, mate.pos)
    if d < 3.0 or d > 40.0:
        return -1.0
    goal = pitch.goal_center(attacking_right)
    progress = (pitch.dist(passer.pos, goal) - pitch.dist(mate.pos, goal)) / 45.0
    openness = min(1.0, min((pitch.dist(mate.pos, o.pos) for o in opponents),
                            default=30.0) / 12.0)
    # good teamwork = better off-ball support angles; synergy = shared wavelength
    support = (0.06 * (mate.eff("teamwork") / 100.0)
               + 0.05 * ((synergy - 50.0) / 50.0))
    # opponents cutting the passing lane
    lane_block = sum(1 for o in opponents
                     if pitch.point_to_segment_dist(o.pos, passer.pos, mate.pos) < 2.0)
    risk = 0.30 * lane_block + 0.010 * d
    # attacking mentality favours progressive passing
    prog_w = 0.45 + 0.06 * ((mentality - 50.0) / 50.0)
    return 0.48 * openness + prog_w * progress + support - risk + 0.45


def choose_on_ball(rng: np.random.Generator, carrier: Player, team: Team,
                   opponents: list[Player]) -> OnBallChoice:
    goal = pitch.goal_center(team.attacking_right)
    d_goal = pitch.dist(carrier.pos, goal)
    press = resolution.pressure_on(carrier, opponents)
    mental = (0.6 * carrier.eff("decisions") + 0.4 * carrier.eff("vision")) / 100.0
    ment_ins = team.instructions.mentality

    # --- shoot utility
    shoot_u = -1.0
    if d_goal < SHOOT_RANGE:
        angle = pitch.shot_angle(carrier.pos, team.attacking_right)
        lane = sum(1 for o in opponents if pitch.point_to_segment_dist(
            o.pos, carrier.pos, goal) < 1.5)
        shoot_u = (0.26 + 2.6 * (angle / np.pi) * np.exp(-d_goal / 16.0)
                   + 0.18 * (carrier.eff("finishing") / 100.0)
                   + 0.04 * ((ment_ins - 50.0) / 50.0)
                   - 0.22 * press - 0.10 * lane)
        if d_goal < 10.0:
            shoot_u += 0.20  # close in: shoot

    # --- best pass utility
    mates = [m for m in team.active() if m.pid != carrier.pid]
    best_mate, best_pass_u = None, -1.0
    for m in mates:
        s = _pass_option_score(carrier, m, opponents, team.attacking_right,
                               synergy=team.synergy, mentality=ment_ins)
        if s > best_pass_u:
            best_mate, best_pass_u = m, s
    # pressure makes releasing the ball more attractive
    pass_u = best_pass_u + 0.30 * press

    # --- long-ball outlet: short options covered, hit the front man
    own_half = (carrier.pos[0] < pitch.LENGTH / 2.0 if team.attacking_right
                else carrier.pos[0] > pitch.LENGTH / 2.0)
    if own_half and best_pass_u < 0.50 and mates:
        sign = 1.0 if team.attacking_right else -1.0
        outlet = max((m for m in mates if not m.is_gk),
                     key=lambda m: sign * m.pos[0])
        d_out = pitch.dist(carrier.pos, outlet.pos)
        if d_out > 20.0:
            u_long = 0.46 + 0.12 * (carrier.eff("passing") / 100.0) - 0.10 * press
            if u_long > best_pass_u:
                best_mate, best_pass_u = outlet, u_long
                pass_u = best_pass_u + 0.30 * press

    # --- dribble utility: space ahead toward goal
    ahead = carrier.pos + pitch.norm_dir(carrier.pos, goal) * 7.0
    space = min((pitch.dist(ahead, o.pos) for o in opponents), default=30.0)
    dribble_u = (0.10 + 0.35 * (carrier.eff("dribbling") / 100.0)
                 + 0.25 * min(1.0, space / 10.0) - 0.65 * press)

    # in the final third, endless recycling loses value: teams of any level
    # take their shots rather than pass around the block forever
    third_x = pitch.LENGTH * (2 / 3)
    in_final_third = (carrier.pos[0] > third_x if team.attacking_right
                      else carrier.pos[0] < pitch.LENGTH - third_x)
    if in_final_third:
        pass_u -= 0.05
        if shoot_u > -1.0:
            shoot_u += 0.03

    # decision noise: weaker decision-makers pick sub-optimally more often;
    # fatigue widens it further late in the match
    noise = 0.22 * (1.0 - mental) + 0.08 * (1.0 - carrier.stamina_level)
    utilities = {
        "shoot": shoot_u + float(rng.normal(0, noise)),
        "pass": pass_u + float(rng.normal(0, noise)),
        "dribble": dribble_u + float(rng.normal(0, noise)),
    }
    action = max(utilities, key=utilities.get)
    if action == "pass" and best_mate is None:
        action = "dribble"
    return OnBallChoice(action, best_mate if action == "pass" else None)


def dribble_target(carrier: Player, team: Team, opponents: list[Player]) -> np.ndarray:
    """Carry toward goal, veering away from the nearest opponent."""
    goal = pitch.goal_center(team.attacking_right)
    direction = pitch.norm_dir(carrier.pos, goal)
    near = min(opponents, key=lambda o: pitch.dist(carrier.pos, o.pos), default=None)
    if near is not None and pitch.dist(carrier.pos, near.pos) < 5.0:
        away = pitch.norm_dir(near.pos, carrier.pos)
        direction = pitch.norm_dir(np.zeros(2), direction + 0.8 * away)
    return pitch.clamp_to_pitch(carrier.pos + direction * 8.0, margin=0.5)


def pick_chasers(players: list[Player], ball_pos: np.ndarray, n: int = 2) -> set[str]:
    """The n players (per team) closest to a loose ball chase it.

    High work-rate players effectively rank closer (they commit sooner).
    """
    def eff_dist(p: Player) -> float:
        return pitch.dist(p.pos, ball_pos) * (1.10 - 0.20 * p.eff("work_rate") / 100.0)
    ranked = sorted(players, key=eff_dist)
    return {p.pid for p in ranked[:n]}


def pick_pressers(players: list[Player], carrier_pos: np.ndarray,
                  n: int = 2) -> set[str]:
    """Nearest outfield defenders press the carrier."""
    cands = sorted((p for p in players if not p.is_gk),
                   key=lambda p: pitch.dist(p.pos, carrier_pos))
    return {p.pid for p in cands[:n]}


def press_point(presser: Player, carrier: Player, own_goal) -> "np.ndarray":
    """Jockey goal-side, staying about a metre off the carrier."""
    import numpy as _np
    return carrier.pos + pitch.norm_dir(carrier.pos, _np.asarray(own_goal)) * 1.3


def assign_markers(defenders: list[Player], threats: list[Player],
                   own_goal) -> dict[str, str]:
    """Greedy man-marking: nearest free defender takes each threat.

    Threats are opponents near our goal, most dangerous (closest to goal)
    first. Returns {defender_pid: threat_pid}.
    """
    import numpy as _np
    og = _np.asarray(own_goal)
    order = sorted(threats, key=lambda t: pitch.dist(t.pos, og))
    free = {d.pid: d for d in defenders if not d.is_gk}
    out: dict[str, str] = {}
    for t in order:
        if not free:
            break
        best = min(free.values(), key=lambda d: pitch.dist(d.pos, t.pos))
        out[best.pid] = t.pid
        del free[best.pid]
    return out


def marking_point(threat: Player, own_goal, marker: Player | None = None) -> "np.ndarray":
    """Goal-side of the man; better markers stay tighter."""
    import numpy as _np
    gap = 1.3
    if marker is not None:
        gap = 1.5 - 0.8 * (marker.attrs.marking / 100.0)   # 0.7m - 1.5m
    return threat.pos + pitch.norm_dir(threat.pos, _np.asarray(own_goal)) * gap
