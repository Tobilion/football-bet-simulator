"""Core entities: attributes, Player, Ball, Team, TeamInstructions.

Phase 1 uses a reduced attribute set (0-100 scale). The model is structured so
the full FM-style set can slot in later without changing consumers.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

import numpy as np

from . import modifiers


@dataclass
class Attributes:
    """Full FM-style attribute set (Phase 2), 0-100. Missing keys default 50."""
    # technical
    passing: float = 50.0
    first_touch: float = 50.0
    tackling: float = 50.0
    marking: float = 50.0
    dribbling: float = 50.0
    finishing: float = 50.0
    crossing: float = 50.0
    heading: float = 50.0
    # physical
    pace: float = 50.0
    acceleration: float = 50.0
    stamina: float = 50.0
    strength: float = 50.0
    agility: float = 50.0
    # mental
    positioning: float = 50.0
    decisions: float = 50.0
    anticipation: float = 50.0
    composure: float = 50.0
    work_rate: float = 50.0
    teamwork: float = 50.0
    vision: float = 50.0
    aggression: float = 50.0
    # goalkeeping (used only for GK)
    shot_stopping: float = 50.0
    handling: float = 50.0
    reflexes: float = 50.0
    positioning_gk: float = 50.0
    command_of_area: float = 50.0

    @classmethod
    def from_dict(cls, d: dict) -> "Attributes":
        known = {k: float(v) for k, v in d.items() if k in cls.__dataclass_fields__}
        return cls(**known)


@dataclass
class Player:
    pid: str
    name: str
    team_id: str
    role: str                      # e.g. "GK", "RB", "RCM", "ST"
    attrs: Attributes
    is_gk: bool = False

    # live state
    pos: np.ndarray = field(default_factory=lambda: np.zeros(2))
    vel: np.ndarray = field(default_factory=lambda: np.zeros(2))
    stamina_level: float = 1.0     # 1.0 fresh -> drains toward ~0.5 floor
    rating: float = 6.0
    yellow_cards: int = 0
    sent_off: bool = False

    # phase-3 modifier inputs
    form: float = 50.0                 # 0-100, 50 neutral
    sharpness: float = 100.0           # 0-100 season fitness/sharpness
    natural_positions: list[str] = field(default_factory=list)
    _static_mods: dict = field(default_factory=dict, repr=False)

    def init_modifiers(self, assigned_role: str) -> None:
        nats = self.natural_positions or [assigned_role]
        fit = modifiers.role_fit(assigned_role, nats)
        self._static_mods = modifiers.static_mods(self.form, self.sharpness, fit)

    def eff(self, name: str) -> float:
        """Effective attribute after form/sharpness/role-fit/streak/fatigue."""
        base = getattr(self.attrs, name)
        cat = modifiers.CATEGORY.get(name, "mental")
        static = self._static_mods.get(cat, 1.0) if self._static_mods else 1.0
        return float(min(100.0, base * static
                         * modifiers.live_mod(self.rating, self.stamina_level, cat)))

    def max_speed(self) -> float:
        """Top speed in m/s, degraded by fatigue."""
        base = 5.0 + (self.attrs.pace / 100.0) * 3.6      # 5.0 - 8.6 m/s
        return base * (0.75 + 0.25 * self.stamina_level)

    def max_accel(self) -> float:
        # agility contributes to change of direction / burst
        accel = 0.75 * self.attrs.acceleration + 0.25 * self.attrs.agility
        base = 3.5 + (accel / 100.0) * 3.5                    # 3.5 - 7.0 m/s^2
        return base * (0.8 + 0.2 * self.stamina_level)


@dataclass
class Ball:
    pos: np.ndarray = field(default_factory=lambda: np.zeros(2))
    vel: np.ndarray = field(default_factory=lambda: np.zeros(2))
    owner: Optional[str] = None        # pid of controlling player, None if loose
    in_flight: bool = False            # True while a struck ball travels
    flight_kind: str = ""              # "pass" | "shot" | "clearance"
    flight_from: Optional[str] = None  # pid of the striker of the ball
    flight_target: Optional[str] = None  # intended receiver pid (passes)
    flight_meta: dict = field(default_factory=dict)


@dataclass
class TeamInstructions:
    """Tactical dials, all 0-100 with 50 = neutral/default."""
    pressing: float = 50.0      # intensity: pressers committed, engage radius
    line_height: float = 50.0   # defensive line: deep <-> high
    width: float = 50.0         # narrow <-> stretched
    tempo: float = 50.0         # slow circulation <-> quick decisions
    mentality: float = 50.0     # defensive <-> attacking

    @classmethod
    def from_dict(cls, d: dict | None) -> "TeamInstructions":
        d = d or {}
        known = {k: float(v) for k, v in d.items() if k in cls.__dataclass_fields__}
        return cls(**known)

    def to_dict(self) -> dict:
        return {k: getattr(self, k) for k in self.__dataclass_fields__}


@dataclass
class Team:
    team_id: str
    name: str
    formation: str
    players: list[Player]
    attacking_right: bool = True
    synergy: float = 50.0       # 0-100 collective familiarity
    instructions: TeamInstructions = field(default_factory=TeamInstructions)

    def gk(self) -> Player:
        return next(p for p in self.players if p.is_gk)

    def outfield(self) -> list[Player]:
        return [p for p in self.players if not p.is_gk]

    def active(self) -> list[Player]:
        """Players still on the pitch (not sent off)."""
        return [p for p in self.players if not p.sent_off]
