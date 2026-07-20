// Bridge: run a match with the ported footysim spatial engine and map its rich
// output back onto the site's Fixture/MatchStats/MatchEvent model.
//
// Used for the WATCHED match only (footysim is high-fidelity but ~1.5s/match).
// Bulk/instant round sims keep using the fast tick engine in matchEngine.
import { Team, Player, Position, MatchStats, MatchEvent } from "../types";
import { getStartingXI, strengthExpectedStats } from "./matchEngine";
import { RNG } from "./footysim/rng";
import { simulateMatch, TeamDict } from "./footysim/sim";
import { decimateFrames } from "./footysim/output";

// Native fidelity. A coarser tick (0.2s) roughly DOUBLED scoring because the ball
// travels ~4m per tick — far beyond the 1.3m control radius — so interceptions and
// keeper contests were silently skipped, producing absurd scorelines (9-1). The
// engine is calibrated for 0.1s ticks; keep them. Costs ~4s for the watched match.
const WATCH_CONFIG = {
  tickSeconds: 0.1, halfTicks: 27000, frameInterval: 20,
  decideInterval: 24, contestInterval: 5, duelEpisodeTicks: 60,
  duelGraceTicks: 25, carryLogInterval: 10,
};

const ROLES_433 = {
  GK: ["GK"], DEF: ["RB", "RCB", "LCB", "LB"], MID: ["RCM", "CM", "LCM"], ATT: ["RW", "ST", "LW"],
};
const ALL_ROLES = [...ROLES_433.GK, ...ROLES_433.DEF, ...ROLES_433.MID, ...ROLES_433.ATT];

/** Derive footysim's 26 attributes from the site's ability set (0-99) + rating.
 * Attributes are rating-DOMINANT (55% overall rating + 45% the specific ability)
 * so a stronger squad is unambiguously stronger on the pitch — otherwise raw
 * abilities cluster together and clear favourites lose too often. */
function attributesFor(p: Player): Record<string, number> {
  const a = p.abilities ?? {};
  const r = p.rating ?? 70;
  // The site rates players ~60-95; footysim is calibrated around ~50-70, where
  // higher absolute attributes inflate conversion (even sides were averaging ~4
  // goals). Compress into the engine's band while KEEPING the spread (slope
  // 0.85) so relative strength still decides matches.
  const band = (v: number) => Math.max(25, Math.min(92, 62 + (v - 75) * 0.85));
  const g = (v: number | undefined) => band(v == null ? r : 0.55 * r + 0.45 * v);
  const rr = band(r);
  const pass = g(a.passing), drib = g(a.dribbling), def = g(a.defending),
    phys = g(a.physical), pace = g(a.pace), shoot = g(a.shooting);
  return {
    passing: pass, first_touch: (pass + drib) / 2, tackling: def, marking: def,
    dribbling: drib, finishing: shoot, crossing: (pass + drib) / 2, heading: phys,
    pace, acceleration: pace, stamina: phys, strength: phys, agility: pace,
    positioning: rr, decisions: rr, anticipation: def, composure: rr, work_rate: rr,
    teamwork: rr, vision: pass, aggression: phys,
    // GK-specific (site GK abilities: diving/handling/reflexes/positioning)
    shot_stopping: g(a.diving ?? a.reflexes), handling: g(a.handling),
    reflexes: g(a.reflexes), positioning_gk: g(a.positioning), command_of_area: rr,
  };
}

/** Assign a team's best XI to 4-3-3 roles, filling shortfalls greedily. */
function toTeamDict(team: Team): { dict: TeamDict; pidMap: Map<string, Player> } {
  const xi = getStartingXI(team);
  const pidMap = new Map<string, Player>();
  const buckets: Record<string, Player[]> = { GK: [], DEF: [], MID: [], ATT: [] };
  for (const p of xi) (buckets[p.position] ?? buckets.MID).push(p);
  const gk = buckets.GK[0] ?? xi[0];
  const pool = xi.filter((p) => p.id !== gk.id);
  const assigned: { player: Player; role: string }[] = [{ player: gk, role: "GK" }];
  const used = new Set([gk.id]);
  const take = (prefer: Position): Player => {
    const fromBucket = buckets[prefer].find((p) => !used.has(p.id));
    const pick = fromBucket ?? pool.find((p) => !used.has(p.id))!;
    used.add(pick.id);
    return pick;
  };
  for (const role of ROLES_433.DEF) assigned.push({ player: take("DEF"), role });
  for (const role of ROLES_433.MID) assigned.push({ player: take("MID"), role });
  for (const role of ROLES_433.ATT) assigned.push({ player: take("ATT"), role });

  const players = assigned.map(({ player, role }) => {
    const pid = `${team.id}__${player.id}`;
    pidMap.set(pid, player);
    return {
      pid, name: player.name, role,
      attributes: attributesFor(player),
      natural_positions: [role],
      form: 50 + ((player.rating ?? 70) - 70) * 0.5,
      sharpness: Math.max(60, 100 - (player.fatigue ?? 0) * 0.4),
    };
  });
  const dict: TeamDict = {
    team_id: team.id, name: team.name, formation: "4-3-3",
    players, synergy: 55,
  };
  return { dict, pidMap };
}

