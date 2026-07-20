"""Live per-player match ratings.

Ratings start at 6.0 and move with recorded contributions. Phase 1 keeps a
simple additive model; Phase 3 layers form/synergy on top of the same hooks.
"""
from __future__ import annotations

from .entities import Player

DELTAS: dict[str, float] = {
    "pass_completed": +0.006,
    "pass_failed": -0.015,
    "interception": +0.06,
    "tackle_won": +0.05,
    "dispossessed": -0.04,
    "shot_on_target": +0.05,
    "shot_off_target": -0.02,
    "goal": +0.90,
    "save": +0.06,
    "goal_conceded_gk": -0.15,
    "foul": -0.04,
    "yellow_card": -0.15,
    "red_card": -1.00,
    "assist": +0.50,
    "key_pass": +0.15,
}


def finalize(player, stats: dict) -> None:
    """End-of-match adjustment: xG over/under-performance for shooters."""
    xg = float(stats.get("xg", 0.0))
    goals = float(stats.get("goals", 0.0))
    if xg > 0.2 or goals > 0:
        delta = max(-0.5, min(0.8, 0.30 * (goals - xg)))
        player.rating = float(min(10.0, max(3.0, player.rating + delta)))


def adjust(player: Player, key: str, scale: float = 1.0) -> None:
    delta = DELTAS.get(key, 0.0) * scale
    player.rating = float(min(10.0, max(3.0, player.rating + delta)))
