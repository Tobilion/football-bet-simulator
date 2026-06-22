import React, { useState, useRef } from "react";
import { GameProps, StakeSlider } from "./shared";
import { formatMoney } from "../../utils";

const RED_NUMS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
const BLACK_NUMS = [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35];

type BetType = "number" | "red" | "black" | "odd" | "even" | "1to18" | "19to36" | "dozen1" | "dozen2" | "dozen3" | "col1" | "col2" | "col3";
interface RouletteBet { type: BetType; label: string; payout: number; value?: number; }

const OUTSIDE_BETS: { type: BetType; label: string; payout: number }[] = [
  { type: "red", label: "🔴 RED", payout: 2 },
  { type: "black", label: "⚫ BLACK", payout: 2 },
  { type: "odd", label: "ODD", payout: 2 },
  { type: "even", label: "EVEN", payout: 2 },
  { type: "1to18", label: "1–18", payout: 2 },
  { type: "19to36", label: "19–36", payout: 2 },
  { type: "dozen1", label: "1st 12", payout: 3 },
  { type: "dozen2", label: "2nd 12", payout: 3 },
  { type: "dozen3", label: "3rd 12", payout: 3 },
];

function checkWin(bet: RouletteBet, num: number): boolean {
  if (bet.type === "number") return bet.value === num;
  if (num === 0) return false;
  if (bet.type === "red") return RED_NUMS.includes(num);
  if (bet.type === "black") return BLACK_NUMS.includes(num);
  if (bet.type === "odd") return num % 2 === 1;
  if (bet.type === "even") return num % 2 === 0;
  if (bet.type === "1to18") return num >= 1 && num <= 18;
  if (bet.type === "19to36") return num >= 19 && num <= 36;
  if (bet.type === "dozen1") return num >= 1 && num <= 12;
  if (bet.type === "dozen2") return num >= 13 && num <= 24;
  if (bet.type === "dozen3") return num >= 25 && num <= 36;
  if (bet.type === "col1") return num % 3 === 1;
  if (bet.type === "col2") return num % 3 === 2;
  if (bet.type === "col3") return num % 3 === 0;
  return false;
}

function getNumColor(n: number) {
  if (n === 0) return "bg-emerald-600 text-white";
  if (RED_NUMS.includes(n)) return "bg-red-600 text-white";
  return "bg-slate-900 text-white";
}

