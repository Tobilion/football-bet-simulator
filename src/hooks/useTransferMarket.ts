import { useState } from "react";
import { TransferListing, Profile } from "../types";
import { generateTransferListings, refreshTransferListings } from "../engine/transferEngine";
import { addToast } from "./useToast";

interface UseTransferMarketDeps {
  userProfile: Profile | null;
  setUserProfile: React.Dispatch<React.SetStateAction<Profile | null>>;
  persist: (profile: Profile) => void;
  teams: import("../types").Team[];
}

export function useTransferMarket(deps: UseTransferMarketDeps) {
  const { userProfile, setUserProfile, persist, teams } = deps;
  const [transferListings, setTransferListings] = useState<TransferListing[]>([]);
  const [userBids, setUserBids] = useState<{ listingId: string; amount: number }[]>([]);
  const [transferToast, setTransferToast] = useState<string>("");

  const handlePlaceUserBid = (listingId: string, amount: number) => {
    if (!userProfile) return;
    const listing = transferListings.find((l) => l.id === listingId);
    if (!listing || listing.status !== "OPEN") return;

    // Look up player name
    let playerName = "Player";
    for (const team of teams) {
      const p = team.players.find((pl) => pl.id === listing.playerId);
      if (p) {
        playerName = p.name;
        break;
      }
    }

    // Get previous user bid for this listing to calculate correct balance delta
    const prevBid = userBids.find((b) => b.listingId === listingId);
    const prevAmount = prevBid ? prevBid.amount : 0;

    // Check if the user has enough balance (w/ refund of previous bid)
    const refundDiff = prevAmount;
    if (amount <= 0 || (amount - refundDiff) > userProfile.balance) {
      addToast({
        type: "loss",
        title: "❌ Insufficient Funds",
        message: `You cannot afford a bid of $${amount.toLocaleString()}!`,
        duration: 4000
      });
      return;
    }

    // Update balance: deduct the new amount, refund the old bid amount
    const nextBalance = Math.round((userProfile.balance + refundDiff - amount) * 100) / 100;
    const nextProfile: Profile = {
      ...userProfile,
      balance: nextBalance,
      bankrollHistory: [
        ...(userProfile.bankrollHistory || []),
        {
          timestamp: Date.now(),
          balance: nextBalance,
          detail: prevBid
            ? `Updated bid on ${playerName}: $${prevAmount} ➔ $${amount}`
            : `Placed bid on ${playerName}: -$${amount}`,
        },
      ],
    };
    setUserProfile(nextProfile);
    persist(nextProfile);

    setUserBids((prev) => {
      const filtered = prev.filter((b) => b.listingId !== listingId);
      return [...filtered, { listingId, amount }];
    });

    addToast({
      type: "win",
      title: "🔄 Bid Registered",
      message: `Placed $${amount.toLocaleString()} bid on ${playerName}`,
      duration: 4500
    });
  };

  const handleWithdrawBid = (listingId: string) => {
    if (!userProfile) return;
    const bid = userBids.find((b) => b.listingId === listingId);
    if (!bid) return;

    // Look up player name
    let playerName = "Player";
    const listing = transferListings.find((l) => l.id === listingId);
    if (listing) {
      for (const team of teams) {
        const p = team.players.find((pl) => pl.id === listing.playerId);
        if (p) {
          playerName = p.name;
          break;
        }
      }
    }

    const nextBalance = Math.round((userProfile.balance + bid.amount) * 100) / 100;
    const nextProfile: Profile = {
      ...userProfile,
      balance: nextBalance,
      bankrollHistory: [
        ...(userProfile.bankrollHistory || []),
        {
          timestamp: Date.now(),
          balance: nextBalance,
          detail: `Withdrew bid on ${playerName}: +$${bid.amount}`,
        },
      ],
    };
    setUserProfile(nextProfile);
    persist(nextProfile);

    setUserBids((prev) => prev.filter((b) => b.listingId !== listingId));

    addToast({
      type: "info",
      title: "🔄 Bid Withdrawn",
      message: `Refunded $${bid.amount.toLocaleString()} for withdrawing bid on ${playerName}`,
      duration: 4000
    });
  };

  const handleGenerateListings = (
    teamsList: import("../types").Team[],
    roundIndex: number,
  ) => {
    const newListings = generateTransferListings(teamsList, roundIndex, transferListings);
    setTransferListings(newListings);
  };

  const REFRESH_FEE = 25_000;

  /** "Refresh list" action: small fee, keeps listings the user has bid on. */
  const handleRefreshListings = (
    teamsList: import("../types").Team[],
    roundIndex: number,
  ) => {
    if (!userProfile) return;
    if (userProfile.balance < REFRESH_FEE) {
      addToast({ type: "loss", title: "❌ Can't Refresh", message: `Refreshing the market costs $${REFRESH_FEE.toLocaleString()}.`, duration: 4000 });
      return;
    }
    const protectedIds = new Set(userBids.map((b) => b.listingId));
    const refreshed = refreshTransferListings(teamsList, roundIndex, transferListings, protectedIds);
    setTransferListings(refreshed);
    const nextBalance = Math.round((userProfile.balance - REFRESH_FEE) * 100) / 100;
    const nextProfile: Profile = {
      ...userProfile,
      balance: nextBalance,
      bankrollHistory: [
        ...(userProfile.bankrollHistory || []),
        { timestamp: Date.now(), balance: nextBalance, detail: `Refreshed transfer market: -$${REFRESH_FEE.toLocaleString()}` },
      ],
    };
    setUserProfile(nextProfile);
    persist(nextProfile);
    addToast({ type: "info", title: "🔄 Market Refreshed", message: "A fresh set of players is available.", duration: 3500 });
  };

  const showTransferToast = (msg: string) => {
    if (!msg) return;
    setTransferToast(msg);
    setTimeout(() => setTransferToast(""), 5000);
  };

  return {
    transferListings,
    setTransferListings,
    userBids,
    setUserBids,
    transferToast,
    handlePlaceUserBid,
    handleWithdrawBid,
    handleGenerateListings,
    handleRefreshListings,
    showTransferToast,
  };
}
