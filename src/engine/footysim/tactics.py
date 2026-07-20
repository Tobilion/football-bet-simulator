"""Formations and tactical target positions.

Formations are defined in normalized coordinates for a team attacking +x:
x in [0,1] own-goal-line -> opponent-goal-line, y in [0,1] bottom -> top.
Targets are mirrored automatically for the team attacking -x.

Each tick, a player's target position = formation base, shifted toward the
ball (compactness / block movement) and pushed up or back depending on
whether their team has possession.
"""
from __future__ import annotations

import numpy as np

from . import pitch
from .entities import Player, Team

# role -> (x, y) normalized, attacking left -> right
FORMATIONS: dict[str, dict[str, tuple[float, float]]] = {
    "4-3-3": {
        "GK":  (0.04, 0.50),
        "RB":  (0.22, 0.15), "RCB": (0.16, 0.37), "LCB": (0.16, 0.63), "LB": (0.22, 0.85),
        "RCM": (0.42, 0.28), "CM":  (0.38, 0.50), "LCM": (0.42, 0.72),
        "RW":  (0.68, 0.15), "ST":  (0.72, 0.50), "LW":  (0.68, 0.85),
    },
    "4-4-2": {
        "GK":  (0.04, 0.50),
        "RB":  (0.22, 0.15), "RCB": (0.16, 0.37), "LCB": (0.16, 0.63), "LB": (0.22, 0.85),
        "RM":  (0.45, 0.14), "RCM": (0.40, 0.38), "LCM": (0.40, 0.62), "LM": (0.45, 0.86),
        "RST": (0.70, 0.40), "LST": (0.70, 0.60),
    },
}


def base_position(role: str, formation: str, attacking_right: bool) -> np.ndarray:
    nx, ny = FORMATIONS[formation][role]
    if not attacking_right:
        nx = 1.0 - nx
        ny = 1.0 - ny
    return np.array([nx * pitch.LENGTH, ny * pitch.WIDTH])


def kickoff_positions(team: Team, has_kickoff: bool) -> None:
    """Place all players; pull everyone into own half, kickoff takers centred."""
    sign = 1.0 if team.attacking_right else -1.0
    half_line = pitch.LENGTH / 2.0
    for p in team.players:
        if p.sent_off:
            continue
        base = base_position(p.role, team.formation, team.attacking_right)
        x, y = float(base[0]), float(base[1])
        # squeeze into own half
        if team.attacking_right:
            x = min(x, half_line - 2.0)
        else:
            x = max(x, half_line + 2.0)
        p.pos = np.array([x, y])
        p.vel = np.zeros(2)
    if has_kickoff:
        takers = sorted(team.active(), key=lambda q: pitch.dist(
            np.array([half_line, pitch.WIDTH / 2.0]),
            base_position(q.role, team.formation, team.attacking_right)))
        takers = [p for p in takers if not p.is_gk][:2]
        takers[0].pos = pitch.CENTER.copy()
        takers[1].pos = pitch.CENTER + np.array([-sign * 2.5, 1.5])


def target_position(player: Player, team: Team, ball_pos: np.ndarray,
                    in_possession: bool) -> np.ndarray:
    """Where this player wants to be this tick (off-ball)."""
    base = base_position(player.role, team.formation, team.attacking_right)
    if player.is_gk:
        # GK stays near goal, shading toward ball's y
        gx = 2.5 if team.attacking_right else pitch.LENGTH - 2.5
        gy = pitch.WIDTH / 2.0 + np.clip(ball_pos[1] - pitch.WIDTH / 2.0, -6.0, 6.0) * 0.5
        return np.array([gx, gy])

    sign = 1.0 if team.attacking_right else -1.0
    ins = team.instructions
    # width: stretch or narrow the block around the pitch's middle
    width_f = 0.85 + 0.30 * (ins.width / 100.0)          # 0.85 - 1.15
    base = base.copy()
    base[1] = pitch.WIDTH / 2.0 + (base[1] - pitch.WIDTH / 2.0) * width_f
    # line height: push the whole structure up or drop it deep
    line_shift = sign * (ins.line_height - 50.0) * 0.12  # +/- 6 m
    # block shifts with the ball (compactness)
    shift_x = 0.30 * (ball_pos[0] - pitch.CENTER[0])
    shift_y = 0.20 * (ball_pos[1] - pitch.CENTER[1])
    # push up when in possession, drop when out; mentality skews both
    ment = (ins.mentality - 50.0) * 0.05                 # +/- 2.5 m
    push = sign * ((6.0 if in_possession else -9.0) + ment)
    # positioning quality adds noise-free discipline (effective attribute)
    disc = 0.7 + 0.3 * (player.eff("positioning") / 100.0)
    tgt = base + disc * np.array([shift_x + push + line_shift, shift_y])

    if not in_possession:
        own_goal = pitch.own_goal_center(team.attacking_right)
        d_ball_goal = pitch.dist(ball_pos, own_goal)
        if d_ball_goal < 45.0:
            # danger: collapse goal-side, onto the lane between ball and goal
            lane_pt = ball_pos + (own_goal - ball_pos) * 0.5
            w = 0.70 * (1.0 - d_ball_goal / 45.0) + 0.18
            tgt = (1.0 - w) * tgt + w * lane_pt
    return pitch.clamp_to_pitch(tgt, margin=1.0)
