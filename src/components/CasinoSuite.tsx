import React, { useState, useEffect } from "react";
import {
  Gamepad2, Coins, ArrowLeft, Play, ShieldAlert, History, Maximize2, Minimize2,
} from "lucide-react";

import { RedOrBlackGame } from "./casino/RedOrBlackGame";
import { SpinTheBottleGame } from "./casino/SpinTheBottleGame";
import { PaddockRushGame } from "./casino/PaddockRushGame";
import { SportyMinesGame } from "./casino/SportyMinesGame";
import { PenaltyShootoutGame } from "./casino/PenaltyShootoutGame";
import { FootballSlotsGame } from "./casino/FootballSlotsGame";
import { PlinkoGame } from "./casino/PlinkoGame";
import { OverUnderDiceGame } from "./casino/OverUnderDiceGame";
import { BlackjackGame } from "./casino/BlackjackGame";
import { RouletteGame } from "./casino/RouletteGame";
import { HiLoGame } from "./casino/HiLoGame";
import { KenoGame } from "./casino/KenoGame";
import { TowerClimberGame } from "./casino/TowerClimberGame";
import { WheelOfWealthGame } from "./casino/WheelOfWealthGame";
import { BaccaratGame } from "./casino/BaccaratGame";
import { ScratchCardGame } from "./casino/ScratchCardGame";
import { formatMoney } from "../utils";

interface CasinoSuiteProps {
  balance: number;
  onUpdateBalance: (update: number | ((prev: number) => number)) => void;
  username: string;
  currentRoundIndex: number;
}

interface RollingLog {
  id: string; game: string; timestamp: number; amount: number;
  multiplier: number; status: "WIN" | "LOSS" | "JOKER" | "FREEZE"; details: string;
}

const GAMES_LIST = [
  { id: "blackjack", name: "Stadium Blackjack", rtp: "99.5%", desc: "6-deck shoe. Hit, Stand, or Double Down against the dealer. Blackjack pays 3:2.", tag: "NEW ♟️", color: "from-slate-700/30 to-black/40 border-slate-500/30", multiplier: "up to 2.5x" },
  { id: "roulette", name: "Stadium Roulette", rtp: "97.3%", desc: "European single-zero roulette. Pick numbers, colors, dozens, or columns.", tag: "NEW 🎡", color: "from-red-600/20 to-black/40 border-red-500/30", multiplier: "up to 36x" },
  { id: "hilo", name: "Hi-Lo Card Ladder", rtp: "97.0%", desc: "Guess Higher or Lower 8 times in a row. Cashout early or chase 120x!", tag: "NEW 🃏", color: "from-blue-600/20 to-black/40 border-blue-500/30", multiplier: "up to 120x" },
  { id: "keno", name: "Keno Rush", rtp: "96.5%", desc: "Pick up to 10 numbers from 40. Match them when 10 are drawn. 5000x jackpot!", tag: "NEW 🎰", color: "from-violet-600/20 to-black/40 border-violet-500/30", multiplier: "up to 5000x" },
  { id: "tower", name: "Tower Climber", rtp: "97.0%", desc: "Pick 1 safe door per floor. Climb all 10 floors for 50x or cashout early.", tag: "NEW 🏗️", color: "from-cyan-600/20 to-black/40 border-cyan-500/30", multiplier: "up to 50x" },
  { id: "wheel", name: "Wheel of Wealth", rtp: "96.0%", desc: "12-segment spinning wheel. Up to 20x multiplier on every spin!", tag: "NEW 🎡", color: "from-amber-600/20 to-black/40 border-amber-500/30", multiplier: "up to 20x" },
  { id: "baccarat", name: "Baccarat Royale", rtp: "98.9%", desc: "Bet on Player, Banker or Tie. Tie pays 8:1. Banker 5% commission.", tag: "NEW 🎴", color: "from-rose-600/20 to-black/40 border-rose-500/30", multiplier: "up to 8x" },
  { id: "scratch", name: "Scratch & Score", rtp: "95.5%", desc: "Scratch 9 cells. Match 3+ symbols for up to 50x on diamonds!", tag: "NEW 🪙", color: "from-yellow-600/20 to-black/40 border-yellow-500/30", multiplier: "up to 50x" },
  { id: "redblack", name: "Red or Black Streak", rtp: "97.0%", desc: "Double or nothing 4-round streak. Beware of the trick Joker! Up to 16.8x.", tag: "HOT STREAK", color: "from-red-500/20 to-black/40 border-red-500/30", multiplier: "up to 16.8x" },
  { id: "bottle", name: "Spin the Bottle", rtp: "97.5%", desc: "Bet Up or Down with the rotating champagne bottle. 2% freeze risk.", tag: "CLASSIC", color: "from-yellow-500/10 to-black/40 border-yellow-500/30", multiplier: "1.98x" },
  { id: "crash", name: "Paddock Rush", rtp: "97.2%", desc: "Predict how far the football mascot runs before tripping. Uncapped multiplier!", tag: "HIGH VOL", color: "from-emerald-500/20 to-black/40 border-emerald-500/30", multiplier: "uncapped" },
  { id: "mines", name: "SportyMines", rtp: "98.0%", desc: "Custom mines on a 5x5 pitch. Uncover helmets and cash out early.", tag: "STRATEGY", color: "from-blue-500/20 to-black/40 border-blue-500/30", multiplier: "customizable" },
  { id: "shootout", name: "Penalty Shootout", rtp: "97.5%", desc: "Interactive spot kick. Beat the keeper for massive 40x multipliers!", tag: "SKILL", color: "from-purple-500/20 to-black/40 border-purple-500/30", multiplier: "up to 40.0x" },
  { id: "slots", name: "Football Slots", rtp: "96.5%", desc: "Spin football reels with high-paying Cups (100x) and Golden Boots (50x).", tag: "CASUAL", color: "from-amber-600/20 to-black/40 border-amber-500/30", multiplier: "up to 100.0x" },
  { id: "plinko", name: "Golden Boot Plinko", rtp: "98.1%", desc: "Drop a golden chip through pegs into boosted multiplier bins.", tag: "BEST RTP", color: "from-pink-500/20 to-black/40 border-pink-500/30", multiplier: "up to 15.0x" },
  { id: "dice", name: "Over / Under Dice", rtp: "97.8%", desc: "Roll high-fidelity duel dice. Adjust targets for boosted payouts.", tag: "SWIFT", color: "from-sky-500/20 to-black/40 border-sky-500/30", multiplier: "up to 5.85x" },
];

