"""Movement integration for players and ball.

Players: accelerate toward a desired point, capped by pace/acceleration,
degraded by stamina. Ball: struck with an initial velocity, decelerates with
ground friction; while owned it is glued just ahead of the carrier.
"""
from __future__ import annotations

import numpy as np

from . import pitch
from .entities import Ball, Player

BALL_FRICTION: float = 5.2        # m/s^2 deceleration on the ground
BALL_ARRIVE_SPEED: float = 3.0    # ideal speed remaining when a pass arrives
CONTROL_RADIUS: float = 1.3       # metres within which a player can play the ball
CARRY_OFFSET: float = 0.5         # ball sits this far ahead of the carrier


def move_player_toward(player: Player, target: np.ndarray, dt: float,
                       speed_scale: float = 1.0) -> None:
    """Steer player toward target with accel/speed caps; integrates position."""
    desired = pitch.norm_dir(player.pos, target) * player.max_speed() * speed_scale
    dv = desired - player.vel
    dv_norm = float(np.linalg.norm(dv))
    max_dv = player.max_accel() * dt
    if dv_norm > max_dv:
        dv = dv / dv_norm * max_dv
    player.vel = player.vel + dv
    player.pos = player.pos + player.vel * dt


def hold_position(player: Player, dt: float) -> None:
    """Decelerate to a stop."""
    speed = float(np.linalg.norm(player.vel))
    if speed < 1e-3:
        player.vel = np.zeros(2)
        return
    decel = min(speed, player.max_accel() * dt)
    player.vel = player.vel * (1.0 - decel / speed)
    player.pos = player.pos + player.vel * dt


def drain_stamina(player: Player, dt: float) -> None:
    """Fatigue proportional to speed; stamina attribute slows the drain."""
    speed = float(np.linalg.norm(player.vel))
    effort = speed / 8.6  # fraction of absolute max speed
    drain_rate = 0.000012 + 0.000075 * effort ** 2      # per-second at attr=100
    attr_factor = 2.0 - (player.attrs.stamina / 100.0)  # low stamina drains ~2x
    player.stamina_level = max(0.5, player.stamina_level - drain_rate * attr_factor * dt * 60.0)


def strike_ball(ball: Ball, direction: np.ndarray, travel_dist: float,
                kind: str, from_pid: str, target_pid: str | None = None,
                meta: dict | None = None, max_speed: float = 26.0) -> None:
    """Launch the ball so it covers ~travel_dist and arrives at pass speed."""
    v0 = float(np.sqrt(max(0.0, 2.0 * BALL_FRICTION * travel_dist
                           + BALL_ARRIVE_SPEED ** 2)))
    v0 = min(v0, max_speed)
    ball.vel = direction * v0
    ball.owner = None
    ball.in_flight = True
    ball.flight_kind = kind
    ball.flight_from = from_pid
    ball.flight_target = target_pid
    ball.flight_meta = meta or {}


def step_ball(ball: Ball, carrier: Player | None, dt: float) -> None:
    """Advance ball one tick."""
    if carrier is not None:
        # glued slightly ahead of carrier in their direction of travel
        heading = carrier.vel
        n = float(np.linalg.norm(heading))
        offset = (heading / n * CARRY_OFFSET) if n > 0.3 else np.zeros(2)
        ball.pos = carrier.pos + offset
        ball.vel = carrier.vel.copy()
        return
    speed = float(np.linalg.norm(ball.vel))
    if speed < 0.05:
        ball.vel = np.zeros(2)
        ball.in_flight = False
        return
    decel = min(speed, BALL_FRICTION * dt)
    ball.vel = ball.vel * (1.0 - decel / speed)
    ball.pos = ball.pos + ball.vel * dt
    if float(np.linalg.norm(ball.vel)) < 0.5:
        ball.in_flight = False  # ball is now just loose / rolling dead
