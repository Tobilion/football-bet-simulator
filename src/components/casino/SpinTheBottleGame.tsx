import React, { useState } from "react";
import { GameProps, StakeSlider } from "./shared";
import { formatMoney } from "../../utils";

export const SpinTheBottleGame: React.FC<GameProps> = ({ balance, onUpdateBalance, addLog }) => {
  const [stake, setStake] = useState<number>(() => Math.max(1, Math.min(50, Math.floor(balance))));
  const [betSide, setBetSide] = useState<"UP" | "DOWN">("UP");
  const [spinning, setSpinning] = useState<boolean>(false);
  const [rotationDegrees, setRotationDegrees] = useState<number>(0);
  const [result, setResult] = useState<"UP" | "DOWN" | "FREEZE" | null>(null);
  const [commentary, setCommentary] = useState<string>("Tap Spin to rotate the championship bottle. Center freeze carries a 2% house advantage.");

  const safeStake = Math.max(1, Math.min(stake, Math.max(1, balance)));

  const handleSpin = () => {
    if (spinning) return;
    if (balance < safeStake) {
      setCommentary("❌ Insufficient balance.");
      return;
    }
    onUpdateBalance((prev) => prev - safeStake);
    setSpinning(true);
    setResult(null);
    setCommentary("Champagne cork is loose... Spinning the bottle at hyper-speed!");

    // Ensure we always spin forward from the current rotation
    const baseDegrees = rotationDegrees - (rotationDegrees % 360);
    const extraCycles = (5 + Math.floor(Math.random() * 5)) * 360;
    const targetSpinDegrees = baseDegrees + extraCycles;
    setRotationDegrees(targetSpinDegrees);

    setTimeout(() => {
      setSpinning(false);

      const rand = Math.random() * 100;
      let finalRes: "UP" | "DOWN" | "FREEZE";
      let offsetDeg = 0;

      if (rand < 2.0) {
        finalRes = "FREEZE";
        offsetDeg = Math.random() < 0.5 ? 90 : 270;
      } else if (rand < 51.0) {
        finalRes = "UP";
        offsetDeg = (Math.random() * 80) - 40;
      } else {
        finalRes = "DOWN";
        offsetDeg = 180 + (Math.random() * 80 - 40);
      }

      setRotationDegrees(targetSpinDegrees + offsetDeg);
      setResult(finalRes);

      if (finalRes === "FREEZE") {
        setCommentary("❄️ UNFORTUNATE! The bottle froze on the center line! You lose your stake! 🏠 HOUSE WINS!!");
        addLog("Spin the Bottle", safeStake, 0, "LOSS", "Center Freeze — you lose");
      } else if (finalRes === betSide) {
        const payout = safeStake * 1.98;
        onUpdateBalance((prev) => prev + payout);
        setCommentary(`🎉 EXCELLENT! Bottle nozzle points ${finalRes}! You won $${formatMoney(payout)} (1.98x)!`);
        addLog("Spin the Bottle", safeStake, 1.98, "WIN", `Nozzle pointed ${finalRes}`);
      } else {
        setCommentary(`💔 MISSED! Nozzle points ${finalRes}, but you backed ${betSide}.`);
        addLog("Spin the Bottle", safeStake, 0, "LOSS", `Nozzle pointed ${finalRes}`);
      }
    }, 1800);
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#070b11] border border-white/5 rounded-2xl p-6 flex flex-col items-center justify-center relative overflow-hidden h-56 select-none">
        <div className="absolute inset-x-0 top-0 h-1/2 bg-emerald-500/5 border-b border-white/5 flex items-start justify-center pt-2">
          <span className="text-[9px] font-mono font-bold tracking-widest text-emerald-500/60">UPPER GREEN ZONE</span>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-blue-500/5 flex items-end justify-center pb-2">
          <span className="text-[9px] font-mono font-bold tracking-widest text-blue-500/60">LOWER BLUE ZONE</span>
        </div>
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[1px] bg-red-500/20 border-t border-dashed border-red-500/35"></div>

        <div
          className="relative z-10 transition-transform duration-[1800ms] ease-out flex items-center justify-center"
          style={{ transform: `rotate(${rotationDegrees}deg)` }}
        >
          <svg width="40" height="120" viewBox="0 0 40 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-[0_0_12px_rgba(16,185,129,0.3)]">
            <rect x="17" y="2" width="6" height="8" rx="1.5" fill="#c09268" />
            <path d="M15 10H25V35L28 42H12L15 10Z" fill="#b89a24" />
            <rect x="16" y="14" width="8" height="14" fill="#0c4a23" />
            <path d="M11 42H29C34 42 36 47 36 53V112C36 116 32 118 28 118H12C8 118 4 116 4 112V53C4 47 6 42 11 42Z" fill="#042a12" stroke="#10b981" strokeWidth="2.5" />
            <rect x="8" y="58" width="24" height="34" rx="2" fill="#dfbb33" />
            <circle cx="20" cy="75" r="5" fill="#000000" />
            <polygon points="20,0 24,14 16,14" fill="#10b981" />
          </svg>
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-slate-300 text-center bg-white/2 p-2.5 rounded-xl border border-white/5 select-none">{commentary}</p>

      <div className="grid grid-cols-2 gap-3 shrink-0">
        <button
          onClick={() => setBetSide("UP")}
          disabled={spinning}
          className={`py-3 rounded-2xl font-sans font-bold text-xs border transition-all active:scale-95 cursor-pointer flex flex-col items-center ${
            betSide === "UP" ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : "bg-white/2 border-white/5 text-slate-400 hover:border-white/10"
          }`}
        >
          <span className="font-sans font-black">BACK UPPER</span>
          <span className="text-[9px] font-mono text-slate-400 mt-1 uppercase">Green Sector</span>
        </button>
        <button
          onClick={() => setBetSide("DOWN")}
          disabled={spinning}
          className={`py-3 rounded-2xl font-sans font-bold text-xs border transition-all active:scale-95 cursor-pointer flex flex-col items-center ${
            betSide === "DOWN" ? "bg-blue-500/20 border-blue-500 text-blue-400" : "bg-white/2 border-white/5 text-slate-400 hover:border-white/10"
          }`}
        >
          <span className="font-sans font-black">BACK LOWER</span>
          <span className="text-[9px] font-mono text-slate-400 mt-1 uppercase">Blue Sector</span>
        </button>
      </div>

      <StakeSlider balance={balance} stake={safeStake} setStake={setStake} disabled={spinning} label="STAKE WAGER" />

      <button
        onClick={handleSpin}
        disabled={spinning || balance <= 0}
        className="w-full bg-emerald-500 hover:bg-emerald-400 text-[#05070a] font-sans font-black text-xs py-3.5 rounded-2xl transition-all shadow-lg active:scale-95 disabled:opacity-50 cursor-pointer uppercase tracking-wider block text-center"
      >
        {spinning ? "SPINNING..." : `🍾 SPIN BOTTLE ($${safeStake.toLocaleString()})`}
      </button>
    </div>
  );
};
