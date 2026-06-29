import React, { useState } from "react";
import { TransferListing, Team } from "../types";
import { formatMoney } from "../utils";
import { calculatePlayerValue } from "../engine/transferEngine";

interface TransferMarketProps {
  listings: TransferListing[];
  teams: Team[];
  ownedTeamId: string;
  currentRoundIndex: number;
  balance: number;
  userBid: { listingId: string; amount: number } | null;
  onPlaceBid: (listingId: string, amount: number) => void;
  onWithdrawBid: (listingId: string) => void;
}

function getPlayerInfo(listings: TransferListing[], listingId: string, teams: Team[]) {
  const listing = listings.find((l) => l.id === listingId);
  if (!listing) return null;
  for (const team of teams) {
    const player = team.players.find((p) => p.id === listing.playerId);
    if (player) return { player, team, listing };
  }
  // Player may have been moved — use listing metadata only
  return { player: null, team: null, listing };
}

function currentHighestBid(listing: TransferListing, userBid: { listingId: string; amount: number } | null): number {
  const all = [...listing.bids];
  if (userBid?.listingId === listing.id) all.push({ bidderId: "USER", amount: userBid.amount });
  if (all.length === 0) return listing.askingPrice;
  return Math.max(...all.map((b) => b.amount));
}

function isUserCurrentlyLeading(listing: TransferListing, userBid: { listingId: string; amount: number } | null): boolean {
  if (!userBid || userBid.listingId !== listing.id) return false;
  const allOther = listing.bids.map((b) => b.amount);
  const maxOther = allOther.length > 0 ? Math.max(...allOther) : 0;
  return userBid.amount > maxOther;
}

