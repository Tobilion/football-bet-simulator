"""Public entry point.

    from footysim.sim import simulate_match
    result = simulate_match(team_a_dict, team_b_dict, seed=42)
    result.save("match.json")

Team dict shape (see example_teams.json):
    {
      "team_id": "ARS", "name": "Arsenal", "formation": "4-3-3",
      "players": [
         {"pid": "ARS_GK", "name": "...", "role": "GK",
          "attributes": {"passing": 70, ...}},
         ... 11 total, roles matching the formation ...
      ]
    }
"""
from __future__ import annotations

from .engine import Config, run_match
from .entities import Attributes, Player, Team, TeamInstructions
from .output import MatchResult, build_result, decimate_frames  # noqa: F401
from .tactics import FORMATIONS


def team_from_dict(d: dict) -> Team:
    formation = d["formation"]
    if formation not in FORMATIONS:
        raise ValueError(f"Unknown formation {formation!r}; "
                         f"available: {sorted(FORMATIONS)}")
    roles_needed = set(FORMATIONS[formation])
    players = []
    for pd in d["players"]:
        role = pd["role"]
        if role not in roles_needed:
            raise ValueError(f"Role {role!r} not in formation {formation}")
        p = Player(
            pid=pd["pid"], name=pd["name"], team_id=d["team_id"], role=role,
            attrs=Attributes.from_dict(pd.get("attributes", {})),
            is_gk=(role == "GK"),
            form=float(pd.get("form", 50.0)),
            sharpness=float(pd.get("sharpness", 100.0)),
            natural_positions=list(pd.get("natural_positions", [])),
        )
        p.init_modifiers(role)
        players.append(p)
    roles_have = {p.role for p in players}
    if roles_have != roles_needed:
        raise ValueError(f"Formation {formation} needs roles {sorted(roles_needed)}, "
                         f"got {sorted(roles_have)}")
    return Team(team_id=d["team_id"], name=d["name"],
                formation=formation, players=players,
                synergy=float(d.get("synergy", 50.0)),
                instructions=TeamInstructions.from_dict(d.get("instructions")))


def simulate_match(team_a: dict, team_b: dict, config: dict | None = None,
                   seed: int = 0) -> MatchResult:
    """Simulate a full match; deterministic for a given (inputs, seed)."""
    cfg = Config(**(config or {}))
    ta = team_from_dict(team_a)
    tb = team_from_dict(team_b)
    state = run_match(ta, tb, cfg, seed)
    return build_result(state, seed)
