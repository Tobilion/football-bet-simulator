import React, { useState } from "react";
import { TransferListing, Team, Player } from "../types";
import { formatMoney } from "../utils";
import { calculatePlayerValue } from "../engine/transferEngine";
import { EmptyState } from "./ui/EmptyState";

interface TransferMarketProps {
  listings: TransferListing[];
  teams: Team[];
  ownedTeamId: string;
  ownedTeamIds?: string[];
  currentRoundIndex: number;
  balance: number;
  userBids: { listingId: string; amount: number }[];
  onPlaceBid: (listingId: string, amount: number) => void;
  onWithdrawBid: (listingId: string) => void;
  onRefresh?: () => void;
}

function currentHighestBid(listing: TransferListing, userBids: { listingId: string; amount: number }[]): number {
  const all = [...listing.bids];
  const uBid = userBids.find((b) => b.listingId === listing.id);
  if (uBid) all.push({ bidderId: "USER", amount: uBid.amount });
  if (all.length === 0) return listing.askingPrice;
  return Math.max(...all.map((b) => b.amount));
}

function isUserCurrentlyLeading(listing: TransferListing, userBids: { listingId: string; amount: number }[]): boolean {
  const uBid = userBids.find((b) => b.listingId === listing.id);
  if (!uBid) return false;
  const allOther = listing.bids.map((b) => b.amount);
  const maxOther = allOther.length > 0 ? Math.max(...allOther) : 0;
  return uBid.amount > maxOther;
}