export const CasinoSuite: React.FC<CasinoSuiteProps> = ({ balance, onUpdateBalance, username, currentRoundIndex }) => {
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const [isFullView, setIsFullView] = useState<boolean>(false);
  const [filter, setFilter] = useState<"all" | "new" | "classic">("all");

  const [claimedRounds, setClaimedRounds] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem("fs_casino_emergency_claimed_rounds_v2") || "[]"); } catch { return []; }
  });
  const hasClaimedEmergency = claimedRounds.includes(currentRoundIndex);
  const setHasClaimedEmergency = (claimed: boolean) => {
    if (claimed && !hasClaimedEmergency) {
      const next = [...claimedRounds, currentRoundIndex];
      setClaimedRounds(next);
      localStorage.setItem("fs_casino_emergency_claimed_rounds_v2", JSON.stringify(next));
    }
  };

  const [logs, setLogs] = useState<RollingLog[]>(() => {
    try { return JSON.parse(localStorage.getItem("fs_casino_logs_v6") || "[]"); } catch { return []; }
  });

  const saveLogs = (newLogs: RollingLog[]) => {
    setLogs(newLogs);
    localStorage.setItem("fs_casino_logs_v6", JSON.stringify(newLogs));
  };

  const addLog = (game: string, amount: number, multiplier: number, status: "WIN"|"LOSS"|"JOKER"|"FREEZE", details: string) => {
    const freshLog: RollingLog = { id: "log_" + Date.now() + "_" + Math.floor(Math.random() * 1000), game, timestamp: Date.now(), amount, multiplier, status, details };
    saveLogs([freshLog, ...logs].slice(0, 15));
  };

  const currentGame = GAMES_LIST.find(g => g.id === activeGame);
  const filteredGames = GAMES_LIST.filter(g => {
    if (filter === "new") return g.tag.includes("NEW");
    if (filter === "classic") return !g.tag.includes("NEW");
    return true;
  });

  const gameRenderer: Record<string, React.ReactNode> = {
    redblack: <RedOrBlackGame balance={balance} onUpdateBalance={onUpdateBalance} addLog={addLog} />,
    bottle: <SpinTheBottleGame balance={balance} onUpdateBalance={onUpdateBalance} addLog={addLog} />,
    crash: <PaddockRushGame balance={balance} onUpdateBalance={onUpdateBalance} addLog={addLog} />,
    mines: <SportyMinesGame balance={balance} onUpdateBalance={onUpdateBalance} addLog={addLog} />,
    shootout: <PenaltyShootoutGame balance={balance} onUpdateBalance={onUpdateBalance} addLog={addLog} />,
    slots: <FootballSlotsGame balance={balance} onUpdateBalance={onUpdateBalance} addLog={addLog} />,
    plinko: <PlinkoGame balance={balance} onUpdateBalance={onUpdateBalance} addLog={addLog} />,
    dice: <OverUnderDiceGame balance={balance} onUpdateBalance={onUpdateBalance} addLog={addLog} />,
    blackjack: <BlackjackGame balance={balance} onUpdateBalance={onUpdateBalance} addLog={addLog} />,
    roulette: <RouletteGame balance={balance} onUpdateBalance={onUpdateBalance} addLog={addLog} />,
    hilo: <HiLoGame balance={balance} onUpdateBalance={onUpdateBalance} addLog={addLog} />,
    keno: <KenoGame balance={balance} onUpdateBalance={onUpdateBalance} addLog={addLog} />,
    tower: <TowerClimberGame balance={balance} onUpdateBalance={onUpdateBalance} addLog={addLog} />,
    wheel: <WheelOfWealthGame balance={balance} onUpdateBalance={onUpdateBalance} addLog={addLog} />,
    baccarat: <BaccaratGame balance={balance} onUpdateBalance={onUpdateBalance} addLog={addLog} />,
    scratch: <ScratchCardGame balance={balance} onUpdateBalance={onUpdateBalance} addLog={addLog} />,
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-[#05070a] text-slate-100 flex flex-col custom-scrollbar" id="cu-bet-elite-casino-suite">
      {/* Header — lobby only */}
      {!activeGame && (
        <div className="relative shrink-0 border-b border-white/5 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#101725] via-[#05070a] to-[#05070a] px-4 md:px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Gamepad2 className="text-emerald-400 animate-pulse" size={18} />
              <span className="text-[10px] text-emerald-400 font-mono tracking-widest uppercase font-black">CU BET ELITE LOUNGE</span>
            </div>
            <h2 className="text-sm font-black text-slate-100 font-sans uppercase tracking-wider mt-1 flex items-center gap-2 flex-wrap">
              CU Bet Elite Casino Suite
              <span className="bg-emerald-500/20 text-emerald-400 text-[8px] font-mono px-1.5 py-0.5 rounded-full animate-pulse font-black">16 GAMES</span>
            </h2>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">Wager with your manager balance. Wins reflect instantly.</p>
          </div>
          <div className="flex gap-2.5 items-center bg-black/40 border border-white/10 rounded-2xl px-3.5 py-2 shrink-0">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></div>
            <Coins className="text-amber-400" size={16} />
            <div className="font-mono">
              <span className="text-[9px] text-slate-400 block uppercase leading-none font-bold">LOBBY BAL</span>
              <span className="text-xs font-black text-emerald-400 mt-1 block">${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      )}

      {/* Low balance warning — lobby */}
      {!activeGame && balance < 50 && !hasClaimedEmergency && (
        <div className="mx-4 md:mx-6 mt-4 bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShieldAlert className="text-red-400 animate-bounce shrink-0" size={20} />
            <div>
              <span className="text-[11px] font-mono font-black text-red-400 uppercase">LOW BALANCE ALERT</span>
              <p className="text-[10px] text-slate-300">Balance: ${formatMoney(balance)}. Claim $500 trial credits!</p>
            </div>
          </div>
          <button onClick={() => { onUpdateBalance(p => p + 500); setHasClaimedEmergency(true); addLog("Emergency Grant", 500, 1, "WIN", "Claimed $500 emergency fund"); }}
            className="bg-emerald-500 hover:bg-emerald-400 text-[#05070a] font-extrabold text-[10px] px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-lg active:scale-95 uppercase tracking-wide shrink-0">
            Claim $500 💸
          </button>
        </div>
      )}

      <div className={`grid gap-4 p-4 md:p-5 items-start ${activeGame && isFullView ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-12"}`}>
        {/* Left sidebar: VIP card + log history */}
        {!(activeGame && isFullView) && (
          <div className={`${activeGame ? "hidden lg:flex lg:col-span-4" : "lg:col-span-4"} flex flex-col gap-4`}>
            <div className="bg-[#0b0e14] border border-white/5 rounded-2xl p-4 flex flex-col shrink-0">
              <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">VIP MEMBERS CLUB</span>
              <h3 className="text-xs font-bold text-slate-100 mt-0.5">Hi, Manager {username}!</h3>
              <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">16 premium games. All bets logged to leaderboard.</p>
              <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-white/5 text-[10px] font-mono text-slate-400">
                <div><span className="text-slate-500 block">GAMES</span><span className="font-bold text-slate-100">16</span></div>
                <div><span className="text-slate-500 block">SESSIONS</span><span className="font-bold text-slate-100">{logs.length}</span></div>
                <div><span className="text-slate-500 block">MAX WIN</span><span className="font-bold text-emerald-400">5000x</span></div>
              </div>
            </div>

            {/* Rolling log */}
            <div className="flex-1 bg-[#0b0e14] border border-white/5 rounded-2xl p-4 flex flex-col min-h-0">
              <div className="flex items-center justify-between border-b border-white/5 pb-2.5 shrink-0">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <History size={11} className="text-emerald-400" /> Live Sessions (Last 15)
                </span>
                <span className="text-[9px] text-slate-500 font-mono">SYS-ONLINE</span>
              </div>
              <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 mt-3 max-h-[300px] lg:max-h-none">
                {logs.length === 0 ? (
                  <div className="text-center text-slate-500 text-[11px] py-12">No sessions logged yet.</div>
                ) : logs.map(log => {
                  const isWin = log.status === "WIN";
                  const isJoker = log.status === "JOKER";
                  const isFreeze = log.status === "FREEZE";
                  return (
                    <div key={log.id} className="bg-black/25 border border-white/5 rounded-xl p-2.5 flex items-center justify-between text-xs hover:bg-slate-900/40 transition-all">
                      <div className="space-y-0.5 max-w-[58%]">
                        <div className="font-bold text-slate-200 truncate text-[11px]">{log.game}</div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">{log.details}</div>
                      </div>
                      <div className="text-right font-mono">
                        <span className={`font-black text-xs ${isWin ? "text-emerald-400" : isJoker ? "text-amber-500" : isFreeze ? "text-blue-400" : "text-red-400"}`}>
                          {isWin ? `+$${formatMoney(Math.max(0, (log.amount ?? 0) * ((log.multiplier ?? 0) - 1)))}` : isJoker ? "WIPED" : isFreeze ? "FROZEN" : `-$${formatMoney(log.amount ?? 0, 0)}`}
                        </span>
                        <div className="text-[9px] text-slate-500 uppercase mt-0.5">
                          {isWin ? `${(log.multiplier ?? 0).toFixed(1)}x` : isJoker ? "JOKER" : isFreeze ? "FREEZE" : "LOST"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Right: game area or lobby grid */}
        <div className={`${activeGame && isFullView ? "col-span-1" : "lg:col-span-8"} flex flex-col`}>
          {activeGame ? (
            <div className="flex-1 bg-[#0b0e14] border border-white/5 rounded-2xl flex flex-col min-h-[560px] relative shadow-2xl overflow-hidden">
              {/* Active game header */}
              <div className="flex items-center justify-between border-b border-white/5 px-4 py-3 shrink-0">
                <div className="flex gap-2">
                  <button onClick={() => { setActiveGame(null); setIsFullView(false); }}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-lg border border-white/5 active:scale-95 cursor-pointer transition-all">
                    <ArrowLeft size={13} /><span>Lobby</span>
                  </button>
                  <button onClick={() => setIsFullView(!isFullView)}
                    className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1.5 rounded-lg border border-emerald-500/20 active:scale-95 cursor-pointer font-bold transition-all">
                    {isFullView ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                    <span className="hidden sm:inline">{isFullView ? "Split" : "Full Screen"}</span>
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <span className="text-[9px] font-mono text-slate-400 block uppercase font-bold">ACTIVE GAME</span>
                    <span className="text-xs font-black text-slate-200 tracking-wide">{currentGame?.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-black/50 border border-white/10 rounded-xl px-2.5 py-1.5">
                    <Coins className="text-amber-400" size={13} />
                    <div>
                      <span className="text-[8px] text-slate-500 block uppercase font-mono leading-none">BAL</span>
                      <span className={`text-xs font-black font-mono block mt-0.5 ${balance <= 0 ? "text-red-400" : "text-emerald-400"}`}>
                        ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Low balance in-game */}
              {balance < 50 && (
                <div className="mx-4 mt-3 bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2 flex items-center justify-between gap-3 shrink-0 animate-pulse">
                  <div className="flex items-center gap-2">
                    <ShieldAlert size={14} className="text-red-400 shrink-0" />
                    <span className="text-[10px] text-red-300 font-mono">Low balance! Claim $1,000 free.</span>
                  </div>
                  <button onClick={() => { onUpdateBalance(p => p + 1000); addLog("Emergency Grant", 1000, 1, "WIN", "Claimed $1000 fund"); }}
                    className="bg-amber-500 hover:bg-amber-450 text-[#05070a] text-[9.5px] font-black px-3 py-1 rounded-lg cursor-pointer active:scale-95 transition-all whitespace-nowrap uppercase shrink-0">
                    +$1,000
                  </button>
                </div>
              )}

              <div className="flex-1 p-4" key={activeGame}>
                {gameRenderer[activeGame]}
              </div>
            </div>
          ) : (
            <div className="flex flex-col">
              {/* Filter tabs + count */}
              <div className="flex items-center justify-between pb-3 flex-wrap gap-2">
                <div className="flex gap-1.5 bg-black/40 border border-white/5 rounded-xl p-1">
                  {(["all","new","classic"] as const).map(f => (
                    <button key={f} onClick={() => setFilter(f)}
                      className={`px-3 py-1.5 text-[9px] font-bold rounded-lg cursor-pointer transition-all uppercase ${filter === f ? "bg-emerald-500 text-slate-950 font-black" : "text-slate-400 hover:text-white"}`}>
                      {f === "all" ? `All (${GAMES_LIST.length})` : f === "new" ? "New (8)" : "Classic (8)"}
                    </button>
                  ))}
                </div>
                <span className="text-[10px] text-slate-500 font-mono hidden sm:block">Click card to launch terminal</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 content-start pr-0.5 pb-6 flex-1">
                {filteredGames.map(g => (
                  <div key={g.id} onClick={() => setActiveGame(g.id)}
                    className={`p-4 rounded-2xl bg-gradient-to-br ${g.color} flex flex-col justify-between text-left hover:scale-[1.015] active:scale-[0.99] transition-all cursor-pointer group relative overflow-hidden border`}>
                    <div className="absolute top-0 right-0 h-10 w-10 bg-white/3 rounded-bl-3xl flex items-center justify-center border-l border-b border-white/5 text-[8px] font-mono text-emerald-400 font-extrabold">{g.rtp}</div>
                    <div className="space-y-1.5">
                      <span className={`text-[8px] font-mono font-black px-2 py-0.5 rounded-full uppercase tracking-wider border ${g.tag.includes("NEW") ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" : "bg-white/5 border-white/10 text-amber-400"}`}>{g.tag}</span>
                      <div>
                        <h4 className="text-sm font-black text-slate-200 group-hover:text-emerald-400 transition-colors uppercase tracking-tight">{g.name}</h4>
                        <p className="text-[10px] text-slate-400 mt-1 leading-normal max-w-[90%]">{g.desc}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5 text-[10px] font-mono text-slate-400">
                      <span>Max: <b className="text-emerald-400">{g.multiplier}</b></span>
                      <span className="flex items-center gap-1 text-emerald-400 group-hover:text-white font-extrabold transition-all">
                        PLAY <Play size={10} className="fill-current" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
