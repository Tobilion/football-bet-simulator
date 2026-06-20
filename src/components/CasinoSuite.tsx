import React, { useState, useEffect } from "react";
import {
  Gamepad2,
  Coins,
  ArrowLeft,
  Play,
  ShieldAlert,
  History,
  Maximize2,
  Minimize2,
} from "lucide-react";

import { RedOrBlackGame } from "./casino/RedOrBlackGame";
import { SpinTheBottleGame } from "./casino/SpinTheBottleGame";
import { PaddockRushGame } from "./casino/PaddockRushGame";
import { SportyMinesGame } from "./casino/SportyMinesGame";
import { PenaltyShootoutGame } from "./casino/PenaltyShootoutGame";
import { FootballSlotsGame } from "./casino/FootballSlotsGame";
import { PlinkoGame } from "./casino/PlinkoGame";
import { OverUnderDiceGame } from "./casino/OverUnderDiceGame";

interface CasinoSuiteProps {
  balance: number;
  onUpdateBalance: (update: number | ((prev: number) => number)) => void;
  username: string;
  currentRoundIndex: number;
}

interface RollingLog {
  id: string;
  game: string;
  timestamp: number;
  amount: number;
  multiplier: number;
  status: "WIN" | "LOSS" | "JOKER" | "FREEZE";
  details: string;
}

