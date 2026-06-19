import React, { useState } from "react";
import { GameProps, StakeSlider } from "./shared";

export const FootballSlotsGame: React.FC<GameProps> = ({ balance, onUpdateBalance, addLog }) => {
  const [stake, setStake] = useState<number>(() => Math.max(1, Math.min(50, Math.floor(balance))));
  const [reels, setReels] = useState<string[]>(["Cup", "Boot", "Ball"]);
  const [spinning, setSpinning] = useState<boolean>(false);
  const [commentary, setCommentary] = useState<string>("Click SPIN below to trigger high-fidelity football slot reels!");

  const symbolsSet = ["Cup", "Boot", "Ball", "Whistle", "Card"];
  const weightsSet = ["🏆", "👟", "⚽", "📯", "🟨"];

  const safeStake = Math.max(1, Math.min(stake, Math.max(1, balance)));

  const handleSpin = () => {
    if (spinning) return;
    if (balance < safeStake) {
      setCommentary("❌ Insufficient balance.");
      return;
    }
    onUpdateBalance(balance - safeStake);
    setSpinning(true);
    setCommentary("Football slot reels are rotating fast...");

    setTimeout(() => {
      setSpinning(false);

      const r1 = symbolsSet[Math.floor(Math.random() * symbolsSet.length)];
      const r2 = symbolsSet[Math.floor(Math.random() * symbolsSet.length)];
      const r3 = symbolsSet[Math.floor(Math.random() * symbolsSet.length)];
      const resultReels = [r1, r2, r3];
      setReels(resultReels);

      if (r1 === r2 && r2 === r3) {
        let multi = 15.0;
        if (r1 === "Cup") multi = 100.0;
        else if (r1 === "Boot") multi = 50.0;
        else if (r1 === "Ball") multi = 30.0;
        else if (r1 === "Whistle") multi = 20.0;

        const winVal = safeStake * multi;
        onUpdateBalance(balance - safeStake + winVal);
        setCommentary(`🎉 MEGA WIN! 3×${r1}! Won $${winVal.toFixed(2)} (${multi}x)!`);
        addLog("Football Slots", safeStake, multi, "WIN", `Hit 3 of a kind: ${r1}`);
      } else if (r1 === r2 || r2 === r3 || r1 === r3) {
        const matchedSym = r1 === r2 ? r1 : (r2 === r3 ? r2 : r3);
        const multi = 3.0;
        const winVal = safeStake * multi;
        onUpdateBalance(balance - safeStake + winVal);
        setCommentary(`🎉 WIN! Two-of-a-kind ${matchedSym}! Won $${winVal.toFixed(2)} (${multi}x)!`);
        addLog("Football Slots", safeStake, multi, "WIN", `Matched 2: ${matchedSym}`);
      } else {
        setCommentary("💔 No matching lines. Try another spin to hit the Cup jackpot (100x)!");
        addLog("Football Slots", safeStake, 0, "LOSS", "No matching lines");
      }
    }, 1100);
  };

  const getSymbolChar = (id: string) => {
    const idx = symbolsSet.indexOf(id);
    return idx !== -1 ? weightsSet[idx] : "⚽";
  };

  return (
    <div className="space-y-4">
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

      <div className="bg-black/30 border border-white/5 rounded-xl p-2.5 grid grid-cols-4 gap-1 text-center select-none">
        {[["3×Cup", "100x"], ["3×Boot", "50x"], ["3×Ball", "30x"], ["2×Any", "3x"]].map(([label, val]) => (
          <div key={label} className="bg-white/2 rounded-lg py-1.5 px-1">
            <div className="text-[9px] text-slate-400 font-mono">{label}</div>
            <div className="text-[11px] font-black text-amber-400 font-mono mt-0.5">{val}</div>
          </div>
        ))}
      </div>

      <p className="text-[11px] leading-relaxed text-slate-300 text-center bg-white/2 p-2.5 rounded-xl border border-white/5 select-none font-mono">{commentary}</p>

      <StakeSlider balance={balance} stake={safeStake} setStake={setStake} disabled={spinning} label="STAKE SLOTS AMOUNT" />

      <button
        onClick={handleSpin}
        disabled={spinning || balance <= 0}
        className="w-full bg-emerald-500 hover:bg-emerald-400 text-[#05070a] font-sans font-black text-xs py-3.5 rounded-2xl transition-all shadow-lg active:scale-95 disabled:opacity-50 cursor-pointer uppercase tracking-wider block text-center"
      >
        {spinning ? "SPINNING REELS..." : `🎰 SPIN REEL ($${safeStake.toLocaleString()})`}
      </button>
    </div>
  );
};
