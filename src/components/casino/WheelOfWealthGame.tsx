import React, { useState, useRef } from "react";
import { GameProps, StakeSlider } from "./shared";
import { formatMoney } from "../../utils";
import { WHEEL_SEGMENTS as SEGMENTS } from "./constants";

const TOTAL_WEIGHT = SEGMENTS.reduce((s, seg) => s + seg.weight, 0);

function pickSegment(): number {
  let rand = Math.random() * TOTAL_WEIGHT;
  for (let i = 0; i < SEGMENTS.length; i++) {
    rand -= SEGMENTS[i].weight;
    if (rand <= 0) return i;
  }
  return 0;
}

const SEGMENT_ANGLE = 360 / SEGMENTS.length;

export const WheelOfWealthGame: React.FC<GameProps> = ({ balance, onUpdateBalance, addLog }) => {
  const [stake, setStake] = useState(() => Math.max(1, Math.min(50, Math.floor(balance))));
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<typeof SEGMENTS[0] | null>(null);
  const [message, setMessage] = useState("Place stake and SPIN the Wheel of Wealth!");
  const totalRotRef = useRef(0);
  const safeStake = Math.max(1, Math.min(stake, Math.max(1, balance)));

  const spin = () => {
    if (spinning || balance < safeStake) { setMessage("❌ Insufficient balance."); return; }
    onUpdateBalance(-safeStake);
    setSpinning(true); setResult(null); setMessage("🎡 Spinning...");
    const segIdx = pickSegment();
    const seg = SEGMENTS[segIdx];
    // Target angle: center of chosen segment, stopping at pointer (top)
    const segCenter = segIdx * SEGMENT_ANGLE + SEGMENT_ANGLE / 2;
    const spins = 5 + Math.floor(Math.random() * 3);
    const newRot = totalRotRef.current + spins * 360 + (360 - segCenter);
    totalRotRef.current = newRot;
    setRotation(newRot);
    setTimeout(() => {
      setSpinning(false); setResult(seg);
      const payout = safeStake * seg.multiplier;
      onUpdateBalance(payout);
      if (seg.multiplier > 1) {
        setMessage(`✅ ${seg.label}! Win $${formatMoney(payout)} (+$${formatMoney(payout - safeStake)} profit)!`);
        addLog("Wheel of Wealth", safeStake, seg.multiplier, "WIN", `${seg.label} segment`);
      } else if (seg.multiplier === 1) {
        setMessage(`🤝 1x — Stake returned!`);
        addLog("Wheel of Wealth", safeStake, 1, "WIN", "Returned stake");
      } else {
        setMessage(`❌ ${seg.label} — Lost $${formatMoney(safeStake - payout)}${payout > 0 ? ` (got $${formatMoney(payout)} back)` : ""}.`);
        addLog("Wheel of Wealth", safeStake - payout, seg.multiplier, "LOSS", `${seg.label} segment`);
      }
    }, 4000);
  };

  return (
    <div className="space-y-4 select-none">
      {/* Wheel */}
      <div className="flex justify-center items-center relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-20">
          <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-t-[20px] border-l-transparent border-r-transparent border-t-amber-400 drop-shadow-lg"></div>
        </div>
        <div className="relative w-52 h-52 sm:w-64 sm:h-64 rounded-full border-4 border-amber-500/50 shadow-2xl overflow-hidden"
          style={{ transform: `rotate(${rotation}deg)`, transition: spinning ? "transform 4s cubic-bezier(0.1,0.6,0.2,1)" : "none" }}>
          <svg viewBox="0 0 200 200" className="w-full h-full">
            {SEGMENTS.map((seg, i) => {
              const startAngle = (i * SEGMENT_ANGLE - 90) * (Math.PI / 180);
              const endAngle = ((i + 1) * SEGMENT_ANGLE - 90) * (Math.PI / 180);
              const x1 = 100 + 98 * Math.cos(startAngle);
              const y1 = 100 + 98 * Math.sin(startAngle);
              const x2 = 100 + 98 * Math.cos(endAngle);
              const y2 = 100 + 98 * Math.sin(endAngle);
              const midAngle = ((i + 0.5) * SEGMENT_ANGLE - 90) * (Math.PI / 180);
              const tx = 100 + 68 * Math.cos(midAngle);
              const ty = 100 + 68 * Math.sin(midAngle);
              return (
                <g key={i}>
                  <path d={`M100,100 L${x1},${y1} A98,98 0 0,1 ${x2},${y2} Z`} fill={seg.color} stroke="#000" strokeWidth="0.5" />
                  <text x={tx} y={ty} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="9" fontWeight="bold" transform={`rotate(${(i + 0.5) * SEGMENT_ANGLE}, ${tx}, ${ty})`}>
                    {seg.label}
                  </text>
                </g>
              );
            })}
            <circle cx="100" cy="100" r="12" fill="#0f172a" stroke="#f59e0b" strokeWidth="2" />
          </svg>
        </div>
      </div>

      {result && (
        <div className={`text-center py-2 rounded-xl border font-black text-sm ${result.multiplier >= 5 ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : result.multiplier === 0 ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-amber-500/10 border-amber-500/20 text-amber-400"}`}>
          {result.label} → {result.multiplier}x
        </div>
      )}

      <p className="text-xs text-center text-slate-300 bg-white/5 border border-white/5 rounded-xl py-2.5 px-3 font-bold">{message}</p>

      <StakeSlider balance={balance} stake={safeStake} setStake={setStake} disabled={spinning} label="SPIN STAKE" />
      <button onClick={spin} disabled={spinning || balance <= 0}
        className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm py-3 rounded-2xl transition-all active:scale-95 disabled:opacity-40 cursor-pointer uppercase block text-center">
        {spinning ? "🎡 SPINNING..." : "🎡 SPIN THE WHEEL"}
      </button>
      <div className="text-[9px] text-slate-600 font-mono text-center">12 segments • Max 20x • RTP ~96%</div>
    </div>
  );
};
