import React, { useState } from "react";
import { GameProps, StakeSlider } from "./shared";
import { formatMoney } from "../../utils";

const SYMBOLS = ["⚽","🏆","🥅","🎽","👟","🥋","🎯","💎","👑","⭐"];
// Prize table: match 3 of a symbol → prize multiplier
const PRIZE_TABLE: Record<string,number> = { "💎": 50, "👑": 30, "⭐": 20, "🏆": 10, "⚽": 5, "🥅": 3, "🎯": 2, "🎽": 1.5, "👟": 1, "🥋": 0 };

function genCard(): string[] {
  const cells: string[] = [];
  // Plant some wins
  const hasWin = Math.random() < 0.45;
  if (hasWin) {
    const winSym = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    const winPositions = new Set<number>();
    while (winPositions.size < 3) winPositions.add(Math.floor(Math.random() * 9));
    for (let i = 0; i < 9; i++) cells.push(winPositions.has(i) ? winSym : SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
  } else {
    for (let i = 0; i < 9; i++) cells.push(SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
  }
  return cells;
}

function checkPrize(card: string[]): { symbol: string; count: number; multiplier: number } | null {
  const counts: Record<string, number> = {};
  card.forEach(s => { counts[s] = (counts[s] || 0) + 1; });
  let best: { symbol: string; count: number; multiplier: number } | null = null;
  for (const [sym, cnt] of Object.entries(counts)) {
    if (cnt >= 3) {
      const multi = (PRIZE_TABLE[sym] ?? 0);
      if (!best || multi > best.multiplier) best = { symbol: sym, count: cnt, multiplier: multi };
    }
  }
  return best;
}

export const ScratchCardGame: React.FC<GameProps> = ({ balance, onUpdateBalance, addLog }) => {
  const [stake, setStake] = useState(() => Math.max(1, Math.min(50, Math.floor(balance))));
  const [card, setCard] = useState<string[]>([]);
  const [revealed, setRevealed] = useState<boolean[]>(Array(9).fill(false));
  const [phase, setPhase] = useState<"idle"|"scratching"|"done">("idle");
  const [message, setMessage] = useState("Buy a scratch card and reveal the symbols!");
  const safeStake = Math.max(1, Math.min(stake, Math.max(1, balance)));

  const buyCard = () => {
    if (balance < safeStake) { setMessage("❌ Insufficient balance."); return; }
    onUpdateBalance(p => Math.max(0, p - safeStake));
    const newCard = genCard();
    setCard(newCard); setRevealed(Array(9).fill(false));
    setPhase("scratching"); setMessage("Tap cells to scratch!");
  };

  const scratch = (i: number) => {
    if (phase !== "scratching" || revealed[i]) return;
    const newRev = [...revealed]; newRev[i] = true; setRevealed(newRev);
    if (newRev.every(r => r)) {
      const prize = checkPrize(card);
      setPhase("done");
      if (prize && prize.multiplier > 0) {
        const payout = safeStake * prize.multiplier;
        onUpdateBalance(p => p + payout);
        setMessage(`🎉 ${prize.symbol} x${prize.count}! WIN $${formatMoney(payout)} (${prize.multiplier}x)!`);
        addLog("Scratch & Score", safeStake, prize.multiplier, "WIN", `${prize.symbol} triple match`);
      } else {
        setMessage(`No match. Better luck next card!`);
        addLog("Scratch & Score", safeStake, 0, "LOSS", "No matching symbols");
      }
    } else {
      const revCount = newRev.filter(Boolean).length;
      setMessage(`${revCount}/9 scratched... keep going!`);
    }
  };

  const revealAll = () => {
    if (phase !== "scratching") return;
    const newRev = Array(9).fill(true); setRevealed(newRev);
    const prize = checkPrize(card);
    setPhase("done");
    if (prize && prize.multiplier > 0) {
      const payout = safeStake * prize.multiplier;
      onUpdateBalance(p => p + payout);
      setMessage(`🎉 ${prize.symbol} x${prize.count}! WIN $${formatMoney(payout)} (${prize.multiplier}x)!`);
      addLog("Scratch & Score", safeStake, prize.multiplier, "WIN", `${prize.symbol} triple`);
    } else {
      setMessage("No match. Try again!");
      addLog("Scratch & Score", safeStake, 0, "LOSS", "No match");
    }
  };

  return (
    <div className="space-y-4 select-none">
      {/* Prize legend */}
      <div className="grid grid-cols-5 gap-1">
        {Object.entries(PRIZE_TABLE).filter(([,v]) => v > 0).slice(0,5).map(([sym, v]) => (
          <div key={sym} className="bg-white/3 border border-white/5 rounded-lg p-1.5 text-center">
            <div className="text-lg">{sym}</div>
            <div className="text-[9px] font-mono text-emerald-400 font-bold">{v}x</div>
          </div>
        ))}
      </div>

      {/* Scratch grid */}
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 9 }, (_, i) => (
          <button key={i} onClick={() => scratch(i)} disabled={phase !== "scratching" || revealed[i]}
            className={`aspect-square rounded-xl border text-2xl sm:text-3xl flex items-center justify-center transition-all active:scale-90 ${
              revealed[i] ? "bg-white/5 border-white/10 cursor-default" :
              phase === "scratching" ? "bg-amber-900/30 border-amber-500/40 hover:bg-amber-800/40 cursor-pointer animate-pulse" :
              "bg-white/3 border-white/5 cursor-default"
            }`}>
            {revealed[i] ? (card[i] || "") : (phase === "scratching" ? "🪙" : "")}
          </button>
        ))}
      </div>

      <p className={`text-xs text-center font-bold py-2.5 px-3 rounded-xl border leading-snug ${
        phase === "done" && message.includes("WIN") ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
        phase === "done" ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-white/5 border-white/5 text-slate-300"
      }`}>{message}</p>

      {phase === "idle" || phase === "done" ? (
        <div className="space-y-3">
          <StakeSlider balance={balance} stake={safeStake} setStake={setStake} label="CARD PRICE" />
          <button onClick={buyCard} disabled={balance <= 0}
            className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm py-3 rounded-2xl transition-all active:scale-95 disabled:opacity-40 cursor-pointer uppercase block text-center">
            🪙 {phase === "done" ? "BUY NEW CARD" : "BUY SCRATCH CARD"}
          </button>
        </div>
      ) : (
        <button onClick={revealAll}
          className="w-full bg-white/10 hover:bg-white/15 border border-white/10 text-slate-200 font-bold text-xs py-2.5 rounded-2xl transition-all active:scale-95 cursor-pointer uppercase block text-center">
          🎴 REVEAL ALL
        </button>
      )}
      <div className="text-[9px] text-slate-600 font-mono text-center">Match 3+ symbols • 45% win rate • Max 50x on 💎</div>
    </div>
  );
};