const EMPTY_STATS = (): MatchStats["home"] => ({
  corners: 0, yellowCards: 0, redCards: 0, saves: 0, shots: 0,
  shotsOnTarget: 0, fouls: 0, passes: 0,
});

export interface FootysimMatch {
  homeScore: number;
  awayScore: number;
  stats: MatchStats;
  events: MatchEvent[];
  playerRatings: Record<string, number>; // site playerId -> rating
  frames: Record<string, unknown>[];     // decimated positional frames for a 2D viewer
  penaltyScore?: string;                 // knockout shootout result, e.g. "4-3"
  wentToExtraTime?: boolean;
}

function poissonSample(rng: RNG, lambda: number): number {
  if (lambda <= 0) return 0;
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= rng.random(); } while (p > L);
  return k - 1;
}

/**
 * Knockout ties can't end level. Plays 30 minutes of extra time (Poisson goals
 * from each side's expected rate, scaled to 30'), then a penalty shootout if
 * still level. Site convention: the shootout winner gets +0.1 on their score and
 * `penaltyScore` records the shootout.
 */
function resolveKnockout(
  homeTeam: Team, awayTeam: Team, seed: number,
  homeScore: number, awayScore: number, events: MatchEvent[],
): { homeScore: number; awayScore: number; penaltyScore?: string; wentToExtraTime: boolean } {
  if (homeScore !== awayScore) return { homeScore, awayScore, wentToExtraTime: false };
  const rng = new RNG((seed ^ 0x9e3779b9) >>> 0);
  const exp = strengthExpectedStats(homeTeam, awayTeam);
  const etH = poissonSample(rng, exp.home.goals * (30 / 90));
  const etA = poissonSample(rng, exp.away.goals * (30 / 90));
  let hs = homeScore + etH;
  let as_ = awayScore + etA;
  const pushEt = (n: number, team: Team) => {
    for (let i = 0; i < n; i++) {
      events.push({
        minute: 91 + Math.floor(rng.random() * 29),
        type: "GOAL", teamId: team.id,
        commentary: `⚽ Extra-time goal for ${team.name}`,
      } as MatchEvent);
    }
  };
  pushEt(etH, homeTeam);
  pushEt(etA, awayTeam);
  if (hs !== as_) return { homeScore: hs, awayScore: as_, wentToExtraTime: true };

  // Penalty shootout — conversion tilted slightly by squad quality.
  const quality = (t: Team) => {
    const xi = getStartingXI(t).filter((p) => !p.isReserve);
    const avg = xi.length ? xi.reduce((a, p) => a + (p.rating ?? 70), 0) / xi.length : 70;
    return Math.max(0.62, Math.min(0.86, 0.60 + (avg - 60) * 0.006));
  };
  const ph = quality(homeTeam), pa = quality(awayTeam);
  let hp = 0, ap = 0;
  for (let i = 0; i < 5; i++) {
    if (rng.random() < ph) hp++;
    if (rng.random() < pa) ap++;
  }
  let guard = 0;
  while (hp === ap && guard++ < 20) {
    const h = rng.random() < ph ? 1 : 0;
    const a = rng.random() < pa ? 1 : 0;
    hp += h; ap += a;
  }
  if (hp === ap) hp++; // absolute fallback
  const homeWon = hp > ap;
  hs = homeWon ? hs + 0.1 : hs;
  as_ = homeWon ? as_ : as_ + 0.1;
  events.push({
    minute: 120, type: "COMMENTARY",
    teamId: homeWon ? homeTeam.id : awayTeam.id,
    commentary: `🥅 Penalty shootout: ${(homeWon ? homeTeam : awayTeam).name} win ${Math.max(hp, ap)}-${Math.min(hp, ap)}`,
  } as MatchEvent);
  return { homeScore: hs, awayScore: as_, penaltyScore: `${hp}-${ap}`, wentToExtraTime: true };
}

