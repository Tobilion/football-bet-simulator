import React from "react";
import { formatMoney } from "../../utils";

interface RevenueFixture {
  fixtureId: string;
  baseIncome: number;
  bonus: number;
  result: "WIN" | "DRAW" | "LOSS";
  scoreline: string;
}

interface OwnerRevenueModalProps {
  teamName: string;
  revenue: number;
  fixtures: RevenueFixture[];
  onClose: () => void;
}

export const OwnerRevenueModal: React.FC<OwnerRevenueModalProps> = ({
  teamName,
  revenue,
  fixtures,
  onClose,
}) => {
  const resultColor = (r: RevenueFixture["result"]) =>
    r === "WIN" ? "text-emerald-400" : r === "LOSS" ? "text-red-400" : "text-slate-400";
  const resultIcon = (r: RevenueFixture["result"]) =>
    r === "WIN" ? "🏆" : r === "LOSS" ? "😞" : "🤝";
  const resultLabel = (r: RevenueFixture["result"]) =>
    r === "WIN" ? "WIN" : r === "LOSS" ? "LOSS" : "DRAW";

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/85 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative bg-gradient-to-br from-[#0d1f14] via-[#0a1a0f] to-[#111827] border border-emerald-500/30 rounded-3xl p-6 max-w-md w-full shadow-2xl shadow-emerald-900/40"
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white h-8 w-8 rounded-full flex items-center justify-center text-xs cursor-pointer transition-all border border-white/5"
        >
          ✕
        </button>

        {/* Header */}
        <div className="text-center mb-5">
          <div className="text-3xl mb-2">🏟️</div>
          <p className="text-[10px] font-mono tracking-widest text-emerald-400 font-black uppercase">
            CLUB OWNERSHIP · MATCHDAY REPORT
          </p>
          <h2 className="text-lg font-black text-white mt-1">{teamName}</h2>
        </div>

        {/* Total revenue banner */}
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 text-center mb-4">
          <p className="text-[10px] text-emerald-400 font-mono font-bold uppercase tracking-widest mb-1">
            MATCHDAY REVENUE CREDITED
          </p>
          <p className="text-3xl font-black text-emerald-400 font-mono">
            +${formatMoney(revenue)}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">Added to your wallet</p>
        </div>

        {/* Per-fixture breakdown */}
        <div className="space-y-2 mb-5">
          <p className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">
            MATCH BREAKDOWN
          </p>
          {fixtures.map((f, i) => (
            <div
              key={i}
              className="bg-white/5 border border-white/8 rounded-xl p-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{resultIcon(f.result)}</span>
                <div>
                  <span className={`text-xs font-black ${resultColor(f.result)}`}>
                    {resultLabel(f.result)} {f.scoreline}
                  </span>
                  <p className="text-[9px] text-slate-500 font-mono">
                    Base: ${formatMoney(f.baseIncome)}
                    {f.bonus !== 0 && (
                      <span className={f.bonus > 0 ? " text-emerald-400" : " text-red-400"}>
                        {f.bonus > 0 ? ` +$${formatMoney(f.bonus)} WIN BONUS` : ` -$${formatMoney(Math.abs(f.bonus))} LOSS PENALTY`}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <span className={`text-sm font-black font-mono ${f.bonus > 0 ? "text-emerald-400" : f.bonus < 0 ? "text-red-400" : "text-slate-300"}`}>
                +${formatMoney(f.baseIncome + f.bonus)}
              </span>
            </div>
          ))}
        </div>

        {/* Perks reminder */}
        <div className="bg-white/3 border border-white/8 rounded-xl p-3 text-center mb-4">
          <p className="text-[10px] text-slate-400 font-mono">
            💡 <span className="text-emerald-400 font-bold">OWNER PERK</span> — You get 5% boosted odds on your club's matches. Upgrade your <span className="text-yellow-400 font-bold">Stadium</span> in My Club to increase matchday revenue.
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black py-3 rounded-xl text-sm cursor-pointer transition-all"
        >
          COLLECT & CONTINUE →
        </button>
      </div>
    </div>
  );
};
