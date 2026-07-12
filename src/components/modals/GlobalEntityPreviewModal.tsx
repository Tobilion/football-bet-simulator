import React, { useState } from "react";
import { TeamCrest } from "../TeamCrest";
import { Team } from "../../types";
import { cleanPlayerName } from "../../utils/playerUtils";

interface GlobalEntityPreviewModalProps {
  globalEntity: { type: "team" | "player"; id: string };
  teams: Team[];
  onClose: () => void;
  onChangeEntity: (entity: { type: "team" | "player"; id: string }) => void;
  onNavigateToTeams: () => void;
}

export const GlobalEntityPreviewModal: React.FC<GlobalEntityPreviewModalProps> = ({
  globalEntity,
  teams,
  onClose,
  onChangeEntity,
  onNavigateToTeams
}) => {
  const [globalPlayerTab, setGlobalPlayerTab] = useState<"stats" | "qualities">("stats");
  const [expandGlobalEntity, setExpandGlobalEntity] = useState<boolean>(false);

  const foundPlayer = globalEntity.type === "player"
    ? teams.flatMap(t => t.players).find(p => p.id === globalEntity.id)
    : null;
  const foundPlayerTeam = foundPlayer
    ? teams.find(t => t.id === foundPlayer.teamId)
    : null;
  const foundTeam = globalEntity.type === "team"
    ? teams.find(t => t.id === globalEntity.id)
    : null;

  if (globalEntity.type === "player" && !foundPlayer) return null;
  if (globalEntity.type === "team" && !foundTeam) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fade-in overflow-y-auto cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative glass-panel-heavy border border-white/10 rounded-3xl p-6 max-w-sm w-full mx-auto my-auto shadow-2xl space-y-6 flex flex-col items-center select-none text-center cursor-default"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white h-9 w-9 rounded-full flex items-center justify-center cursor-pointer text-xs transition-all border border-white/5"
        >
          ✕
        </button>

        {foundPlayer && (
          <div className="w-full flex flex-col items-center space-y-4">
            {/* Player FUT-Card Inspired Title */}
            <div className="flex flex-col items-center">
              <div className="h-11 w-11 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-center text-xl mb-1 shadow-md animate-pulse">
                🏃
              </div>
              <p className="text-[10px] font-mono tracking-widest text-[#10b981] font-extrabold uppercase">
                CHAMPIONSHIP PLAYER PORTRAIT
              </p>
              <h3 className="text-lg font-black text-slate-100 tracking-tight leading-tight mt-1 truncate max-w-[240px]">
                {cleanPlayerName(foundPlayer.name)}
              </h3>
              <div className="flex items-center gap-1.5 mt-1.5 justify-center flex-wrap">
                <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[9px] font-mono text-[#10b981] font-bold">
                  {foundPlayer.position}
                </span>
                {foundPlayerTeam && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-300 font-bold text-xs flex items-center gap-1">
                      <TeamCrest team={foundPlayerTeam} size={16} />
                      {foundPlayerTeam.name}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Selector Tabs */}
            <div className="w-full grid grid-cols-2 border-b border-white/5 text-xs font-bold leading-none select-none">
              <button
                type="button"
                onClick={() => setGlobalPlayerTab("stats")}
                className={`py-2 border-b-2 text-center transition-all cursor-pointer font-bold ${
                  globalPlayerTab === "stats"
                    ? "border-emerald-500 text-emerald-400 font-black"
                    : "border-transparent text-slate-400 hover:text-white font-medium"
                }`}
              >
                SEASON STATS
              </button>
              <button
                type="button"
                onClick={() => setGlobalPlayerTab("qualities")}
                className={`py-2 border-b-2 text-center transition-all cursor-pointer ${
                  globalPlayerTab === "qualities"
                    ? "border-emerald-500 text-emerald-400 font-black"
                    : "border-transparent text-slate-400 hover:text-white font-medium"
                }`}
              >
                TECHNICAL QUALITIES
              </button>
            </div>

            {/* Render content */}
            {globalPlayerTab === "stats" ? (
              <div className="w-full space-y-3 animate-fade-in block">
                {/* Overall badge */}
                <div className="h-16 w-16 mx-auto rounded-full border border-emerald-500/20 bg-emerald-500/5 shadow-[0_0_15px_rgba(16,185,129,0.12)] flex flex-col items-center justify-center">
                  <span className="text-slate-500 font-mono text-[7px] font-bold uppercase leading-none">OVR</span>
                  <span className="text-xl font-black font-mono text-[#10b981] leading-none mt-0.5">
                    {foundPlayer.rating}
                  </span>
                </div>

                {/* Performance stats grid */}
                <div className="w-full bg-black/40 border border-white/5 rounded-xl p-3 grid grid-cols-4 gap-2 text-center text-xs font-mono text-slate-350">
                  <div>
                    <span className="font-black text-slate-205 block">{foundPlayer.matchesPlayed}</span>
                    <span className="text-[8px] text-slate-500 font-bold uppercase block mt-0.5">Played</span>
                  </div>
                  <div>
                    <span className="font-black text-emerald-400 block">{foundPlayer.goals}</span>
                    <span className="text-[8px] text-slate-500 font-bold uppercase block mt-0.5">Goals</span>
                  </div>
                  <div>
                    <span className="font-black text-slate-205 block">
                      {foundPlayer.position === "GK" ? (foundPlayer.saves || 0) : (foundPlayer.assists || 0)}
                    </span>
                    <span className="text-[8px] text-slate-500 font-bold uppercase block mt-0.5">
                      {foundPlayer.position === "GK" ? "Saves" : "Assists"}
                    </span>
                  </div>
                  <div>
                    <span className="font-black text-slate-205 block text-[10px] whitespace-nowrap">
                      🟨{foundPlayer.yellowCards || 0} 🟥{foundPlayer.redCards || 0}
                    </span>
                    <span className="text-[8px] text-slate-500 font-bold uppercase block mt-0.5">Cards</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full space-y-3 bg-black/20 p-4 rounded-2xl border border-white/5 animate-fade-in text-left block">
                <p className="text-[9px] font-mono tracking-widest text-slate-550 font-black uppercase text-center border-b border-white/5 pb-1.5 mb-2">
                  TECHNICAL CHARACTERISTICS GAUGES
                </p>
                {foundPlayer.abilities ? (
                  Object.entries(foundPlayer.abilities).map(([abilKey, abilVal]) => {
                    const value = abilVal as number;
                    const color = value >= 85 ? "bg-emerald-500" : value >= 75 ? "bg-yellow-500" : "bg-sky-500";
                    const label = abilKey.toUpperCase();
                    return (
                      <div key={abilKey} className="space-y-0.5">
                        <div className="flex justify-between text-[10px] font-mono text-slate-300 leading-none">
                          <span className="font-bold uppercase tracking-wider">{label}</span>
                          <span className="font-extrabold text-slate-105">{value}</span>
                        </div>
                        <div className="h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5 relative">
                          <div
                            className={`h-full ${color} rounded-full transition-all duration-300`}
                            style={{ width: `${value}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs font-mono text-slate-550 text-center py-2">
                    No specific abilities declared for player.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {foundTeam && (
          <div className="w-full flex flex-col items-center space-y-4">
            {/* Team Profile Header */}
            <div className="flex flex-col items-center">
              <TeamCrest team={foundTeam} size={56} className="mb-1" />
              <p className="text-[10px] font-mono tracking-widest text-emerald-400 font-extrabold uppercase mt-1">
                CHAMPIONSHIP CLUB DOSSIER
              </p>
              <h3 className="text-lg font-black text-slate-100 tracking-tight leading-tight mt-1.5 truncate max-w-[240px]">
                {foundTeam.name}
              </h3>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[10px] text-slate-400 font-mono uppercase font-bold tracking-widest">
                  RATING: {foundTeam.rating.toFixed(1)} Stars
                </span>
              </div>
            </div>

            {/* Team Color chips */}
            <div className="flex items-center gap-2 select-none">
              <span className="text-[9px] text-slate-500 uppercase font-mono font-bold">Colors:</span>
              <div className="h-4 w-4 rounded-full border border-white/20" style={{ backgroundColor: foundTeam.primaryColor }} title="Primary Color"></div>
              <div className="h-4 w-4 rounded-full border border-white/20" style={{ backgroundColor: foundTeam.secondaryColor }} title="Secondary Color"></div>
            </div>

            {/* Stats Summary Grid */}
            <div className="w-full bg-black/40 border border-white/5 rounded-xl p-3 grid grid-cols-4 gap-2 text-center text-xs">
              <div>
                <span className="text-xs font-black text-slate-200 font-mono block">
                  {foundTeam.wonMatches}
                </span>
                <span className="text-[9px] text-emerald-450 font-mono font-bold uppercase block mt-0.5">
                  Won
                </span>
              </div>
              <div>
                <span className="text-xs font-black text-slate-200 font-mono block">
                  {foundTeam.drawnMatches || 0}
                </span>
                <span className="text-[9px] text-slate-500 font-mono font-bold uppercase block mt-0.5">
                  Drawn
                </span>
              </div>
              <div>
                <span className="text-xs font-black text-slate-200 font-mono block">
                  {foundTeam.lostMatches}
                </span>
                <span className="text-[9px] text-rose-400 font-mono font-bold uppercase block mt-0.5">
                  Lost
                </span>
              </div>
              <div>
                <span className="text-xs font-black text-slate-200 font-mono block">
                  {foundTeam.goalsScored}
                </span>
                <span className="text-[9px] text-sky-450 font-mono font-bold uppercase block mt-0.5">
                  Goals
                </span>
              </div>
            </div>

            {expandGlobalEntity ? (
              <div className="w-full max-h-[180px] overflow-y-auto space-y-2 bg-black/20 p-2.5 rounded-2xl border border-white/5 text-left no-scrollbar">
                <p className="text-[10px] font-mono tracking-widest text-slate-555 font-black uppercase text-center border-b border-white/5 pb-1 select-none">
                  ACTIVE CLUB SQUAD LISTING ({foundTeam.players.length})
                </p>
                <div className="space-y-1 text-[11px] font-mono">
                  {foundTeam.players.map(p => (
                    <div 
                      key={p.id}
                      onClick={() => {
                        onChangeEntity({ type: "player", id: p.id });
                        setExpandGlobalEntity(false);
                      }}
                      className="flex justify-between items-center py-1.5 px-2 hover:bg-white/5 border border-transparent hover:border-white/5 rounded-lg transition-all cursor-pointer"
                    >
                      <span className="font-semibold text-slate-300 truncate block max-w-[150px]">
                        {cleanPlayerName(p.name)}
                      </span>
                      <div className="flex gap-2 items-center">
                        <span className="text-[8px] bg-slate-800 text-slate-400 font-bold px-1 rounded uppercase">
                          {p.position}
                        </span>
                        <span className="font-extrabold text-emerald-450">
                          {p.rating}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setExpandGlobalEntity(true)}
                className="w-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold font-sans text-xs py-2 px-4 rounded-xl border border-emerald-500/20 transition-all cursor-pointer flex items-center justify-center gap-1 hover:scale-[1.01]"
              >
                👥 EXPAND FULL CLUB ROSTER & RATINGS
              </button>
            )}

            <button
              type="button"
              onClick={onNavigateToTeams}
              className="w-full bg-white/5 hover:bg-white/10 text-slate-300 font-medium font-sans text-xs py-1.5 px-4 rounded-xl border border-white/5 transition-all cursor-pointer hover:scale-[1.01]"
            >
              Stadium 🏟️ OPEN DIRECTLY IN FULL SQUAD COMPARATOR
            </button>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full bg-emerald-500 text-slate-950 font-black font-sans text-xs py-2 px-4 rounded-xl hover:scale-105 active:scale-100 transition-all cursor-pointer mt-2"
        >
          Close Preview
        </button>
      </div>
    </div>
  );
};
