import React, { useState } from "react";
import { GameProps, StakeSlider } from "./shared";
import { formatMoney } from "../../utils";

const TOTAL = 40;
const DRAW = 10;

// Payout table for 10-pick keno (picks=10)
const PAYOUT_TABLE: Record<number, number> = { 0:0,1:0,2:0,3:1,4:2,5:5,6:15,7:50,8:200,9:800,10:5000 };

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
    const pool = Array.from({ length: TOTAL }, (_, i) => i + 1);
    const shuffled = pool.sort(() => Math.random() - 0.5);
    const drawnNums = shuffled.slice(0, DRAW);
    setPhase("revealing");
    const revealed: number[] = [];
    drawnNums.forEach((num, i) => {
      setTimeout(() => {
        revealed.push(num);
        setDrawn([...revealed]);
        if (i === drawnNums.length - 1) {
          const hitCount = drawnNums.filter(n => picks.has(n)).length;
          const multi = PAYOUT_TABLE[Math.min(hitCount, 10)] ?? 0;
          const payout = safeStake * multi;
          if (payout > 0) onUpdateBalance(p => p + payout);
          setHits(hitCount);
          setPhase("done");
          if (multi > 1) {
            setMessage(`🎯 ${hitCount} hits! ${multi}x payout — Win $${formatMoney(payout)}!`);
            addLog("Keno Rush", safeStake, multi, "WIN", `${hitCount}/${picks.size} hits`);
          } else {
            setMessage(`${hitCount} hits from ${picks.size} picks. Better luck next time!`);
            addLog("Keno Rush", safeStake, 0, "LOSS", `${hitCount}/${picks.size} hits`);
          }
        }
      }, i * 150);
    });
  };

  const reset = () => { setPicks(new Set()); setDrawn([]); setPhase("idle"); setHits(0); setMessage("Pick up to 10 numbers then draw!"); };

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

      {/* Payout table */}
      <div className="bg-black/30 border border-white/5 rounded-xl p-2.5 grid grid-cols-6 gap-1 text-center">
        {Object.entries(PAYOUT_TABLE).filter(([k]) => parseInt(k) >= parseInt(picks.size.toString()) - 2).slice(0,6).map(([k, v]) => (
          <div key={k} className={`text-[9px] font-mono ${hits === parseInt(k) && phase === "done" ? "text-emerald-400 font-black" : "text-slate-500"}`}>
            <div className="text-[8px]">{k}H</div>
            <div className="font-bold">{v}x</div>
          </div>
        ))}
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
