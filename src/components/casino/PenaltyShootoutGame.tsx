import React, { useState, useRef } from "react";
import { Sparkles } from "lucide-react";
import { GameProps, StakeSlider } from "./shared";

export const PenaltyShootoutGame: React.FC<GameProps> = ({ balance, onUpdateBalance, addLog }) => {
  const [stake, setStake] = useState<number>(() => Math.max(1, Math.min(50, Math.floor(balance))));
  const [roundsCount, setRoundsCount] = useState<number>(0);
  const [currentMulti, setCurrentMulti] = useState<number>(1.0);
  const [inGame, setInGame] = useState<boolean>(false);
  const [commentary, setCommentary] = useState<string>("Choose target coordinates to release a shot! Beat the keeper for massive 40x multipliers!");
  const [firing, setFiring] = useState<boolean>(false);
  const [lastEvent, setLastEvent] = useState<{ spot: string; saved: boolean } | null>(null);

  const SHOT_MULTIS = [2.5, 6.0, 15.0, 40.0];

  const safeStake = Math.max(1, Math.min(stake, Math.max(1, balance)));
  const stakeRef = useRef<number>(safeStake);

  const targets = [
    { id: "TL", label: "⚽ Top-Left" },
    { id: "TR", label: "⚽ Top-Right" },
    { id: "BL", label: "🥅 Bot-Left" },
    { id: "BR", label: "🥅 Bot-Right" }
  ];

  const handleShoot = (spot: string) => {
    if (firing) return;

    if (!inGame) {
      if (balance < safeStake) {
        setCommentary("❌ Insufficient balance. Claim emergency cash!");
        return;
      }
      stakeRef.current = safeStake;
      onUpdateBalance((prev) => prev - safeStake);
      setInGame(true);
      setRoundsCount(1);
      setCurrentMulti(1.0);
    }

    setFiring(true);
    setCommentary("Run up... releasing direct power volley shot!");

    setTimeout(() => {
      setFiring(false);
      const saved = Math.random() < 0.20;
      setLastEvent({ spot, saved });

      if (saved) {
        setInGame(false);
        setCommentary("🧤 AMAZING SAVE! The diving keeper intercepts your shot!");
        addLog("Penalty Shootout", stakeRef.current, 0, "LOSS", `Saved at ${spot} on shot ${roundsCount}`);
        setRoundsCount(0);
      } else {
        const shotIdx = roundsCount - 1;
        const scaleMulti = SHOT_MULTIS[Math.min(shotIdx, SHOT_MULTIS.length - 1)];
        setCurrentMulti(scaleMulti);

        if (roundsCount >= 4) {
          const finalVal = stakeRef.current * 40.0;
          onUpdateBalance((prev) => prev + finalVal);
          setInGame(false);
          setCommentary(`🏆 SHOT-MASTER! 4 goals in a row! Maximum payout $${finalVal.toFixed(2)} (40.0x Jackpot)!`);
          addLog("Penalty Shootout", stakeRef.current, 40.0, "WIN", "Cleared 4 rounds penalty streak!");
          setRoundsCount(0);
        } else {
          setRoundsCount(prev => prev + 1);
          setCommentary(`⚽ GOOOAL! Multiplier at ${scaleMulti}x. Keep going or Cash Out!`);
        }
      }
    }, 1100);
  };

  const handleCashout = () => {
    if (!inGame || roundsCount <= 1 || firing) return;
    const winVal = stakeRef.current * currentMulti;
    onUpdateBalance((prev) => prev + winVal);
    setInGame(false);
    setCommentary(`💰 CASHED OUT! Secured $${winVal.toFixed(2)} at ${currentMulti}x!`);
    addLog("Penalty Shootout", stakeRef.current, currentMulti, "WIN", `Safe Cashout after ${roundsCount - 1} goals`);
    setRoundsCount(0);
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#05070a] border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center relative h-52 select-none overflow-hidden">
        <div className="absolute inset-x-8 top-10 bottom-6 border-4 border-b-0 border-white/30 bg-white/2 rounded-t-3xl flex items-center justify-center">
          {firing ? (
            <div className="flex flex-col items-center justify-center z-10 animate-pulse text-amber-400">
              <Sparkles size={28} className="animate-spin mb-1" />
              <span className="text-[10px] uppercase font-mono tracking-widest font-black">Keeper Diving!</span>
            </div>
          ) : lastEvent ? (
            <div className="text-center z-10">
              <span className="text-5xl block animate-bounce">{lastEvent.saved ? "🧤" : "⚽"}</span>
              <p className="text-xs font-black uppercase text-slate-300 font-mono mt-1">
                {lastEvent.saved ? `BLOCKED AT ${lastEvent.spot}` : `SCORED AT ${lastEvent.spot}!`}
              </p>
            </div>
          ) : (
            <div className="text-center text-slate-500 text-xs">🏃 keeper is ready... choose target</div>
          )}
        </div>
      </div>

      {inGame && (
        <div className="flex gap-2 justify-center font-mono text-[10px] bg-black/35 py-2 px-3 border border-white/5 rounded-xl select-none">
          {SHOT_MULTIS.map((m, i) => (
            <React.Fragment key={i}>
              <span className={roundsCount === i + 2 ? "text-amber-400 font-black animate-pulse" : roundsCount > i + 1 ? "text-emerald-400" : "text-slate-500"}>
                R{i + 1}: {m}x
              </span>
              {i < 3 && <span className="text-slate-600">•</span>}
            </React.Fragment>
          ))}
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-slate-300 text-center bg-white/2 p-2.5 rounded-xl border border-white/5 select-none font-mono">{commentary}</p>

      <div className="grid grid-cols-2 gap-2 shrink-0">
        {targets.map(tar => (
          <button
            key={tar.id}
            disabled={firing}
            onClick={() => handleShoot(tar.id)}
            className="bg-[#121620] hover:bg-white/5 border border-white/10 hover:border-emerald-500 text-emerald-400 font-sans font-black text-xs py-3 rounded-2xl transition-all active:scale-95 disabled:opacity-50 cursor-pointer uppercase text-center"
          >
            {tar.label}
          </button>
        ))}
      </div>

      {inGame && (
        <button
          onClick={handleCashout}
          disabled={roundsCount <= 1 || firing}
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-[#05070a] font-sans font-black text-xs py-3.5 rounded-2xl transition-all shadow-lg active:scale-95 disabled:opacity-50 cursor-pointer uppercase tracking-wider block text-center"
        >
          💰 CASHOUT PENALTY (${(stakeRef.current * currentMulti).toFixed(2)})
        </button>
      )}

      {!inGame && (
        <StakeSlider balance={balance} stake={safeStake} setStake={setStake} disabled={inGame || firing} label="SET WAGER STAKE" />
      )}
    </div>
  );
};
