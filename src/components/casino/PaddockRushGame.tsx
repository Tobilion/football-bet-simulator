import React, { useState, useRef, useEffect } from "react";
import { GameProps, StakeSlider } from "./shared";

export const PaddockRushGame: React.FC<GameProps> = ({
  balance,
  onUpdateBalance,
  addLog,
}) => {
  const [stake, setStake] = useState<number>(() =>
    Math.max(1, Math.min(50, Math.floor(balance))),
  );
  const [isLive, setIsLive] = useState<boolean>(false);
  const [multiplier, setMultiplier] = useState<number>(1.0);
  const [isCrashed, setIsCrashed] = useState<boolean>(false);
  const [isCashedOut, setIsCashedOut] = useState<boolean>(false);
  const [commentary, setCommentary] = useState<string>(
    "Click Launch to start. Cash out before the mascot collapses with the ball!",
  );

  const multiplierRef = useRef<number>(1.0);
  const animFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const crashLimitRef = useRef<number>(1.0);
  const stakeRef = useRef<number>(1);
  const isStartingRef = useRef<boolean>(false);

  const safeStake = Math.max(1, Math.min(stake, Math.max(1, balance)));

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const startCrashGame = () => {
    if (isLive || isStartingRef.current) return;
    if (balance < safeStake) {
      setCommentary("❌ Insufficient lobby wallet funds.");
      return;
    }
    
    isStartingRef.current = true;
    stakeRef.current = safeStake;

    // Deduct the stake using functional state updates
    onUpdateBalance((prev) => prev - stakeRef.current);
    setIsLive(true);
    setIsCrashed(false);
    setIsCashedOut(false);
    setMultiplier(1.0);
    multiplierRef.current = 1.0;
    startTimeRef.current = Date.now();
    setCommentary("🏃 Mascot is on the rush! Hold your nerve...");

    const prob = Math.random();
    if (prob < 0.05) {
      crashLimitRef.current = 1.0;
    } else {
      crashLimitRef.current = 1.0 + Math.pow(Math.random(), 2.2) * 20;
    }

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    tickCrashGame();
    
    setTimeout(() => { isStartingRef.current = false; }, 100);
  };

  const tickCrashGame = () => {
    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    const currentMulti = 1.0 + Math.pow(elapsed * 0.45, 1.8);

    if (currentMulti >= crashLimitRef.current) {
      setIsLive(false);
      setIsCrashed(true);
      setMultiplier(crashLimitRef.current);
      setCommentary(
        `💥 TRIP-COLLAPSE! Mascot stumbled at ${crashLimitRef.current.toFixed(2)}x! Bet lost.`,
      );
      addLog(
        "Paddock Rush",
        stakeRef.current,
        0,
        "LOSS",
        `Crashed at ${crashLimitRef.current.toFixed(2)}x`,
      );
    } else {
      setMultiplier(currentMulti);
      multiplierRef.current = currentMulti;
      animFrameRef.current = requestAnimationFrame(tickCrashGame);
    }
  };

  const handleCashout = () => {
    if (!isLive || isCashedOut || isCrashed) return;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setIsLive(false);
    setIsCashedOut(true);
    const finalOdds = multiplierRef.current;
    const winVal = stakeRef.current * finalOdds;

    // Simply add the win value using functional updater
    onUpdateBalance((prev) => prev + winVal);

    setCommentary(
      `💰 CASHED OUT at ${finalOdds.toFixed(2)}x! Total return $${winVal.toFixed(2)}!`,
    );
    addLog(
      "Paddock Rush",
      stakeRef.current,
      finalOdds,
      "WIN",
      `Cashed out at ${finalOdds.toFixed(2)}x`,
    );
  };

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="bg-[#070b11] border border-white/5 rounded-2xl p-6 flex flex-col justify-between items-center relative overflow-hidden h-52 select-none">
        <div className="absolute inset-0 bg-blue-500/2 mix-blend-color-dodge opacity-30 pointer-events-none"></div>
        <div className="my-auto z-10 flex flex-col items-center">
          <span
            className={`font-mono text-5xl font-black tracking-tight transition-all ${
              isCrashed
                ? "text-red-500"
                : isCashedOut
                  ? "text-emerald-400"
                  : "text-amber-400 animate-pulse"
            }`}
          >
            {multiplier.toFixed(2)}x
          </span>
          <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest mt-1">
            CURRENT MULTIPLIER
          </span>
        </div>
        <div className="w-full h-8 bg-black/60 border border-white/5 rounded-full flex items-center justify-between px-3 overflow-hidden relative z-10">
          <div
            className="h-full bg-emerald-500 transition-all rounded-full absolute left-0 top-0 duration-75"
            style={{ width: `${Math.min(100, (multiplier / 20) * 100)}%` }}
          ></div>
          <span className="text-[10px] font-mono text-slate-300 z-10 uppercase font-bold">
            START 1.0x
          </span>
          <span className="text-[10px] font-mono text-amber-400 z-10 font-black">
            CRASH POINT
          </span>
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-slate-300 text-center bg-white/2 p-2.5 rounded-xl border border-white/5 select-none">
        {commentary}
      </p>

      {!isLive && (
        <StakeSlider
          balance={balance}
          stake={safeStake}
          setStake={setStake}
          disabled={isLive}
          label="WAGER STAKE"
        />
      )}

      {isLive ? (
        <button
          onClick={handleCashout}
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-[#05070a] font-sans font-black text-sm py-4 rounded-2xl transition-all shadow-lg shadow-emerald-500/10 active:scale-95 cursor-pointer uppercase tracking-widest animate-pulse"
        >
          💰 CASHOUT NOW AT {multiplier.toFixed(2)}x
        </button>
      ) : (
        <button
          onClick={startCrashGame}
          disabled={balance <= 0}
          className="w-full bg-blue-500 hover:bg-blue-400 text-white font-sans font-black text-xs py-3.5 rounded-2xl transition-all shadow-lg active:scale-95 disabled:opacity-50 cursor-pointer uppercase tracking-widest"
        >
          🏃 LAUNCH MASCOT RUSH (${safeStake.toLocaleString()})
        </button>
      )}
    </div>
  );
};
