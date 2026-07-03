import { useState } from "react";
import {
  BetSelection,
  BetBuilderSelection,
  BetTicket,
  Fixture,
  MarketType,
  Profile,
  Team,
  Tipster,
} from "../types";
import { persistStateToCache } from "../utils/storage";
import { credit, debit, round2 } from "../utils/wallet";
import { computeAccaOdds } from "../utils/betBuilderUtils";
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
    if (!Number.isFinite(totalStake) || totalStake <= 0) {
      alert("Stake must be greater than zero.");
      return;
    }
    if (type === "SINGLE" && selectionStakes) {
      const sum = round2(Object.values(selectionStakes).reduce((a, b) => a + (b || 0), 0));
      if (Math.abs(sum - totalStake) > 0.01) {
        alert("Per-selection stakes must add up to the total stake.");
        return;
      }
    }
    const debited = debit(userProfile.balance, totalStake);
    if (debited === null) {
      alert("Insufficient wallet balance!");
      return;
    }

    // Same-game-multi pricing: same-fixture legs get a correlation discount.
    const totalOdds = computeAccaOdds(selectedBets);

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

    const nextBalance = debited;
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
    const target = userProfile.tickets.find((t) => t.id === ticketId);
    if (!target || target.status !== "PENDING") return; // guard against double cash-out
    const nextTickets = userProfile.tickets.map((t) =>
      t.id === ticketId && t.status === "PENDING"
        ? { ...t, status: "CASHED_OUT" as const, cashedOutAmount: offerAmount, cashedOutRound: userProfile.currentRoundIndex }
        : t,
    );
    const nextBalance = credit(userProfile.balance, offerAmount);
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
    if (!userProfile) return false;
    const bbDebited = debit(userProfile.balance, stake);
    if (bbDebited === null) return false;
    // Same-game multis are regular tickets: they appear in the bet list,
    // analytics, and settle through the normal pipeline.
    const ticket: BetTicket = {
      id: `sgm-${Date.now()}`,
      type: "ACCUMULATOR",
      selections: selections.map((s) => ({
        fixtureId,
        marketType: s.marketType,
        selectionId: s.selectionId,
        odds: s.odds,
        details: s.label,
        marketName: "Same Game Multi",
      })),
      totalOdds: combinedOdds,
      stake,
      potentialPayout: Math.round(stake * combinedOdds * 100) / 100,
      status: "PENDING",
      timestamp: Date.now(),
    };
    const nextProfile = {
      ...userProfile,
      balance: bbDebited,
      tickets: [...userProfile.tickets, ticket],
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
