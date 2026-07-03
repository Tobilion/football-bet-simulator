import React, { useState } from "react";
import { GameProps, StakeSlider } from "./shared";
import { formatMoney } from "../../utils";

type Suit = "♠" | "♥" | "♦" | "♣";
type CardVal = "A"|"2"|"3"|"4"|"5"|"6"|"7"|"8"|"9"|"10"|"J"|"Q"|"K";
const SUITS: Suit[] = ["♠","♥","♦","♣"];
const VALS: CardVal[] = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
const VAL_RANK: Record<CardVal,number> = {A:1,"2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"10":10,J:11,Q:12,K:13};
const isRed = (s: Suit) => s === "♥" || s === "♦";

interface Card { val: CardVal; suit: Suit; }
function randomCard(): Card { return { val: VALS[Math.floor(Math.random()*13)], suit: SUITS[Math.floor(Math.random()*4)] }; }

// House edge kept at 3% (RTP ~97%). Multipliers are DERIVED from the current card's real
// win probability, so no card/direction is ever +EV — every step returns 0.97 on average.
// Ties lose. With 13 ranks: strictly-higher count = 13 - rank, strictly-lower count = rank - 1.
const HOUSE_EDGE = 0.97;
const MAX_STEPS = 8;
const higherCount = (rank: number) => 13 - rank;
const lowerCount = (rank: number) => rank - 1;
const stepMulti = (count: number) => (count > 0 ? (HOUSE_EDGE * 13) / count : 0);

export const HiLoGame: React.FC<GameProps> = ({ balance, onUpdateBalance, addLog }) => {
  const [stake, setStake] = useState(() => Math.max(1, Math.min(50, Math.floor(balance))));
  const [currentCard, setCurrentCard] = useState<Card | null>(null);
  const [streak, setStreak] = useState(0);
  const [pool, setPool] = useState(0);
  const [message, setMessage] = useState("Click START to flip your first card!");
  const [phase, setPhase] = useState<"idle"|"playing"|"done">("idle");
  const [resolving, setResolving] = useState(false);
  const safeStake = Math.max(1, Math.min(stake, Math.max(1, balance)));

  const curRank = currentCard ? VAL_RANK[currentCard.val] : 0;
  const hiCount = higherCount(curRank);
  const loCount = lowerCount(curRank);
  const hiMulti = stepMulti(hiCount);
  const loMulti = stepMulti(loCount);

  const startGame = () => {
    if (balance < safeStake) { setMessage("❌ Insufficient balance."); return; }
    onUpdateBalance(p => Math.max(0, p - safeStake));
    const card = randomCard();
    setCurrentCard(card); setStreak(0); setPool(safeStake); setPhase("playing");
    setMessage(`Current card: ${card.val}${card.suit}. Higher or Lower? (payout scales with the odds)`);
  };

  const guess = (dir: "higher" | "lower") => {
    if (phase !== "playing" || !currentCard || resolving) return;
    const stepCount = dir === "higher" ? higherCount(curRank) : lowerCount(curRank);
    if (stepCount === 0) return; // impossible guess (e.g. Higher on a King)
    const multi = stepMulti(stepCount);
    setResolving(true);
    setTimeout(() => {
      const next = randomCard();
      const nextRank = VAL_RANK[next.val];
      const correct = dir === "higher" ? nextRank > curRank : nextRank < curRank; // ties lose
      if (!correct) {
        addLog("Hi-Lo Ladder", safeStake, 0, "LOSS", `Lost on streak ${streak+1}: drew ${next.val}${next.suit}`);
        setMessage(`💔 Drawn ${next.val}${next.suit}! Streak broken at level ${streak+1}. Lost $${formatMoney(safeStake)}.`);
        setCurrentCard(next); setPhase("done"); setResolving(false); return;
      }
      const newStreak = streak + 1;
      const newPool = pool * multi;
      setCurrentCard(next); setStreak(newStreak); setPool(newPool);
      if (newStreak >= MAX_STEPS) {
        onUpdateBalance(p => p + newPool);
        addLog("Hi-Lo Ladder", safeStake, newPool / safeStake, "WIN", `Max streak! ${next.val}${next.suit}`);
        setMessage(`🏆 MAX STREAK! ${MAX_STEPS} correct! You win $${formatMoney(newPool)} (${(newPool/safeStake).toFixed(2)}x)!`);
        setPhase("done"); setResolving(false); return;
      }
      setMessage(`✅ ${next.val}${next.suit}! Level ${newStreak}/${MAX_STEPS} — Pool: $${formatMoney(newPool)} (${(newPool/safeStake).toFixed(2)}x). Continue or Cashout?`);
      setResolving(false);
    }, 600);
  };

  const cashout = () => {
    if (phase !== "playing" || streak === 0) return;
    onUpdateBalance(p => p + pool);
    addLog("Hi-Lo Ladder", safeStake, pool / safeStake, "WIN", `Cashed out at streak ${streak}`);
    setMessage(`💰 Cashed out $${formatMoney(pool)} after ${streak} correct guesses!`);
    setPhase("done");
  };

  return (
    <div className="space-y-4 select-none">
      {/* Streak progress */}
      <div className="bg-black/40 border border-white/5 rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[9px] font-mono text-slate-500 uppercase font-bold">STREAK PROGRESS</div>
          <div className="text-[9px] font-mono text-emerald-400 font-bold">
            {phase === "playing" ? `POOL $${formatMoney(pool)} (${(pool/safeStake).toFixed(2)}x)` : `MAX ${MAX_STEPS} LEVELS`}
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {Array.from({ length: MAX_STEPS }, (_, i) => (
            <div key={i} className={`flex-1 min-w-[2rem] text-center py-1.5 rounded-lg border text-[9px] font-mono font-black transition-all ${
              i < streak ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" :
              i === streak && phase === "playing" ? "bg-amber-500/20 border-amber-500 text-amber-400 animate-pulse" :
              "bg-white/2 border-white/5 text-slate-600"
            }`}>
              L{i+1}
            </div>
          ))}
        </div>
      </div>

      {/* Card display */}
      <div className="flex justify-center">
        {currentCard ? (
          <div className={`w-20 h-28 rounded-xl border-2 flex flex-col items-start justify-start p-2 shadow-2xl ${isRed(currentCard.suit) ? "bg-white border-red-400" : "bg-white border-slate-700"}`}>
            <span className={`text-base font-black leading-none ${isRed(currentCard.suit) ? "text-red-600" : "text-slate-900"}`}>{currentCard.val}</span>
            <span className={`text-2xl ${isRed(currentCard.suit) ? "text-red-600" : "text-slate-900"}`}>{currentCard.suit}</span>
          </div>
        ) : (
          <div className="w-20 h-28 rounded-xl border-2 border-white/10 bg-gradient-to-br from-blue-900 to-blue-950 flex items-center justify-center">
            <span className="text-blue-400/40 text-3xl">🂠</span>
          </div>
        )}
      </div>

      <p className="text-xs text-center text-slate-300 bg-white/5 border border-white/5 rounded-xl py-2.5 px-3 font-bold leading-snug">{message}</p>

      {phase === "idle" || phase === "done" ? (
        <div className="space-y-3">
          <StakeSlider balance={balance} stake={safeStake} setStake={setStake} label="ENTRY STAKE" />
          <button onClick={startGame} disabled={balance <= 0}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm py-3 rounded-2xl transition-all active:scale-95 disabled:opacity-40 cursor-pointer uppercase block text-center">
            {phase === "done" ? "🃏 PLAY AGAIN" : "🃏 START GAME"}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => guess("higher")} disabled={resolving || hiCount === 0}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm py-4 rounded-2xl transition-all active:scale-95 disabled:opacity-40 cursor-pointer uppercase flex flex-col items-center leading-tight">
              <span>▲ HIGHER</span>
              <span className="text-[10px] font-mono opacity-90">{hiCount === 0 ? "—" : `x${hiMulti.toFixed(2)}`}</span>
            </button>
            <button onClick={() => guess("lower")} disabled={resolving || loCount === 0}
              className="bg-blue-700 hover:bg-blue-600 text-white font-black text-sm py-4 rounded-2xl transition-all active:scale-95 disabled:opacity-40 cursor-pointer uppercase flex flex-col items-center leading-tight">
              <span>▼ LOWER</span>
              <span className="text-[10px] font-mono opacity-90">{loCount === 0 ? "—" : `x${loMulti.toFixed(2)}`}</span>
            </button>
          </div>
          {streak > 0 && (
            <button onClick={cashout}
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs py-2.5 rounded-2xl transition-all active:scale-95 cursor-pointer uppercase block text-center">
              💰 CASHOUT ${formatMoney(pool)} ({(pool/safeStake).toFixed(2)}x)
            </button>
          )}
        </div>
      )}
      <div className="text-[9px] text-slate-600 font-mono text-center">Ties lose • payout scales with card odds • up to {MAX_STEPS} levels • RTP ~97%</div>
    </div>
  );
};
