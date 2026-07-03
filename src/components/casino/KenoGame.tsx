import React, { useState } from "react";
import { GameProps, StakeSlider } from "./shared";
import { formatMoney } from "../../utils";

const TOTAL = 40;
const DRAW = 10;

// Pay tables keyed by how many numbers the player picked, then by how many hit.
// Each table is tuned so its expected return is < 1 (house-favorable) — verified in tests.
// Picking fewer numbers now has its own honest table instead of the old fixed 10-pick table
// (which made small tickets mathematically unable to win).
const KENO_PAYOUTS: Record<number, Record<number, number>> = {
  1: { 1: 3 },
  2: { 2: 13 },
  3: { 2: 1, 3: 45 },
  4: { 3: 6, 4: 130 },
  5: { 3: 3, 4: 20, 5: 400 },
  6: { 3: 2, 4: 12, 5: 90, 6: 1000 },
  7: { 4: 5, 5: 35, 6: 220, 7: 1800 },
  8: { 4: 3, 5: 20, 6: 110, 7: 700, 8: 3000 },
  9: { 4: 2, 5: 10, 6: 55, 7: 320, 8: 1500, 9: 4500 },
  10: { 5: 5, 6: 28, 7: 130, 8: 600, 9: 2200, 10: 5000 },
};

// Unbiased Fisher-Yates shuffle (the old `.sort(() => Math.random() - 0.5)` is biased).
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const KenoGame: React.FC<GameProps> = ({ balance, onUpdateBalance, addLog }) => {
  const [stake, setStake] = useState(() => Math.max(1, Math.min(50, Math.floor(balance))));
  const [picks, setPicks] = useState<Set<number>>(new Set());
  const [drawn, setDrawn] = useState<number[]>([]);
  const [phase, setPhase] = useState<"idle"|"revealing"|"done">("idle");
  const [hits, setHits] = useState(0);
  const [message, setMessage] = useState("Pick up to 10 numbers then draw!");
  const safeStake = Math.max(1, Math.min(stake, Math.max(1, balance)));

  const togglePick = (n: number) => {
    if (phase !== "idle") return;
    setPicks(prev => {
      const next = new Set(prev);
      if (next.has(n)) { next.delete(n); return next; }
      if (next.size >= 10) return prev;
      next.add(n); return next;
    });
  };

  const draw = () => {
    if (picks.size === 0) { setMessage("Pick at least 1 number first!"); return; }
    if (balance < safeStake) { setMessage("❌ Insufficient balance."); return; }
    onUpdateBalance(p => Math.max(0, p - safeStake));
    const pickCount = picks.size;
    const pool = Array.from({ length: TOTAL }, (_, i) => i + 1);
    const drawnNums = shuffle(pool).slice(0, DRAW);
    setPhase("revealing");
    const revealed: number[] = [];
    drawnNums.forEach((num, i) => {
      setTimeout(() => {
        revealed.push(num);
        setDrawn([...revealed]);
        if (i === drawnNums.length - 1) {
          const hitCount = drawnNums.filter(n => picks.has(n)).length;
          const table = KENO_PAYOUTS[pickCount] ?? {};
          const multi = table[hitCount] ?? 0;
          const payout = safeStake * multi;
          if (payout > 0) onUpdateBalance(p => p + payout);
          setHits(hitCount);
          setPhase("done");
          if (multi > 0) {
            setMessage(`🎯 ${hitCount} hits! ${multi}x payout — Win $${formatMoney(payout)}!`);
            addLog("Keno Rush", safeStake, multi, "WIN", `${hitCount}/${pickCount} hits`);
          } else {
            setMessage(`${hitCount} hits from ${pickCount} picks. Better luck next time!`);
            addLog("Keno Rush", safeStake, 0, "LOSS", `${hitCount}/${pickCount} hits`);
          }
        }
      }, i * 150);
    });
  };

  const reset = () => { setPicks(new Set()); setDrawn([]); setPhase("idle"); setHits(0); setMessage("Pick up to 10 numbers then draw!"); };

  const activeTable = KENO_PAYOUTS[picks.size || 10] ?? {};

  return (
    <div className="space-y-3 select-none">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">PICKS: {picks.size}/10</span>
        {phase === "done" && <span className={`text-[10px] font-mono font-bold ${hits >= 5 ? "text-emerald-400" : "text-slate-400"}`}>HITS: {hits}/{picks.size}</span>}
      </div>

      {/* Number grid */}
      <div className="grid grid-cols-8 gap-1">
        {Array.from({ length: TOTAL }, (_, i) => i + 1).map(n => {
          const isPick = picks.has(n);
          const isDrawn = drawn.includes(n);
          const isHit = isPick && isDrawn;
          return (
            <button key={n} onClick={() => togglePick(n)} disabled={phase !== "idle"}
              className={`h-8 sm:h-9 rounded-lg text-[11px] font-black transition-all active:scale-90 ${
                isHit ? "bg-emerald-500 text-white ring-2 ring-emerald-400 scale-110" :
                isDrawn ? "bg-red-700/60 text-red-300 border border-red-500/30" :
                isPick ? "bg-amber-500/30 border-2 border-amber-500 text-amber-400" :
                "bg-white/5 border border-white/8 text-slate-400 hover:bg-white/10 cursor-pointer"
              }`}>
              {n}
            </button>
          );
        })}
      </div>

      {/* Payout table for current pick count */}
      <div className="bg-black/30 border border-white/5 rounded-xl p-2.5">
        <div className="text-[8px] font-mono text-slate-500 uppercase mb-1.5 text-center">Payouts for {picks.size || 10}-pick ticket</div>
        <div className="grid grid-cols-6 gap-1 text-center">
          {Object.entries(activeTable).map(([k, v]) => (
            <div key={k} className={`text-[9px] font-mono ${hits === parseInt(k) && phase === "done" ? "text-emerald-400 font-black" : "text-slate-500"}`}>
              <div className="text-[8px]">{k}H</div>
              <div className="font-bold">{v}x</div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-center text-slate-300 bg-white/5 border border-white/5 rounded-xl py-2 px-3 font-bold">{message}</p>

      <StakeSlider balance={balance} stake={safeStake} setStake={setStake} disabled={phase !== "idle"} label="TICKET STAKE" />

      {phase === "idle" ? (
        <button onClick={draw} disabled={picks.size === 0 || balance <= 0}
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm py-3 rounded-2xl transition-all active:scale-95 disabled:opacity-40 cursor-pointer uppercase block text-center">
          🎰 DRAW {DRAW} NUMBERS
        </button>
      ) : phase === "done" ? (
        <button onClick={reset}
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm py-3 rounded-2xl transition-all active:scale-95 cursor-pointer uppercase block text-center">
          🔄 NEW TICKET
        </button>
      ) : (
        <div className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 text-center text-xs text-amber-400 font-mono animate-pulse">
          Drawing numbers...
        </div>
      )}
      <div className="text-[9px] text-slate-600 font-mono text-center">Pick 1–10 • 10 drawn from 40 • Max 5000x on 10/10</div>
    </div>
  );
};
