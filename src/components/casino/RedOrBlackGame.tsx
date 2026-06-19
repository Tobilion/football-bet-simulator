import React, { useState, useRef } from "react";
import { RefreshCw } from "lucide-react";
import { GameProps, StakeSlider } from "./shared";

export const RedOrBlackGame: React.FC<GameProps> = ({ balance, onUpdateBalance, addLog }) => {
  const [stake, setStake] = useState<number>(() => Math.max(1, Math.min(50, Math.floor(balance))));
  const [round, setRound] = useState<number>(0);
  const [history, setHistory] = useState<("RED" | "BLACK" | "JOKER")[]>([]);
  const [currentPool, setCurrentPool] = useState<number>(0);
  const [spinning, setSpinning] = useState<boolean>(false);
  const [lastDraw, setLastDraw] = useState<"RED" | "BLACK" | "JOKER" | null>(null);
  const [message, setMessage] = useState<string>("Choose Red or Black to begin a 4-round streak! Beware of the 2% Joker card.");

  const ROUND_MULTIS = [2.4, 5.5, 12.0, 28.0];
  const ROUND_LABELS_MULTI = ["2.4x", "5.5x", "12.0x", "28.0x"];

  const originalWagerRef = useRef<number>(0);
  const currentRoundRef = useRef<number>(0);
  const currentPoolRef = useRef<number>(0);
  const balanceAtStartRef = useRef<number>(0);

  const safeStake = balance > 0 ? Math.max(1, Math.min(stake, Math.floor(balance))) : stake;

  const resolveRound = (choice: "RED" | "BLACK") => {
    setSpinning(true);
    setMessage("Shuffling casino decks...");

    setTimeout(() => {
      setSpinning(false);
      const rand = Math.random() * 100;
      let draw: "RED" | "BLACK" | "JOKER";
      if (rand < 2.0) draw = "JOKER";
      else if (rand < 51.0) draw = "RED";
      else draw = "BLACK";

      setLastDraw(draw);
      setHistory(prev => [...prev, draw]);

      const thisRound = currentRoundRef.current;
      const origWager = originalWagerRef.current;
      const balStart = balanceAtStartRef.current;

      if (draw === "JOKER") {
        setMessage("🤡 Oh no! The trick JOKER card appeared and wiped the entire pool!");
        addLog("Red or Black", origWager, 0, "JOKER", `Wiped by Joker on round ${thisRound}`);
        setRound(0);
        setCurrentPool(0);
        currentRoundRef.current = 0;
        currentPoolRef.current = 0;
      } else if (draw === choice) {
        const newPool = origWager * ROUND_MULTIS[thisRound - 1];
        setCurrentPool(newPool);
        currentPoolRef.current = newPool;

        if (thisRound >= 4) {
          onUpdateBalance(balStart - origWager + newPool);
          setMessage(`🏆 MASTER STREAK! 4 rounds cleared! You win $${newPool.toFixed(2)} (${ROUND_MULTIS[3]}x)!`);
          addLog("Red or Black", origWager, ROUND_MULTIS[3], "WIN", "Mastered 4 rounds streak!");
          setRound(0);
          setCurrentPool(0);
          currentRoundRef.current = 0;
          currentPoolRef.current = 0;
        } else {
          const nextRound = thisRound + 1;
          setRound(nextRound);
          currentRoundRef.current = nextRound;
          setMessage(`🎯 SUCCESS! Round ${thisRound} hit! Pool is now $${newPool.toFixed(2)} (${ROUND_MULTIS[thisRound - 1]}x). Continue to round ${nextRound} or Cash Out!`);
        }
      } else {
        setMessage(`💔 Missed. Drawn card was ${draw} but you guessed ${choice}. Bet lost.`);
        addLog("Red or Black", origWager, 0, "LOSS", `Lost on round ${thisRound} (drew ${draw})`);
        setRound(0);
        setCurrentPool(0);
        currentRoundRef.current = 0;
        currentPoolRef.current = 0;
      }
    }, 1200);
  };

  const selectColor = (choice: "RED" | "BLACK") => {
    if (spinning) return;
    if (round === 0) {
      if (balance <= 0) {
        setMessage("❌ No balance remaining. Claim the free $500 emergency cash above!");
        return;
      }
      const wager = Math.min(safeStake, balance);
      originalWagerRef.current = wager;
      currentRoundRef.current = 1;
      currentPoolRef.current = wager;
      balanceAtStartRef.current = balance;
      onUpdateBalance(balance - wager);
      setRound(1);
      setCurrentPool(wager);
      setHistory([]);
      setLastDraw(null);
      resolveRound(choice);
    } else {
      resolveRound(choice);
    }
  };

  const handleCashout = () => {
    if (round <= 1 || currentPool <= 0 || spinning) return;
    const finalPool = currentPoolRef.current;
    const origWager = originalWagerRef.current;
    const balStart = balanceAtStartRef.current;
    onUpdateBalance(balStart - origWager + finalPool);
    setMessage(`💰 Safe recovery! Cashed out $${finalPool.toFixed(2)} after round ${round - 1} (${(finalPool / origWager).toFixed(2)}x)!`);
    addLog("Red or Black", origWager, finalPool / origWager, "WIN", `Safe Cashout after Round ${round - 1}`);
    setRound(0);
    setCurrentPool(0);
    currentRoundRef.current = 0;
    currentPoolRef.current = 0;
  };

  return (
    <div className="space-y-4">
      <div className="bg-black/40 border border-white/5 rounded-xl p-4 text-center">
        <span className="text-[9px] font-mono text-emerald-400 uppercase font-black">ROUND STREAK STATUS — BOOSTED ODDS</span>
        <div className="flex justify-center items-center gap-3 my-4">
          {[1, 2, 3, 4].map(r => {
            const isCleared = round > r;
            const isCurrent = round === r;
            return (
              <div
                key={r}
                className={`h-12 w-12 rounded-xl flex flex-col items-center justify-center border font-mono transition-all ${
                  isCleared
                    ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                    : isCurrent
                    ? "bg-amber-500/20 border-amber-500 text-amber-400 animate-pulse font-bold"
                    : "bg-white/2 border-white/5 text-slate-500"
                }`}
              >
                <span className="text-[10px]">R{r}</span>
                <span className="text-[9px] font-extrabold">{ROUND_LABELS_MULTI[r - 1]}</span>
              </div>
            );
          })}
        </div>

        <div className="min-h-24 flex items-center justify-center border border-white/5 rounded-xl bg-black/60 p-4">
          {spinning ? (
            <div className="flex flex-col items-center gap-2">
              <RefreshCw className="animate-spin text-amber-400" size={24} />
              <span className="text-xs text-slate-400 font-mono uppercase">Shuffling decks...</span>
            </div>
          ) : lastDraw ? (
            <div className="flex flex-col items-center">
              <div className={`h-16 w-12 rounded-xl flex items-center justify-center font-bold text-xl shadow-lg border ${
                lastDraw === "RED"
                  ? "bg-red-700 border-red-500/40 text-white"
                  : lastDraw === "BLACK"
                  ? "bg-slate-900 border-white/10 text-white"
                  : "bg-amber-600 border-amber-500 text-black"
              }`}>
                {lastDraw === "RED" ? "♦️" : lastDraw === "BLACK" ? "♣️" : "🤡"}
              </div>
              <span className="text-[10px] text-slate-400 font-mono mt-1.5 uppercase font-bold">Drawn: {lastDraw}</span>
            </div>
          ) : (
            <span className="text-slate-500 text-xs font-mono uppercase">Place your prediction to draw</span>
          )}
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-slate-300 text-center bg-white/2 p-2.5 rounded-xl border border-white/5">{message}</p>

      {round === 0 ? (
        <StakeSlider
          balance={balance}
          stake={safeStake}
          setStake={setStake}
          disabled={spinning}
          label="STREAK ENTRY STAKE"
        />
      ) : (
        <div className="bg-black/30 border border-white/5 rounded-xl p-3 flex items-center justify-between text-xs font-mono">
          <span>Active Streak: <b className="text-emerald-400">Round {round}</b></span>
          <span>Rolling Pool: <b className="text-emerald-400">${currentPool.toFixed(2)}</b></span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={() => selectColor("RED")}
          disabled={spinning || (round === 0 && balance <= 0)}
          className="bg-red-700 hover:bg-red-600 text-white font-sans font-bold text-xs py-3.5 rounded-2xl transition-all border border-red-500/20 active:scale-95 disabled:opacity-40 cursor-pointer text-center uppercase tracking-wider"
        >
          ♦️ BET RED
        </button>
        <button
          onClick={() => selectColor("BLACK")}
          disabled={spinning || (round === 0 && balance <= 0)}
          className="bg-slate-900 hover:bg-slate-800 text-white font-sans font-bold text-xs py-3.5 rounded-2xl transition-all border border-white/10 active:scale-95 disabled:opacity-40 cursor-pointer text-center uppercase tracking-wider"
        >
          ♣️ BET BLACK
        </button>
      </div>

      {round > 1 && (
        <button
          onClick={handleCashout}
          disabled={spinning}
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-sans font-black text-xs py-3.5 rounded-2xl transition-all shadow-lg active:scale-95 disabled:opacity-50 cursor-pointer uppercase tracking-wider block text-center"
        >
          💰 CASHOUT POOL (${currentPool.toFixed(2)})
        </button>
      )}
    </div>
  );
};
