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

const STREAK_MULTIPLIERS = [1.5, 2.2, 3.5, 6.0, 12.0, 25.0, 55.0, 120.0];

export const HiLoGame: React.FC<GameProps> = ({ balance, onUpdateBalance, addLog }) => {
  const [stake, setStake] = useState(() => Math.max(1, Math.min(50, Math.floor(balance))));
  const [currentCard, setCurrentCard] = useState<Card | null>(null);
  const [streak, setStreak] = useState(0);
  const [pool, setPool] = useState(0);
  const [message, setMessage] = useState("Click START to flip your first card!");
  const [phase, setPhase] = useState<"idle"|"playing"|"done">("idle");
  const [resolving, setResolving] = useState(false);
  const safeStake = Math.max(1, Math.min(stake, Math.max(1, balance)));

  const startGame = () => {
    if (balance < safeStake) { setMessage("❌ Insufficient balance."); return; }
    onUpdateBalance(p => Math.max(0, p - safeStake));
    const card = randomCard();
    setCurrentCard(card); setStreak(0); setPool(safeStake); setPhase("playing");
    setMessage(`Current card: ${card.val}${card.suit}. Guess — Higher or Lower?`);
  };

  const guess = (dir: "higher" | "lower") => {
    if (phase !== "playing" || !currentCard || resolving) return;
    setResolving(true);
    setTimeout(() => {
      const next = randomCard();
      const curRank = VAL_RANK[currentCard.val];
      const nextRank = VAL_RANK[next.val];
      let correct = false;
      if (dir === "higher" && nextRank > curRank) correct = true;
      if (dir === "lower" && nextRank < curRank) correct = true;
      // Tie = lose
      if (!correct) {
        addLog("Hi-Lo Ladder", safeStake, 0, "LOSS", `Lost on streak ${streak+1}: drew ${next.val}${next.suit}`);
        setMessage(`💔 Drawn ${next.val}${next.suit}! Streak broken at level ${streak+1}. Lost $${formatMoney(safeStake)}.`);
        setCurrentCard(next); setPhase("done"); setResolving(false); return;
      }
      const newStreak = streak + 1;
      const multi = STREAK_MULTIPLIERS[Math.min(newStreak - 1, STREAK_MULTIPLIERS.length - 1)];
      const newPool = safeStake * multi;
      setCurrentCard(next); setStreak(newStreak); setPool(newPool);
      if (newStreak >= 8) {
        onUpdateBalance(p => p + newPool);
        addLog("Hi-Lo Ladder", safeStake, multi, "WIN", `Max streak! ${next.val}${next.suit}`);
        setMessage(`🏆 MAX STREAK! 8 correct! You win $${formatMoney(newPool)} (${multi}x)!`);
        setPhase("done"); setResolving(false); return;
      }
      setMessage(`✅ ${next.val}${next.suit}! Level ${newStreak}/${8} — Pool: $${formatMoney(newPool)} (${multi}x). Continue or Cashout?`);
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
      {/* Streak ladder */}
      <div className="bg-black/40 border border-white/5 rounded-xl p-3">
        <div className="text-[9px] font-mono text-slate-500 uppercase font-bold mb-2">STREAK LADDER</div>
        <div className="flex gap-1.5 flex-wrap">
          {STREAK_MULTIPLIERS.map((m, i) => (
            <div key={i} className={`flex-1 min-w-[3rem] text-center py-1.5 rounded-lg border text-[9px] font-mono font-black transition-all ${
              i < streak ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" :
              i === streak && phase === "playing" ? "bg-amber-500/20 border-amber-500 text-amber-400 animate-pulse" :
              "bg-white/2 border-white/5 text-slate-600"
            }`}>
              <div>L{i+1}</div><div>{m}x</div>
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
            <button onClick={() => guess("higher")} disabled={resolving}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm py-4 rounded-2xl transition-all active:scale-95 disabled:opacity-50 cursor-pointer uppercase">
              ▲ HIGHER
            </button>
            <button onClick={() => guess("lower")} disabled={resolving}
              className="bg-blue-700 hover:bg-blue-600 text-white font-black text-sm py-4 rounded-2xl transition-all active:scale-95 disabled:opacity-50 cursor-pointer uppercase">
              ▼ LOWER
            </button>
          </div>
          {streak > 0 && (
            <button onClick={cashout}
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs py-2.5 rounded-2xl transition-all active:scale-95 cursor-pointer uppercase block text-center">
              💰 CASHOUT ${formatMoney(pool)} ({(pool/safeStake).toFixed(1)}x)
            </button>
          )}
        </div>
      )}
      <div className="text-[9px] text-slate-600 font-mono text-center">Ties lose • 8 levels up to 120x • RTP ~97%</div>
    </div>
  );
};
