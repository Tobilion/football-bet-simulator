import React, { useState, useEffect, useRef } from "react";
import { 
  Gamepad2, Coins, ArrowLeft, Trophy, Play, Info, Sparkles, Flame, ShieldAlert, 
  HelpCircle, Zap, RefreshCw, Dice5, Target, Layers, Radio, TrendingUp, History
} from "lucide-react";

interface CasinoSuiteProps {
  balance: number;
  onUpdateBalance: (newBalance: number) => void;
  username: string;
}

// Global rolling log model
interface RollingLog {
  id: string;
  game: string;
  timestamp: number;
  amount: number;
  multiplier: number;
  status: "WIN" | "LOSS" | "JOKER" | "FREEZE";
  details: string;
}

export const CasinoSuite: React.FC<CasinoSuiteProps> = ({ balance, onUpdateBalance, username }) => {
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const [isFullView, setIsFullView] = useState<boolean>(true);
  const [logs, setLogs] = useState<RollingLog[]>(() => {
    const saved = localStorage.getItem("fs_casino_logs_v4");
    if (saved) return JSON.parse(saved);
    return [
      { id: "1", game: "Penalty Shootout", timestamp: Date.now() - 300000, amount: 100, multiplier: 2.4, status: "WIN", details: "Scored Top-Left Volley" },
      { id: "2", game: "SportyMines", timestamp: Date.now() - 250000, amount: 50, multiplier: 1.8, status: "WIN", details: "Cleared 4 Helmets" },
      { id: "3", game: "Football Slots", timestamp: Date.now() - 200000, amount: 200, multiplier: 0, status: "LOSS", details: "No matching lines" },
      { id: "4", game: "Red or Black", timestamp: Date.now() - 150000, amount: 100, multiplier: 0, status: "JOKER", details: "Wiped by Joker Card" }
    ];
  });

  const saveLogs = (newLogs: RollingLog[]) => {
    setLogs(newLogs);
    localStorage.setItem("fs_casino_logs_v4", JSON.stringify(newLogs));
  };

  const addLog = (game: string, amount: number, multiplier: number, status: "WIN" | "LOSS" | "JOKER" | "FREEZE", details: string) => {
    const freshLog: RollingLog = {
      id: "log_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      game,
      timestamp: Date.now(),
      amount,
      multiplier,
      status,
      details
    };
    saveLogs([freshLog, ...logs].slice(0, 10));
  };

  const gamesList = [
    { id: "redblack", name: "Red or Black Streak", rtp: "96.4%", desc: "Double or nothing 4-round streak game. Beware of the trick Joker!", tag: "HOT STREAK", color: "from-red-500/20 to-black/40 border-red-500/30", multiplier: "up to 16.0x" },
    { id: "bottle", name: "Spin the Bottle", rtp: "97.0%", desc: "Bet Up or Down with the rotating champagne bottle. 3% center-freeze risk.", tag: "CLASSIC", color: "from-yellow-500/10 to-black/40 border-yellow-500/30", multiplier: "2.0x" },
    { id: "crash", name: "Paddock Rush", rtp: "96.8%", desc: "Predict how far the football mascot runs before tripping. Multiplier climbs exponentially!", tag: "HIGH VOLATILITY", color: "from-emerald-500/20 to-black/40 border-emerald-500/30", multiplier: "uncapped" },
    { id: "mines", name: "SportyMines", rtp: "97.2%", desc: "Configure custom mines on a 6x6 pitch. Uncover helmets and cash out early.", tag: "STRATEGY", color: "from-blue-500/20 to-black/40 border-blue-500/30", multiplier: "customizable" },
    { id: "shootout", name: "Penalty Shootout", rtp: "96.5%", desc: "Interactive spot kick simulation. Beat the diving keeper for high multipliers.", tag: "SKILL-BASED", color: "from-purple-500/20 to-black/40 border-purple-500/30", multiplier: "up to 8.0x" },
    { id: "slots", name: "Football Slots", rtp: "95.8%", desc: "Spin classic football reels with high-paying scatter Cups and Golden Boots.", tag: "CASUAL", color: "from-amber-600/20 to-black/40 border-amber-500/30", multiplier: "up to 50.0x" },
    { id: "plinko", name: "Golden Boot Plinko", rtp: "98.1%", desc: "Drop a golden chip through the pegs into high multiplier bins.", tag: "BEST RTP", color: "from-pink-500/20 to-black/40 border-pink-500/30", multiplier: "up to 15.0x" },
    { id: "dice", name: "Over / Under Dice", rtp: "97.5%", desc: "Roll high-fidelity duel dice. Adjust targets and enjoy immediate rollbacks.", tag: "SWIFT REELS", color: "from-sky-500/20 to-black/40 border-sky-500/30", multiplier: "up to 5.8x" }
  ];

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-[#05070a] text-slate-100 flex flex-col no-scrollbar max-h-none" id="sportsim-elite-casino-suite">
      {/* Visual Header Banner */}
      <div className="relative shrink-0 border-b border-white/5 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#101725] via-[#05070a] to-[#05070a] px-4 md:px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Gamepad2 className="text-emerald-400 animate-pulse" size={18} />
            <span className="text-[10px] text-emerald-400 font-mono tracking-widest block uppercase font-black">
              SPORTSIM ELITE LOUNGE
            </span>
          </div>
          <h2 className="text-sm font-black text-slate-150 font-sans uppercase tracking-wider mt-1 flex items-center gap-1.5">
            SportSim Elite Casino Suite
            <span className="bg-emerald-500/20 text-emerald-400 text-[8px] font-mono px-1.5 py-0.5 rounded-full select-none tracking-normal font-black animate-pulse">
              LIVE MULTIPLIERS
            </span>
          </h2>
          <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate max-w-md">
            Wager with your manager budget balance. Wins reflect instantly to cache.
          </p>
        </div>

        {/* Lounge context balance display */}
        <div className="flex gap-2.5 items-center bg-black/40 border border-white/10 rounded-2xl px-3.5 py-2">
          <div className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></div>
          <Coins className="text-amber-400" size={16} />
          <div className="font-mono">
            <span className="text-[9px] text-slate-450 block uppercase leading-none font-bold">LOBBY BAL</span>
            <span className="text-xs font-black text-emerald-400 mt-1 block">
              ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {balance < 50 && (
        <div className="mx-4 md:mx-6 mt-4 bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 select-none animate-pulse">
          <div className="flex items-center gap-3">
            <ShieldAlert className="text-red-400 animate-bounce" size={20} />
            <div className="text-left">
              <span className="text-[11px] font-mono font-black text-red-400 uppercase">LOW CONTROLLER BALANCES</span>
              <p className="text-[10px] text-slate-300">Your current casino manager wallet balance resides at ${balance.toFixed(2)}. Claim $500 free trial credits!</p>
            </div>
          </div>
          <button
            onClick={() => {
              onUpdateBalance(balance + 500);
              addLog("Emergency Grant", 0, 0, "WIN", "Claimed $500 casino emergency fund");
            }}
            className="bg-emerald-500 hover:bg-emerald-450 text-[#05070a] font-extrabold font-sans text-[10px] px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-lg active:scale-95 uppercase tracking-wide shrink-0"
          >
            Claim $500 Emergency Cash 💸
          </button>
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 p-4 md:p-6 min-h-0">
        {/* Left column: Bento launchers list or Back button context */}
        <div className={`lg:col-span-4 flex flex-col gap-4 min-h-0 ${activeGame && isFullView ? "hidden" : "flex"} ${activeGame && !isFullView ? "hidden lg:flex" : ""}`}>
          <div className="bg-[#0b0e14] border border-white/5 rounded-2xl p-4 flex flex-col justify-between shrink-0 select-none">
            <div>
              <span className="text-[10px] font-mono font-bold tracking-widest text-slate-450 uppercase block">
                VIP MEMBERS CLUB
              </span>
              <h3 className="text-xs font-bold text-slate-100 font-sans mt-0.5">
                Hi, Manager {username}!
              </h3>
              <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                Take a spin between kickoff matches. Live betting records persist to the regional leaderboards profile automatically. Guaranteed original rates.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-white/5 text-[10px] font-mono text-slate-400">
              <div>
                <span className="text-slate-500 block">TOTAL LOGS</span>
                <span className="font-bold text-slate-100">{logs.length} games</span>
              </div>
              <div>
                <span className="text-slate-500 block">MAX WIN MULTI</span>
                <span className="font-bold text-emerald-350">50.0x</span>
              </div>
            </div>
          </div>

          {/* Rolling log history of last spin events */}
          <div className="flex-1 bg-[#0b0e14] border border-white/5 rounded-2xl p-4 flex flex-col min-h-0">
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5 select-none shrink-0">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <History size={11} className="text-emerald-450" />
                Live Rolling spins (Last 10)
              </span>
              <span className="text-[9px] text-slate-550 font-mono">SYS-ONLINE</span>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 mt-3 max-h-[280px] lg:max-h-none">
              {logs.length === 0 ? (
                <div className="text-center text-slate-500 text-[11px] py-12">
                  No spins logged in this session yet.
                </div>
              ) : (
                logs.map(log => {
                  const isWin = log.status === "WIN";
                  const isJoker = log.status === "JOKER";
                  const isFreeze = log.status === "FREEZE";
                  return (
                    <div key={log.id} className="bg-black/25 border border-white/5 rounded-xl p-2.5 flex items-center justify-between text-xs transition-all hover:bg-slate-900/40">
                      <div className="space-y-0.5 max-w-[60%]">
                        <div className="font-bold text-slate-200 truncate">{log.game}</div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">{log.details}</div>
                      </div>
                      <div className="text-right font-mono text-xs">
                        <span className={`font-black ${
                          isWin ? "text-emerald-400" : isJoker ? "text-amber-500 font-extrabold" : isFreeze ? "text-blue-400 font-extrabold" : "text-red-400"
                        }`}>
                          {isWin ? `+$${(log.amount * log.multiplier).toFixed(2)}` : isJoker ? "WIPED" : isFreeze ? "FROZEN" : `-$${log.amount.toFixed(0)}`}
                        </span>
                        <div className="text-[9px] text-slate-500 uppercase mt-0.5">
                          {isWin ? `${log.multiplier.toFixed(1)}x` : isJoker ? "JOKER" : isFreeze ? "FREEZE" : "LOST"}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right column / Workspace */}
        <div className={`${activeGame && isFullView ? "lg:col-span-12" : "lg:col-span-8"} flex flex-col min-h-0`}>
          {activeGame ? (
            <div className="flex-1 bg-[#0b0e14] border border-white/5 rounded-2xl p-4 md:p-6 flex flex-col min-h-0 relative select-none z-10 shadow-2xl">
              {/* Active game header context */}
              <div className="flex items-center justify-between border-b border-white/5 pb-3.5 mb-4 shrink-0">
                <div className="flex gap-2.5">
                  <button
                    onClick={() => setActiveGame(null)}
                    className="flex items-center gap-1.5 text-xs text-slate-450 hover:text-white transition-all bg-white/2 hover:bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5 active:scale-95 cursor-pointer"
                  >
                    <ArrowLeft size={13} />
                    <span>Lounge</span>
                  </button>
                  <button
                    onClick={() => setIsFullView(!isFullView)}
                    className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-all bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1.5 rounded-lg border border-emerald-500/20 active:scale-95 cursor-pointer font-bold"
                  >
                    <span>{isFullView ? "🖥️ Split View" : "🖥️ Full Screen View"}</span>
                  </button>
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-mono text-slate-450 block uppercase font-bold">ACTIVE GAME</span>
                  <span className="text-xs font-black text-slate-200 tracking-wide font-sans">{gamesList.find(g => g.id === activeGame)?.name}</span>
                </div>
              </div>

              {/* Inside WorkSpace active renderer */}
              <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
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
            // Grid selector dashboard
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="flex items-center justify-between pb-2 select-none">
                <h3 className="text-xs font-bold text-slate-400 font-sans tracking-wide uppercase">
                  LAUNCH VVIP GLASS CARDS ({gamesList.length} GAME TERMINALS)
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto pr-1 no-scrollbar pb-6 flex-1">
                {gamesList.map(g => (
                  <div
                    key={g.id}
                    onClick={() => setActiveGame(g.id)}
                    className={`p-4 rounded-2xl bg-gradient-to-br ${g.color} flex flex-col justify-between text-left hover:scale-[1.015] active:scale-[0.99] transition-all cursor-pointer backdrop-blur-sm group select-none relative overflow-hidden`}
                  >
                    {/* Tiny neon highlight element top right */}
                    <div className="absolute top-0 right-0 h-10 w-10 bg-white/3 rounded-bl-3xl flex items-center justify-center border-l border-b border-white/5 text-[9px] font-mono text-emerald-400 font-extrabold select-none">
                      {g.rtp}
                    </div>

                    <div className="space-y-2">
                      <span className="bg-white/5 border border-white/10 text-[8px] text-amber-400 font-mono font-black px-2 py-0.5 rounded-full select-none tracking-wider uppercase">
                        {g.tag}
                      </span>
                      <div>
                        <h4 className="text-sm font-black text-slate-200 group-hover:text-emerald-450 transition-colors uppercase tracking-tight">
                          {g.name}
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-1 leading-normal max-w-[85%]">
                          {g.desc}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/3 text-[10px] font-mono text-slate-400">
                      <span>Max Multiplier: <b className="text-emerald-450">{g.multiplier}</b></span>
                      <span className="flex items-center gap-1 text-emerald-405 group-hover:text-white font-extrabold transition-all">
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


// 🎰 GAME 1: RED OR BLACK STREAK
interface GameProps {
  balance: number;
  onUpdateBalance: (newBalance: number) => void;
  addLog: (game: string, amount: number, multiplier: number, status: "WIN" | "LOSS" | "JOKER" | "FREEZE", details: string) => void;
}

const RedOrBlackGame: React.FC<GameProps> = ({ balance, onUpdateBalance, addLog }) => {
  const [stake, setStake] = useState<number>(50);
  const [round, setRound] = useState<number>(0); // 0 means not playing/ready
  const [history, setHistory] = useState<("RED" | "BLACK" | "JOKER")[]>([]);
  const [currentPool, setCurrentPool] = useState<number>(0);
  const [spinning, setSpinning] = useState<boolean>(false);
  const [lastDraw, setLastDraw] = useState<"RED" | "BLACK" | "JOKER" | null>(null);
  const [message, setMessage] = useState<string>("Choose Red or Black to begin a 4-round streak! Beware of the tiny 2% Joker card.");

  const startStreak = (choice: "RED" | "BLACK") => {
    const actualWager = Math.min(stake, balance);
    if (actualWager <= 0) {
      setMessage("❌ Zero or negative balance. Claim the free emergency lounge cash voucher above!");
      return;
    }
    const nextBal = balance - actualWager;
    onUpdateBalance(nextBal);
    
    setRound(1);
    setCurrentPool(actualWager);
    setHistory([]);
    setLastDraw(null);
    drawRound(choice, actualWager);
  };

  const drawRound = (choice: "RED" | "BLACK", currentStakeVal: number) => {
    setSpinning(true);
    setMessage("Shuffling casino decks...");
    
    setTimeout(() => {
      setSpinning(false);
      // Increased odds: only 2% Joker, 49% Red, 49% Black
      const rand = Math.random() * 100;
      let draw: "RED" | "BLACK" | "JOKER";
      if (rand < 2.0) {
        draw = "JOKER";
      } else if (rand < 51.0) {
        draw = "RED";
      } else {
        draw = "BLACK";
      }
      
      setLastDraw(draw);
      setHistory(prev => [...prev, draw]);

      if (draw === "JOKER") {
        setMessage("🤡 Oh no! The trick JOKER card has appeared and wiped out the entire pool!");
        addLog("Red or Black", currentStakeVal, 0, "JOKER", "Wiped by Joker on round " + (round || 1));
        setRound(0);
        setCurrentPool(0);
      } else if (draw === choice) {
        // Boosted multiplier step from 2.0x to 2.2x!
        const winAmount = currentPool * 2.2;
        setCurrentPool(winAmount);
        
        if (round >= 4) {
          setMessage(`🏆 MASTER STREAK! 4 rounds cleared! You automatically win $${winAmount.toFixed(2)} (${(winAmount/stake).toFixed(1)}x)!`);
          onUpdateBalance(balance - stake + winAmount);
          addLog("Red or Black", stake, winAmount / stake, "WIN", "Mastered 4 rounds streak!");
          setRound(0);
          setCurrentPool(0);
        } else {
          setMessage(`🎯 SUCCESS! Round ${round} hit! Pool is now $${winAmount.toFixed(2)}. Continue round ${round + 1} or Cash Out now!`);
          setRound(prev => prev + 1);
        }
      } else {
        setMessage(`💔 Missed. Drawn card was ${draw} but you guessed ${choice}. Bet lost.`);
        addLog("Red or Black", currentStakeVal, 0, "LOSS", `Lost on round ${round || 1} (drew ${draw})`);
        setRound(0);
        setCurrentPool(0);
      }
    }, 1205);
  };

  const selectColor = (choice: "RED" | "BLACK") => {
    if (spinning) return;
    if (round === 0) {
      startStreak(choice);
    } else {
      drawRound(choice, currentPool);
    }
  };

  const handleCashout = () => {
    if (round <= 1 || currentPool <= 0 || spinning) return;
    const finalRefValue = currentPool;
    onUpdateBalance(balance + finalRefValue);
    setMessage(`💰 Safe recovery! Cashed out $${finalRefValue.toFixed(2)} after round ${round - 1} (${(finalRefValue/stake).toFixed(1)}x)!`);
    addLog("Red or Black", stake, finalRefValue / stake, "WIN", `Safe Cashout after Round ${round - 1}`);
    setRound(0);
    setCurrentPool(0);
  };

  return (
    <div className="space-y-4">
      <div className="bg-black/40 border border-white/5 rounded-xl p-4 text-center">
        <span className="text-[9px] font-mono text-emerald-450 uppercase font-black">ROUND STREAK STATUS (BOOSTED ODDS!)</span>
        <div className="flex justify-center items-center gap-3 my-4">
          {[1, 2, 3, 4].map(r => {
            const isCleared = round > r;
            const isCurrent = round === r;
            return (
              <div 
                key={r} 
                className={`h-11 w-11 rounded-xl flex flex-col items-center justify-center border font-mono transition-all ${
                  isCleared 
                    ? "bg-emerald-500/20 border-emerald-500 text-emerald-450" 
                    : isCurrent 
                    ? "bg-amber-500/20 border-amber-500 text-amber-500 animate-pulse font-bold" 
                    : "bg-white/2 border-white/5 text-slate-500"
                }`}
              >
                <span className="text-[10px]">R{r}</span>
                <span className="text-[8px] font-extrabold">{r === 1 ? "2.2x" : r === 2 ? "4.8x" : r === 3 ? "10.6x" : "23.4x"}</span>
              </div>
            );
          })}
        </div>

        {/* Drawn card layout */}
        <div className="min-h-24 flex items-center justify-center border border-white/5 rounded-xl bg-black/60 relative p-4">
          {spinning ? (
            <div className="flex flex-col items-center justify-center gap-2">
              <RefreshCw className="animate-spin text-amber-400" size={24} />
              <span className="text-xs text-slate-400 font-mono uppercase">Shuffling decks...</span>
            </div>
          ) : lastDraw ? (
            <div className="flex flex-col items-center">
              <div className={`h-25 w-16 rounded-xl flex flex-col items-center justify-center font-bold text-lg shadow-lg border relative ${
                lastDraw === "RED" 
                  ? "bg-red-650 border-red-500/40 text-white" 
                  : lastDraw === "BLACK" 
                  ? "bg-slate-900 border-white/10 text-white" 
                  : "bg-amber-600 border-amber-500 text-black font-serif"
              }`}>
                {lastDraw === "RED" ? "♦️ R" : lastDraw === "BLACK" ? "♣️ B" : "🤡 J"}
              </div>
              <span className="text-[10px] text-slate-400 font-mono mt-1.5 uppercase font-bold">Drawn Card: {lastDraw}</span>
            </div>
          ) : (
            <span className="text-slate-500 text-xs font-mono uppercase">Place your guest prediction to draw</span>
          )}
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-slate-350 text-center bg-white/2 p-2 rounded-xl border border-white/5">
        {message}
      </p>

      {/* Inputs controls */}
      {round === 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs select-none">
            <span className="text-slate-400 font-medium font-sans">STREAK ENTRY STAKE</span>
            <span className="font-mono text-emerald-400 font-black">${stake}</span>
          </div>
          <input 
            type="range"
            min={Math.max(1, Math.min(10, Math.floor(balance)))} 
            max={Math.max(10, Math.min(1000, Math.floor(balance)))} 
            step={Math.max(1, Math.min(10, Math.floor(balance / 50) || 5))}
            value={Math.max(1, Math.min(stake, balance || 10))}
            onChange={(e) => setStake(Number(e.target.value))}
            className="w-full accent-emerald-500 cursor-pointer h-1.5"
          />
        </div>
      ) : (
        <div className="bg-black/30 border border-white/5 rounded-xl p-3 flex items-center justify-between text-xs font-mono">
          <span>Active Streak: <b className="text-emerald-400">Round {round}</b></span>
          <span>Rolling Pool: <b className="text-emerald-400">${currentPool.toFixed(2)}</b></span>
        </div>
      )}

      {/* CTAs */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={() => selectColor("RED")}
          disabled={spinning}
          className="bg-red-650 hover:bg-red-500 text-white font-sans font-bold text-xs py-3 rounded-2xl transition-all border border-red-500/20 active:scale-95 disabled:opacity-50 cursor-pointer text-center uppercase"
        >
          ♦️ BET RED
        </button>
        <button
          onClick={() => selectColor("BLACK")}
          disabled={spinning}
          className="bg-slate-900 hover:bg-slate-800 text-white font-sans font-bold text-xs py-3 rounded-2xl transition-all border border-white/10 active:scale-95 disabled:opacity-50 cursor-pointer text-center uppercase"
        >
          ♣️ BET BLACK
        </button>
      </div>

      {round > 1 && (
        <button
          onClick={handleCashout}
          disabled={spinning}
          className="w-full bg-emerald-500 hover:bg-emerald-450 text-slate-950 font-sans font-black text-xs py-3.5 rounded-2xl transition-all shadow-lg active:scale-95 disabled:opacity-50 cursor-pointer uppercase tracking-wider block text-center"
        >
          💰 CASHOUT POOL (${currentPool.toFixed(2)})
        </button>
      )}
    </div>
  );
};


// 🍾 GAME 2: SPIN THE BOTTLE
const SpinTheBottleGame: React.FC<GameProps> = ({ balance, onUpdateBalance, addLog }) => {
  const [stake, setStake] = useState<number>(50);
  const [betSide, setBetSide] = useState<"UP" | "DOWN">("UP");
  const [spinning, setSpinning] = useState<boolean>(false);
  const [rotationDegrees, setRotationDegrees] = useState<number>(0);
  const [result, setResult] = useState<"UP" | "DOWN" | "FREEZE" | null>(null);
  const [commentary, setCommentary] = useState<string>("Tap Spin to rotate the championship premium bottle. Center freeze carries a 3% house advantage.");

  const handleSpin = () => {
    if (spinning) return;
    if (balance < stake) {
      setCommentary("❌ Insufficient lobby balance.");
      return;
    }
    onUpdateBalance(balance - stake);
    setSpinning(true);
    setResult(null);
    setCommentary("Champagne cork is loose... Spinning the bottle at hyper-speed!");

    // Rotate at least 5 complete loops plus some random offset
    const cycles = 5 + Math.random() * 5;
    const finalRot = cycles * 360;
    setRotationDegrees(finalRot);

    setTimeout(() => {
      setSpinning(false);
      
      const rand = Math.random() * 100;
      let finalRes: "UP" | "DOWN" | "FREEZE";
      let offsetDeg = 0;

      if (rand < 3.0) {
        finalRes = "FREEZE";
        // Freeze stops horizontally near center line (90 or 270 degrees)
        offsetDeg = Math.random() < 0.5 ? 90 : 270;
      } else if (rand < 51.5) {
        finalRes = "UP";
        // UP stands in top zone (between 315 and 45 degrees, ie -45 to 45)
        offsetDeg = (Math.random() * 80) - 40;
      } else {
        finalRes = "DOWN";
        // DOWN stands in bottom zone (ie 135 to 225)
        offsetDeg = 180 + (Math.random() * 80 - 40);
      }

      setRotationDegrees(finalRot + offsetDeg);
      setResult(finalRes);

      if (finalRes === "FREEZE") {
        setCommentary("❄️ UNFORTUNATE! The bottle froze perfectly on the center line! Standard freeze, bet is nullified!");
        addLog("Spin the Bottle", stake, 0, "FREEZE", "Center Freeze occurred");
      } else if (finalRes === betSide) {
        const payout = stake * 2;
        onUpdateBalance(balance - stake + payout);
        setCommentary(`🎉 EXCELLENT! Bottle nozzle points ${finalRes}! You successfully unlocked double payout of $${payout.toFixed(2)} (2.0x)!`);
        addLog("Spin the Bottle", stake, 2.0, "WIN", `Nozzle pointed ${finalRes}`);
      } else {
        setCommentary(`💔 MISSED! Nozzle points ${finalRes}, but you backed ${betSide}. Better luck on the next turn!`);
        addLog("Spin the Bottle", stake, 0, "LOSS", `Nozzle pointed ${finalRes}`);
      }
    }, 1800);
  };

  return (
    <div className="space-y-4">
      {/* Visual Canvas bottle rendering */}
      <div className="bg-[#070b11] border border-white/5 rounded-2xl p-6 flex flex-col items-center justify-center relative overflow-hidden h-64 select-none">
        {/* Subtle sectors */}
        <div className="absolute inset-x-0 top-0 h-1/2 bg-emerald-500/5 border-b border-white/5 flex items-start justify-center pt-2">
          <span className="text-[9px] font-mono font-bold tracking-widest text-[#10b981]/60">UPPER GREEN ZONE</span>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-blue-500/5 flex items-end justify-center pb-2">
          <span className="text-[9px] font-mono font-bold tracking-widest text-[#3b82f6]/60">LOWER BLUE ZONE</span>
        </div>

        {/* Center horizontal line */}
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[1px] bg-red-500/20 border-t border-dashed border-red-500/35"></div>

        {/* The rotating Bottle SVG container */}
        <div 
          className="relative z-10 transition-transform duration-[1800ms] ease-out flex items-center justify-center"
          style={{ transform: `rotate(${rotationDegrees}deg)` }}
        >
          {/* Customized Luxury Champagne bottle glass */}
          <svg width="40" height="120" viewBox="0 0 40 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-[0_0_12px_rgba(16,185,129,0.3)]">
            {/* Cork */}
            <rect x="17" y="2" width="6" height="8" rx="1.5" fill="#c09268" />
            {/* Neck */}
            <path d="M15 10H25V35L28 42H12L15 10Z" fill="#b89a24" />
            <rect x="16" y="14" width="8" height="14" fill="#0c4a23" />
            {/* Body */}
            <path d="M11 42H29C34 42 36 47 36 53V112C36 116 32 118 28 118H12C8 118 4 116 4 112V53C4 47 6 42 11 42Z" fill="#042a12" stroke="#10b981" strokeWidth="2.5" />
            {/* Label */}
            <rect x="8" y="58" width="24" height="34" rx="2" fill="#dfbb33" />
            <circle cx="20" cy="75" r="5" fill="#000000" />
            {/* Arrow/Nozzle Tip */}
            <polygon points="20,0 24,14 16,14" fill="#10b981" />
          </svg>
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-slate-350 text-center bg-white/2 p-2.5 rounded-xl border border-white/5 select-none">
        {commentary}
      </p>

      {/* Bets parameters */}
      <div className="grid grid-cols-2 gap-3 shrink-0">
        <button
          onClick={() => setBetSide("UP")}
          disabled={spinning}
          className={`py-3 rounded-2xl font-sans font-bold text-xs border transition-all active:scale-95 cursor-pointer flex flex-col items-center ${
            betSide === "UP"
              ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
              : "bg-white/2 border-white/5 text-slate-400 hover:border-white/10"
          }`}
        >
          <span className="font-sans font-black">BACK UPPER</span>
          <span className="text-[9px] font-mono text-slate-400 mt-1 uppercase">Green Sector</span>
        </button>

        <button
          onClick={() => setBetSide("DOWN")}
          disabled={spinning}
          className={`py-3 rounded-2xl font-sans font-bold text-xs border transition-all active:scale-95 cursor-pointer flex flex-col items-center ${
            betSide === "DOWN"
              ? "bg-blue-500/20 border-blue-500 text-blue-400"
              : "bg-white/2 border-white/5 text-slate-400 hover:border-white/10"
          }`}
        >
          <span className="font-sans font-black">BACK LOWER</span>
          <span className="text-[9px] font-mono text-slate-400 mt-1 uppercase">Blue Sector</span>
        </button>
      </div>

      <div className="space-y-2 select-none">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-slate-400 font-sans">STAKE WAGER</span>
          <span className="text-[#10b981] font-bold">${stake}</span>
        </div>
        <input 
          disabled={spinning}
          type="range"
          min={10} 
          max={Math.min(500, balance)} 
          step={10}
          value={stake}
          onChange={(e) => setStake(Number(e.target.value))}
          className="w-full accent-emerald-500 cursor-pointer h-1.5"
        />
      </div>

      <button
        onClick={handleSpin}
        disabled={spinning}
        className="w-full bg-emerald-500 hover:bg-emerald-450 text-[#05070a] font-sans font-black text-xs py-3.5 rounded-2xl transition-all shadow-lg active:scale-95 disabled:opacity-50 cursor-pointer uppercase tracking-wider block text-center"
      >
        {spinning ? "SPINNING Champ..." : "🍾 SPIN BOTTLE ($" + stake + ")"}
      </button>
    </div>
  );
};


// 🏎️ GAME 3: PADDOCK RUSH (CRASH)
const PaddockRushGame: React.FC<GameProps> = ({ balance, onUpdateBalance, addLog }) => {
  const [stake, setStake] = useState<number>(50);
  const [isLive, setIsLive] = useState<boolean>(false);
  const [multiplier, setMultiplier] = useState<number>(1.0);
  const [isCrashed, setIsCrashed] = useState<boolean>(false);
  const [isCashedOut, setIsCashedOut] = useState<boolean>(false);
  const [cashoutOdds, setCashoutOdds] = useState<number>(1.0);
  const [commentary, setCommentary] = useState<string>("Click Launch to start. Cash out before the mascot collapses with the ball!");

  const multiplierRef = useRef<number>(1.0);
  const animFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const crashLimitRef = useRef<number>(1.0);

  const startCrashGame = () => {
    if (balance < stake) {
      setCommentary("❌ Insufficient lobby wallet funds.");
      return;
    }
    onUpdateBalance(balance - stake);
    setIsLive(true);
    setIsCrashed(false);
    setIsCashedOut(false);
    setMultiplier(1.0);
    multiplierRef.current = 1.0;
    startTimeRef.current = Date.now();
    setCommentary("🏃 Mascot is on the rush! Hold your nerve...");

    // Determine when the mascot crashes (deterministic/random formula)
    const prob = Math.random();
    if (prob < 0.10) {
      // 10% instant crash (1.00x)
      crashLimitRef.current = 1.00;
    } else {
      // Exponential curve: higher crash points are rarer
      crashLimitRef.current = 1.0 + Math.pow(Math.random(), 3) * 15;
    }

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    tickCrashGame();
  };

  const tickCrashGame = () => {
    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    // Multiplier accelerates slowly over time
    const currentMulti = 1.0 + Math.pow(elapsed * 0.45, 1.8);
    
    if (currentMulti >= crashLimitRef.current) {
      // Mascot trip/crashing!
      setIsLive(false);
      setIsCrashed(true);
      setMultiplier(crashLimitRef.current);
      setCommentary(`💥 TRIP-COLLAPSE! Mascot stumbled at ${crashLimitRef.current.toFixed(2)}x! Bet is lost.`);
      addLog("Paddock Rush", stake, 0, "LOSS", `Crashed at ${crashLimitRef.current.toFixed(2)}x`);
    } else {
      setMultiplier(currentMulti);
      multiplierRef.current = currentMulti;
      animFrameRef.current = requestAnimationFrame(tickCrashGame);
    }
  };

  const handleCashout = () => {
    if (!isLive || isCashedOut || isCrashed) return;

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setIsLive(false);
    setIsCashedOut(true);
    const finalOdds = multiplierRef.current;
    setCashoutOdds(finalOdds);
    
    const winVal = stake * finalOdds;
    onUpdateBalance(balance - stake + winVal);
    setCommentary(`💰 CONGRATULATIONS! Successfully cashed out at ${finalOdds.toFixed(2)}x for a total return of $${winVal.toFixed(2)}!`);
    addLog("Paddock Rush", stake, finalOdds, "WIN", `Cashed out at ${finalOdds.toFixed(2)}x`);
  };

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* High-fidelity running line graph plot */}
      <div className="bg-[#070b11] border border-white/5 rounded-2xl p-6 flex flex-col justify-between items-center relative overflow-hidden h-60 select-none">
        
        {/* Mascot representation banner */}
        <div className="absolute inset-0 bg-[#3b82f6]/2 mix-blend-color-dodge opacity-30 pointer-events-none"></div>

        {/* Dynamic growing multiplier value */}
        <div className="my-auto z-10 flex flex-col items-center">
          <span className={`font-mono text-4xl font-black tracking-tight ${
            isCrashed ? "text-red-500 scale-95" : isCashedOut ? "text-emerald-400 scale-105" : "text-amber-400 animate-pulse"
          }`}>
            {multiplier.toFixed(2)}x
          </span>
          <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest mt-1">CURRENT MULTIPLIER</span>
        </div>

        {/* Exponential track representing paddock curve */}
        <div className="w-full h-8 bg-black/60 border border-white/5 rounded-full flex items-center justify-between px-3 overflow-hidden relative z-10">
          <div className="h-full bg-emerald-500 transition-all rounded-full absolute left-0 top-0 duration-75" style={{ width: `${Math.min(100, (multiplier / 15) * 100)}%` }}></div>
          <span className="text-[10px] font-mono text-slate-350 z-10 uppercase font-bold">START 1.0x</span>
          <span className="text-[10px] font-mono text-amber-405 z-10 font-black">CRASH POINT</span>
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-slate-350 text-center bg-white/2 p-2.5 rounded-xl border border-white/5 select-none">
        {commentary}
      </p>

      {/* Inputs stakes slider */}
      {!isLive && (
        <div className="space-y-2 select-none">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400 font-sans">WAGER STAKE</span>
            <span className="text-[#10b981] font-bold">${stake}</span>
          </div>
          <input 
            type="range"
            min={10} 
            max={Math.min(balance, balance)} 
            step={10}
            value={stake}
            onChange={(e) => setStake(Number(e.target.value))}
            className="w-full accent-emerald-500 cursor-pointer h-1.5"
          />
        </div>
      )}

      {isLive ? (
        <button
          onClick={handleCashout}
          className="w-full bg-emerald-500 hover:bg-emerald-450 text-[#05070a] font-sans font-black text-xs py-4 rounded-2xl transition-all shadow-lg shadow-emerald-500/10 active:scale-95 cursor-pointer uppercase tracking-widest"
        >
          💰 CASHOUT NOW AT {multiplier.toFixed(2)}x
        </button>
      ) : (
        <button
          onClick={startCrashGame}
          className="w-full bg-[#3b82f6] hover:bg-[#2563eb] text-white font-sans font-black text-xs py-3.5 rounded-2xl transition-all shadow-lg active:scale-95 cursor-pointer uppercase tracking-widest"
        >
          🏃 LAUNCH MASCOT RUSH (${stake})
        </button>
      )}
    </div>
  );
};


// 💣 GAME 4: SPORTYMINES
const SportyMinesGame: React.FC<GameProps> = ({ balance, onUpdateBalance, addLog }) => {
  const [mineCount, setMineCount] = useState<number>(3);
  const [stake, setStake] = useState<number>(50);
  const [inGame, setInGame] = useState<boolean>(false);
  const [grid, setGrid] = useState<{ mine: boolean; revealed: boolean }[]>([]);
  const [revealedCount, setRevealedCount] = useState<number>(0);
  const [multiplier, setMultiplier] = useState<number>(1.0);
  const [commentary, setCommentary] = useState<string>("Set mine density, lock wager stake and click START to dig!");

  // Compute total layout grids (6x6 matrix = 36 total cells)
  const totalCells = 36;

  const getMultiplier = (clicks: number, mines: number) => {
    // Standard mine calculations formula
    if (clicks === 0) return 1.0;
    let odds = 1.0;
    for (let i = 0; i < clicks; i++) {
      odds *= (totalCells - i) / (totalCells - mines - i);
    }
    // High premium house house edge 2% deduction
    return Math.round(odds * 0.98 * 100) / 100;
  };

  const handleStartGame = () => {
    if (balance < stake) {
      setCommentary("❌ Insufficient budget wallet funds.");
      return;
    }
    onUpdateBalance(balance - stake);
    setInGame(true);
    setRevealedCount(0);
    setMultiplier(1.0);
    setCommentary(`🎮 SportyMines Active! ${mineCount} explosive mines hidden. Tap cells to uncover Helmets!`);

    // Create randomized mine coordinates
    const minesIdxs = new Set<number>();
    while (minesIdxs.size < mineCount) {
      minesIdxs.add(Math.floor(Math.random() * totalCells));
    }

    const nextGrid = Array.from({ length: totalCells }, (_, index) => ({
      mine: minesIdxs.has(index),
      revealed: false
    }));
    setGrid(nextGrid);
  };

  const handleCellClick = (index: number) => {
    if (!inGame || grid[index].revealed) return;

    const cell = grid[index];
    const newGrid = [...grid];
    newGrid[index].revealed = true;
    setGrid(newGrid);

    if (cell.mine) {
      setInGame(false);
      setCommentary(`💥 EXPLOSION! You hit a mine. Game over, bet is lost.`);
      addLog("SportyMines", stake, 0, "LOSS", `Exploded after ${revealedCount} clicks`);
    } else {
      const nextClicks = revealedCount + 1;
      setRevealedCount(nextClicks);
      const nextMulti = getMultiplier(nextClicks, mineCount);
      setMultiplier(nextMulti);
      
      const remainingSafe = totalCells - mineCount - nextClicks;
      if (remainingSafe === 0) {
        // Automatic full board clearance!
        const winAmount = stake * nextMulti;
        onUpdateBalance(balance - stake + winAmount);
        setInGame(false);
        setCommentary(`🏆 BOARD CLEARANCE! You revealed all safe helmet cards! Gained $${winAmount.toFixed(2)} (${nextMulti}x)`);
        addLog("SportyMines", stake, nextMulti, "WIN", "Full Board Clearance!");
      } else {
        setCommentary(`🟢 SAFE HELMET! Multiplier expanded to ${nextMulti}x. Cash out now or select another!`);
      }
    }
  };

  const handleCashout = () => {
    if (!inGame || revealedCount === 0) return;
    const finalMulti = multiplier;
    const finalPayout = stake * finalMulti;
    onUpdateBalance(balance + finalPayout);
    setInGame(false);
    setCommentary(`💰 SAFE CASHOUT! Picked up $${finalPayout.toFixed(2)} at ${finalMulti}x multiplier.`);
    addLog("SportyMines", stake, finalMulti, "WIN", `Safe Cashout at ${finalMulti}x`);
  };

  return (
    <div className="space-y-4">
      {/* 6x6 high density interactive grid layout */}
      <div className="flex justify-center select-none">
        <div className="grid grid-cols-6 gap-1.5 bg-black/60 p-3.5 border border-white/5 rounded-2xl w-full max-w-sm">
          {grid.length === 0 ? (
            Array.from({ length: totalCells }).map((_, index) => (
              <div key={index} className="aspect-square bg-slate-900 border border-white/3 rounded-lg flex items-center justify-center text-slate-700 opacity-20">
                ⭐
              </div>
            ))
          ) : (
            grid.map((cell, idx) => (
              <button
                key={idx}
                onClick={() => handleCellClick(idx)}
                className={`aspect-square rounded-lg flex items-center justify-center border transition-all cursor-pointer ${
                  cell.revealed
                    ? cell.mine
                      ? "bg-red-650 border-red-500 text-white"
                      : "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                    : inGame
                    ? "bg-slate-800 border-white/10 hover:border-emerald-500/50 hover:bg-slate-700 text-slate-300"
                    : "bg-slate-900/40 border-white/5 text-slate-600 cursor-default"
                }`}
              >
                {cell.revealed ? (
                  cell.mine ? "💣" : "🪖"
                ) : (
                  <span className="text-[9px] font-mono font-medium text-slate-500">{idx+1}</span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-slate-350 text-center bg-white/2 p-2.5 rounded-xl border border-white/5 select-none font-mono">
        {commentary}
      </p>

      {/* Select mine density & stake slider */}
      {!inGame && (
        <div className="grid grid-cols-2 gap-3 shrink-0 select-none">
          <div className="space-y-1 text-left">
            <span className="text-[10px] text-slate-500 font-mono block">MINE DENSITY</span>
            <div className="flex gap-1">
              {[2, 3, 5, 8].map(density => (
                <button
                  key={density}
                  onClick={() => setMineCount(density)}
                  className={`flex-1 py-1.5 px-2.5 rounded-lg border text-xs font-mono font-bold transition-all ${
                    mineCount === density
                      ? "bg-amber-500/20 border-amber-500 text-amber-500 font-black shadow-[0_0_8px_rgba(245,158,11,0.1)]"
                      : "bg-white/2 border-white/5 text-slate-400 hover:border-white/10 cursor-pointer"
                  }`}
                >
                  {density}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1 text-left">
            <span className="text-[10px] text-slate-500 font-mono block">STAKE AMOUNT</span>
            <div className="flex gap-1">
              {[25, 50, 100, 200].map(val => (
                <button
                  key={val}
                  onClick={() => setStake(val)}
                  className={`flex-1 py-1.5 px-2.5 rounded-lg border text-xs font-mono font-bold transition-all ${
                    stake === val
                      ? "bg-blue-500/20 border-blue-500 text-blue-400 font-black shadow-[0_0_8px_rgba(59,130,246,0.1)]"
                      : "bg-white/2 border-white/5 text-slate-400 hover:border-white/10 cursor-pointer"
                  }`}
                >
                  ${val}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {inGame ? (
        <button
          onClick={handleCashout}
          disabled={revealedCount === 0}
          className="w-full bg-emerald-500 hover:bg-emerald-450 text-[#05070a] font-sans font-black text-xs py-3.5 rounded-2xl transition-all shadow-lg active:scale-95 disabled:opacity-50 cursor-pointer uppercase tracking-wider"
        >
          💰 CASHOUT NOW (${(stake * multiplier).toFixed(2)})
        </button>
      ) : (
        <button
          onClick={handleStartGame}
          className="w-full bg-[#3b82f6] hover:bg-[#2563eb] text-white font-sans font-black text-xs py-3.5 rounded-2xl transition-all shadow-lg active:scale-95 cursor-pointer uppercase tracking-wider"
        >
          💣 START SOCCER-MINES MATCH GAME
        </button>
      )}
    </div>
  );
};


// ⚽ GAME 5: PENALTY SHOOTOUT
const PenaltyShootoutGame: React.FC<GameProps> = ({ balance, onUpdateBalance, addLog }) => {
  const [stake, setStake] = useState<number>(50);
  const [roundsCount, setRoundsCount] = useState<number>(0);
  const [currentMulti, setCurrentMulti] = useState<number>(1.0);
  const [inGame, setInGame] = useState<boolean>(false);
  const [commentary, setCommentary] = useState<string>("Choose target coordinates to release a shot! Beat the keeper for super boosted 15.0x multipliers!");
  const [firing, setFiring] = useState<boolean>(false);
  const [lastEvent, setLastEvent] = useState<{ spot: string; saved: boolean } | null>(null);

  const targets = [
    { id: "TL", label: "⚽ Top-Left" },
    { id: "TR", label: "⚽ Top-Right" },
    { id: "BL", label: "🥅 Bottom-Left" },
    { id: "BR", label: "🥅 Bottom-Right" }
  ];

  const handleShoot = (spot: string) => {
    if (firing) return;

    if (!inGame) {
      if (balance < stake) {
        setCommentary("❌ Insufficient lobby wallet funds. Please claim the free $500 Lounge Grant!");
        return;
      }
      onUpdateBalance(balance - stake);
      setInGame(true);
      setRoundsCount(1);
      setCurrentMulti(1.0);
    }

    setFiring(true);
    setCommentary("Run up... releasing direct power volley shot!");

    setTimeout(() => {
      setFiring(false);
      // Increased odds: Keeper has only a 25% chance of saving (75% score chance)
      const saved = Math.random() < 0.25;
      setLastEvent({ spot, saved });

      if (saved) {
        // SAVED! Bet lost, exit game
        setInGame(false);
        setCommentary("🧤 AMAZING SAVE! The diving keeper intercepts your shot. Direct penalty block!");
        addLog("Penalty Shootout", stake, 0, "LOSS", `Saved at ${spot} on shot ${roundsCount}`);
      } else {
        // SCORED! Highly boosted multipliers (1.9x, 3.8x, 7.5x, 15.0x)
        const nextRounds = roundsCount + 1;
        setRoundsCount(nextRounds);
        const scaleMulti = roundsCount === 1 ? 1.9 : roundsCount === 2 ? 3.8 : roundsCount === 3 ? 7.5 : 15.0;
        setCurrentMulti(scaleMulti);

        if (roundsCount >= 4) {
          const finalVal = stake * 15.0;
          onUpdateBalance(balance - stake + finalVal);
          setInGame(false);
          setCommentary(`🏆 SHOT-MASTER! 4 goals in a row cleared! Smashed maximum payout representing $${finalVal.toFixed(2)} (15.0x Jackpot)!`);
          addLog("Penalty Shootout", stake, 15.0, "WIN", "Cleared 4 rounds penalty shootout streak!");
        } else {
          setCommentary(`⚽ GOOOAL! You hit the back of the net! Multiplier expanded to ${scaleMulti}x. Continue or Cash Out.`);
        }
      }
    }, 1100);
  };

  const handleCashout = () => {
    if (!inGame || roundsCount <= 1 || firing) return;
    const winVal = stake * currentMulti;
    onUpdateBalance(balance + winVal);
    setInGame(false);
    setCommentary(`💰 SAFE CASHOUT! Secured $${winVal.toFixed(2)} returns at ${currentMulti}x payout.`);
    addLog("Penalty Shootout", stake, currentMulti, "WIN", `Safe Cashout after ${roundsCount - 1} goals`);
  };

  return (
    <div className="space-y-4">
      {/* Goalkeeper physical target canvas */}
      <div className="bg-[#05070a] border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center relative h-56 select-none overflow-hidden">
        {/* Goalpost background graphic */}
        <div className="absolute inset-x-8 top-10 bottom-6 border-4 border-b-0 border-white/30 bg-white/2 rounded-t-3xl flex items-center justify-center">
          
          {firing ? (
            <div className="flex flex-col items-center justify-center z-10 animate-pulse text-amber-400">
              <Sparkles size={28} className="animate-spin mb-1" />
              <span className="text-[10px] uppercase font-mono tracking-widest font-black">Keeper Diving!</span>
            </div>
          ) : lastEvent ? (
            <div className="text-center z-10 max-w-sm">
              <span className="text-5xl block animate-bounce">{lastEvent.saved ? "🧤" : "⚽"}</span>
              <p className="text-xs font-black uppercase text-slate-300 font-mono mt-1">
                {lastEvent.saved ? `BLOCKED AT ${lastEvent.spot}` : `SCORED AT ${lastEvent.spot}!`}
              </p>
            </div>
          ) : (
            <div className="text-center text-slate-500 text-xs">
              🏃 keeper is ready... choose target
            </div>
          )}
        </div>
      </div>

      {/* Progress Multipliers Header Display */}
      {inGame && (
        <div className="flex gap-2 justify-center font-mono text-[10px] bg-black/35 py-2 border border-white/3 rounded-xl select-none">
          <span className={roundsCount === 2 ? "text-amber-405 font-bold animate-pulse" : "text-slate-500"}>R1: 1.9x</span>
          <span className="text-slate-600">•</span>
          <span className={roundsCount === 3 ? "text-amber-405 font-bold animate-pulse" : "text-slate-500"}>R2: 3.8x</span>
          <span className="text-slate-600">•</span>
          <span className={roundsCount === 4 ? "text-amber-405 font-bold animate-pulse" : "text-slate-500"}>R3: 7.5x</span>
          <span className="text-slate-600">•</span>
          <span className={roundsCount > 4 ? "text-emerald-450 font-bold animate-pulse" : "text-slate-500"}>R4: 15.0x</span>
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-slate-350 text-center bg-white/2 p-2.5 rounded-xl border border-white/5 select-none font-mono">
        {commentary}
      </p>

      {/* Grid of penalty target spots (disabled if firing) */}
      <div className="grid grid-cols-2 gap-2 shrink-0">
        {targets.map(tar => (
          <button
            key={tar.id}
            disabled={firing}
            onClick={() => handleShoot(tar.id)}
            className="bg-[#121620] hover:bg-white/5 border border-white/10 hover:border-emerald-500 text-emerald-400 font-sans font-black text-xs py-3 rounded-2xl transition-all active:scale-95 disabled:opacity-50 cursor-pointer uppercase text-center"
          >
            {tar.label}
          </button>
        ))}
      </div>

      {inGame && (
        <button
          onClick={handleCashout}
          disabled={roundsCount <= 1 || firing}
          className="w-full bg-emerald-500 hover:bg-emerald-450 text-[#05070a] font-sans font-black text-xs py-3.5 rounded-2xl transition-all shadow-lg active:scale-95 disabled:opacity-50 cursor-pointer uppercase tracking-wider block text-center"
        >
          💰 CASHOUT PENALTY GAME (${(stake * currentMulti).toFixed(2)})
        </button>
      )}

      {!inGame && (
        <div className="space-y-1.5 select-none text-[11px] font-mono">
          <div className="flex justify-between">
            <span className="text-slate-400 font-sans">SET WAGER STAKE</span>
            <span className="text-emerald-400 font-bold">${stake}</span>
          </div>
          <input 
            type="range"
            min={Math.max(1, Math.min(10, Math.floor(balance)))} 
            max={Math.max(10, Math.min(1000, Math.floor(balance)))} 
            step={Math.max(1, Math.min(10, Math.floor(balance / 50) || 5))}
            value={Math.max(1, Math.min(stake, balance || 10))}
            onChange={(e) => setStake(Number(e.target.value))}
            className="w-full accent-emerald-500 cursor-pointer h-1.5"
          />
        </div>
      )}
    </div>
  );
};


// 🎰 GAME 6: FOOTBALL SLOTS
const FootballSlotsGame: React.FC<GameProps> = ({ balance, onUpdateBalance, addLog }) => {
  const [stake, setStake] = useState<number>(50);
  const [reels, setReels] = useState<string[]>(["Cup", "Boot", "Ball"]);
  const [spinning, setSpinning] = useState<boolean>(false);
  const [commentary, setCommentary] = useState<string>("Click SPIN below to trigger high-fidelity football slot reels and match payout lines!");

  // Symbol mappings
  const symbolsSet = ["Cup", "Boot", "Ball", "Whistle", "Card"];
  const weightsSet = ["🏆", "👟", "⚽", "📯", "🟨"];

  const handleSpin = () => {
    if (spinning) return;
    if (balance < stake) {
      setCommentary("❌ Insufficient lobby wallet funds.");
      return;
    }
    onUpdateBalance(balance - stake);
    setSpinning(true);
    setCommentary("Football slot reels are rotating fast...");

    setTimeout(() => {
      setSpinning(false);
      
      // Pull 3 random symbols
      const r1 = symbolsSet[Math.floor(Math.random() * symbolsSet.length)];
      const r2 = symbolsSet[Math.floor(Math.random() * symbolsSet.length)];
      const r3 = symbolsSet[Math.floor(Math.random() * symbolsSet.length)];
      const resultReels = [r1, r2, r3];
      setReels(resultReels);

      // Settle payouts math
      if (r1 === r2 && r2 === r3) {
        // High 3 of a kind payout!
        let multi = 10.0;
        if (r1 === "Cup") multi = 50.0;
        if (r1 === "Boot") multi = 30.0;
        if (r1 === "Ball") multi = 20.0;

        const winVal = stake * multi;
        onUpdateBalance(balance - stake + winVal);
        setCommentary(`🎉 ULTRA MEGA WIN! 3-of-a-kind ${r1} matching line! Secured payout representing $${winVal.toFixed(2)} (${multi}x)!`);
        addLog("Football Slots", stake, multi, "WIN", `Hit 3 of a kind: ${r1}`);
      } else if (r1 === r2 || r2 === r3 || r1 === r3) {
        // Scatter / 2 of a kind payout
        const matchedSym = r1 === r2 ? r1 : r3;
        const multi = 2.0;
        const winVal = stake * multi;
        onUpdateBalance(balance - stake + winVal);
        setCommentary(`🎉 WIN! Two-of-a-kind matching line with ${matchedSym}! Secured payout of $${winVal.toFixed(2)} (2.0x)!`);
        addLog("Football Slots", stake, multi, "WIN", `Matched 2 symbols: ${matchedSym}`);
      } else {
        setCommentary("💔 No matching lines. Try another spin to hit the Cup jackpot!");
        addLog("Football Slots", stake, 0, "LOSS", "No matching lines");
      }
    }, 1100);
  };

  const getSymbolChar = (id: string) => {
    const idx = symbolsSet.indexOf(id);
    return idx !== -1 ? weightsSet[idx] : "⚽";
  };

  return (
    <div className="space-y-4">
      {/* Traditional three-column slot rollers layout */}
      <div className="bg-[#05070a] border border-white/5 rounded-2xl p-5 flex justify-center gap-4 select-none relative">
        {reels.map((sym, index) => (
          <div
            key={index}
            className={`h-28 w-20 rounded-xl bg-gradient-to-b from-[#131923] to-[#040608] border border-white/10 flex flex-col items-center justify-center font-bold relative overflow-hidden transition-all duration-300 ${
              spinning ? "animate-pulse border-amber-500/30 scale-95" : ""
            }`}
          >
            <span className="text-3xl block">{spinning ? "⚙️" : getSymbolChar(sym)}</span>
            <span className="text-[10px] text-slate-400 font-mono uppercase mt-1 tracking-wider">{spinning ? "..." : sym}</span>
          </div>
        ))}
      </div>

      <p className="text-[11px] leading-relaxed text-slate-350 text-center bg-white/2 p-2.5 rounded-xl border border-white/5 select-none font-mono">
        {commentary}
      </p>

      {/* Stake parameters select */}
      <div className="flex justify-between items-center bg-black/45 p-3 rounded-xl border border-white/5 text-xs select-none">
        <span className="text-slate-400">STAKE SLOTS AMOUNT</span>
        <div className="flex gap-1">
          {[20, 50, 100, 250].map(val => (
            <button
              key={val}
              disabled={spinning}
              onClick={() => setStake(val)}
              className={`py-1 px-2.5 rounded-lg border text-[10px] font-mono font-bold transition-all ${
                stake === val
                  ? "bg-amber-500/20 border-amber-500 text-amber-500 font-black"
                  : "bg-white/2 border-white/5 text-slate-400 hover:border-white/10 cursor-pointer"
              }`}
            >
              ${val}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleSpin}
        disabled={spinning}
        className="w-full bg-emerald-500 hover:bg-emerald-450 text-[#05070a] font-sans font-black text-xs py-3.5 rounded-2xl transition-all shadow-lg active:scale-95 disabled:opacity-50 cursor-pointer uppercase tracking-wider block text-center"
      >
        {spinning ? "SPINNING REELS..." : "🎰 SPIN REEL ($" + stake + ")"}
      </button>
    </div>
  );
};


// 💎 GAME 7: GOLDEN BOOT PLINKO
const PlinkoGame: React.FC<GameProps> = ({ balance, onUpdateBalance, addLog }) => {
  const [stake, setStake] = useState<number>(50);
  const [dropping, setDropping] = useState<boolean>(false);
  const [pegPath, setPegPath] = useState<number[]>([]);
  const [commentary, setCommentary] = useState<string>("Select drop. Drop a golden chip down the triangle pegboard into payout bins.");

  const bins = [
    { multi: 10.0, label: "10.0x", color: "bg-red-500/15 border-red-500/40 text-red-00" },
    { multi: 3.0, label: "3.0x", color: "bg-amber-500/15 border-amber-500/40 text-amber-400" },
    { multi: 1.5, label: "1.5x", color: "bg-emerald-500/15 border-emerald-500/40 text-emerald-400" },
    { multi: 0.2, label: "0.2x", color: "bg-[#1f2937]/30 border-white/5 text-slate-400" },
    { multi: 0.5, label: "0.5x", color: "bg-[#1f2937]/30 border-white/5 text-slate-450" },
    { multi: 1.5, label: "1.5x", color: "bg-emerald-500/15 border-emerald-500/40 text-emerald-400" },
    { multi: 3.0, label: "3.0x", color: "bg-amber-500/15 border-amber-500/40 text-amber-400" },
    { multi: 10.0, label: "10.0x", color: "bg-red-500/15 border-red-500/40 text-red-00" }
  ];

  const handleDrop = () => {
    if (dropping) return;
    if (balance < stake) {
      setCommentary("❌ Insufficient lobby balance.");
      return;
    }
    onUpdateBalance(balance - stake);
    setDropping(true);
    setPegPath([]);
    setCommentary("Chip is bouncing on the pegboard grids... watch the drift!");

    // Simulating plinko drop physics of 7 rows path. Bounce left (0) or right (1)
    const path: number[] = [];
    for (let r = 0; r < 7; r++) {
      path.push(Math.random() < 0.5 ? 0 : 1);
    }

    // Set paths step by step
    let step = 0;
    const interval = setInterval(() => {
      setPegPath(path.slice(0, step + 1));
      step += 1;
      
      if (step >= 7) {
        clearInterval(interval);
        setDropping(false);

        // Map path to ending grid bin
        const rightBouncesCount = path.reduce((acc, v) => acc + v, 0);
        // Map remaining bounces to 8 possible bins (0 to 7)
        const binIdx = Math.min(7, rightBouncesCount);
        const hitBin = bins[binIdx];
        const winPayout = stake * hitBin.multi;
        onUpdateBalance(balance - stake + winPayout);

        setCommentary(`💎 BOUNCED INTO BIN! Golden chip hit the ${hitBin.label} bin! Yielded returns representing $${winPayout.toFixed(2)}.`);
        addLog("Golden Boot Plinko", stake, hitBin.multi, hitBin.multi >= 1.0 ? "WIN" : "LOSS", `Landed in ${hitBin.label} slot`);
      }
    }, 280);
  };

  return (
    <div className="space-y-4 select-none">
      {/* Pegboard layout visualization */}
      <div className="bg-[#05070a] border border-white/5 rounded-2xl p-4 flex flex-col justify-between items-center relative min-h-64 h-auto">
        <span className="text-[10px] font-mono text-slate-500 absolute top-2 right-2">PEGBOARD SHIFT</span>
        
        {/* Peg triangles representing Plinko peg grids */}
        <div className="my-auto space-y-2 text-center w-full max-w-sm flex flex-col items-center py-4">
          {[1, 2, 3, 4, 5, 6].map((row, rIdx) => (
            <div key={rIdx} className="flex justify-center gap-5">
              {Array.from({ length: row }).map((_, pIdx) => {
                // Highlight peg if ball path has traversed it
                const isTraversed = pxMatch(rIdx, pIdx, pegPath);
                return (
                  <span 
                    key={pIdx} 
                    className={`h-1.5 w-1.5 rounded-full block transition-colors duration-150 ${
                      isTraversed ? "bg-amber-405 shadow-[0_0_8px_rgba(245,158,11,0.8)] scale-150" : "bg-slate-750"
                    }`}
                  ></span>
                );
              })}
            </div>
          ))}
        </div>

        {/* Bins bottom row */}
        <div className="grid grid-cols-8 gap-1 w-full text-center mt-3 pt-3 border-t border-white/5 font-mono">
          {bins.map((bin, bIdx) => (
            <div key={bIdx} className={`py-1.5 rounded text-[9px] font-bold ${bin.color}`}>
              {bin.label}
            </div>
          ))}
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-slate-350 text-center bg-white/2 p-2.5 rounded-xl border border-white/5 select-none font-mono">
        {commentary}
      </p>

      {/* Stake parameters select */}
      <div className="flex justify-between items-center bg-black/45 p-3 rounded-xl border border-white/5 text-xs select-none">
        <span className="text-slate-450 font-medium">STAKE PLINKO WAGER</span>
        <div className="flex gap-1">
          {[10, 25, 50, 100].map(val => (
            <button
              key={val}
              disabled={dropping}
              onClick={() => setStake(val)}
              className={`py-1 px-2.5 rounded-lg border text-[10px] font-mono font-bold transition-all ${
                stake === val
                  ? "bg-amber-500/20 border-amber-500 text-amber-500 font-black animate-pulse"
                  : "bg-white/2 border-white/5 text-slate-400 hover:border-white/10 cursor-pointer"
              }`}
            >
              ${val}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleDrop}
        disabled={dropping}
        className="w-full bg-[#10b981] hover:bg-[#059669] text-[#05070a] font-sans font-black text-xs py-3.5 rounded-2xl transition-all shadow-lg active:scale-95 disabled:opacity-50 cursor-pointer uppercase tracking-wider block text-center"
      >
        {dropping ? "DROPPING GOLDEN BALL..." : "💎 DROP GOLDEN BALL ($" + stake + ")"}
      </button>
    </div>
  );
};

// Plinko peg paths matching helper
function pxMatch(rowIdx: number, pegIdx: number, path: number[]): boolean {
  if (path.length <= rowIdx) return false;
  const pathPart = path.slice(0, rowIdx + 1);
  const positionAccum = pathPart.reduce((acc, v) => acc + v, 0);
  return pegIdx === positionAccum;
}


// 🎲 GAME 8: OVER / UNDER DICE
const OverUnderDiceGame: React.FC<GameProps> = ({ balance, onUpdateBalance, addLog }) => {
  const [stake, setStake] = useState<number>(50);
  const [targetMode, setTargetMode] = useState<"OVER_7" | "UNDER_7" | "EQUAL_7">("OVER_7");
  const [rolling, setRolling] = useState<boolean>(false);
  const [diceVals, setDiceVals] = useState<number[]>([3, 4]);
  const [commentary, setCommentary] = useState<string>("Pick target threshold, set wager stake and click ROLL to duel!");

  const handleRoll = () => {
    if (rolling) return;
    if (balance < stake) {
      setCommentary("❌ Insufficient lobby balance.");
      return;
    }
    onUpdateBalance(balance - stake);
    setRolling(true);
    setCommentary("Rolling dice cups...");

    setTimeout(() => {
      setRolling(false);
      
      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      const sum = d1 + d2;
      setDiceVals([d1, d2]);

      // Settle results
      let success = false;
      let multiplier = 2.0;

      if (targetMode === "OVER_7") {
        success = sum > 7;
        multiplier = 2.2; // Over 7 pays 2.2x
      } else if (targetMode === "UNDER_7") {
        success = sum < 7;
        multiplier = 2.2; // Under 7 pays 2.2x
      } else {
        success = sum === 7;
        multiplier = 5.8; // Exact 7 pays high 5.8x!
      }

      const payoutText = success ? `WON` : `LOSS`;

      if (success) {
        const winVal = stake * multiplier;
        onUpdateBalance(balance - stake + winVal);
        setCommentary(`🎉 EXCELLENT GUESS! Dice rolled is ${d1} + ${d2} = ${sum}. Target prediction HIT securing total $${winVal.toFixed(2)} (${multiplier.toFixed(1)}x)!`);
        addLog("Over/Under Dice", stake, multiplier, "WIN", `Sum was ${sum} (Guessed ${targetMode})`);
      } else {
        setCommentary(`💔 MISSED GAME! Dice rolled is ${d1} + ${d2} = ${sum}. Guessed ${targetMode}, prediction was negative.`);
        addLog("Over/Under Dice", stake, 0, "LOSS", `Sum was ${sum} (Guessed ${targetMode})`);
      }
    }, 1100);
  };

  return (
    <div className="space-y-4">
      {/* Visual rolling dice representation */}
      <div className="bg-[#05070a] border border-white/5 rounded-2xl p-5 flex justify-center gap-6 select-none relative">
        <span className="text-[10px] font-mono text-slate-500 absolute top-2 left-2 uppercase">Duel Dice Cup</span>
        {diceVals.map((val, index) => (
          <div
            key={index}
            className={`h-20 w-20 rounded-2xl bg-gradient-to-br from-[#121824] to-[#05070a] border-2 border-emerald-500/20 shadow-md flex items-center justify-center font-black text-3xl font-mono text-slate-105 transition-all duration-300 ${
              rolling ? "rotate-12 animate-pulse scale-90 border-amber-500" : ""
            }`}
          >
            {rolling ? "🎲" : val}
          </div>
        ))}
      </div>

      <p className="text-[11px] leading-relaxed text-slate-350 text-center bg-white/2 p-2.5 rounded-xl border border-white/5 select-none font-mono">
        {commentary}
      </p>

      {/* Target prediction select */}
      <div className="grid grid-cols-3 gap-2 shrink-0 select-none">
        <button
          onClick={() => setTargetMode("UNDER_7")}
          disabled={rolling}
          className={`py-3 rounded-2xl font-sans font-bold text-xs border transition-all active:scale-95 cursor-pointer flex flex-col items-center ${
            targetMode === "UNDER_7"
              ? "bg-emerald-500/20 border-emerald-505 text-emerald-400 font-extrabold"
              : "bg-[#0b0e14] border-white/5 text-slate-400 hover:border-white/10"
          }`}
        >
          <span>UNDER 7</span>
          <span className="text-[8px] font-mono text-slate-550 mt-1">2.2x Pays</span>
        </button>

        <button
          onClick={() => setTargetMode("EQUAL_7")}
          disabled={rolling}
          className={`py-3 rounded-2xl font-sans font-bold text-xs border transition-all active:scale-95 cursor-pointer flex flex-col items-center ${
            targetMode === "EQUAL_7"
              ? "bg-amber-500/25 border-amber-500 text-amber-400 font-extrabold"
              : "bg-[#0b0e14] border-white/5 text-slate-400 hover:border-white/10"
          }`}
        >
          <span>EXACTLY 7</span>
          <span className="text-[8px] font-mono text-slate-550 mt-1">5.8x High Jackpot</span>
        </button>

        <button
          onClick={() => setTargetMode("OVER_7")}
          disabled={rolling}
          className={`py-3 rounded-2xl font-sans font-bold text-xs border transition-all active:scale-95 cursor-pointer flex flex-col items-center ${
            targetMode === "OVER_7"
              ? "bg-sky-500/20 border-sky-505 text-sky-400 font-extrabold"
              : "bg-[#0b0e14] border-white/5 text-slate-400 hover:border-white/10"
          }`}
        >
          <span>OVER 7</span>
          <span className="text-[8px] font-mono text-slate-550 mt-1">2.2x Pays</span>
        </button>
      </div>

      {/* Stake parameters select */}
      <div className="flex justify-between items-center bg-black/45 p-3 rounded-xl border border-white/5 text-xs select-none">
        <span className="text-slate-400">STAKE AMOUNT</span>
        <div className="flex gap-1">
          {[20, 50, 100, 250].map(val => (
            <button
              key={val}
              disabled={rolling}
              onClick={() => setStake(val)}
              className={`py-1 px-2.5 rounded-lg border text-[10px] font-mono font-bold transition-all ${
                stake === val
                  ? "bg-amber-500/20 border-amber-500 text-amber-500 font-black animate-pulse"
                  : "bg-white/2 border-white/5 text-slate-400 hover:border-white/10 cursor-pointer"
              }`}
            >
              ${val}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleRoll}
        disabled={rolling}
        className="w-full bg-emerald-500 hover:bg-emerald-450 text-[#05070a] font-sans font-black text-xs py-3.5 rounded-2xl transition-all shadow-lg active:scale-95 disabled:opacity-50 cursor-pointer uppercase tracking-wider block text-center"
      >
        {rolling ? "ROLLING DUELL DICE..." : "🎲 ROLL DUEL DICE ($" + stake + ")"}
      </button>
    </div>
  );
};
