import React, { useState, useMemo } from "react";
import { PurchasedItem, LuxuryItem, LuxuryCategory, Team } from "../types";
import { STORE_ITEMS } from "../data/luxuryItems";
import { InfoButton } from "./ui/InfoButton";
import { Skeleton } from "./ui/Skeleton";
import { formatMoney } from "../utils";

interface VIPStoreProps {
  balance: number;
  purchasedItems: PurchasedItem[];
  onPurchase: (itemDetails: Omit<PurchasedItem, "dateStr" | "id"> & { id: string; teamId?: string }) => void;
  onLiquidate: (item: PurchasedItem) => void;
  teams?: Team[];
  ownedTeamId?: string;
  ownedTeamIds?: string[];
  onRenameStadium?: (teamId: string, newName: string, fee: number) => boolean;
  onBoostRatings?: (teamId: string, fee: number) => boolean;
}

// Football-club store items and what each one actually does.
type ClubActionKind = "buy" | "naming" | "training";
const CLUB_ITEM_CONFIG: Record<string, { kind: ClubActionKind; tier?: "small" | "mid" | "elite" }> = {
  club1: { kind: "buy", tier: "small" },   // Lower League
  club2: { kind: "buy", tier: "mid" },     // Mid-table
  club3: { kind: "buy", tier: "elite" },   // Elite
  club4: { kind: "naming" },               // Stadium Naming Rights
  club5: { kind: "training" },             // Training Complex Upgrade
};

/** Classify a club into a purchase tier by star rating / division. */
function teamTier(t: Team): "small" | "mid" | "elite" {
  const r = t.rating;
  if ((t.division ?? 1) === 2 || r < 3.5) return "small";
  if (r < 4.3) return "mid";
  return "elite";
}

const CATEGORIES = ["All", ...Array.from(new Set(STORE_ITEMS.map(i => i.category)))];

const RarityColors: Record<string, string> = {
  "Common": "bg-slate-500/20 text-slate-400 border-slate-500/30",
  "Rare": "bg-sky-500/20 text-sky-400 border-sky-500/30",
  "Ultra Rare": "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "Legendary": "bg-amber-500/20 text-amber-500 border-amber-500/50 shadow-[0_0_8px_rgba(245,158,11,0.4)] animate-[pulse_2s_ease-in-out_infinite]"
};

