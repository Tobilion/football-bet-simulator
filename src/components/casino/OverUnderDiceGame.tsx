import React, { useState } from "react";
import { GameProps, StakeSlider } from "./shared";

export const OverUnderDiceGame: React.FC<GameProps> = ({ balance, onUpdateBalance, addLog }) => {
  const [stake, setStake] = useState<number>(() => Math.max(1, Math.min(50, Math.floor(balance))));
  const [targetMode, setTargetMode] = useState<"OVER_7" | "UNDER_7" | "EQUAL_7">("OVER_7");
  const [rolling, setRolling] = useState<boolean>(false);
  const [diceVals, setDiceVals] = useState<number[]>([3, 4]);
  const [commentary, setCommentary] = useState<string>("Pick Over/Under/Exact 7, set wager and click ROLL to duel!");

  const safeStake = Math.max(1, Math.min(stake, Math.max(1, balance)));

  const handleRoll = () => {
    if (rolling) return;
    if (balance < safeStake) {
      setCommentary("❌ Insufficient balance.");
      return;
    }
    onUpdateBalance((prev) => prev - safeStake);
    setRolling(true);
    setCommentary("Rolling dice cups...");

    setTimeout(() => {
      setRolling(false);

      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      const sum = d1 + d2;
      setDiceVals([d1, d2]);

      let success = false;
      let multiplier = 2.4;

      if (targetMode === "OVER_7") {
        success = sum > 7;
        multiplier = 2.4;
      } else if (targetMode === "UNDER_7") {
        success = sum < 7;
        multiplier = 2.4;
      } else {
        success = sum === 7;
        multiplier = 6.5;
      }

      if (success) {
        const winVal = safeStake * multiplier;
        onUpdateBalance((prev) => prev + winVal);
        setCommentary(`🎉 ${d1} + ${d2} = ${sum} — ${targetMode.replace("_", " ")} HIT! Won $${winVal.toFixed(2)} (${multiplier}x)!`);
        addLog("Over/Under Dice", safeStake, multiplier, "WIN", `Sum was ${sum} (Guessed ${targetMode})`);
      } else {
        setCommentary(`💔 ${d1} + ${d2} = ${sum} — ${targetMode.replace("_", " ")} MISSED!`);
        addLog("Over/Under Dice", safeStake, 0, "LOSS", `Sum was ${sum} (Guessed ${targetMode})`);
      }
    }, 1100);
  };

  const DICE_FACES: Record<number, string> = {
    1: "⚀", 2: "⚁", 3: "⚂", 4: "⚃", 5: "⚄", 6: "⚅"
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#05070a] border border-white/5 rounded-2xl p-5 flex justify-center gap-6 select-none relative">
        <span className="text-[10px] font-mono text-slate-500 absolute top-2 left-2 uppercase">Duel Dice Cup</span>
        {diceVals.map((val, index) => (
          <div
            key={index}
            className={`h-20 w-20 rounded-2xl bg-gradient-to-br from-[#121824] to-[#05070a] border-2 border-emerald-500/20 shadow-md flex items-center justify-center font-black text-4xl font-mono transition-all duration-300 ${
              rolling ? "rotate-12 animate-pulse scale-90 border-amber-500" : ""
            }`}
          >
            {rolling ? "🎲" : DICE_FACES[val] ?? val}
          </div>
        ))}
        {!rolling && (
          <div className="absolute bottom-3 left-0 right-0 text-center">
            <span className="text-[10px] font-mono text-slate-400">Sum: <b className="text-white">{diceVals[0] + diceVals[1]}</b></span>
          </div>
        )}
      </div>

      <p className="text-[11px] leading-relaxed text-slate-300 text-center bg-white/2 p-2.5 rounded-xl border border-white/5 select-none font-mono">{commentary}</p>

      <div className="grid grid-cols-3 gap-2 shrink-0 select-none">
        {(["UNDER_7", "EQUAL_7", "OVER_7"] as const).map(mode => {
          const isActive = targetMode === mode;
          const multi = mode === "EQUAL_7" ? "6.5x" : "2.4x";
          const label = mode === "UNDER_7" ? "UNDER 7" : mode === "EQUAL_7" ? "EXACTLY 7" : "OVER 7";
          const activeStyle = mode === "UNDER_7"
            ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
            : mode === "EQUAL_7"
            ? "bg-amber-500/25 border-amber-500 text-amber-400"
            : "bg-sky-500/20 border-sky-500 text-sky-400";
          return (
            <button
              key={mode}
              onClick={() => setTargetMode(mode)}
              disabled={rolling}
              className={`py-3 rounded-2xl font-sans font-bold text-xs border transition-all active:scale-95 cursor-pointer flex flex-col items-center ${
                isActive ? activeStyle : "bg-[#0b0e14] border-white/5 text-slate-400 hover:border-white/10"
              }`}
            >
              <span>{label}</span>
              <span className="text-[8px] font-mono text-slate-500 mt-1">{multi} Pays</span>
            </button>
          );
        })}
      </div>

      <StakeSlider balance={balance} stake={safeStake} setStake={setStake} disabled={rolling} label="STAKE AMOUNT" />

      <button
        onClick={handleRoll}
        disabled={rolling || balance <= 0}
        className="w-full bg-emerald-500 hover:bg-emerald-400 text-[#05070a] font-sans font-black text-xs py-3.5 rounded-2xl transition-all shadow-lg active:scale-95 disabled:opacity-50 cursor-pointer uppercase tracking-wider block text-center"
      >
        {rolling ? "ROLLING DICE..." : `🎲 ROLL DUEL DICE ($${safeStake.toLocaleString()})`}
      </button>
    </div>
  );
};
