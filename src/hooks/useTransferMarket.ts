import { useState } from "react";
import { TransferListing, Profile } from "../types";
import { generateTransferListings } from "../engine/transferEngine";

export function useTransferMarket(userProfile: Profile | null) {
  const [transferListings, setTransferListings] = useState<TransferListing[]>([]);
  const [userBid, setUserBid] = useState<{ listingId: string; amount: number } | null>(null);
  const [transferToast, setTransferToast] = useState<string>("");

  const handlePlaceUserBid = (listingId: string, amount: number) => {
    if (!userProfile) return;
    const listing = transferListings.find((l) => l.id === listingId);
    if (!listing || listing.status !== "OPEN") return;
    // Validate the user can (in principle) afford it — real deduction at round advance
    if (amount <= 0 || amount > userProfile.balance) {
      return;
    }
    setUserBid({ listingId, amount });
  };

  const handleWithdrawBid = (listingId: string) => {
    if (userBid?.listingId === listingId) {
      setUserBid(null);
    }
  };

  const handleGenerateListings = (
    teams: import("../types").Team[],
    roundIndex: number,
  ) => {
    const newListings = generateTransferListings(teams, roundIndex, transferListings);
    setTransferListings(newListings);
  };

  const showTransferToast = (msg: string) => {
    if (!msg) return;
    setTransferToast(msg);
    setTimeout(() => setTransferToast(""), 5000);
  };

  return {
    transferListings,
    setTransferListings,
    userBid,
    setUserBid,
    transferToast,
    handlePlaceUserBid,
    handleWithdrawBid,
    handleGenerateListings,
    showTransferToast,
  };
}
