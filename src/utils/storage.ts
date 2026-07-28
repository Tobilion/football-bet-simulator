import { Profile, Team, Fixture, Tipster, BetTicket } from "../types";

/** Bump when the persisted shape changes incompatibly; old saves are discarded. */
export const SCHEMA_VERSION = 2;

export const isSaveCompatible = (keys: { profile: string }): boolean =>
  localStorage.getItem(`${keys.profile}_schema`) === String(SCHEMA_VERSION);

export const getKeysForMode = (
  mode: "TOURNAMENT" | "LEAGUE",
  slotNum: number = 1,
) => {
  const m = mode.toLowerCase();
  const suffix = `_slot${slotNum}`;
  return {
    profile: `fs_profile_v3_${m}${suffix}`,
    teams: `fs_teams_v3_${m}${suffix}`,
    fixtures: `fs_fixtures_v3_${m}${suffix}`,
    tipsters: `fs_tipsters_v3_${m}${suffix}`,
    tipsterTickets: `fs_tipster_tickets_v3_${m}${suffix}`,
  };
};

function fnv1a(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

export function signSave<T>(data: T, key: string): { data: T; hash: string } {
  return { data, hash: fnv1a(JSON.stringify(data) + key) };
}

function verifySave<T>(payload: { data: T; hash: string }, key: string): T | null {
  return fnv1a(JSON.stringify(payload.data) + key) === payload.hash ? payload.data : null;
}

export function persistStateToCache(
  gameMode: "TOURNAMENT" | "LEAGUE" | null,
  activeSlot: number,
  updatedProfile: Profile,
  updatedTeams: Team[],
  updatedFixtures: Fixture[],
  updatedTipsters: Tipster[],
  updatedTipsterTickets: { [id: string]: BetTicket },
) {
  if (!gameMode) return;
  const keys = getKeysForMode(gameMode, activeSlot);
  localStorage.setItem(`${keys.profile}_schema`, String(SCHEMA_VERSION));
  localStorage.setItem(keys.profile, JSON.stringify(signSave(updatedProfile, keys.profile)));
  localStorage.setItem(keys.teams, JSON.stringify(signSave(updatedTeams, keys.teams)));
  localStorage.setItem(keys.fixtures, JSON.stringify(signSave(updatedFixtures, keys.fixtures)));
  localStorage.setItem(keys.tipsters, JSON.stringify(signSave(updatedTipsters, keys.tipsters)));
  localStorage.setItem(keys.tipsterTickets, JSON.stringify(signSave(updatedTipsterTickets, keys.tipsterTickets)));
}

interface SignedPayload<T> {
  data: T;
  hash: string;
}

function tryLoadSigned<T>(raw: string | null, key: string): T | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "data" in parsed && "hash" in parsed) {
      return verifySave(parsed as SignedPayload<T>, key);
    }
    // Legacy save (pre-v2): return raw data as-is
    return parsed as T;
  } catch {
    return null;
  }
}

export function loadProfile(keys: ReturnType<typeof getKeysForMode>): Profile | null {
  return tryLoadSigned<Profile>(localStorage.getItem(keys.profile), keys.profile);
}

export function loadTeams(keys: ReturnType<typeof getKeysForMode>): Team[] | null {
  return tryLoadSigned<Team[]>(localStorage.getItem(keys.teams), keys.teams);
}

export function loadFixtures(keys: ReturnType<typeof getKeysForMode>): Fixture[] | null {
  return tryLoadSigned<Fixture[]>(localStorage.getItem(keys.fixtures), keys.fixtures);
}

export function loadTipsters(keys: ReturnType<typeof getKeysForMode>): Tipster[] | null {
  return tryLoadSigned<Tipster[]>(localStorage.getItem(keys.tipsters), keys.tipsters);
}

export function loadTipsterTickets(keys: ReturnType<typeof getKeysForMode>): { [id: string]: BetTicket } | null {
  return tryLoadSigned<{ [id: string]: BetTicket }>(localStorage.getItem(keys.tipsterTickets), keys.tipsterTickets);
}