export const TransferMarket: React.FC<TransferMarketProps> = ({
  listings,
  teams,
  ownedTeamId,
  ownedTeamIds = [],
  currentRoundIndex,
  balance,
  userBids,
  onPlaceBid,
  onWithdrawBid,
  onRefresh,
}) => {
  const ownedIds = ownedTeamIds.length > 0 ? ownedTeamIds : [ownedTeamId];
  const [selectedClubId, setSelectedClubId] = useState<string>(ownedTeamId);
  const activeClubId = ownedIds.includes(selectedClubId) ? selectedClubId : (ownedIds[0] ?? ownedTeamId);

  const [bidAmounts, setBidAmounts] = useState<Record<string, string>>({});

  const openListings = listings.filter(
    (l) => l.status === "OPEN" && l.fromTeamId !== activeClubId,
  );
  const sellingListings = listings.filter(
    (l) => l.status === "OPEN" && l.fromTeamId === activeClubId,
  );

  const handleBidSubmit = (listingId: string) => {
    const raw = parseFloat(bidAmounts[listingId] || "0");
    if (isNaN(raw) || raw <= 0) return;
    onPlaceBid(listingId, Math.round(raw));
    setBidAmounts((prev) => ({ ...prev, [listingId]: "" }));
  };

  const renderPlayerCard = (listing: TransferListing) => {
    let player: Player | null = null;
    let fromTeamName = "Unknown";
    for (const team of teams) {
      const p = team.players.find((pp) => pp.id === listing.playerId);
      if (p) { player = p; fromTeamName = team.shortName; break; }
      if (team.id === listing.fromTeamId) fromTeamName = team.shortName;
    }

    const highest = currentHighestBid(listing, userBids);
    const userLeading = isUserCurrentlyLeading(listing, userBids);
    const userBidForThis = userBids.find((b) => b.listingId === listing.id);
    const hasBid = !!userBidForThis;
    const roundsLeft = listing.expiresAtRound - currentRoundIndex;
    const value = player
      ? calculatePlayerValue(player, teams.find((t) => t.id === listing.fromTeamId) || teams[0])
      : listing.askingPrice;

    return (
      <div
        key={listing.id}
        className="bg-[#0f1923] border border-white/5 rounded-xl p-4 space-y-3 transition-all hover:border-white/10"
      >
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

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-white/5 rounded-lg p-2 text-center">
            <p className="text-slate-400 text-[10px]">Est. Value</p>
            <p className="text-white font-semibold">${formatMoney(value, 0)}</p>
          </div>
          <div className="bg-white/5 rounded-lg p-2 text-center">
            <p className="text-slate-400 text-[10px]">Ask Price</p>
            <p className="text-emerald-400 font-semibold">${formatMoney(listing.askingPrice, 0)}</p>
          </div>
          <div className="bg-white/5 rounded-lg p-2 text-center">
            <p className="text-slate-400 text-[10px]">Rounds Left</p>
            <p className={roundsLeft <= 1 ? "text-red-400 font-semibold" : "text-white font-semibold"}>
              {roundsLeft}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5">
          <span className="text-slate-400">Highest Bid</span>
          <span className={userLeading ? "text-amber-400 font-semibold flex items-center gap-1" : "text-white"}>
            ${formatMoney(highest, 0)}
            {userLeading && <span className="bg-amber-400/20 text-amber-400 text-[8px] font-bold px-1 py-0.5 rounded">🏆 Leading</span>}
          </span>
        </div>

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
              className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-semibold text-xs px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              Bid
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5">
            <span className="text-amber-400 text-xs font-semibold">
              Your bid: ${formatMoney(userBidForThis.amount, 0)}
            </span>
            <button
              type="button"
              onClick={() => onWithdrawBid(listing.id)}
              className="text-slate-400 hover:text-red-400 text-xs font-bold transition-colors cursor-pointer"
            >
              Withdraw
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderSellingCard = (listing: TransferListing) => {
    const highest = currentHighestBid(listing, []);
    const roundsLeft = listing.expiresAtRound - currentRoundIndex;
    let playerName = "Unknown";
    for (const team of teams) {
      const p = team.players.find((pp) => pp.id === listing.playerId);
      if (p) { playerName = p.name; break; }
    }

    return (
      <div
        key={listing.id}
        className="bg-[#0f1923] border border-red-500/10 rounded-xl p-3 flex items-center justify-between"
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
    <div className="h-full flex flex-col bg-[#080c12] overflow-hidden relative">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/5 flex-shrink-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-white uppercase tracking-tight flex items-center gap-2">
            <span>⚽</span> Transfer Market
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Place bids on players · Auctions resolve at round advance
          </p>
        </div>

        {/* Switcher if they own multiple clubs */}
        {ownedIds.length > 1 && (
          <div className="flex gap-1.5 bg-black/40 border border-white/5 p-1 rounded-xl">
            {ownedIds.map((id) => {
              const t = teams.find((tt) => tt.id === id);
              if (!t) return null;
              const isActive = id === activeClubId;
              return (
                <button
                  key={id}
                  onClick={() => setSelectedClubId(id)}
                  className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                    isActive
                      ? "bg-emerald-500 text-slate-950 font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {t.shortName}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden gap-4 p-4">
        {/* Left: Available listings */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Available Players ({openListings.length})
            </p>
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 px-2.5 py-1.5 rounded-lg transition-all active:scale-95 cursor-pointer"
                title="Replace the list with a fresh set of players ($25,000 fee). Bids you've placed are kept."
              >
                🔄 Refresh list <span className="text-slate-500 normal-case">($25K)</span>
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 no-scrollbar">
            {openListings.length === 0 ? (
              <EmptyState
                title="No Listed Players"
                description="Auctions update each round. Check back next round to bid on new transfers."
                icon="transfer"
              />
            ) : (
              openListings.map(renderPlayerCard)
            )}
          </div>
        </div>

        {/* Right: Club outgoing & user active bids */}
        <div className="w-80 flex flex-col min-h-0 gap-4 border-l border-white/5 pl-4">
          {/* Active Bids Placed */}
          <div className="flex-[2] flex flex-col min-h-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex justify-between items-center">
              <span>🎯 Your Active Bids ({userBids.length})</span>
            </p>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 no-scrollbar">
              {userBids.length === 0 ? (
                <div className="border border-dashed border-white/5 rounded-xl p-6 text-center text-slate-500 text-[11px] leading-relaxed">
                  You haven't placed any active bids in the market yet.
                </div>
              ) : (
                userBids.map((bid) => {
                  const listing = listings.find((l) => l.id === bid.listingId);
                  if (!listing) return null;
                  let player: Player | null = null;
                  for (const team of teams) {
                    const p = team.players.find((pp) => pp.id === listing.playerId);
                    if (p) { player = p; break; }
                  }
                  const userLeading = isUserCurrentlyLeading(listing, userBids);
                  return (
                    <div key={bid.listingId} className="bg-[#12151c]/60 border border-white/5 rounded-xl p-3 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-white text-[11px]">{player?.name ?? "—"}</p>
                          <p className="text-[10px] text-slate-400">{player?.position} · Rating {player?.rating}</p>
                        </div>
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${
                          userLeading
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/10"
                            : "bg-red-500/20 text-red-400 border border-red-500/10"
                        }`}>
                          {userLeading ? "Leading" : "Outbid"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] pt-1.5 border-t border-white/5">
                        <span className="text-slate-400">Bid: <b className="text-emerald-400">${formatMoney(bid.amount, 0)}</b></span>
                        <button
                          onClick={() => onWithdrawBid(bid.listingId)}
                          className="text-[9px] text-slate-400 hover:text-red-400 font-bold underline cursor-pointer"
                        >
                          Withdraw
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Outgoing sales */}
          <div className="flex-1 flex flex-col min-h-0 border-t border-white/5 pt-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
              Your Club — Outgoing
            </p>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 no-scrollbar">
              {sellingListings.length === 0 ? (
                <div className="border border-dashed border-white/5 rounded-xl p-4 text-center text-slate-500 text-[11px]">
                  No players from your club are currently on sale.
                </div>
              ) : (
                sellingListings.map(renderSellingCard)
              )}
            </div>
          </div>

          {/* Balance reminder */}
          <div className="bg-white/5 rounded-xl p-3.5 flex-shrink-0">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Spendable Balance</p>
            <p className="text-base font-black text-emerald-400 mt-0.5">${formatMoney(balance, 0)}</p>
            <p className="text-[9px] text-slate-500 mt-1 leading-normal">
              Bid wagers are reserved from your balance immediately and refunded if you are outbid or withdraw.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
