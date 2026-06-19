import React, { useState } from "react";
import { GameProps, StakeSlider } from "./shared";

export const SportyMinesGame: React.FC<GameProps> = ({ balance, onUpdateBalance, addLog }) => {
  const [mineCount, setMineCount] = useState<number>(3);
  const [stake, setStake] = useState<number>(() => Math.max(1, Math.min(50, Math.floor(balance))));
  const [inGame, setInGame] = useState<boolean>(false);
  const [grid, setGrid] = useState<{ mine: boolean; revealed: boolean }[]>([]);
  const [revealedCount, setRevealedCount] = useState<number>(0);
  const [multiplier, setMultiplier] = useState<number>(1.0);
  const [commentary, setCommentary] = useState<string>("Set mine density, choose your stake and click START to dig!");
  const [roundOver, setRoundOver] = useState<boolean>(false);

  const totalCells = 25;
  const safeStake = Math.max(1, Math.min(stake, Math.max(1, balance)));

  const getMultiplier = (clicks: number, mines: number) => {
    if (clicks === 0) return 1.0;
    let odds = 1.0;
    for (let i = 0; i < clicks; i++) {
      odds *= (totalCells - i) / (totalCells - mines - i);
    }
    return Math.round(odds * 0.99 * 100) / 100;
  };

  const handleStartGame = () => {
    if (balance < safeStake) {
      setCommentary("❌ Insufficient funds.");
      return;
    }
    onUpdateBalance(balance - safeStake);
    setInGame(true);
    setRoundOver(false);
    setRevealedCount(0);
    setMultiplier(1.0);
    setCommentary(`🎮 SportyMines Active! ${mineCount} explosive mines hidden in the 5x5 pitch. Tap cells!`);

    const minesIdxs = new Set<number>();
    while (minesIdxs.size < mineCount) {
      minesIdxs.add(Math.floor(Math.random() * totalCells));
    }

    const nextGrid = Array.from({ length: totalCells }, (_, index) => ({
      mine: minesIdxs.has(index),
      revealed: false
    }));
    setGrid(nextGrid);
  };

  const handleCellClick = (index: number) => {
    if (!inGame || grid[index].revealed || roundOver) return;

    const cell = grid[index];
    const newGrid = [...grid];
    newGrid[index] = { ...newGrid[index], revealed: true };
    setGrid(newGrid);

    if (cell.mine) {
      const fullyRevealedGrid = newGrid.map(c => ({ ...c, revealed: true }));
      setGrid(fullyRevealedGrid);
      setInGame(false);
      setRoundOver(true);
      setCommentary(`💥 EXPLOSION! You hit a mine! Game over — see where all ${mineCount} mines were hidden.`);
      addLog("SportyMines", safeStake, 0, "LOSS", `Exploded after ${revealedCount} clicks`);
    } else {
      const nextClicks = revealedCount + 1;
      setRevealedCount(nextClicks);
      const nextMulti = getMultiplier(nextClicks, mineCount);
      setMultiplier(nextMulti);

      const remainingSafe = totalCells - mineCount - nextClicks;
      if (remainingSafe === 0) {
        const fullyRevealedGrid = newGrid.map(c => ({ ...c, revealed: true }));
        setGrid(fullyRevealedGrid);
        const winAmount = safeStake * nextMulti;
        onUpdateBalance(balance - safeStake + winAmount);
        setInGame(false);
        setRoundOver(true);
        setCommentary(`🏆 BOARD CLEARANCE! All safe cells revealed! Won $${winAmount.toFixed(2)} (${nextMulti}x)`);
        addLog("SportyMines", safeStake, nextMulti, "WIN", "Full Board Clearance!");
      } else {
        setCommentary(`🟢 SAFE HELMET! Multiplier: ${nextMulti}x. Cash out or keep going!`);
      }
    }
  };

  const handleCashout = () => {
    if (!inGame || revealedCount === 0) return;
    const finalMulti = multiplier;
    const finalPayout = safeStake * finalMulti;
    const fullyRevealedGrid = grid.map(c => ({ ...c, revealed: true }));
    setGrid(fullyRevealedGrid);
    onUpdateBalance(balance + finalPayout);
    setInGame(false);
    setRoundOver(true);
    setCommentary(`💰 SAFE CASHOUT! Secured $${finalPayout.toFixed(2)} at ${finalMulti}x. See the full board reveal!`);
    addLog("SportyMines", safeStake, finalMulti, "WIN", `Safe Cashout at ${finalMulti}x`);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-center select-none">
        <div className="grid grid-cols-5 gap-1.5 bg-black/60 p-3 border border-white/5 rounded-2xl w-full max-w-xs">
          {grid.length === 0 ? (
            Array.from({ length: totalCells }).map((_, index) => (
              <div key={index} className="aspect-square bg-slate-900/60 border border-white/5 rounded-lg flex items-center justify-center text-slate-700 text-[10px] opacity-30">
                {index + 1}
              </div>
            ))
          ) : (
            grid.map((cell, idx) => (
              <button
                key={idx}
                onClick={() => handleCellClick(idx)}
                className={`aspect-square rounded-lg flex items-center justify-center border transition-all text-sm ${
                  cell.revealed
                    ? cell.mine
                      ? "bg-red-700/80 border-red-500 text-white"
                      : "bg-emerald-500/20 border-emerald-500/60 text-emerald-400"
                    : inGame
                    ? "bg-slate-800 border-white/10 hover:border-emerald-500/50 hover:bg-slate-700 text-slate-300 cursor-pointer"
                    : "bg-slate-900/40 border-white/5 text-slate-600 cursor-default"
                }`}
              >
                {cell.revealed ? (
                  cell.mine ? "💣" : "🪖"
                ) : (
                  <span className="text-[9px] font-mono text-slate-500">{idx + 1}</span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-slate-300 text-center bg-white/2 p-2.5 rounded-xl border border-white/5 select-none font-mono">{commentary}</p>

      {!inGame && (
        <div className="space-y-3">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-500 font-mono block">MINE DENSITY (5×5 grid)</span>
            <div className="flex gap-1.5">
              {[2, 3, 5, 8].map(density => (
                <button
                  key={density}
                  onClick={() => setMineCount(density)}
                  className={`flex-1 py-2 px-2 rounded-xl border text-xs font-mono font-bold transition-all ${
                    mineCount === density
                      ? "bg-amber-500/20 border-amber-500 text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.15)]"
                      : "bg-white/2 border-white/5 text-slate-400 hover:border-white/10 cursor-pointer"
                  }`}
                >
                  <div>{density} 💣</div>
                  <div className="text-[8px] font-mono text-slate-500 mt-0.5">
                    ~{getMultiplier(3, density).toFixed(1)}x@3
                  </div>
                </button>
              ))}
            </div>
          </div>

          <StakeSlider balance={balance} stake={safeStake} setStake={setStake} disabled={inGame} label="STAKE AMOUNT" />
        </div>
      )}

      {inGame ? (
        <>
          <div className="bg-black/30 border border-white/5 rounded-xl p-2.5 flex justify-between text-xs font-mono">
            <span>Revealed: <b className="text-emerald-400">{revealedCount}</b> safe cells</span>
            <span>Cashout: <b className="text-emerald-400">${(safeStake * multiplier).toFixed(2)} ({multiplier}x)</b></span>
          </div>
          <button
            onClick={handleCashout}
            disabled={revealedCount === 0}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-[#05070a] font-sans font-black text-xs py-3.5 rounded-2xl transition-all shadow-lg active:scale-95 disabled:opacity-50 cursor-pointer uppercase tracking-wider"
          >
            💰 CASHOUT NOW (${(safeStake * multiplier).toFixed(2)})
          </button>
        </>
      ) : (
        <button
          onClick={handleStartGame}
          disabled={balance <= 0}
          className="w-full bg-blue-500 hover:bg-blue-400 text-white font-sans font-black text-xs py-3.5 rounded-2xl transition-all shadow-lg active:scale-95 disabled:opacity-50 cursor-pointer uppercase tracking-wider"
        >
          💣 START SOCCERMINES (${safeStake.toLocaleString()})
        </button>
      )}
    </div>
  );
};
