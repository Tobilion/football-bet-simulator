"""Assemble and serialize the match dataset.

`MatchResult.to_dict()` produces the full JSON contract:
meta, events_general, events_key, frames, boxscore (team + per-player),
ratings. `decimate_frames` lets a consumer compress playback without
touching simulation fidelity.
"""
from __future__ import annotations

import json
from dataclasses import dataclass

from .engine import MatchState


@dataclass
class MatchResult:
    data: dict

    def to_dict(self) -> dict:
        return self.data

    def to_json(self, indent: int | None = None) -> str:
        return json.dumps(self.data, indent=indent, sort_keys=True)

    def save(self, path: str, indent: int | None = None) -> None:
        with open(path, "w") as f:
            f.write(self.to_json(indent))


PLAYER_STAT_KEYS = [
    "passes_attempted", "passes_completed", "passes_failed", "interceptions",
    "tackles_won", "dispossessed", "shots", "shots_on_target", "goals", "xg",
    "saves", "distance", "fouls", "fouls_won", "yellow_cards", "red_cards",
    "key_passes", "assists", "crosses", "crosses_completed",
    "touches", "progressive_passes", "passes_final_third",
    "progressive_carries", "dribbles_completed", "duels", "duels_won",
    "big_chances", "shots_inside_box", "shots_outside_box",
    "xg_faced", "goals_conceded",
]


def _player_boxscore(st: MatchState) -> dict:
    out = {}
    for t in st.teams:
        for p in t.players:
            s = st.stats[p.pid]
            row = {k: s.get(k, 0) for k in PLAYER_STAT_KEYS}
            att = row["passes_attempted"]
            row["pass_accuracy"] = round(row["passes_completed"] / att, 3) if att else None
            row["xg"] = round(float(row["xg"]), 3)
            row["xg_faced"] = round(float(row["xg_faced"]), 3)
            row["distance"] = round(float(row["distance"]), 1)
            row["team"] = t.team_id
            row["name"] = p.name
            row["role"] = p.role
            out[p.pid] = row
    return out


def _team_boxscore(st: MatchState, player_rows: dict) -> dict:
    total_poss = sum(st.possession_ticks.values()) or 1
    out = {}
    for t in st.teams:
        rows = [r for r in player_rows.values() if r["team"] == t.team_id]
        agg = {k: round(sum(r[k] for r in rows), 3) for k in PLAYER_STAT_KEYS}
        att = agg["passes_attempted"]
        agg["pass_accuracy"] = round(agg["passes_completed"] / att, 3) if att else None
        agg["possession_pct"] = round(100.0 * st.possession_ticks[t.team_id] / total_poss, 1)
        agg["goals"] = st.score[t.team_id]
        out[t.team_id] = agg
    return out


def build_result(st: MatchState, seed: int) -> MatchResult:
    player_rows = _player_boxscore(st)
    data = {
        "meta": {
            "teams": {
                t.team_id: {"name": t.name, "formation": t.formation,
                            "synergy": t.synergy,
                            "instructions": t.instructions.to_dict(),
                            "players": [{"pid": p.pid, "name": p.name,
                                         "role": p.role, "form": p.form,
                                         "sharpness": p.sharpness}
                                        for p in t.players]}
                for t in st.teams
            },
            "seed": seed,
            "config": st.cfg.to_dict(),
            "final_score": dict(st.score),
            "engine": "footysim-phase1",
        },
        "events_general": st.events_general,
        "events_key": st.events_key,
        "frames": st.frames,
        "boxscore": {"teams": _team_boxscore(st, player_rows),
                     "players": player_rows},
        "ratings": {p.pid: round(p.rating, 2)
                    for t in st.teams for p in t.players},
    }
    return MatchResult(data)


def decimate_frames(frames: list[dict], target_seconds: float | None = None,
                    target_fps: float | None = None,
                    match_seconds: float = 5400.0) -> list[dict]:
    """Downsample frames for playback. Never affects simulation.

    - target_seconds: play the whole match back in this many wall-clock
      seconds at ~30 fps.
    - target_fps: alternatively keep one frame per 1/fps of *match* time.
    """
    if not frames:
        return []
    if target_seconds is not None:
        n_out = max(2, int(target_seconds * 30))
    elif target_fps is not None:
        n_out = max(2, int(match_seconds * target_fps))
    else:
        return list(frames)
    if n_out >= len(frames):
        return list(frames)
    idx = [round(i * (len(frames) - 1) / (n_out - 1)) for i in range(n_out)]
    return [frames[i] for i in idx]
