import { useEffect, useRef, useState } from "react";
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
import { bootstrapWallet, placeBetOnServer, cashOutOnServer, settleOnServer, placeBetBuilderOnServer, type ServerFailure } from "../utils/apiClient";

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

  // Tri-state: null = not checked yet, true/false = last known reachability.
  // Once a call comes back "unreachable" we stop retrying the server for the
  // rest of the session (each attempt still has to time out first, so this
  // avoids a repeated ~1.2s stall on every bet when there's simply no server
  // running — the overwhelmingly common case for local/offline play).
  const serverAvailable = useRef<boolean | null>(null);

  useEffect(() => {
    if (!userProfile || !gameMode) return;
    let cancelled = false;
    bootstrapWallet({ gameMode, slot: activeSlot }, userProfile).then((result) => {
      if (cancelled) return;
      serverAvailable.current = result.ok;
      // If the server already had a profile for this slot (i.e. this isn't
      // the very first contact), its balance/tickets are now the truth —
      // reconcile local state to match so the two never silently diverge.
      if (result.ok && JSON.stringify(result.profile) !== JSON.stringify(userProfile)) {
        setUserProfile(result.profile);
      }
    });
    return () => { cancelled = true; };
    // Only re-run when the save slot itself changes, not on every profile edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameMode, activeSlot]);

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

  /**
   * Local (client-only) bet placement — the ORIGINAL logic, unchanged. This
   * runs whenever the wallet server isn't reachable, so offline play behaves
   * exactly as it always has. When the server IS reachable, handlePlaceBet
   * (below) defers to it instead, since the server recomputes this same
   * math against its own stored balance rather than trusting this one.
   */
  const placeBetLocally = (
    type: "SINGLE" | "ACCUMULATOR",
    totalStake: number,
    selectionStakes?: { [secId: string]: number },
  ) => {
    if (!userProfile) return;
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

  const handlePlaceBet = async (
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

    if (gameMode && serverAvailable.current !== false) {
      const result = await placeBetOnServer(
        { gameMode, slot: activeSlot },
        { type, totalStake, selectedBets, selectionStakes },
      );
      if (result.ok) {
        serverAvailable.current = true;
        setUserProfile(result.profile);
        setSelectedBets([]);
        persist(result.profile);
        return;
      }
      const failure = result as ServerFailure;
      if (failure.reason === "rejected") {
        // The server WAS reached and it has the real, authoritative balance
        // — trust its answer rather than falling through to local logic,
        // which could be operating on a stale/out-of-sync balance by now.
        serverAvailable.current = true;
        alert(failure.error);
        return;
      }
      // "unreachable": no server running (or it just went away) — fall back
      // to local computation exactly as before this feature existed.
      serverAvailable.current = false;
    }

    placeBetLocally(type, totalStake, selectionStakes);
  };

  /** Local (client-only) cash-out — the ORIGINAL logic, used when the server isn't reachable. */
  const cashOutLocally = (ticketId: string, offerAmount: number) => {
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
   * `offerAmount` is what the UI displayed to the user a moment ago (computed
   * client-side, same as always, for the on-screen "cash out for $X" button).
   * When the server is reachable it is NOT trusted here — the server
   * recomputes the fair value itself from the same fixtures and only ever
   * credits its own number. This is deliberate: a modified client could send
   * any `offerAmount` it likes, so the server treats it as a display hint,
   * never as the amount to actually pay out.
   */
  const handleCashOut = async (ticketId: string, offerAmount: number) => {
    if (!userProfile) return;

    if (gameMode && serverAvailable.current !== false) {
      const result = await cashOutOnServer({ gameMode, slot: activeSlot }, ticketId, fixtures);
      if (result.ok) {
        serverAvailable.current = true;
        addToast({
          type: "cashout", title: "💸 Cashed Out",
          message: `$${result.cashedOutAmount.toFixed(2)} added to wallet`, duration: 4000,
        });
        setUserProfile(result.profile);
        persist(result.profile);
        return;
      }
      const failure = result as ServerFailure;
      if (failure.reason === "rejected") {
        serverAvailable.current = true;
        alert(failure.error);
        return;
      }
      serverAvailable.current = false; // unreachable — fall back below
    }

    cashOutLocally(ticketId, offerAmount);
  };

  /**
   * Auto-settles any PENDING ticket whose fixtures have all reached FT, without
   * waiting for a round advance. This prevents tickets from sitting in a
   * pending/"suspended" limbo after their matches finish. Returns silently when
   * nothing is settleable so it is safe to call from an effect on every tick.
   */
  const settleFinishedTickets = async () => {
    if (!userProfile) return;
    const ftFixtures = fixtures.filter((f) => f.status === "FT");
    if (ftFixtures.length === 0) return;

    const settleableIds = userProfile.tickets
      .filter(
        (t) =>
          t.status === "PENDING" &&
          t.selections.every((sel) =>
            ftFixtures.some((f) => f.id === sel.fixtureId),
          ),
      )
      .map((t) => t.id);
    const bbSettleable = (userProfile.betBuilderTickets ?? []).some(
      (t) => t.status === "PENDING" && ftFixtures.some((f) => f.id === t.fixtureId),
    );
    if (settleableIds.length === 0 && !bbSettleable) return;

    // Mark SETTLING: transient status that prevents double settlement if the
    // round-advance effect fires before the async setState batch (or the
    // server round-trip below) settles.
    const markingTickets = userProfile.tickets.map((t) =>
      settleableIds.includes(t.id) ? { ...t, status: "SETTLING" as const } : t,
    );
    // Optimistically persist the SETTLING state
    const markingProfile: Profile = { ...userProfile, tickets: markingTickets };
    setUserProfile(markingProfile);
    persist(markingProfile);

    if (gameMode && serverAvailable.current !== false) {
      const result = await settleOnServer({ gameMode, slot: activeSlot }, ftFixtures);
      if (result.ok) {
        serverAvailable.current = true;
        result.profile.tickets.forEach((ticket, idx) => {
          if (markingTickets[idx]?.status === "SETTLING" && ticket.status !== "SETTLING") {
            if (ticket.status === "WON") {
              addToast({ type: "win", title: "🏆 Ticket Won!", message: `+$${(ticket.settledPayout ?? ticket.potentialPayout).toFixed(2)} payout`, duration: 5000 });
            } else if (ticket.status === "LOST") {
              addToast({ type: "loss", title: "Ticket Lost", message: `-$${ticket.stake.toFixed(2)} stake lost`, duration: 3000 });
            }
          }
        });
        setUserProfile(result.profile);
        persist(result.profile);
        return;
      }
      const failure = result as ServerFailure;
      if (failure.reason === "rejected") {
        serverAvailable.current = true;
        // Nothing sensible to do but leave the SETTLING marks as-is and try
        // again next tick — don't fall through to local settlement, which
        // would credit a balance the server (now authoritative) doesn't know about.
        return;
      }
      serverAvailable.current = false; // unreachable — fall back below
    }

    // Local settlement (server unavailable) — original logic, unchanged.
    const { finalTickets, totalWinPayoutSum } = settlePendingTickets(
      markingTickets,
      ftFixtures,
    );

    finalTickets.forEach((ticket, idx) => {
      if (markingTickets[idx]?.status === "SETTLING" && ticket.status !== "SETTLING") {
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

  /** Local (client-only) Bet Builder placement — the ORIGINAL logic, used when the server isn't reachable. */
  const placeBetBuilderLocally = (
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

  /**
   * NOTE: `combinedOdds` here is a display value the caller already computed
   * (used for the local-fallback path only). When the server is reachable it
   * recomputes the same correlation-discounted odds itself and that's the
   * number actually charged/paid — see server/index.ts's place-builder route.
   */
  const handlePlaceBetBuilder = async (
    fixtureId: string,
    selections: BetBuilderSelection[],
    stake: number,
    combinedOdds: number,
  ): Promise<boolean> => {
    if (!userProfile) return false;

    if (gameMode && serverAvailable.current !== false) {
      const result = await placeBetBuilderOnServer({ gameMode, slot: activeSlot }, { fixtureId, selections, stake });
      if (result.ok) {
        serverAvailable.current = true;
        setUserProfile(result.profile);
        persist(result.profile);
        return true;
      }
      const failure = result as ServerFailure;
      if (failure.reason === "rejected") {
        serverAvailable.current = true;
        alert(failure.error);
        return false;
      }
      serverAvailable.current = false; // unreachable — fall back below
    }

    return placeBetBuilderLocally(fixtureId, selections, stake, combinedOdds);
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
