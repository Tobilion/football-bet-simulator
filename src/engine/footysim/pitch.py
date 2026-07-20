"""Pitch geometry and coordinate helpers.

Coordinate system: continuous 2D, origin at one corner.
x in [0, LENGTH] (105 m), y in [0, WIDTH] (68 m).
Team attacking direction is +x or -x depending on side.
"""
from __future__ import annotations

import numpy as np

LENGTH: float = 105.0
WIDTH: float = 68.0
CENTER: np.ndarray = np.array([LENGTH / 2.0, WIDTH / 2.0])

GOAL_WIDTH: float = 7.32
GOAL_Y_MIN: float = WIDTH / 2.0 - GOAL_WIDTH / 2.0
GOAL_Y_MAX: float = WIDTH / 2.0 + GOAL_WIDTH / 2.0

PENALTY_AREA_DEPTH: float = 16.5
PENALTY_AREA_HALF_WIDTH: float = 20.16


def goal_center(attacking_right: bool) -> np.ndarray:
    """Center of the goal a team is attacking."""
    x = LENGTH if attacking_right else 0.0
    return np.array([x, WIDTH / 2.0])


def own_goal_center(attacking_right: bool) -> np.ndarray:
    return goal_center(not attacking_right)


def clamp_to_pitch(pos: np.ndarray, margin: float = 0.0) -> np.ndarray:
    return np.array([
        min(max(pos[0], margin), LENGTH - margin),
        min(max(pos[1], margin), WIDTH - margin),
    ])


def in_bounds(pos: np.ndarray) -> bool:
    return 0.0 <= pos[0] <= LENGTH and 0.0 <= pos[1] <= WIDTH


def dist(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.linalg.norm(a - b))


def norm_dir(from_pos: np.ndarray, to_pos: np.ndarray) -> np.ndarray:
    """Unit vector from -> to; zero vector if coincident."""
    d = to_pos - from_pos
    n = np.linalg.norm(d)
    if n < 1e-9:
        return np.zeros(2)
    return d / n


def shot_angle(pos: np.ndarray, attacking_right: bool) -> float:
    """Opening angle (radians) of the goal mouth as seen from pos."""
    gx = LENGTH if attacking_right else 0.0
    p1 = np.array([gx, GOAL_Y_MIN])
    p2 = np.array([gx, GOAL_Y_MAX])
    v1 = p1 - pos
    v2 = p2 - pos
    n1 = np.linalg.norm(v1)
    n2 = np.linalg.norm(v2)
    if n1 < 1e-9 or n2 < 1e-9:
        return np.pi
    cosang = float(np.clip(np.dot(v1, v2) / (n1 * n2), -1.0, 1.0))
    return float(np.arccos(cosang))


def point_to_segment_dist(p: np.ndarray, a: np.ndarray, b: np.ndarray) -> float:
    """Distance from point p to segment a-b."""
    ab = b - a
    denom = float(np.dot(ab, ab))
    if denom < 1e-9:
        return dist(p, a)
    t = float(np.clip(np.dot(p - a, ab) / denom, 0.0, 1.0))
    proj = a + t * ab
    return dist(p, proj)


PENALTY_SPOT_DIST: float = 11.0


def in_penalty_area(pos: np.ndarray, goal_at_right: bool) -> bool:
    """Is pos inside the penalty area of the goal at x=LENGTH (True) or x=0."""
    if goal_at_right:
        in_x = pos[0] >= LENGTH - PENALTY_AREA_DEPTH
    else:
        in_x = pos[0] <= PENALTY_AREA_DEPTH
    return bool(in_x and abs(pos[1] - WIDTH / 2.0) <= PENALTY_AREA_HALF_WIDTH)


def penalty_spot(goal_at_right: bool) -> np.ndarray:
    x = LENGTH - PENALTY_SPOT_DIST if goal_at_right else PENALTY_SPOT_DIST
    return np.array([x, WIDTH / 2.0])
