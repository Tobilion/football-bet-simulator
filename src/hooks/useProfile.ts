import { useState } from "react";
import { Profile, Team, Fixture, Tipster, BetTicket, ClubOwnership, PurchasedItem } from "../types";
import { persistStateToCache, getKeysForMode } from "../utils/storage";

interface UseProfileDeps {
  gameMode: "TOURNAMENT" | "LEAGUE" | null;
  activeSlot: number;
  teams: Team[];
  setTeams: React.Dispatch<React.SetStateAction<Team[]>>;
  fixtures: Fixture[];
  tipsters: Tipster[];
  tipsterTickets: { [id: string]: BetTicket };
}

export function useProfile(deps: UseProfileDeps) {
  const { gameMode, activeSlot, teams, setTeams, fixtures, tipsters, tipsterTickets } = deps;

  const [userProfile, setUserProfile] = useState<Profile | null>(null);

  const persist = (
    profile: Profile,
    t: Team[] = teams,
    f: Fixture[] = fixtures,
    ts: Tipster[] = tipsters,
    tt: { [id: string]: BetTicket } = tipsterTickets,
  ) => persistStateToCache(gameMode, activeSlot, profile, t, f, ts, tt);

  const handleUpdateBalanceCasino = (update: number | ((prev: number) => number)) => {
    setUserProfile((prev) => {
      if (!prev) return prev;
      let nextBalance = typeof update === "function" ? update(prev.balance) : update;
      nextBalance = Math.max(0, nextBalance);
      const updated: Profile = {
        ...prev,
        balance: Math.round(nextBalance * 100) / 100,
        netProfit: Math.round((prev.netProfit + (nextBalance - prev.balance)) * 100) / 100,
      };
      if (gameMode) {
        localStorage.setItem(
          getKeysForMode(gameMode, activeSlot).profile,
          JSON.stringify(updated),
        );
      }
      return updated;
    });
  };

  const handleConfirmWalletTransaction = (
    amount: number,
    action: "DEPOSIT" | "WITHDRAW",
  ): boolean => {
    if (!userProfile) return false;
    let hasFunds = true;
    setUserProfile((prev) => {
      if (!prev) return prev;
      if (action === "WITHDRAW" && prev.balance < amount) {
        hasFunds = false;
        return prev;
      }
      const multiplier = action === "DEPOSIT" ? 1 : -1;
      const nextBalance = Math.round((prev.balance + amount * multiplier) * 100) / 100;
      const nextProfile: Profile = { ...prev, balance: nextBalance };
      if (gameMode) {
        localStorage.setItem(
          getKeysForMode(gameMode, activeSlot).profile,
          JSON.stringify(nextProfile),
        );
      }
      return nextProfile;
    });
    if (!hasFunds) {
      alert("Insufficient wallet balance for withdrawal!");
      return false;
    }
    return true;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handlePurchaseVIPItem = (itemDetails: any) => {
    if (!userProfile) return;
    if (userProfile.balance < itemDetails.price) return;

    const newItem: PurchasedItem = {
      id: Math.random().toString(36).substring(7),
      name: itemDetails.name,
      description: itemDetails.description || "",
      price: itemDetails.price,
      worth: itemDetails.worth ?? Math.round(itemDetails.price * 0.7),
      icon: itemDetails.icon || "🏆",
      dateStr: new Date().toLocaleDateString(),
      imageUrl: itemDetails.imageUrl,
      category: itemDetails.category,
      rarity: itemDetails.rarity,
    };

    let nextTeams = teams;
    if (itemDetails.category === "Football Clubs" && itemDetails.teamId) {
      const targetTeam = teams.find((t) => t.id === itemDetails.teamId);
      if (targetTeam && !targetTeam.ownership) {
        const defaultStarters = targetTeam.players.slice(0, 11).map((p) => p.id);
        const ownership: ClubOwnership = {
          clubId: targetTeam.id,
          purchasedAt: Date.now(),
          purchasePrice: itemDetails.price,
          trainingFacilityLevel: 1,
          stadiumLevel: 1,
          totalInvested: itemDetails.price,
          passiveIncomePerMatch: 50000,
          formation: "4-4-2",
          mentality: "Balanced",
          pressingStyle: "Mid Block",
          starterIds: defaultStarters,
          matchesManaged: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          totalGoalsFor: 0,
          totalGoalsAgainst: 0,
        };
        nextTeams = teams.map((t) =>
          t.id === itemDetails.teamId ? { ...t, ownership } : t,
        );
        setTeams(nextTeams);
      }
    }

    const nextProfile: Profile = {
      ...userProfile,
      balance: userProfile.balance - itemDetails.price,
      purchasedItems: [...(userProfile.purchasedItems || []), newItem],
      ownedTeamId:
        itemDetails.category === "Football Clubs" && itemDetails.teamId
          ? itemDetails.teamId
          : userProfile.ownedTeamId,
    };
    setUserProfile(nextProfile);
    persist(nextProfile, nextTeams);
  };

  const handleUpdateClubOwnership = (
    teamId: string,
    updates: Partial<ClubOwnership>,
  ) => {
    const nextTeams = teams.map((t) =>
      t.id === teamId && t.ownership
        ? { ...t, ownership: { ...t.ownership, ...updates } }
        : t,
    );
    setTeams(nextTeams);
    if (userProfile) persist(userProfile, nextTeams);
  };

  const handleUpgradeFacility = (
    teamId: string,
    type: "training" | "stadium",
  ) => {
    if (!userProfile) return;
    const team = teams.find((t) => t.id === teamId);
    if (!team?.ownership) return;
    const lvl =
      type === "training"
        ? team.ownership.trainingFacilityLevel
        : team.ownership.stadiumLevel;
    const cost = type === "training" ? lvl * 2_000_000 : lvl * 5_000_000;
    if (userProfile.balance < cost) return;
    const newIncome =
      type === "stadium"
        ? (lvl + 1) * 50_000
        : team.ownership.passiveIncomePerMatch;
    const nextTeams = teams.map((t) =>
      t.id === teamId && t.ownership
        ? {
            ...t,
            ownership: {
              ...t.ownership,
              trainingFacilityLevel:
                type === "training" ? lvl + 1 : t.ownership.trainingFacilityLevel,
              stadiumLevel: type === "stadium" ? lvl + 1 : t.ownership.stadiumLevel,
              totalInvested: t.ownership.totalInvested + cost,
              passiveIncomePerMatch: newIncome,
            },
          }
        : t,
    );
    const nextProfile: Profile = {
      ...userProfile,
      balance: userProfile.balance - cost,
    };
    setTeams(nextTeams);
    setUserProfile(nextProfile);
    persist(nextProfile, nextTeams);
  };

  const handleLiquidateVIPItem = (item: { id: string; worth: number }) => {
    if (!userProfile) return;
    const nextProfile: Profile = {
      ...userProfile,
      balance: userProfile.balance + item.worth,
      purchasedItems: (userProfile.purchasedItems || []).filter(
        (i) => i.id !== item.id,
      ),
    };
    setUserProfile(nextProfile);
    persist(nextProfile);
  };

  return {
    userProfile,
    setUserProfile,
    persist,
    handleUpdateBalanceCasino,
    handleConfirmWalletTransaction,
    handlePurchaseVIPItem,
    handleUpdateClubOwnership,
    handleUpgradeFacility,
    handleLiquidateVIPItem,
  };
}
