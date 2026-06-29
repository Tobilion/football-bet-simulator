import React, { useState } from "react";
import { Tv, Calendar, Ticket, Users, BarChart3, Trophy, Award, Plus, RotateCcw, Activity, LogOut, Gamepad2, MessageSquare, ShieldCheck, ArrowLeftRight } from "lucide-react";

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  username: string;
  balance: number;
  addFunds: () => void;
  resetTournament: () => void;
  currentRoundLabel: string;
  gameMode: "TOURNAMENT" | "LEAGUE";
  exitToMenu: () => void;
  hasOwnedClub?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  username,
  balance,
  addFunds,
  resetTournament,
  currentRoundLabel,
  gameMode,
  exitToMenu,
  hasOwnedClub = false,
}) => {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const tabs = [
    { id: "live", label: "Live", icon: <Tv size={14} className="opacity-85" /> },
    { id: "fixtures", label: "Fixtures & Odds", icon: <Calendar size={14} className="opacity-85" /> },
    { id: "bets", label: "My Bets", icon: <Ticket size={14} className="opacity-85" /> },
    { id: "feed", label: "Fan Feed", icon: <MessageSquare size={14} className="opacity-85" /> },
    { id: "store", label: "VIP Store", icon: <div className="text-amber-500 font-bold">🛒</div> },
    { id: "casino", label: "Elite Casino", icon: <Gamepad2 size={14} className="opacity-[0.95] text-amber-450" /> },
    ...(hasOwnedClub ? [{ id: "myclub", label: "My Club", icon: <ShieldCheck size={14} className="text-emerald-400" /> }] : []),
    ...(hasOwnedClub ? [{ id: "transfers", label: "Transfers", icon: <ArrowLeftRight size={14} className="text-sky-400" /> }] : []),
    { id: "teams", label: "Teams", icon: <Users size={14} className="opacity-85" /> },
    { id: "analytics", label: "Analytics", icon: <BarChart3 size={14} className="opacity-85" /> },
    { id: "tournament", label: gameMode === "LEAGUE" ? "Standings" : "Tournament", icon: <Trophy size={14} className="opacity-85" /> },
    { id: "leaderboard", label: "Leaderboard", icon: <Award size={14} className="opacity-85" /> }
  ];

  return (
    <header className="glass-panel border-x-0 border-t-0 rounded-none h-16 px-4 md:px-6 flex items-center justify-between select-none shrink-0 z-40">
      {/* Brand logo */}
      <div className="flex items-center gap-3">
        <Activity size={20} className="animate-pulse text-emerald-400" />
        <div className="hidden sm:block">
          <h1 className="text-sm font-black tracking-wider uppercase text-emerald-400 font-sans leading-none">
            CU Bet
          </h1>
          <p className="text-[10px] text-slate-400 font-mono tracking-widest leading-none mt-1">
            {gameMode === "LEAGUE" ? "LEAGUE CAMPAIGN" : "TOURNAMENT ENGINE"}
          </p>
        </div>
      </div>

      {/* Navigation tabs */}
      <nav className="flex items-center overflow-x-auto no-scrollbar max-w-[45%] sm:max-w-[55%] md:max-w-none h-full mx-2">
        <div className="flex items-center gap-0.5 md:gap-1">
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                title={tab.label}
                className={`flex items-center gap-1.5 px-2 md:px-3 py-2 md:py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 cursor-pointer min-w-[36px] min-h-[36px] justify-center md:justify-start ${
                  isActive
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                    : "text-slate-300 hover:bg-white/5 hover:text-white border border-transparent"
                }`}
              >
                <span className="shrink-0">{tab.icon}</span>
                <span className="hidden md:inline">{tab.label}</span>
                {tab.id === "live" && (
                  <span className="flex h-1.5 w-1.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Profile & Wallet */}
      <div className="flex items-center gap-1.5 md:gap-3">
        {/* Wallet Display */}
        <div className="bg-white/5 px-2 md:px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-1.5 md:gap-2">
          <span className="hidden sm:inline text-[9px] font-mono text-slate-400 tracking-wider">WALLET:</span>
          <span className="text-xs font-bold text-emerald-400 font-mono">
            ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <button
            onClick={addFunds}
            title="Add +$1000.00 Funds"
            className="ml-0.5 md:ml-1.5 bg-emerald-500/20 hover:bg-emerald-500 hover:text-slate-950 text-emerald-400 p-0.5 px-1 rounded-md transition-all cursor-pointer flex items-center justify-center font-black text-[10px] min-w-[24px] min-h-[24px]"
          >
            <Plus size={10} strokeWidth={3} />
          </button>
        </div>

        {/* Current Round Indicator */}
        <div className="hidden lg:flex flex-col items-end border-l border-white/10 pl-3">
          <span className="text-[10px] text-slate-400 font-mono leading-none">STAGE</span>
          <span className="text-xs font-black text-emerald-400 font-sans tracking-tight mt-0.5">
            {currentRoundLabel}
          </span>
        </div>

        {/* Developer resets option */}
        <button
          onClick={() => setShowResetConfirm(true)}
          title="Restart Championship"
          className="bg-red-500/10 hover:bg-red-500/30 text-red-400 p-2 rounded-lg border border-red-500/20 transition-all cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
        >
          <RotateCcw size={14} />
        </button>

        {/* Exit to Main Menu option */}
        <button
          onClick={exitToMenu}
          title="Exit to Mode Selection"
          className="bg-slate-500/15 hover:bg-slate-500/35 text-slate-300 hover:text-white p-2 rounded-lg border border-white/10 transition-all cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
        >
          <LogOut size={14} />
        </button>

        {showResetConfirm && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[100] animate-fade-in animate-duration-200">
            <div className="glass-panel border-red-500/30 max-w-md w-full p-6 text-center space-y-4 shadow-[0_0_50px_rgba(239,68,68,0.15)] mx-4">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15 border border-red-500/30 text-red-400">
                <RotateCcw size={24} className="animate-spin-slow" />
              </div>
              
              <div className="space-y-1">
                <span className="text-[10px] text-red-400 font-mono tracking-widest uppercase font-bold">
                  ⚠️ DANGER ZONE
                </span>
                <h3 className="text-sm font-bold text-slate-100 font-sans tracking-tight">
                  Reset Tournament Championship?
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  This action is irreversible. All current fixtures, live standings, bets history, and user wallet profile statistics will be wiped and seeded with a fresh Round of 32 champion cup.
                </p>
              </div>
              
              <div className="flex items-center gap-3 justify-center pt-2 select-none">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="bg-white/5 hover:bg-white/10 text-slate-300 font-bold px-4 py-2 rounded-xl text-xs cursor-pointer border border-white/5 hover:text-white transition-all duration-150"
                >
                  Nevermind, Cancel
                </button>
                <button
                  onClick={() => {
                    setShowResetConfirm(false);
                    resetTournament();
                  }}
                  className="bg-red-500 hover:bg-red-650 text-white font-bold px-4 py-2 rounded-xl text-xs cursor-pointer shadow-md shadow-red-500/10 hover:shadow-red-500/20 active:scale-95 transition-all duration-150"
                >
                  Yes, Completely Reset
                </button>
              </div>
            </div>
          </div>
        )}

        {/* User name badge */}
                <div className="hidden md:flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center font-black text-slate-900 border border-emerald-400 shadow-lg shadow-emerald-500/20">
            {username.slice(0, 2).toUpperCase()}
          </div>
        </div>
      </div>
    </header>
  );
};