export const RouletteGame: React.FC<GameProps> = ({ balance, onUpdateBalance, addLog }) => {
  const [stake, setStake] = useState(() => Math.max(1, Math.min(50, Math.floor(balance))));
  const [selectedBet, setSelectedBet] = useState<RouletteBet>({ type: "red", label: "🔴 RED", payout: 2 });
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [message, setMessage] = useState("Pick a bet type and spin!");
  const [history, setHistory] = useState<number[]>([]);
  const [spinDeg, setSpinDeg] = useState(0);
  const safeStake = Math.max(1, Math.min(stake, Math.max(1, balance)));
  const totalDegRef = useRef(0);

  const spin = () => {
    if (spinning || balance < safeStake) { setMessage("❌ Insufficient balance."); return; }
    onUpdateBalance(p => Math.max(0, p - safeStake));
    setSpinning(true); setResult(null); setMessage("🎡 Spinning...");
    const winNum = Math.floor(Math.random() * 37);
    const extraSpins = 5 + Math.floor(Math.random() * 5);
    const newDeg = totalDegRef.current + extraSpins * 360 + (winNum / 37) * 360;
    totalDegRef.current = newDeg;
    setSpinDeg(newDeg);
    setTimeout(() => {
      setSpinning(false); setResult(winNum);
      setHistory(h => [winNum, ...h].slice(0, 12));
      const won = checkWin(selectedBet, winNum);
      if (won) {
        const payout = safeStake * selectedBet.payout;
        onUpdateBalance(p => p + payout);
        setMessage(`✅ ${winNum}! ${selectedBet.label} wins! +$${formatMoney(payout)} (${selectedBet.payout}x)`);
        addLog("Stadium Roulette", safeStake, selectedBet.payout, "WIN", `${winNum} — ${selectedBet.label}`);
      } else {
        setMessage(`❌ ${winNum} — ${winNum === 0 ? "Zero!" : RED_NUMS.includes(winNum) ? "Red" : "Black"}. ${selectedBet.label} loses.`);
        addLog("Stadium Roulette", safeStake, 0, "LOSS", `${winNum} — ${selectedBet.label} missed`);
      }
    }, 3000);
  };

  const numColor = result !== null ? getNumColor(result) : "";

  return (
    <div className="space-y-4 select-none">
      {/* Wheel visual */}
      <div className="flex justify-center items-center gap-6">
        <div className="relative w-24 h-24 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-amber-500/30 overflow-hidden bg-gradient-to-br from-emerald-900 to-emerald-950">
            <div className="absolute inset-1 rounded-full border-2 border-white/10 flex items-center justify-center"
              style={{ transform: `rotate(${spinDeg}deg)`, transition: spinning ? "transform 3s cubic-bezier(0.17,0.67,0.12,0.99)" : "none" }}>
              <div className="grid grid-cols-6 gap-px p-1">
                {Array.from({ length: 37 }, (_, i) => (
                  <div key={i} className={`w-2.5 h-2.5 rounded-full text-[5px] flex items-center justify-center font-bold ${i === 0 ? "bg-emerald-500" : RED_NUMS.includes(i) ? "bg-red-500" : "bg-slate-800"}`}></div>
                ))}
              </div>
            </div>
          </div>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-0.5 w-0 h-0 border-l-4 border-r-4 border-b-8 border-l-transparent border-r-transparent border-b-amber-400 z-10"></div>
        </div>
        <div className="text-center">
          {result !== null ? (
            <div className={`w-16 h-16 rounded-full ${numColor} border-2 border-white/20 flex flex-col items-center justify-center shadow-xl`}>
              <span className="text-xl font-black">{result}</span>
              <span className="text-[8px] font-bold uppercase">{result === 0 ? "ZERO" : RED_NUMS.includes(result) ? "RED" : "BLACK"}</span>
            </div>
          ) : (
            <div className="w-16 h-16 rounded-full bg-white/5 border-2 border-white/10 flex items-center justify-center">
              <span className="text-slate-500 text-xs font-mono">?</span>
            </div>
          )}
          <div className="mt-2 flex gap-1 flex-wrap justify-center max-w-[120px]">
            {history.slice(0, 8).map((n, i) => (
              <span key={i} className={`text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center ${getNumColor(n)}`}>{n}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Message */}
      <p className="text-xs text-center text-slate-300 bg-white/5 border border-white/5 rounded-xl py-2.5 px-3 font-bold">{message}</p>

      {/* Outside bets */}
      <div>
        <div className="text-[9px] font-mono text-slate-500 uppercase font-bold mb-1.5">OUTSIDE BETS (1:1 / 2:1)</div>
        <div className="grid grid-cols-3 gap-1.5">
          {OUTSIDE_BETS.map(b => (
            <button key={b.type} onClick={() => setSelectedBet(b)} disabled={spinning}
              className={`py-2 text-[10px] font-bold rounded-xl border transition-all cursor-pointer uppercase ${
                selectedBet.type === b.type ? "bg-amber-500/20 border-amber-500 text-amber-400" : "bg-white/3 border-white/5 text-slate-400 hover:border-white/20"
              }`}>
              {b.label}<br/><span className="text-[8px] text-slate-500">{b.payout}x</span>
            </button>
          ))}
        </div>
      </div>

      {/* Number bet */}
      <div>
        <div className="text-[9px] font-mono text-slate-500 uppercase font-bold mb-1.5">STRAIGHT UP NUMBER (35:1)</div>
        <div className="grid grid-cols-9 gap-0.5">
          {Array.from({ length: 37 }, (_, i) => (
            <button key={i} onClick={() => setSelectedBet({ type: "number", label: `#${i}`, payout: 36, value: i })} disabled={spinning}
              className={`h-7 rounded text-[9px] font-black transition-all cursor-pointer ${getNumColor(i)} ${
                selectedBet.type === "number" && selectedBet.value === i ? "ring-2 ring-amber-400 scale-110" : "opacity-70 hover:opacity-100"
              }`}>
              {i}
            </button>
          ))}
        </div>
      </div>

      <StakeSlider balance={balance} stake={safeStake} setStake={setStake} label="BET STAKE" disabled={spinning} />
      <button onClick={spin} disabled={spinning || balance <= 0}
        className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm py-3 rounded-2xl transition-all active:scale-95 disabled:opacity-40 cursor-pointer uppercase tracking-wide block text-center">
        {spinning ? "🎡 Spinning..." : "🎡 SPIN"}
      </button>
      <div className="text-[9px] text-slate-600 font-mono text-center">European single-zero roulette • RTP 97.3%</div>
    </div>
  );
};
