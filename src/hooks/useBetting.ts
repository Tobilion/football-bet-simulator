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
import { settlePendingTickets } from "../utils/betSettlement";
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

  const sameSelection = (a: BetSelection, b: BetSelection) =>
    a.fixtureId === b.fixtureId &&
    a.marketType === b.marketType &&
    a.selectionId === b.selectionId;

  const handleAddBetSelection = (newSel: BetSelection) => {
    setCollapsedSlip(false);
    // Pure toggle: clicking a selection adds it, clicking it again removes it.
    // Mutually-exclusive outcomes from the same match (e.g. Home + Away) are now
    // allowed to coexist in the slip so they can be placed as separate singles.
    // The accumulator view enforces exclusivity separately (see BettingSlip).
    setSelectedBets((prev) => {
      const exists = prev.some((s) => sameSelection(s, newSel));
      if (exists) return prev.filter((s) => !sameSelection(s, newSel));
      return [...prev, newSel];
    });
  };

  const handleAddMultipleSelections = (newSels: BetSelection[]) => {
    setCollapsedSlip(false);
    setSelectedBets((prev) => {
      const current = [...prev];
      newSels.forEach((newSel) => {
        if (!current.some((s) => sameSelection(s, newSel))) current.push(newSel);
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

    let newTickets: BetTicket[];
    if (type === "SINGLE") {
      // Each single is its OWN independent ticket — its own stake, odds,
      // settlement and cash-out. Placing several singles at once no longer
      // groups them into a single multi-leg ticket.
      const ts = Date.now();
      newTickets = selectedBets.map((b, i) => {
        const key = `${b.fixtureId}-${b.marketType}-${b.selectionId}`;
        const stake = round2(selectionStakes?.[key] ?? totalStake / selectedBets.length);
        return {
          id: `ticket-${ts}-${i}-${Math.floor(Math.random() * 1000)}`,
          type: "SINGLE" as const,
          selections: [b],
          totalOdds: b.odds,
          stake,
          potentialPayout: round2(stake * b.odds),
          status: "PENDING" as const,
          timestamp: ts,
        };
      });
    } else {
      // Same-game-multi pricing: same-fixture legs get a correlation discount.
      const totalOdds = computeAccaOdds(selectedBets);
      newTickets = [{
        id: `ticket-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type,
        selections: [...selectedBets],
        totalOdds,
        stake: totalStake,
        potentialPayout: Math.round(totalStake * totalOdds * 100) / 100,
        status: "PENDING",
        timestamp: Date.now(),
      }];
    }

    const nextProfile: Profile = {
      ...userProfile,
      balance: debited,
      tickets: [...userProfile.tickets, ...newTickets],
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

  /**
   * Auto-settles any PENDING ticket whose fixtures have all reached FT, without
   * waiting for a round advance. This prevents tickets from sitting in a
   * pending/"suspended" limbo after their matches finish. Returns silently when
   * nothing is settleable so it is safe to call from an effect on every tick.
   */
  const settleFinishedTickets = () => {
    if (!userProfile) return;
    const ftFixtures = fixtures.filter((f) => f.status === "FT");
    if (ftFixtures.length === 0) return;

    const settleable = userProfile.tickets.some(
      (t) =>
        t.status === "PENDING" &&
        t.selections.every((sel) =>
          ftFixtures.some((f) => f.id === sel.fixtureId),
        ),
    );
    if (!settleable) return;

    const { finalTickets, totalWinPayoutSum } = settlePendingTickets(
      userProfile.tickets,
      ftFixtures,
    );

    finalTickets.forEach((ticket, idx) => {
      if (userProfile.tickets[idx]?.status === "PENDING" && ticket.status !== "PENDING") {
        if (ticket.status === "WON") {
          addToast({ type: "win", title: "🏆 Ticket Won!", message: `+$${(ticket.settledPayout ?? ticket.potentialPayout).toFixed(2)} payout`, duration: 5000 });
        } else if (ticket.status === "LOST") {
          addToast({ type: "loss", title: "Ticket Lost", message: `-$${ticket.stake.toFixed(2)} stake lost`, duration: 3000 });
        }
      }
    });

    const nextProfile: Profile = {
      ...userProfile,
      balance: credit(userProfile.balance, totalWinPayoutSum),
      tickets: finalTickets,
    };
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
    settleFinishedTickets,
    handlePlaceBetBuilder,
  };
}
