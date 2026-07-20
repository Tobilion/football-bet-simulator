"""Dynamic attribute modifiers (Phase 3).

Effective attributes = base attribute x modifiers. Modifiers come from:
- form:       pre-match form input (0-100, 50 = neutral)   -> +/- 8%
- sharpness:  season fitness/sharpness (0-100, 100 = peak) -> up to -10%
              on technical & mental attributes
- role_fit:   how natural the assigned role is             -> up to -18%
              (strongest on mental attributes)
- streak:     live in-match rating vs 6.0 (hot/cold)       -> +/- 6%
- stamina:    handled in physics for speed; here it also
              erodes mental sharpness late in the match

The static part is precomputed once per player; the live part (streak,
stamina) is read at call time. `Player.eff(name)` is the single entry point
used by decisions and resolution.
"""
from __future__ import annotations

CATEGORY: dict[str, str] = {
    # technical
    "passing": "tech", "first_touch": "tech", "tackling": "tech",
    "marking": "tech", "dribbling": "tech", "finishing": "tech",
    "crossing": "tech", "heading": "tech",
    # physical (form/sharpness barely touch these; stamina handled in physics)
    "pace": "phys", "acceleration": "phys", "stamina": "phys",
    "strength": "phys", "agility": "phys",
    # mental
    "positioning": "mental", "decisions": "mental", "anticipation": "mental",
    "composure": "mental", "work_rate": "mental", "teamwork": "mental",
    "vision": "mental", "aggression": "mental",
    # goalkeeping treated as technical
    "shot_stopping": "tech", "handling": "tech", "reflexes": "tech",
    "positioning_gk": "tech", "command_of_area": "tech",
}

ROLE_GROUP: dict[str, str] = {
    "GK": "GK",
    "RB": "DEF", "LB": "DEF", "RCB": "DEF", "LCB": "DEF",
    "RCM": "MID", "CM": "MID", "LCM": "MID", "RM": "MID", "LM": "MID",
    "RW": "ATT", "LW": "ATT", "ST": "ATT", "RST": "ATT", "LST": "ATT",
}

_ADJACENT = {("DEF", "MID"), ("MID", "DEF"), ("MID", "ATT"), ("ATT", "MID")}


def role_fit(assigned: str, natural_positions: list[str]) -> float:
    """1.0 natural, 0.96 same group, 0.90 adjacent group, 0.82 otherwise."""
    if assigned in natural_positions:
        return 1.0
    a = ROLE_GROUP.get(assigned, "MID")
    groups = {ROLE_GROUP.get(r, "MID") for r in natural_positions}
    if a in groups:
        return 0.96
    if any((a, g) in _ADJACENT for g in groups):
        return 0.90
    return 0.82


def static_mods(form: float, sharpness: float, fit: float) -> dict[str, float]:
    """Per-category multipliers fixed for the whole match."""
    form_m = 0.92 + 0.16 * (form / 100.0)             # 0.92 - 1.08
    sharp_m = 0.90 + 0.10 * (sharpness / 100.0)       # 0.90 - 1.00
    return {
        "tech": form_m * sharp_m * (0.6 + 0.4 * fit),
        "mental": form_m * sharp_m * fit,             # role fit bites hardest here
        "phys": 1.0,                                  # physics handles fatigue
    }


def live_mod(rating: float, stamina_level: float, category: str) -> float:
    """Hot/cold streak from live rating; late-game mental fatigue."""
    streak = max(-0.06, min(0.06, (rating - 6.0) * 0.015))
    m = 1.0 + streak
    if category == "mental":
        m *= (0.94 + 0.06 * stamina_level)            # tired minds decide worse
    return m