export const VIPStore: React.FC<VIPStoreProps> = ({ balance, purchasedItems, onPurchase, onLiquidate, teams = [], ownedTeamId, ownedTeamIds = [], onRenameStadium, onBoostRatings }) => {
  const [activeTab, setActiveTab] = useState<"store" | "inventory">("store");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [clubPickerItem, setClubPickerItem] = useState<LuxuryItem | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [stadiumNameInput, setStadiumNameInput] = useState<string>("");

  const clubConfig = clubPickerItem ? CLUB_ITEM_CONFIG[clubPickerItem.id] : undefined;
  const clubAction: ClubActionKind = clubConfig?.kind ?? "buy";
  const ownedIds = ownedTeamIds.length > 0 ? ownedTeamIds : (ownedTeamId ? [ownedTeamId] : []);

  // Which teams the picker should list depends on the action:
  //  - buy: unowned clubs in the item's tier only
  //  - naming / training: clubs the user ALREADY owns (these don't grant ownership)
  const pickerTeams = useMemo(() => {
    if (!clubPickerItem) return [];
    if (clubAction === "buy") {
      const tier = clubConfig?.tier;
      return teams.filter(
        (t) => !t.ownership && !ownedIds.includes(t.id) && (!tier || teamTier(t) === tier),
      );
    }
    // naming / training operate on owned clubs
    return teams.filter((t) => ownedIds.includes(t.id) || !!t.ownership);
  }, [clubPickerItem, clubAction, clubConfig, teams, ownedIds]);

  const totalWorth = purchasedItems.reduce((sum, item) => sum + item.worth, 0);

  const filteredStoreItems = useMemo(() => {
    let items = STORE_ITEMS;
    if (selectedCategory !== "All") {
      items = items.filter(i => i.category === selectedCategory);
    }
    // Filter out already owned items
    const ownedIds = new Set(purchasedItems.map(p => p.id));
    return items.filter(i => !ownedIds.has(i.id));
  }, [selectedCategory, purchasedItems]);

  const ImageWithSkeleton = ({ src, alt, index }: { src: string, alt: string, index: number }) => {
    const [loaded, setLoaded] = useState(false);
    return (
      <div className="relative w-full h-36 rounded-xl overflow-hidden mb-3.5 border border-white/5 bg-[#0a111a] group shrink-0">
        {!loaded && <Skeleton className="absolute inset-0 z-10" />}
        <img
          src={src}
          className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          alt={alt}
          loading={index < 4 ? "eager" : "lazy"}
          onLoad={() => setLoaded(true)}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
            setLoaded(true);
          }}
          referrerPolicy="no-referrer"
        />
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto w-full p-4 md:p-8 space-y-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-white/5 pb-4 select-none gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-xl font-bold text-amber-500 font-sans tracking-tight">Luxury VIP Store</h2>
            <p className="text-xs text-slate-400">Spend your sportsbook winnings on prestigious virtual assets.</p>
          </div>
          <InfoButton 
            title="VIP Luxury Store" 
            body="Purchase high-end sports cars, penthouses, superyachts, exclusive fashion, and private flights. Items here are purely status symbols and do not affect gameplay, though they can be liquidated later for collateral." 
          />
        </div>
        <div className="flex border border-white/10 rounded-lg overflow-hidden bg-black/40 shrink-0">
          <button
            onClick={() => setActiveTab("store")}
            className={`px-6 py-2 text-xs font-bold transition-colors cursor-pointer ${activeTab === "store" ? "bg-amber-500/20 text-amber-400" : "text-slate-400 hover:bg-white/5"}`}
          >
            Showroom
          </button>
          <button
            onClick={() => setActiveTab("inventory")}
            className={`px-6 py-2 text-xs font-bold transition-colors cursor-pointer ${activeTab === "inventory" ? "bg-amber-500/20 text-amber-400" : "text-slate-400 hover:bg-white/5"}`}
          >
            Trophy Room ({purchasedItems.length})
          </button>
        </div>
      </div>

      {activeTab === "store" && (
        <div className="space-y-6">
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar select-none">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  selectedCategory === cat ? "bg-amber-500 text-amber-950 shadow-[0_0_10px_rgba(245,158,11,0.3)] font-black" : "bg-white/5 text-slate-400 hover:bg-white/10"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 pb-20">
            {filteredStoreItems.map((item, index) => (
              <div key={item.id} className={`glass-card bg-[#0a111a]/85 border ${item.rarity === 'Legendary' ? 'border-amber-500/30' : 'border-white/5'} rounded-2xl p-4 flex flex-col hover:border-white/10 transition-all duration-200`}>
                
                <ImageWithSkeleton src={item.imageUrl} alt={item.name} index={index} />

                <div className="space-y-1 mb-2">
                  <div className="flex items-start justify-between gap-1">
                    <h3 className="text-xs font-bold text-slate-200 line-clamp-1 leading-snug" title={item.name}>{item.name}</h3>
                    <span 
                      className={`text-[8px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border whitespace-nowrap ${RarityColors[item.rarity] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}
                    >
                      {item.rarity}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 h-8 line-clamp-2 leading-relaxed">{item.description}</p>
                </div>
                
                <div className="mt-auto pt-4 space-y-2 select-none">
                  <div className="p-2.5 bg-black/45 rounded-xl space-y-1.5">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-500">Acquisition Cost:</span>
                      <span className="font-bold text-amber-500">{formatMoney(item.price)}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-500">Resale Value:</span>
                      <span className="font-bold text-slate-400">{formatMoney(Math.floor(item.price * 0.85))}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (item.category === "Football Clubs") {
                        setClubPickerItem(item);
                        setSelectedTeamId("");
                        setStadiumNameInput("");
                      } else {
                        onPurchase({ ...item, worth: Math.floor(item.price * 0.85), icon: item.imageUrl });
                      }
                    }}
                    disabled={balance < item.price}
                    className="w-full py-2 rounded-xl font-bold text-[10px] uppercase cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-600 bg-amber-500 hover:bg-amber-400 text-amber-950 transition-colors shadow-lg active:scale-[0.98]"
                  >
                    {balance < item.price
                      ? "Insufficient Wallet"
                      : item.category === "Football Clubs"
                      ? (CLUB_ITEM_CONFIG[item.id]?.kind === "naming" ? "Name Stadium →"
                        : CLUB_ITEM_CONFIG[item.id]?.kind === "training" ? "Upgrade Club →"
                        : "Choose Club →")
                      : "Acquire Asset"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "inventory" && (
        <div className="space-y-4">
          <div className="mb-2 p-4 glass-card bg-emerald-950/10 border-emerald-500/20 rounded-xl flex items-center justify-between select-none">
            <div>
              <span className="text-[10px] text-emerald-400 uppercase tracking-widest font-black">Total Asset Portfolio Collateral</span>
              <div className="text-2xl font-black text-emerald-450 font-mono mt-0.5">${totalWorth.toLocaleString()}</div>
            </div>
            <div className="text-3xl text-emerald-400">💼</div>
          </div>

          <p className="text-sm text-slate-400 mb-4 bg-white/5 py-1 px-3 rounded inline-block">You own {purchasedItems.length} / {STORE_ITEMS.length} luxury items.</p>

          {purchasedItems.length === 0 ? (
            <div className="text-center py-24 bg-black/20 rounded-2xl border border-white/5 select-none">
              <span className="text-4xl opacity-40 mb-3 block">🕸️</span>
              <h3 className="text-slate-300 font-bold text-sm">Your luxury portfolio is empty</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">Visit the showroom above to invest your winnings on prestigous real estate, hypercars, aircrafts, and businesses.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 pb-20">
              {purchasedItems.map((item, idx) => (
                <div key={item.id + idx} className={`glass-card bg-[#0a111a]/85 border ${item.rarity === 'Legendary' ? 'border-amber-500/30' : 'border-white/5'} rounded-2xl p-4 relative overflow-hidden group flex flex-col hover:border-white/10 transition-all duration-200`}>
                  
                  {item.imageUrl ? (
                    <ImageWithSkeleton src={item.imageUrl} alt={item.name} index={idx} />
                  ) : (
                    <div className="text-3.5xl mb-2 text-center opacity-85 select-none">{item.icon}</div>
                  )}

                  <div className="space-y-1 mb-2">
                    <div className="flex items-start justify-between gap-1">
                      <h3 className="text-xs font-bold text-slate-200 line-clamp-1 leading-snug">{item.name}</h3>
                      {item.rarity && (
                         <span 
                           className={`text-[8px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border whitespace-nowrap ${RarityColors[item.rarity] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}
                         >
                           {item.rarity}
                         </span>
                                        )}
                    </div>
                    <p className="text-[10px] text-slate-500 line-clamp-2">{item.description}</p>
                  </div>

                  <div className="mt-auto pt-3 space-y-2 select-none">
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>Purchased</span>
                      <span>{item.dateStr}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-500">Resale Value</span>
                      <span className="font-bold text-emerald-400">{formatMoney(item.worth)}</span>
                    </div>
                    <button
                      onClick={() => onLiquidate(item)}
                      className="w-full py-1.5 rounded-xl text-[10px] font-bold uppercase text-red-400 border border-red-500/20 hover:bg-red-500/10 cursor-pointer transition-all"
                    >
                      Liquidate Asset
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Club Picker Modal */}
      {clubPickerItem && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center z-[200] p-4 animate-fade-in">
          <div className="glass-panel border border-amber-500/30 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-amber-400">
                  {clubAction === "buy" ? "Choose Your Club" : clubAction === "naming" ? "Stadium Naming Rights" : "Training Complex Upgrade"}
                </h3>
                <p className="text-xs text-slate-400">
                  {clubAction === "buy"
                    ? `Select a ${clubConfig?.tier ?? ""} club to purchase for ${formatMoney(clubPickerItem.price)}`
                    : clubAction === "naming"
                    ? `Pick one of YOUR clubs to rename its stadium (${formatMoney(clubPickerItem.price)} fee — no ownership granted)`
                    : `Pick one of YOUR clubs to boost every player +2 rating (${formatMoney(clubPickerItem.price)} fee)`}
                </p>
              </div>
              <button onClick={() => { setClubPickerItem(null); setStadiumNameInput(""); }} className="text-slate-400 hover:text-white text-lg cursor-pointer">✕</button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {pickerTeams.map(team => (
                <button
                  key={team.id}
                  onClick={() => setSelectedTeamId(team.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    selectedTeamId === team.id
                      ? "border-amber-500/60 bg-amber-500/10"
                      : "border-white/5 bg-white/3 hover:bg-white/5"
                  }`}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-black shrink-0"
                    style={{ backgroundColor: team.primaryColor }}
                  >
                    {team.shortName.slice(0,2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-200 truncate">{team.name}</p>
                    <p className="text-[9px] text-slate-500 font-mono">
                      Div {team.division ?? 1} · Rating {team.rating.toFixed(1)} ⭐ · {team.players.length} players
                    </p>
                  </div>
                  {selectedTeamId === team.id && (
                    <span className="text-amber-400 text-xs font-black shrink-0">✓</span>
                  )}
                </button>
              ))}
              {pickerTeams.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-6">
                  {clubAction === "buy" ? "No available clubs in this tier." : "You don't own any clubs yet — buy one first."}
                </p>
              )}
            </div>

            {/* Naming rights needs a new stadium name */}
            {clubAction === "naming" && selectedTeamId && (
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">New Stadium Name</label>
                <input
                  value={stadiumNameInput}
                  onChange={(e) => setStadiumNameInput(e.target.value)}
                  placeholder="e.g. Tobi Arena"
                  maxLength={40}
                  className="w-full text-xs p-2.5 rounded-xl bg-black/30 border border-white/10 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
                />
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setClubPickerItem(null); setSelectedTeamId(""); setStadiumNameInput(""); }}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-400 border border-white/10 hover:bg-white/5 cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button
                disabled={
                  !selectedTeamId ||
                  balance < clubPickerItem.price ||
                  (clubAction === "naming" && !stadiumNameInput.trim())
                }
                onClick={() => {
                  if (!selectedTeamId) return;
                  const teamName = teams.find(t => t.id === selectedTeamId)?.name ?? "Club";
                  if (clubAction === "buy") {
                    onPurchase({
                      ...clubPickerItem,
                      worth: Math.floor(clubPickerItem.price * 0.85),
                      icon: clubPickerItem.imageUrl,
                      teamId: selectedTeamId,
                      name: `${teamName} — Ownership`,
                    });
                  } else if (clubAction === "naming") {
                    onRenameStadium?.(selectedTeamId, stadiumNameInput.trim(), clubPickerItem.price);
                  } else if (clubAction === "training") {
                    onBoostRatings?.(selectedTeamId, clubPickerItem.price);
                  }
                  setClubPickerItem(null);
                  setSelectedTeamId("");
                  setStadiumNameInput("");
                }}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-amber-950 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {clubAction === "buy" ? "Confirm Purchase" : clubAction === "naming" ? "Rename Stadium" : "Upgrade Training"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
