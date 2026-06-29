import { Profile, Team, Fixture, Tipster, BetTicket } from "../types";

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

export const persistStateToCache = (
  gameMode: "TOURNAMENT" | "LEAGUE" | null,
  activeSlot: number,
  updatedProfile: Profile,
  updatedTeams: Team[],
  updatedFixtures: Fixture[],
  updatedTipsters: Tipster[],
  updatedTipsterTickets: { [id: string]: BetTicket },
) => {
  if (!gameMode) return;
  const keys = getKeysForMode(gameMode, activeSlot);
  localStorage.setItem(keys.profile, JSON.stringify(updatedProfile));
  localStorage.setItem(keys.teams, JSON.stringify(updatedTeams));
  localStorage.setItem(keys.fixtures, JSON.stringify(updatedFixtures));
  localStorage.setItem(keys.tipsters, JSON.stringify(updatedTipsters));
  localStorage.setItem(
    keys.tipsterTickets,
    JSON.stringify(updatedTipsterTickets),
  );
};