export const CasinoSuite: React.FC<CasinoSuiteProps> = ({
  balance,
  onUpdateBalance,
  username,
  currentRoundIndex,
}) => {
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const [isFullView, setIsFullView] = useState<boolean>(false);

  const [claimedRounds, setClaimedRounds] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem("fs_casino_emergency_claimed_rounds_v2");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
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
    const saved = localStorage.getItem("fs_casino_logs_v6");
    if (saved) return JSON.parse(saved);
    return [
      {
        id: "1",
        game: "Penalty Shootout",
        timestamp: Date.now() - 300000,
        amount: 100,
        multiplier: 6.0,
        status: "WIN",
        details: "Scored Top-Left Volley",
      },
      {
        id: "2",
        game: "SportyMines",
        timestamp: Date.now() - 250000,
        amount: 50,
        multiplier: 2.1,
        status: "WIN",
        details: "Cleared 4 Helmets",
      },
      {
        id: "3",
        game: "Football Slots",
        timestamp: Date.now() - 200000,
        amount: 200,
        multiplier: 0,
        status: "LOSS",
        details: "No matching lines",
      },
      {
        id: "4",
        game: "Red or Black",
        timestamp: Date.now() - 150000,
        amount: 100,
        multiplier: 0,
        status: "JOKER",
        details: "Wiped by Joker Card",
      },
    ];
  });

  // Reset session trackers when entering/leaving games
  useEffect(() => {
    // Note: setting false is a no-op now so round-limited claims are maintained
    setHasClaimedEmergency(false);
  }, [activeGame]);

  const saveLogs = (newLogs: RollingLog[]) => {
    setLogs(newLogs);
    localStorage.setItem("fs_casino_logs_v6", JSON.stringify(newLogs));
  };

  const addLog = (
    game: string,
    amount: number,
    multiplier: number,
    status: "WIN" | "LOSS" | "JOKER" | "FREEZE",
    details: string,
  ) => {
    const freshLog: RollingLog = {
      id: "log_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      game,
      timestamp: Date.now(),
      amount,
      multiplier,
      status,
      details,
    };
    saveLogs([freshLog, ...logs].slice(0, 10));
  };

  const gamesList = [
    {
      id: "redblack",
      name: "Red or Black Streak",
      rtp: "97.0%",
      desc: "Double or nothing 4-round streak. Beware of the trick Joker! Boosted up to 28x.",
      tag: "HOT STREAK",
      color: "from-red-500/20 to-black/40 border-red-500/30",
      multiplier: "up to 28.0x",
    },
    {
      id: "bottle",
      name: "Spin the Bottle",
      rtp: "97.5%",
      desc: "Bet Up or Down with the rotating champagne bottle. 2% center-freeze risk.",
      tag: "CLASSIC",
      color: "from-yellow-500/10 to-black/40 border-yellow-500/30",
      multiplier: "2.2x",
    },
    {
      id: "crash",
      name: "Paddock Rush",
      rtp: "97.2%",
      desc: "Predict how far the football mascot runs before tripping. Multiplier climbs exponentially!",
      tag: "HIGH VOLATILITY",
      color: "from-emerald-500/20 to-black/40 border-emerald-500/30",
      multiplier: "uncapped",
    },
    {
      id: "mines",
      name: "SportyMines",
      rtp: "98.0%",
      desc: "Configure custom mines on a 5x5 pitch. Uncover helmets and cash out early.",
      tag: "STRATEGY",
      color: "from-blue-500/20 to-black/40 border-blue-500/30",
      multiplier: "customizable",
    },
    {
      id: "shootout",
      name: "Penalty Shootout",
      rtp: "97.5%",
      desc: "Interactive spot kick simulation. Beat the keeper for massive 40x multipliers!",
      tag: "SKILL-BASED",
      color: "from-purple-500/20 to-black/40 border-purple-500/30",
      multiplier: "up to 40.0x",
    },
    {
      id: "slots",
      name: "Football Slots",
      rtp: "96.5%",
      desc: "Spin classic football reels with high-paying Cups (100x) and Golden Boots (50x).",
      tag: "CASUAL",
      color: "from-amber-600/20 to-black/40 border-amber-500/30",
      multiplier: "up to 100.0x",
    },
    {
      id: "plinko",
      name: "Golden Boot Plinko",
      rtp: "98.1%",
      desc: "Drop a golden chip through pegs into boosted high multiplier bins.",
      tag: "BEST RTP",
      color: "from-pink-500/20 to-black/40 border-pink-500/30",
      multiplier: "up to 15.0x",
    },
    {
      id: "dice",
      name: "Over / Under Dice",
      rtp: "97.8%",
      desc: "Roll high-fidelity duel dice. Adjust targets for boosted payouts.",
      tag: "SWIFT REELS",
      color: "from-sky-500/20 to-black/40 border-sky-500/30",
      multiplier: "up to 6.5x",
    },
  ];

  const currentGame = gamesList.find((g) => g.id === activeGame);

  return (
    <div
      className="flex-1 min-h-0 overflow-y-auto bg-[#05070a] text-slate-100 flex flex-col no-scrollbar"
      id="sportsim-elite-casino-suite"
    >
      {/* Visual Header Banner - only show on lobby */}
      {!activeGame && (
        <div className="relative shrink-0 border-b border-white/5 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#101725] via-[#05070a] to-[#05070a] px-4 md:px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Gamepad2 className="text-emerald-400 animate-pulse" size={18} />
              <span className="text-[10px] text-emerald-400 font-mono tracking-widest block uppercase font-black">
                SPORTSIM ELITE LOUNGE
              </span>
            </div>
            <h2 className="text-sm font-black text-slate-100 font-sans uppercase tracking-wider mt-1 flex items-center gap-1.5">
              SportSim Elite Casino Suite
              <span className="bg-emerald-500/20 text-emerald-400 text-[8px] font-mono px-1.5 py-0.5 rounded-full select-none tracking-normal font-black animate-pulse">
                LIVE MULTIPLIERS
              </span>
            </h2>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate max-w-md">
              Wager with your manager budget balance. Wins reflect instantly.
            </p>
          </div>

          {/* Lounge balance display */}
          <div className="flex gap-2.5 items-center bg-black/40 border border-white/10 rounded-2xl px-3.5 py-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></div>
            <Coins className="text-amber-400" size={16} />
            <div className="font-mono">
              <span className="text-[9px] text-slate-400 block uppercase leading-none font-bold">
                LOBBY BAL
              </span>
              <span className="text-xs font-black text-emerald-400 mt-1 block">
                $
                {balance.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Low balance warning — shown on lobby only */}
      {!activeGame && balance < 50 && !hasClaimedEmergency && (
        <div className="mx-4 md:mx-6 mt-4 bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 select-none">
          <div className="flex items-center gap-3">
            <ShieldAlert className="text-red-400 animate-bounce" size={20} />
            <div className="text-left">
              <span className="text-[11px] font-mono font-black text-red-400 uppercase">
                LOW BALANCE ALERT
              </span>
              <p className="text-[10px] text-slate-300">
                Your wallet balance is ${balance.toFixed(2)}. Claim $500 free
                trial credits!
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              onUpdateBalance((prev) => prev + 500);
              setHasClaimedEmergency(true);
              addLog(
                "Emergency Grant",
                500,
                1,
                "WIN",
                "Claimed $500 casino emergency fund",
              );
            }}
            className="bg-emerald-500 hover:bg-emerald-400 text-[#05070a] font-extrabold font-sans text-[10px] px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-lg active:scale-95 uppercase tracking-wide shrink-0"
          >
            Claim $500 Emergency Cash 💸
          </button>
        </div>
      )}

      <div
        className={`flex-1 grid gap-5 p-4 md:p-5 min-h-0 ${activeGame && isFullView ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-12"}`}
      >
        {/* Left column: lobby/logs — hidden in full-view game mode */}
        {!(activeGame && isFullView) && (
          <div
            className={`${activeGame ? "hidden lg:flex lg:col-span-4" : "lg:col-span-4"} flex flex-col gap-4 min-h-0`}
          >
            <div className="bg-[#0b0e14] border border-white/5 rounded-2xl p-4 flex flex-col justify-between shrink-0 select-none">
              <div>
                <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase block">
                  VIP MEMBERS CLUB
                </span>
                <h3 className="text-xs font-bold text-slate-100 font-sans mt-0.5">
                  Hi, Manager {username}!
                </h3>
                <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                  Wager between kickoff matches. All bets are logged to the live
                  regional leaderboard profile automatically.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-white/5 text-[10px] font-mono text-slate-400">
                <div>
                  <span className="text-slate-500 block">TOTAL LOGS</span>
                  <span className="font-bold text-slate-100">
                    {logs.length} games
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">MAX WIN MULTI</span>
                  <span className="font-bold text-emerald-400">100.0x</span>
                </div>
              </div>
            </div>

            {/* Rolling log history */}
            <div className="flex-1 bg-[#0b0e14] border border-white/5 rounded-2xl p-4 flex flex-col min-h-0">
              <div className="flex items-center justify-between border-b border-white/5 pb-2.5 select-none shrink-0">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <History size={11} className="text-emerald-400" />
                  Live Rolling Spins (Last 10)
                </span>
                <span className="text-[9px] text-slate-500 font-mono">
                  SYS-ONLINE
                </span>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 mt-3 max-h-[280px] lg:max-h-none">
                {logs.length === 0 ? (
                  <div className="text-center text-slate-500 text-[11px] py-12">
                    No spins logged yet.
                  </div>
                ) : (
                  logs.map((log) => {
                    const isWin = log.status === "WIN";
                    const isJoker = log.status === "JOKER";
                    const isFreeze = log.status === "FREEZE";

                    const safeAmount = log.amount ?? 0;
                    const safeMultiplier = log.multiplier ?? 0;

                    return (
                      <div
                        key={log.id}
                        className="bg-black/25 border border-white/5 rounded-xl p-2.5 flex items-center justify-between text-xs hover:bg-slate-900/40 transition-all"
                      >
                        <div className="space-y-0.5 max-w-[60%]">
                          <div className="font-bold text-slate-200 truncate">
                            {log.game}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono truncate">
                            {log.details}
                          </div>
                        </div>
                        <div className="text-right font-mono text-xs">
                          <span
                            className={`font-black ${isWin ? "text-emerald-400" : isJoker ? "text-amber-500" : isFreeze ? "text-blue-400" : "text-red-400"}`}
                          >
                            {isWin
                              ? `+$${(safeAmount * safeMultiplier).toFixed(2)}`
                              : isJoker
                                ? "WIPED"
                                : isFreeze
                                  ? "FROZEN"
                                  : `-$${safeAmount.toFixed(0)}`}
                          </span>
                          <div className="text-[9px] text-slate-500 uppercase mt-0.5">
                            {isWin
                              ? `${safeMultiplier.toFixed(1)}x`
                              : isJoker
                                ? "JOKER"
                                : isFreeze
                                  ? "FREEZE"
                                  : "LOST"}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* Right column / Workspace */}
        <div
          className={`${activeGame && isFullView ? "col-span-1" : "lg:col-span-8"} flex flex-col min-h-0`}
        >
          {activeGame ? (
            <div className="flex-1 bg-[#0b0e14] border border-white/5 rounded-2xl flex flex-col min-h-0 relative select-none z-10 shadow-2xl overflow-hidden">
              {/* Active game header */}
              <div className="flex items-center justify-between border-b border-white/5 px-4 py-3 shrink-0">
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setActiveGame(null);
                      setIsFullView(false);
                    }}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-all bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-lg border border-white/5 active:scale-95 cursor-pointer"
                  >
                    <ArrowLeft size={13} />
                    <span>Lounge</span>
                  </button>
                  <button
                    onClick={() => setIsFullView(!isFullView)}
                    className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-all bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1.5 rounded-lg border border-emerald-500/20 active:scale-95 cursor-pointer font-bold"
                  >
                    {isFullView ? (
                      <Minimize2 size={12} />
                    ) : (
                      <Maximize2 size={12} />
                    )}
                    <span>{isFullView ? "Split View" : "Full Screen"}</span>
                  </button>
                </div>
                {/* In-game balance display */}
                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <span className="text-[9px] font-mono text-slate-400 block uppercase font-bold">
                      ACTIVE GAME
                    </span>
                    <span className="text-xs font-black text-slate-200 tracking-wide font-sans">
                      {currentGame?.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-black/50 border border-white/10 rounded-xl px-2.5 py-1.5">
                    <Coins className="text-amber-400" size={13} />
                    <div>
                      <span className="text-[8px] text-slate-500 block uppercase font-mono leading-none">
                        BALANCE
                      </span>
                      <span
                        className={`text-xs font-black font-mono block mt-0.5 ${balance <= 0 ? "text-red-400" : "text-emerald-400"}`}
                      >
                        $
                        {balance.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Low balance warning in game too */}
              {balance < 10 && !hasClaimedEmergency && (
                <div className="mx-4 mt-3 bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2 flex items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <ShieldAlert size={14} className="text-red-400 shrink-0" />
                    <span className="text-[10px] text-red-300 font-mono">
                      Low balance! Claim emergency cash to keep playing.
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      onUpdateBalance((prev) => prev + 500);
                      setHasClaimedEmergency(true);
                      addLog(
                        "Emergency Grant",
                        500,
                        1,
                        "WIN",
                        "Claimed $500 emergency fund",
                      );
                    }}
                    className="bg-emerald-500 text-[#05070a] text-[9px] font-extrabold px-2.5 py-1 rounded-lg cursor-pointer active:scale-95 transition-all whitespace-nowrap uppercase shrink-0"
                  >
                    Claim $500
                  </button>
                </div>
              )}

              {/* Inside WorkSpace active renderer - Keying by game and claim state forces cleanup of stale states */}
              <div
                className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-4"
                key={activeGame + "_" + hasClaimedEmergency}
              >
                {activeGame === "redblack" && (
                  <RedOrBlackGame
                    balance={balance}
                    onUpdateBalance={onUpdateBalance}
                    addLog={addLog}
                  />
                )}
                {activeGame === "bottle" && (
                  <SpinTheBottleGame
                    balance={balance}
                    onUpdateBalance={onUpdateBalance}
                    addLog={addLog}
                  />
                )}
                {activeGame === "crash" && (
                  <PaddockRushGame
                    balance={balance}
                    onUpdateBalance={onUpdateBalance}
                    addLog={addLog}
                  />
                )}
                {activeGame === "mines" && (
                  <SportyMinesGame
                    balance={balance}
                    onUpdateBalance={onUpdateBalance}
                    addLog={addLog}
                  />
                )}
                {activeGame === "shootout" && (
                  <PenaltyShootoutGame
                    balance={balance}
                    onUpdateBalance={onUpdateBalance}
                    addLog={addLog}
                  />
                )}
                {activeGame === "slots" && (
                  <FootballSlotsGame
                    balance={balance}
                    onUpdateBalance={onUpdateBalance}
                    addLog={addLog}
                  />
                )}
                {activeGame === "plinko" && (
                  <PlinkoGame
                    balance={balance}
                    onUpdateBalance={onUpdateBalance}
                    addLog={addLog}
                  />
                )}
                {activeGame === "dice" && (
                  <OverUnderDiceGame
                    balance={balance}
                    onUpdateBalance={onUpdateBalance}
                    addLog={addLog}
                  />
                )}
              </div>
            </div>
          ) : (
            // Lobby game grid
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="flex items-center justify-between pb-2 select-none">
                <h3 className="text-xs font-bold text-slate-400 font-sans tracking-wide uppercase">
                  LAUNCH VVIP GLASS CARDS ({gamesList.length} GAME TERMINALS)
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto pr-1 no-scrollbar pb-6 flex-1">
                {gamesList.map((g) => (
                  <div
                    key={g.id}
                    onClick={() => setActiveGame(g.id)}
                    className={`p-4 rounded-2xl bg-gradient-to-br ${g.color} flex flex-col justify-between text-left hover:scale-[1.015] active:scale-[0.99] transition-all cursor-pointer backdrop-blur-sm group select-none relative overflow-hidden border`}
                  >
                    {/* RTP badge top right */}
                    <div className="absolute top-0 right-0 h-10 w-10 bg-white/3 rounded-bl-3xl flex items-center justify-center border-l border-b border-white/5 text-[9px] font-mono text-emerald-400 font-extrabold select-none">
                      {g.rtp}
                    </div>

                    <div className="space-y-2">
                      <span className="bg-white/5 border border-white/10 text-[8px] text-amber-400 font-mono font-black px-2 py-0.5 rounded-full select-none tracking-wider uppercase">
                        {g.tag}
                      </span>
                      <div>
                        <h4 className="text-sm font-black text-slate-200 group-hover:text-emerald-400 transition-colors uppercase tracking-tight">
                          {g.name}
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-1 leading-normal max-w-[85%]">
                          {g.desc}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5 text-[10px] font-mono text-slate-400">
                      <span>
                        Max Multi:{" "}
                        <b className="text-emerald-400">{g.multiplier}</b>
                      </span>
                      <span className="flex items-center gap-1 text-emerald-400 group-hover:text-white font-extrabold transition-all">
                        LAUNCH TERMINAL
                        <Play size={10} className="fill-current" />
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
