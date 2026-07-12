import { CareerProfile, Profile, SeasonRecord } from "../types";

const PRESTIGE_TITLES = ["Punter", "Sharp", "Pro", "Elite", "Legend", "GOAT"];
const CAREER_STORAGE_KEY = "fs_career_v1";

export function getPrestigeTitle(seasonsPlayed: number): string {
  const level = Math.floor(seasonsPlayed / 3);
  return PRESTIGE_TITLES[Math.min(level, PRESTIGE_TITLES.length - 1)];
}

export function emptyCareerProfile(): CareerProfile {
  return {
    totalSeasonsPlayed: 0,
    allTimeProfit: 0,
    allTimeWinRate: 0,
    bestSeason: null,
    records: [],
    prestigeLevel: 0,
    prestigeTitle: PRESTIGE_TITLES[0],
  };
}

export function buildSeasonRecord(
  userProfile: Profile,
  champion: string,
  mode: "TOURNAMENT" | "LEAGUE",
  seasonNumber: number,
): SeasonRecord {
  // Legacy bet-builder tickets count toward stats like regular tickets.
  const legacyBB = (userProfile.betBuilderTickets || []).map((bb) => ({
    status: bb.status,
    stake: bb.stake,
    potentialPayout: bb.potentialPayout,
    cashedOutAmount: undefined as number | undefined,
  }));
  const allTickets = [...userProfile.tickets, ...legacyBB];
  const settled = allTickets.filter(
    (t) => t.status === "WON" || t.status === "LOST" || t.status === "CASHED_OUT",
  );
  // Cashing out for any amount is a positive resolution and counts as a win.
  const won = settled.filter((t) => t.status === "WON" || t.status === "CASHED_OUT");
  const biggestWin = won.reduce(
    (max, t) =>
      Math.max(max, (t.status === "CASHED_OUT" ? (t.cashedOutAmount ?? 0) : t.potentialPayout) - t.stake),
    0,
  );
  const netProfit = settled.reduce((acc, t) => {
    if (t.status === "WON") return acc + (t.potentialPayout - t.stake);
    if (t.status === "LOST") return acc - t.stake;
    if (t.status === "CASHED_OUT") return acc + ((t.cashedOutAmount ?? 0) - t.stake);
    return acc;
  }, 0);

  return {
    seasonNumber,
    mode,
    startBalance: Math.round((userProfile.balance - netProfit) * 100) / 100,
    endBalance: userProfile.balance,
    netProfit: Math.round(netProfit * 100) / 100,
    totalBetsPlaced: allTickets.length,
    totalBetsWon: won.length,
    winRate: settled.length > 0 ? Math.round((won.length / settled.length) * 100) : 0,
    biggestWin: Math.round(biggestWin * 100) / 100,
    completedAt: new Date().toISOString(),
    champion,
  };
}

export function updateCareerProfile(
  career: CareerProfile,
  newRecord: SeasonRecord,
): CareerProfile {
  const records = [...career.records, newRecord];
  const totalSeasonsPlayed = records.length;
  const allTimeProfit =
    Math.round(records.reduce((acc, r) => acc + r.netProfit, 0) * 100) / 100;
  const totalWon = records.reduce((acc, r) => acc + r.totalBetsWon, 0);
  const totalPlaced = records.reduce((acc, r) => acc + r.totalBetsPlaced, 0);
  const bestSeason = records.reduce<SeasonRecord | null>(
    (best, r) => (!best || r.netProfit > best.netProfit ? r : best),
    null,
  );
  return {
    totalSeasonsPlayed,
    allTimeProfit,
    allTimeWinRate: totalPlaced > 0 ? Math.round((totalWon / totalPlaced) * 100) : 0,
    bestSeason,
    records,
    prestigeLevel: Math.floor(totalSeasonsPlayed / 3),
    prestigeTitle: getPrestigeTitle(totalSeasonsPlayed),
  };
}

export function loadCareerProfile(): CareerProfile {
  try {
    const raw = localStorage.getItem(CAREER_STORAGE_KEY);
    if (!raw) return emptyCareerProfile();
    return { ...emptyCareerProfile(), ...JSON.parse(raw) };
  } catch {
    return emptyCareerProfile();
  }
}

export function saveCareerProfile(career: CareerProfile): void {
  localStorage.setItem(CAREER_STORAGE_KEY, JSON.stringify(career));
}

/** Records a finished season into localStorage and returns the updated career. */
export function recordSeasonEnd(
  userProfile: Profile,
  champion: string,
  mode: "TOURNAMENT" | "LEAGUE",
): CareerProfile {
  const career = loadCareerProfile();
  const record = buildSeasonRecord(userProfile, champion, mode, career.totalSeasonsPlayed + 1);
  const updated = updateCareerProfile(career, record);
  saveCareerProfile(updated);
  return updated;
}