/** Run the footysim engine for one fixture and map it to the site's model. */
export function simulateFixtureFootysim(
  homeTeam: Team, awayTeam: Team, seed: number,
  opts: { knockout?: boolean } = {},
): FootysimMatch {
  const { dict: hd, pidMap: hMap } = toTeamDict(homeTeam);
  const { dict: ad, pidMap: aMap } = toTeamDict(awayTeam);
  const res = simulateMatch(hd, ad, WATCH_CONFIG, seed);

  const bs = res.boxscore.teams;
  const home = bs[homeTeam.id];
  const away = bs[awayTeam.id];
  const mkStats = (t: Record<string, number>, oppShots: number): MatchStats["home"] => {
    const s = EMPTY_STATS();
    s.shots = Math.round(t.shots);
    s.shotsOnTarget = Math.round(t.shots_on_target);
    s.saves = Math.round(t.saves);
    s.yellowCards = Math.round(t.yellow_cards);
    s.redCards = Math.round(t.red_cards);
    s.fouls = Math.round(t.fouls);
    s.passes = Math.round(t.passes_completed);
    // footysim doesn't track corners: synthesise from attacking volume so the
    // betting markets stay populated (~10 total across both sides).
    s.corners = Math.max(2, Math.round(t.shots * 0.32 + (t.crosses ?? 0) * 0.25));
    void oppShots;
    return s;
  };
  const stats: MatchStats = {
    home: mkStats(home, away.shots),
    away: mkStats(away, home.shots),
  } as MatchStats;

  const nameOf = (pid: string): Player | undefined => hMap.get(pid) ?? aMap.get(pid);
  const teamIdOf = (pid: string): string | undefined => (hMap.has(pid) ? homeTeam.id : aMap.has(pid) ? awayTeam.id : undefined);
  const events: MatchEvent[] = [];
  for (const ev of res.events_key) {
    const type = ev.type as string;
    const actor = ev.actor as string | null;
    const player = actor ? nameOf(actor) : undefined;
    const minute = Math.max(1, Math.round(Number(ev.t) / 60));
    const teamId = actor ? teamIdOf(actor) : undefined;
    if (type === "goal") {
      events.push({ minute, type: "GOAL", teamId, playerId: player?.id, playerName: player?.name, commentary: `⚽ Goal! ${player?.name ?? ""}` });
    } else if (type === "save") {
      events.push({ minute, type: "SAVE", teamId, playerId: player?.id, playerName: player?.name, commentary: `🧤 Save by ${player?.name ?? "the keeper"}` });
    } else if (type === "yellow_card") {
      events.push({ minute, type: "YELLOW_CARD", teamId, playerId: player?.id, playerName: player?.name, commentary: `🟨 Yellow — ${player?.name ?? ""}` });
    } else if (type === "red_card") {
      events.push({ minute, type: "RED_CARD", teamId, playerId: player?.id, playerName: player?.name, commentary: `🟥 Red — ${player?.name ?? ""}` });
    }
  }

  const playerRatings: Record<string, number> = {};
  for (const [pid, rating] of Object.entries(res.ratings)) {
    const p = nameOf(pid);
    if (p) playerRatings[p.id] = rating;
  }

  let homeScore = res.final_score[homeTeam.id] ?? 0;
  let awayScore = res.final_score[awayTeam.id] ?? 0;
  let penaltyScore: string | undefined;
  let wentToExtraTime = false;
  if (opts.knockout) {
    const k = resolveKnockout(homeTeam, awayTeam, seed, homeScore, awayScore, events);
    homeScore = k.homeScore;
    awayScore = k.awayScore;
    penaltyScore = k.penaltyScore;
    wentToExtraTime = k.wentToExtraTime;
  }

  return {
    homeScore,
    awayScore,
    stats,
    events,
    playerRatings,
    frames: decimateFrames(res.frames, 240),
    penaltyScore,
    wentToExtraTime,
  };
}
