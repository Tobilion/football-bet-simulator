import React from "react";
import { Tipster } from "../types";

interface LeaderboardProps {
  tipsters: Tipster[];
  userBalance: number;
  username: string;
  tickets: any[];
}

export const Leaderboard: React.FC<LeaderboardProps> = ({
  tipsters,
  userBalance,
  username,
  tickets
}) => {
  // Compile user stats to resemble a Tipster structure
  const totalPlaced = tickets.length;
  const wonTickets = tickets.filter(t => t.status === "WON");
  const pendingTickets = tickets.filter(t => t.status === "PENDING");
  const accuracy = totalPlaced > 0 ? Math.round((wonTickets.length / (totalPlaced - pendingTickets.length || 1)) * 100) : 0;

  const userTipsterRepresentation: Tipster = {
    id: "user",
    name: `${username} (You)`,
    avatar: "👑",
    bio: "Your personalized virtual betting simulation account profile.",
    balance: userBalance,
    accuracy,
    betsWon: wonTickets.length,
    betsTotal: totalPlaced,
    riskProfile: "BALANCED", // default
    recentTips: tickets.slice(-2).map(t => {
      const selectionsStr = t.selections.map((sel: any) => `${sel.details} (@${sel.odds.toFixed(1)})`).join(" + ");
      return `${t.type} Stake $${t.stake.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} @ odds ${t.totalOdds.toFixed(2)} [${t.status}]: ${selectionsStr}`;
    })
  };

  // Merge, sort, and rank
  const allCompetitors = [userTipsterRepresentation, ...tipsters].sort((a, b) => b.balance - a.balance);

  return (
    <div className="flex-1 min-height-0 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6 no-scrollbar max-h-none">
      
      {/* Title */}
      <div className="border-b border-white/5 pb-3 select-none">
        <span className="text-[10px] text-emerald-400 font-mono tracking-widest block uppercase font-bold">
          GLOBAL TIPSTERS CHAMPIONSHIP
        </span>
        <h2 className="text-sm font-bold text-slate-100 font-sans tracking-tight mt-1">
          Leaderboard ranking of virtual tipsters versus player balance
        </h2>
      </div>

      {/* Leaderboard entries */}
      <div className="space-y-3">
        {allCompetitors.map((comp, idx) => {
          const isUser = comp.id === "user";
          
          let rankIcon = `Rank #${idx + 1}`;
          if (idx === 0) rankIcon = "🥇 #1";
          if (idx === 1) rankIcon = "🥈 #2";
          if (idx === 2) rankIcon = "🥉 #3";

          return (
            <div
              key={comp.id}
              className={`glass-card border rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-150 ${
                isUser 
                  ? "border-emerald-450 bg-emerald-500/5 shadow-[0_0_15px_rgba(16,185,129,0.1)]" 
                  : "border-white/5 hover:border-white/15 hover:bg-white/5"
              }`}
            >
              {/* Profile Block */}
              <div className="flex items-start gap-3.5 flex-1 select-none">
                {/* Ranking Position */}
                <div className="h-10 w-16 shrink-0 rounded-xl bg-black/45 border border-white/5 flex items-center justify-center text-xs font-black font-mono text-emerald-400">
                  {rankIcon}
                </div>

                <div className="text-2xl shrink-0 mt-0.5">{comp.avatar}</div>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className={`text-sm font-extrabold ${isUser ? "text-emerald-400" : "text-slate-200"}`}>
                      {comp.name}
                    </h3>
                    
                    {/* Risk profile tag */}
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                      comp.riskProfile === "SAFE" ? "bg-emerald-500/10 text-emerald-400" :
                      comp.riskProfile === "BALANCED" ? "bg-blue-500/10 text-blue-400" : "bg-red-500/10 text-red-400"
                    }`}>
                      {comp.riskProfile} STYLE
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                    {comp.bio}
                  </p>
                </div>
              </div>

              {/* Financial Performance details */}
              <div className="flex items-center gap-6 justify-between md:justify-end border-t border-white/5 md:border-t-0 pt-3 md:pt-0">
                
                {/* Stats Columns */}
                <div className="text-left font-mono select-none">
                  <span className="text-[8px] text-slate-500 block uppercase font-bold leading-none">PREDICT BALANCE</span>
                  <span className="text-sm font-black text-emerald-400 block mt-0.5 whitespace-nowrap">
                    ${comp.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="text-center font-mono select-none">
                  <span className="text-[8px] text-slate-500 block uppercase font-bold leading-none">STRIKE RATE</span>
                  <span className="text-xs font-black text-emerald-450 block mt-0.5">
                    {comp.accuracy}%
                  </span>
                  <span className="text-[8px] text-slate-500 block leading-none mt-0.5">
                    {comp.betsWon}/{comp.betsTotal} hits
                  </span>
                </div>
              </div>

              {/* Expand tips history box inside footer of item */}
              {comp.recentTips.length > 0 && (
                <div className="w-full md:hidden bg-black/35 rounded-xl p-2.5 text-[10px] text-slate-400 mt-2 font-mono divide-y divide-white/5 border border-white/5">
                  <span className="text-[8px] uppercase text-slate-500 font-bold block mb-1">LATEST TIP RECORD</span>
                  <div className="truncate py-1 leading-tight">{comp.recentTips[0]}</div>
                </div>
              )}
              
              {/* Desktop recent tips drawer */}
              {comp.recentTips.length > 0 && (
                <div className="hidden md:block w-48 shrink-0 bg-black/35 rounded-xl p-2.5 text-[9px] text-slate-400 font-mono border border-white/5 select-none">
                  <span className="text-[8px] uppercase text-slate-500 font-extrabold block mb-1 leading-none tracking-widest">LATEST FORM</span>
                  <div className="truncate pt-1 leading-tight" title={comp.recentTips[0]}>
                    📝 {comp.recentTips[0]}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