export const TransferMarket: React.FC<TransferMarketProps> = ({
  listings,
  teams,
  ownedTeamId,
  currentRoundIndex,
  balance,
  userBid,
  onPlaceBid,
  onWithdrawBid,
}) => {
  const [bidAmounts, setBidAmounts] = useState<Record<string, string>>({});

  const openListings = listings.filter(
    (l) => l.status === "OPEN" && l.fromTeamId !== ownedTeamId,
  );
  const sellingListings = listings.filter(
    (l) => l.status === "OPEN" && l.fromTeamId === ownedTeamId,
  );

  const handleBidSubmit = (listingId: string) => {
    const raw = parseFloat(bidAmounts[listingId] || "0");
    if (isNaN(raw) || raw <= 0) return;
    onPlaceBid(listingId, Math.round(raw));
  };

  const renderPlayerCard = (listing: TransferListing) => {
    // Look up player from any team (may have moved)
    let player = null;
    let fromTeamName = "Unknown";
    for (const team of teams) {
      const p = team.players.find((pp) => pp.id === listing.playerId);
      if (p) { player = p; fromTeamName = team.shortName; break; }
      if (team.id === listing.fromTeamId) fromTeamName = team.shortName;
    }

    const highest = currentHighestBid(listing, userBid);
    const userLeading = isUserCurrentlyLeading(listing, userBid);
    const hasBid = userBid?.listingId === listing.id;
    const roundsLeft = listing.expiresAtRound - currentRoundIndex;
    const value = player
      ? calculatePlayerValue(player, teams.find((t) => t.id === listing.fromTeamId) || teams[0])
      : listing.askingPrice;

    return (
      <div
        key={listing.id}
        className="bg-[#0f1923] border border-white/10 rounded-xl p-4 space-y-3"
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold text-white text-sm">
              {player?.name ?? "—"}
            </p>
            <p className="text-xs text-slate-400">
              {player?.position ?? "?"} · Age {player?.age ?? "?"} · {fromTeamName}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Overall</p>
            <p className="text-amber-400 font-bold text-sm">{player?.rating ?? "—"}</p>
          </div>
        </div>

        {/* Value + price row */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-white/5 rounded-lg p-2 text-center">
            <p className="text-slate-400">Est. Value</p>
            <p className="text-white font-semibold">${formatMoney(value, 0)}</p>
          </div>
          <div className="bg-white/5 rounded-lg p-2 text-center">
            <p className="text-slate-400">Ask Price</p>
            <p className="text-emerald-400 font-semibold">${formatMoney(listing.askingPrice, 0)}</p>
          </div>
          <div className="bg-white/5 rounded-lg p-2 text-center">
            <p className="text-slate-400">Rounds Left</p>
            <p className={roundsLeft <= 1 ? "text-red-400 font-semibold" : "text-white font-semibold"}>
              {roundsLeft}
            </p>
          </div>
        </div>

        {/* Current bid */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Highest Bid</span>
          <span className={userLeading ? "text-amber-400 font-semibold" : "text-white"}>
            ${formatMoney(highest, 0)}
            {userLeading && " 🏆 You"}
          </span>
        </div>

        {/* Bid input */}
        {!hasBid ? (
          <div className="flex gap-2">
            <input
              type="number"
              min={highest + 1}
              placeholder={`Min $${formatMoney(highest + 1, 0)}`}
              value={bidAmounts[listing.id] ?? ""}
              onChange={(e) =>
                setBidAmounts((prev) => ({ ...prev, [listing.id]: e.target.value }))
              }
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/60"
            />
            <button
              type="button"
              onClick={() => handleBidSubmit(listing.id)}
              disabled={
                !bidAmounts[listing.id] ||
                parseFloat(bidAmounts[listing.id] ?? "0") > balance
              }
              className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-semibold text-xs px-3 py-1.5 rounded-lg transition-colors"
            >
              Bid
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-1.5">
            <span className="text-amber-400 text-xs font-semibold">
              Your bid: ${formatMoney(userBid!.amount, 0)}
            </span>
            <button
              type="button"
              onClick={() => onWithdrawBid(listing.id)}
              className="text-slate-400 hover:text-red-400 text-xs transition-colors"
            >
              Withdraw
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderSellingCard = (listing: TransferListing) => {
    const highest = currentHighestBid(listing, null);
    const roundsLeft = listing.expiresAtRound - currentRoundIndex;
    let playerName = "Unknown";
    for (const team of teams) {
      const p = team.players.find((pp) => pp.id === listing.playerId);
      if (p) { playerName = p.name; break; }
    }

    return (
      <div
        key={listing.id}
        className="bg-[#0f1923] border border-red-500/20 rounded-xl p-3 flex items-center justify-between"
      >
        <div>
          <p className="text-white text-sm font-semibold">{playerName}</p>
          <p className="text-xs text-slate-400">
            {listing.bids.length} bid{listing.bids.length !== 1 ? "s" : ""} · {roundsLeft} round{roundsLeft !== 1 ? "s" : ""} left
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Highest</p>
          <p className="text-red-400 font-semibold text-sm">${formatMoney(highest, 0)}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-[#080c12] overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/5 flex-shrink-0">
        <h2 className="text-lg font-bold text-white">Transfer Market</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Place bids on players · Auctions resolve at round advance
        </p>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden gap-4 p-4">
        {/* Left: Available listings */}
        <div className="flex-1 flex flex-col min-h-0">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
            Available Players ({openListings.length})
          </p>
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {openListings.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-slate-500 text-sm">
                No players listed this round
              </div>
            ) : (
              openListings.map(renderPlayerCard)
            )}
          </div>
        </div>

        {/* Right: Club outgoing */}
        <div className="w-72 flex flex-col min-h-0">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
            Your Club — Selling
          </p>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {sellingListings.length === 0 ? (
              <div className="flex items-center justify-center h-24 text-slate-500 text-xs text-center">
                No players from your club on the market
              </div>
            ) : (
              sellingListings.map(renderSellingCard)
            )}
          </div>

          {/* Balance reminder */}
          <div className="mt-4 bg-white/5 rounded-xl p-3 flex-shrink-0">
            <p className="text-xs text-slate-400">Available to bid</p>
            <p className="text-white font-bold">${formatMoney(balance, 0)}</p>
            <p className="text-xs text-slate-500 mt-1">Deducted at round advance if you win</p>
          </div>
        </div>
      </div>
    </div>
  );
};

void getPlayerInfo; // suppress unused warning
