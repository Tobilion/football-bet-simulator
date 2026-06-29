import { useState } from "react";
import {
  BetSelection,
  BetBuilderSelection,
  BetBuilderTicket,
  BetTicket,
  Fixture,
  MarketType,
  Profile,
  Team,
  Tipster,
} from "../types";
import { persistStateToCache } from "../utils/storage";
import { addToast } from "../hooks/useToast";

interface UseBettingDeps {
  userProfile: Profile | null;
  setUserProfile: React.Dispatch<React.SetStateAction<Profile | null>>;
  fixtures: Fixture[];
  teams: Team[];
  tipsters: Tipster[];
  tipsterTickets: { [id: string]: BetTicket };
  gameMode: "TOURNAMENT" | "LEAGUE" | null;
  activeSlot: number;
  setCollapsedSlip: React.Dispatch<React.SetStateAction<boolean>>;
}

const OUTCOME_MARKETS: MarketType[] = ["MATCH_WINNER", "DOUBLE_CHANCE", "EXACT_SCORE"];

export function useBetting(deps: UseBettingDeps) {
  const {
    userProfile,
    setUserProfile,
    fixtures,
    teams,
    tipsters,
    tipsterTickets,
    gameMode,
    activeSlot,
    setCollapsedSlip,
  } = deps;

  const [selectedBets, setSelectedBets] = useState<BetSelection[]>([]);

  const persist = (profile: Profile) =>
    persistStateToCache(gameMode, activeSlot, profile, teams, fixtures, tipsters, tipsterTickets);

  const handleAddBetSelection = (newSel: BetSelection) => {
    setCollapsedSlip(false);
    setSelectedBets((prev) => {
      let filtered = prev;
      if (newSel.marketType === "ANYTIME_GOALSCORER") {
        filtered = prev.filter(
          (s) =>
            !(
              s.fixtureId === newSel.fixtureId &&
              s.marketType === "ANYTIME_GOALSCORER" &&
              s.selectionId === newSel.selectionId
            ),
        );
      } else if (OUTCOME_MARKETS.includes(newSel.marketType)) {
        filtered = prev.filter(
          (s) =>
            !(
              s.fixtureId === newSel.fixtureId &&
              OUTCOME_MARKETS.includes(s.marketType)
            ),
        );
      } else {
        filtered = prev.filter(
          (s) =>
            !(
              s.fixtureId === newSel.fixtureId &&
              s.marketType === newSel.marketType
            ),
        );
      }
      return [...filtered, newSel];
    });
  };

  const handleAddMultipleSelections = (newSels: BetSelection[]) => {
    setCollapsedSlip(false);
    setSelectedBets((prev) => {
      let current = [...prev];
      newSels.forEach((newSel) => {
        if (newSel.marketType === "ANYTIME_GOALSCORER") {
          current = current.filter(
            (s) =>
              !(
                s.fixtureId === newSel.fixtureId &&
                s.marketType === "ANYTIME_GOALSCORER" &&
                s.selectionId === newSel.selectionId
              ),
          );
        } else if (OUTCOME_MARKETS.includes(newSel.marketType)) {
          current = current.filter(
            (s) =>
              !(
                s.fixtureId === newSel.fixtureId &&
                OUTCOME_MARKETS.includes(s.marketType)
              ),
          );
        } else {
          current = current.filter(
            (s) =>
              !(
                s.fixtureId === newSel.fixtureId &&
                s.marketType === newSel.marketType
              ),
          );
        }
        current.push(newSel);
      });
      return current;
    });
  };

  const handleRemoveSelection = (
    fixtureId: string,
    marketType: MarketType,
    selectionId: string,
  ) => {
    setSelectedBets((prev) =>
      prev.filter(
        (s) =>
          !(
            s.fixtureId === fixtureId &&
            s.marketType === marketType &&
            s.selectionId === selectionId
          ),
      ),
    );
  };

  const handleClearAllSelections = () => setSelectedBets([]);

  const handlePlaceBet = (
    type: "SINGLE" | "ACCUMULATOR",
    totalStake: number,
    selectionStakes?: { [secId: string]: number },
  ) => {
    if (!userProfile) return;
    if (userProfile.balance < totalStake) {
      alert("Insufficient wallet balance!");
      return;
    }

    const totalOdds =
      Math.round(selectedBets.reduce((acc, b) => acc * b.odds, 1) * 100) / 100;

    const newTicket: BetTicket = {
      id: `ticket-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type,
      selections: [...selectedBets],
      totalOdds: type === "SINGLE" ? 1 : totalOdds,
      stake: totalStake,
      potentialPayout:
        type === "SINGLE"
          ? Math.round(
              selectedBets.reduce((sum, b) => {
                const key = `${b.fixtureId}-${b.marketType}-${b.selectionId}`;
                const st = selectionStakes?.[key] || 0;
                return sum + st * b.odds;
              }, 0) * 100,
            ) / 100
          : Math.round(totalStake * totalOdds * 100) / 100,
      status: "PENDING",
      timestamp: Date.now(),
      selectionStakes,
    };

    const nextBalance = Math.round((userProfile.balance - totalStake) * 100) / 100;
    const nextProfile: Profile = {
      ...userProfile,
      balance: nextBalance,
      tickets: [...userProfile.tickets, newTicket],
    };

    setUserProfile(nextProfile);
    setSelectedBets([]);
    persist(nextProfile);
  };

  const handleCashOut = (ticketId: string, offerAmount: number) => {
    if (!userProfile) return;
    const nextTickets = userProfile.tickets.map((t) =>
      t.id === ticketId && t.status === "PENDING"
        ? { ...t, status: "CASHED_OUT" as const, cashedOutAmount: offerAmount, cashedOutRound: userProfile.currentRoundIndex }
        : t,
    );
    const nextBalance = Math.round((userProfile.balance + offerAmount) * 100) / 100;
    const nextProfile: Profile = {
      ...userProfile,
      balance: nextBalance,
      tickets: nextTickets,
    };
    addToast({ type: "cashout", title: "💸 Cashed Out", message: `$${offerAmount.toFixed(2)} added to wallet`, duration: 4000 });
    setUserProfile(nextProfile);
    persist(nextProfile);
  };

  const handlePlaceBetBuilder = (
    fixtureId: string,
    selections: BetBuilderSelection[],
    stake: number,
    combinedOdds: number,
  ): boolean => {
    if (!userProfile || userProfile.balance < stake || stake <= 0) return false;
    const ticket: BetBuilderTicket = {
      id: `bb-${Date.now()}`,
      fixtureId,
      selections,
      combinedOdds,
      stake,
      potentialPayout: Math.round(stake * combinedOdds * 100) / 100,
      status: "PENDING",
      placedAt: userProfile.currentRoundIndex,
    };
    const nextProfile = {
      ...userProfile,
      balance: userProfile.balance - stake,
      betBuilderTickets: [...(userProfile.betBuilderTickets || []), ticket],
    };
    setUserProfile(nextProfile);
    persist(nextProfile);
    return true;
  };

  return {
    selectedBets,
    setSelectedBets,
    handleAddBetSelection,
    handleAddMultipleSelections,
    handleRemoveSelection,
    handleClearAllSelections,
    handlePlaceBet,
    handleCashOut,
    handlePlaceBetBuilder,
  };
}
