import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import type { Profile } from "../src/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Overridable so tests can point at a throwaway directory instead of the
// real save data (see tests/server-settlement.test.ts).
const DATA_DIR = process.env.CU_BET_DATA_DIR || join(__dirname, "data", "profiles");

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

export function profileKey(gameMode: "TOURNAMENT" | "LEAGUE", slot: number): string {
  return `${gameMode.toLowerCase()}_slot${slot}`;
}

function profilePath(gameMode: "TOURNAMENT" | "LEAGUE", slot: number): string {
  return join(DATA_DIR, `${profileKey(gameMode, slot)}.json`);
}

/** Reads the server's canonical profile for a slot, or null if none exists yet. */
export function readProfile(gameMode: "TOURNAMENT" | "LEAGUE", slot: number): Profile | null {
  const path = profilePath(gameMode, slot);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Profile;
  } catch {
    return null;
  }
}

/** Persists the server's canonical profile for a slot. */
export function writeProfile(
  gameMode: "TOURNAMENT" | "LEAGUE",
  slot: number,
  profile: Profile,
): void {
  ensureDataDir();
  writeFileSync(profilePath(gameMode, slot), JSON.stringify(profile, null, 2), "utf-8");
}

/**
 * First-contact bootstrap: if the server has never seen this slot before, seed
 * it from whatever the client currently has (there is no account/auth system,
 * so "first write wins" is the only reasonable origin of truth). If the
 * server already has a profile, the client's copy is ignored — the server's
 * stored profile is always what's returned from here on.
 */
export function bootstrapProfile(
  gameMode: "TOURNAMENT" | "LEAGUE",
  slot: number,
  clientProfile: Profile,
): Profile {
  const existing = readProfile(gameMode, slot);
  if (existing) return existing;
  writeProfile(gameMode, slot, clientProfile);
  return clientProfile;
}
