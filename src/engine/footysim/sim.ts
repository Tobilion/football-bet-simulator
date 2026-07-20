// Public entry point (port of sim.py).
import { Config, runMatch } from "./engine";
import { attributesFromDict, Player, Team, TeamInstructions } from "./entities";
import { buildResult, MatchResult } from "./output";
import { FORMATIONS } from "./tactics";

export interface TeamDict {
  team_id: string;
  name: string;
  formation: string;
  synergy?: number;
  instructions?: Record<string, unknown>;
  players: {
    pid: string; name: string; role: string;
    attributes?: Record<string, unknown>;
    form?: number; sharpness?: number; natural_positions?: string[];
  }[];
}

export function teamFromDict(d: TeamDict): Team {
  const formation = d.formation;
  if (!(formation in FORMATIONS)) {
    throw new Error(`Unknown formation ${formation}; available: ${Object.keys(FORMATIONS).sort().join(", ")}`);
  }
  const rolesNeeded = new Set(Object.keys(FORMATIONS[formation]));
  const players: Player[] = [];
  for (const pd of d.players) {
    const role = pd.role;
    if (!rolesNeeded.has(role)) throw new Error(`Role ${role} not in formation ${formation}`);
    const p = new Player({
      pid: pd.pid, name: pd.name, teamId: d.team_id, role,
      attrs: attributesFromDict(pd.attributes ?? {}),
      isGk: role === "GK",
      form: Number(pd.form ?? 50.0),
      sharpness: Number(pd.sharpness ?? 100.0),
      naturalPositions: pd.natural_positions ?? [],
    });
    p.initModifiers(role);
    players.push(p);
  }
  const rolesHave = new Set(players.map((p) => p.role));
  if (rolesHave.size !== rolesNeeded.size || ![...rolesNeeded].every((r) => rolesHave.has(r))) {
    throw new Error(`Formation ${formation} needs roles ${[...rolesNeeded].sort().join(",")}`);
  }
  return new Team({
    teamId: d.team_id, name: d.name, formation, players,
    synergy: Number(d.synergy ?? 50.0),
    instructions: TeamInstructions.fromDict(d.instructions),
  });
}

export function simulateMatch(teamA: TeamDict, teamB: TeamDict,
                              config: Partial<Config> | null = null, seed = 0): MatchResult {
  const cfg = new Config(config ?? {});
  const ta = teamFromDict(teamA);
  const tb = teamFromDict(teamB);
  const state = runMatch(ta, tb, cfg, seed);
  return buildResult(state, seed);
}
