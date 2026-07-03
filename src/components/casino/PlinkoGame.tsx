import React, { useState } from "react";
import { GameProps, StakeSlider } from "./shared";
import { formatMoney } from "../../utils";

export const PlinkoGame: React.FC<GameProps> = ({ balance, onUpdateBalance, addLog }) => {
  const [stake, setStake] = useState<number>(() => Math.max(1, Math.min(50, Math.floor(balance))));
  const [dropping, setDropping] = useState<boolean>(false);
  const [pegPath, setPegPath] = useState<number[]>([]);
  const [commentary, setCommentary] = useState<string>("Drop a golden chip down the triangle pegboard into payout bins!");

  const bins = [
    { multi: 15.0, label: "15x", color: "bg-red-500/20 border-red-500/40 text-red-400" },
    { multi: 2.0, label: "2x", color: "bg-amber-500/20 border-amber-500/40 text-amber-400" },
    { multi: 1.0, label: "1x", color: "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" },
    { multi: 0.36, label: "0.36x", color: "bg-slate-700/30 border-white/5 text-slate-400" },
    { multi: 0.36, label: "0.36x", color: "bg-slate-700/30 border-white/5 text-slate-400" },
    { multi: 1.0, label: "1x", color: "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" },
    { multi: 2.0, label: "2x", color: "bg-amber-500/20 border-amber-500/40 text-amber-400" },
    { multi: 15.0, label: "15x", color: "bg-red-500/20 border-red-500/40 text-red-400" }
  ];

  const safeStake = Math.max(1, Math.min(stake, Math.max(1, balance)));

  const handleDrop = () => {
    if (dropping) return;
    if (balance < safeStake) {
      setCommentary("❌ Insufficient balance.");
      return;
    }
    onUpdateBalance((prev) => prev - safeStake);
    setDropping(true);
    setPegPath([]);
    setCommentary("Chip is bouncing on the pegboard... watch the drift!");

    const path: number[] = [];
    for (let r = 0; r < 7; r++) {
      path.push(Math.random() < 0.5 ? 0 : 1);
    }

    let step = 0;
    const interval = setInterval(() => {
      setPegPath(path.slice(0, step + 1));
      step += 1;

      if (step >= 7) {
        clearInterval(interval);
        setDropping(false);

        const rightBouncesCount = path.reduce((acc, v) => acc + v, 0);
        const binIdx = Math.min(7, rightBouncesCount);
        const hitBin = bins[binIdx];
        const winPayout = safeStake * hitBin.multi;
        onUpdateBalance((prev) => prev + winPayout);

        setCommentary(`💎 Landed in ${hitBin.label} bin! Return: $${formatMoney(winPayout)}`);
        addLog("Golden Boot Plinko", hitBin.multi >= 1.0 ? safeStake : safeStake * (1 - hitBin.multi), hitBin.multi, hitBin.multi >= 1.0 ? "WIN" : "LOSS", `Landed in ${hitBin.label} slot`);
      }
    }, 280);
  };

  return (
    <div className="space-y-4 select-none">
      <div className="bg-[#05070a] border border-white/5 rounded-2xl p-4 flex flex-col justify-between items-center relative min-h-52">
        <span className="text-[10px] font-mono text-slate-500 absolute top-2 right-2 uppercase">PEGBOARD</span>

        <div className="my-auto space-y-2 text-center w-full max-w-xs flex flex-col items-center py-4">
          {[1, 2, 3, 4, 5, 6].map((row, rIdx) => (
            <div key={rIdx} className="flex justify-center gap-5">
              {Array.from({ length: row }).map((_, pIdx) => {
                const isTraversed = pxMatch(rIdx, pIdx, pegPath);
                return (
                  <span
                    key={pIdx}
                    className={`h-1.5 w-1.5 rounded-full block transition-colors duration-150 ${
                      isTraversed ? "bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)] scale-150" : "bg-slate-700"
                    }`}
                  ></span>
                );
              })}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-8 gap-1 w-full text-center mt-3 pt-3 border-t border-white/5 font-mono">
          {bins.map((bin, bIdx) => (
            <div key={bIdx} className={`py-1.5 rounded text-[9px] font-bold border ${bin.color}`}>
              {bin.label}
            </div>
          ))}
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-slate-300 text-center bg-white/2 p-2.5 rounded-xl border border-white/5 font-mono">{commentary}</p>

      <StakeSlider balance={balance} stake={safeStake} setStake={setStake} disabled={dropping} label="STAKE PLINKO WAGER" />

      <button
        onClick={handleDrop}
        disabled={dropping || balance <= 0}
        className="w-full bg-emerald-500 hover:bg-emerald-400 text-[#05070a] font-sans font-black text-xs py-3.5 rounded-2xl transition-all shadow-lg active:scale-95 disabled:opacity-50 cursor-pointer uppercase tracking-wider block text-center"
      >
        {dropping ? "DROPPING GOLDEN BALL..." : `💎 DROP GOLDEN BALL ($${safeStake.toLocaleString()})`}
      </button>
    </div>
  );
};

function pxMatch(rowIdx: number, pegIdx: number, path: number[]): boolean {
  if (path.length <= rowIdx) return false;
  const pathPart = path.slice(0, rowIdx + 1);
  const positionAccum = pathPart.reduce((acc, v) => acc + v, 0);
  return pegIdx === positionAccum;
}
