// Core entities (port of entities.py).
import { V2 } from "./vec";
import { CATEGORY, roleFit, staticMods, liveMod } from "./modifiers";

export const ATTR_KEYS = [
  "passing", "first_touch", "tackling", "marking", "dribbling", "finishing",
  "crossing", "heading", "pace", "acceleration", "stamina", "strength", "agility",
  "positioning", "decisions", "anticipation", "composure", "work_rate", "teamwork",
  "vision", "aggression", "shot_stopping", "handling", "reflexes", "positioning_gk",
  "command_of_area",
] as const;

export type Attributes = Record<string, number>;

export function attributesFromDict(d: Record<string, unknown>): Attributes {
  const a: Attributes = {};
  for (const k of ATTR_KEYS) a[k] = 50.0;
  for (const k of Object.keys(d)) if ((ATTR_KEYS as readonly string[]).includes(k)) a[k] = Number(d[k]);
  return a;
}

export class Player {
  pid: string;
  name: string;
  teamId: string;
  role: string;
  attrs: Attributes;
  isGk: boolean;

  pos: V2 = [0, 0];
  vel: V2 = [0, 0];
  staminaLevel = 1.0;
  rating = 6.0;
  yellowCards = 0;
  sentOff = false;

  form = 50.0;
  sharpness = 100.0;
  naturalPositions: string[] = [];
  private staticModsMap: Record<string, number> = {};

  constructor(init: {
    pid: string; name: string; teamId: string; role: string; attrs: Attributes;
    isGk?: boolean; form?: number; sharpness?: number; naturalPositions?: string[];
  }) {
    this.pid = init.pid;
    this.name = init.name;
    this.teamId = init.teamId;
    this.role = init.role;
    this.attrs = init.attrs;
    this.isGk = init.isGk ?? false;
    this.form = init.form ?? 50.0;
    this.sharpness = init.sharpness ?? 100.0;
    this.naturalPositions = init.naturalPositions ?? [];
  }

  initModifiers(assignedRole: string): void {
    const nats = this.naturalPositions.length ? this.naturalPositions : [assignedRole];
    const fit = roleFit(assignedRole, nats);
    this.staticModsMap = staticMods(this.form, this.sharpness, fit);
  }

  eff(name: string): number {
    const base = this.attrs[name] ?? 50.0;
    const cat = CATEGORY[name] ?? "mental";
    const stat = this.staticModsMap[cat] ?? 1.0;
    return Math.min(100.0, base * stat * liveMod(this.rating, this.staminaLevel, cat));
  }

  maxSpeed(): number {
    const base = 5.0 + (this.attrs.pace / 100.0) * 3.6;
    return base * (0.75 + 0.25 * this.staminaLevel);
  }

  maxAccel(): number {
    const accel = 0.75 * this.attrs.acceleration + 0.25 * this.attrs.agility;
    const base = 3.5 + (accel / 100.0) * 3.5;
    return base * (0.8 + 0.2 * this.staminaLevel);
  }
}

export class Ball {
  pos: V2;
  vel: V2 = [0, 0];
  owner: string | null = null;
  inFlight = false;
  flightKind = "";
  flightFrom: string | null = null;
  flightTarget: string | null = null;
  flightMeta: Record<string, unknown> = {};
  constructor(pos: V2 = [0, 0], owner: string | null = null) {
    this.pos = [pos[0], pos[1]];
    this.owner = owner;
  }
}

export class TeamInstructions {
  pressing = 50.0;
  lineHeight = 50.0;
  width = 50.0;
  tempo = 50.0;
  mentality = 50.0;
  static fromDict(d: Record<string, unknown> | null | undefined): TeamInstructions {
    const t = new TeamInstructions();
    const dd = d ?? {};
    const map: Record<string, keyof TeamInstructions> = {
      pressing: "pressing", line_height: "lineHeight", lineHeight: "lineHeight",
      width: "width", tempo: "tempo", mentality: "mentality",
    };
    for (const k of Object.keys(dd)) {
      const f = map[k];
      if (f) (t[f] as number) = Number((dd as Record<string, unknown>)[k]);
    }
    return t;
  }
}

export class Team {
  teamId: string;
  name: string;
  formation: string;
  players: Player[];
  attackingRight = true;
  synergy = 50.0;
  instructions: TeamInstructions;
  constructor(init: {
    teamId: string; name: string; formation: string; players: Player[];
    synergy?: number; instructions?: TeamInstructions;
  }) {
    this.teamId = init.teamId;
    this.name = init.name;
    this.formation = init.formation;
    this.players = init.players;
    this.synergy = init.synergy ?? 50.0;
    this.instructions = init.instructions ?? new TeamInstructions();
  }
  gk(): Player {
    const g = this.players.find((p) => p.isGk);
    if (!g) throw new Error("no GK");
    return g;
  }
  outfield(): Player[] {
    return this.players.filter((p) => !p.isGk);
  }
  active(): Player[] {
    return this.players.filter((p) => !p.sentOff);
  }
}
