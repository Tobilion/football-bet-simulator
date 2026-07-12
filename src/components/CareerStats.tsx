import React from "react";
import { CareerProfile, Profile } from "../types";
import { formatMoney } from "../utils";
import { buildSeasonRecord } from "../utils/careerUtils";

interface CareerStatsProps {
  career: CareerProfile;
  liveProfile?: Profile | null;
  gameMode?: "TOURNAMENT" | "LEAGUE" | null;
}

const PRESTIGE_ICONS = ["🎲", "🃏", "💼", "🏅", "👑", "🐐"];
const SEASONS_PER_LEVEL = 3;

export const CareerStats: React.FC<CareerStatsProps> = ({ career, liveProfile, gameMode }) => {
  // Live, in-progress season stats so the Career tab visibly advances as matches
  // are played, rather than only updating when a whole season concludes.
  const live = liveProfile && gameMode
    ? buildSeasonRecord(liveProfile, "—", gameMode, career.totalSeasonsPlayed + 1)
    : null;
  const icon = PRESTIGE_ICONS[Math.min(career.prestigeLevel, PRESTIGE_ICONS.length - 1)];
  const seasonsIntoLevel = career.totalSeasonsPlayed % SEASONS_PER_LEVEL;
  const isMaxLevel = career.prestigeLevel >= PRESTIGE_ICONS.length - 1;
  const progressPct = isMaxLevel ? 100 : Math.round((seasonsIntoLevel / SEASONS_PER_LEVEL) * 100);
  const bestSeasonNum = career.bestSeason?.seasonNumber;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 space-y-5 no-scrollbar">
      {/* Prestige badge */}
      <div className="glass-card border border-yellow-400/20 rounded-2xl p-6 text-center bg-gradient-to-b from-yellow-400/5 to-transparent">
        <div className="text-5xl mb-2">{icon}</div>
        <p className="text-2xl font-black text-yellow-400 tracking-widest uppercase">
          {career.prestigeTitle}
        </p>
        <p className="text-[10px] text-slate-500 font-mono uppercase mt-1">
          Prestige Level {career.prestigeLevel} • {career.totalSeasonsPlayed} season
          {career.totalSeasonsPlayed === 1 ? "" : "s"} played
        </p>
      </div>

      {/* In-progress season (live) */}
      {live && (
        <div className="glass-card border border-emerald-400/20 rounded-2xl p-4 bg-gradient-to-b from-emerald-400/5 to-transparent">
          <div className="flex justify-between items-center mb-3">
            <p className="text-[9px] font-black tracking-widest text-emerald-400 uppercase">Current Season — In Progress</p>
            <span className="text-[9px] font-mono text-slate-500 uppercase">{gameMode}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div>
              <p className="text-[8px] text-slate-500 uppercase font-bold">Bets Placed</p>
              <p className="text-lg font-black font-mono text-white mt-0.5">{live.totalBetsPlaced}</p>
            </div>
            <div>
              <p className="text-[8px] text-slate-500 uppercase font-bold">Bets Won</p>
              <p className="text-lg font-black font-mono text-emerald-400 mt-0.5">{live.totalBetsWon}</p>
            </div>
            <div>
              <p className="text-[8px] text-slate-500 uppercase font-bold">Win Rate</p>
              <p className="text-lg font-black font-mono text-white mt-0.5">{live.winRate}%</p>
            </div>
            <div>
              <p className="text-[8px] text-slate-500 uppercase font-bold">Net Profit</p>
              <p className={`text-lg font-black font-mono mt-0.5 ${live.netProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {live.netProfit >= 0 ? "+" : ""}{formatMoney(live.netProfit)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* All-time stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="glass-card border border-white/5 rounded-2xl p-4">
          <p className="text-[9px] font-black tracking-widest text-slate-500 uppercase">All-Time Profit</p>
          <p className={`text-2xl font-black font-mono mt-1 ${career.allTimeProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {career.allTimeProfit >= 0 ? "+" : ""}{formatMoney(career.allTimeProfit)}
          </p>
        </div>
        <div className="glass-card border border-white/5 rounded-2xl p-4">
          <p className="text-[9px] font-black tracking-widest text-slate-500 uppercase">All-Time Win Rate</p>
          <p className="text-2xl font-black font-mono text-white mt-1">{career.allTimeWinRate}%</p>
        </div>
        <div className="glass-card border border-white/5 rounded-2xl p-4">
          <p className="text-[9px] font-black tracking-widest text-slate-500 uppercase">Seasons Played</p>
          <p className="text-2xl font-black font-mono text-white mt-1">{career.totalSeasonsPlayed}</p>
        </div>
      </div>

      {/* Prestige progress */}
      <div className="glass-card border border-white/5 rounded-2xl p-4">
        <div className="flex justify-between items-center mb-2">
          <p className="text-[9px] font-black tracking-widest text-slate-400 uppercase">Prestige Progress</p>
          <p className="text-[9px] text-slate-500 font-mono">
            {isMaxLevel ? "MAX PRESTIGE" : `${seasonsIntoLevel}/${SEASONS_PER_LEVEL} seasons to next title`}
          </p>
        </div>
        <div className="h-2 bg-black/40 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-yellow-500 to-amber-400 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Season records table */}
      <div className="glass-card border border-white/5 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5">
          <h3 className="text-xs font-black tracking-widest text-slate-400 uppercase">📜 Season Records</h3>
        </div>
        {career.records.length === 0 ? (
          <p className="text-center text-sm text-slate-500 py-10">
            No completed seasons yet. Finish a tournament or league campaign to start your career log.
          </p>
        ) : (
          <div className="overflow-x-auto max-h-[340px] overflow-y-auto no-scrollbar">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-[#12151d]">
                <tr className="text-[9px] font-black tracking-widest text-slate-500 uppercase">
                  <th className="px-4 py-2.5">Season</th>
                  <th className="px-4 py-2.5">Mode</th>
                  <th className="px-4 py-2.5 text-right">Net Profit</th>
                  <th className="px-4 py-2.5 text-right">Win Rate</th>
                  <th className="px-4 py-2.5">Champion</th>
                </tr>
              </thead>
              <tbody>
                {[...career.records].reverse().map((r) => {
                  const isBest = r.seasonNumber === bestSeasonNum;
                  return (
                    <tr
                      key={r.seasonNumber}
                      className={`border-t border-white/5 text-xs font-mono ${
                        isBest ? "bg-yellow-400/10 text-yellow-300" : "text-slate-300"
                      }`}
                    >
                      <td className="px-4 py-2.5 font-black">
                        #{r.seasonNumber} {isBest && "🏆"}
                      </td>
                      <td className="px-4 py-2.5 text-[10px] uppercase">{r.mode}</td>
                      <td className={`px-4 py-2.5 text-right font-bold ${r.netProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {r.netProfit >= 0 ? "+" : ""}{formatMoney(r.netProfit)}
                      </td>
                      <td className="px-4 py-2.5 text-right">{r.winRate}%</td>
                      <td className="px-4 py-2.5 truncate max-w-[140px]">{r.champion ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
