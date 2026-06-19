import React from "react";

export interface GameProps {
  balance: number;
  onUpdateBalance: (newBalance: number) => void;
  addLog: (
    game: string,
    amount: number,
    multiplier: number,
    status: "WIN" | "LOSS" | "JOKER" | "FREEZE",
    details: string
  ) => void;
}

export function sliderProps(balance: number, stake: number, setStake: (v: number) => void) {
  const safeBalance = Math.max(1, Math.floor(balance));
  const min = 1;
  const max = safeBalance;
  const step = Math.max(1, Math.floor(safeBalance / 100));
  const clampedValue = Math.min(Math.max(min, stake), max);
  return { min, max, step, clampedValue };
}

interface StakeSliderProps {
  balance: number;
  stake: number;
  setStake: (v: number) => void;
  disabled?: boolean;
  label?: string;
}

export const StakeSlider: React.FC<StakeSliderProps> = ({
  balance,
  stake,
  setStake,
  disabled,
  label
}) => {
  const { min, max, step, clampedValue } = sliderProps(balance, stake, setStake);
  const pct = max > min ? ((clampedValue - min) / (max - min)) * 100 : 0;
  const isEmpty = balance <= 0;

  return (
    <div className="space-y-2 select-none">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400 font-sans uppercase font-semibold tracking-wide">
          {label ?? "WAGER STAKE"}
        </span>
        <span className="font-mono text-emerald-400 font-black text-sm">
          ${clampedValue.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })}
        </span>
      </div>
      {isEmpty ? (
        <div className="w-full h-7 flex items-center justify-center bg-red-500/10 border border-red-500/20 rounded-xl">
          <span className="text-[10px] text-red-400 font-mono uppercase font-bold">
            ⚠️ No balance – claim emergency cash above
          </span>
        </div>
      ) : (
        <>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={clampedValue}
            disabled={disabled}
            onChange={(e) => setStake(Number(e.target.value))}
            className="w-full h-2 rounded-full accent-emerald-500 cursor-pointer disabled:opacity-40"
          />
          <div className="flex justify-between text-[9px] font-mono text-slate-500">
            <span>${min}</span>
            <span className="text-slate-600">{pct.toFixed(0)}% of balance</span>
            <span>${max.toLocaleString()}</span>
          </div>
        </>
      )}
    </div>
  );
};
