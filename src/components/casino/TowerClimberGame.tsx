import React, { useState } from "react";
import { GameProps, StakeSlider } from "./shared";
import { formatMoney } from "../../utils";

const FLOORS = 10;
const COLS = 3;

// Each floor has one safe and two bombs (roughly)
// On harder floors, more bombs
function genFloor(floorIdx: number): ("safe"|"bomb")[] {
  const bombs = Math.min(2, Math.floor(floorIdx / 3) + 1);
  const cells: ("safe"|"bomb")[] = Array(COLS).fill("safe");
  const bombIdxs = new Set<number>();
  while (bombIdxs.size < bombs) bombIdxs.add(Math.floor(Math.random() * COLS));
  bombIdxs.forEach(i => { cells[i] = "bomb"; });
  return cells;
}

const FLOOR_MULTIPLIERS = [1.4, 2.0, 2.9, 4.1, 6.0, 8.8, 13.0, 19.5, 30.0, 50.0];

export const TowerClimberGame: React.FC<GameProps> = ({ balance, onUpdateBalance, addLog }) => {
  const [stake, setStake] = useState(() => Math.max(1, Math.min(50, Math.floor(balance))));
  const [phase, setPhase] = useState<"idle"|"playing"|"done">("idle");
  const [floors, setFloors] = useState<("safe"|"bomb"|"hidden")[][]>([]);
  const [currentFloor, setCurrentFloor] = useState(0);
  const [revealedFloors, setRevealedFloors] = useState<{ cells: ("safe"|"bomb"|"hidden")[]; chosen: number }[]>([]);
  const [message, setMessage] = useState("Set stake and START to climb the tower!");
  const [pool, setPool] = useState(0);
  const safeStake = Math.max(1, Math.min(stake, Math.max(1, balance)));

  const startGame = () => {
    if (balance < safeStake) { setMessage("❌ Insufficient balance."); return; }
    onUpdateBalance(p => Math.max(0, p - safeStake));
    const generatedFloors = Array.from({ length: FLOORS }, (_, i) => genFloor(i));
    setFloors(generatedFloors);
    setCurrentFloor(0); setRevealedFloors([]); setPool(safeStake);
    setPhase("playing"); setMessage(`Floor 1 of ${FLOORS} — Pick a door!`);
  };

  const pickCell = (col: number) => {
    if (phase !== "playing") return;
    const floor = floors[currentFloor];
    const chosen = floor[col];
    const newRevealed = [...revealedFloors, { cells: floor, chosen: col }];
    setRevealedFloors(newRevealed);
    if (chosen === "bomb") {
      setPhase("done");
      const lostMsg = `💥 BOOM! Hit a bomb on floor ${currentFloor + 1}! Lost $${formatMoney(safeStake)}.`;
      setMessage(lostMsg);
      addLog("Tower Climber", safeStake, 0, "LOSS", `Bombed floor ${currentFloor + 1}`);
    } else {
      const nextFloor = currentFloor + 1;
      const multi = FLOOR_MULTIPLIERS[currentFloor];
      const newPool = safeStake * multi;
      setPool(newPool);
      if (nextFloor >= FLOORS) {
        onUpdateBalance(p => p + newPool);
        setPhase("done");
        setMessage(`🏆 TOP FLOOR! ${FLOORS}/${FLOORS} climbed! Win $${formatMoney(newPool)} (${multi}x)!`);
        addLog("Tower Climber", safeStake, multi, "WIN", `Completed all ${FLOORS} floors!`);
      } else {
        setCurrentFloor(nextFloor);
        setMessage(`✅ Safe! Floor ${nextFloor + 1} next — Pool: $${formatMoney(newPool)} (${multi}x). Pick or Cashout.`);
      }
    }
  };

  const cashout = () => {
    if (phase !== "playing" || currentFloor === 0) return;
    onUpdateBalance(p => p + pool);
    addLog("Tower Climber", safeStake, pool / safeStake, "WIN", `Cashed at floor ${currentFloor}`);
    setMessage(`💰 Cashed out $${formatMoney(pool)} at floor ${currentFloor}/${FLOORS}!`);
    setPhase("done");
  };

  const renderFloor = (idx: number) => {
    const isActive = idx === currentFloor && phase === "playing";
    const revealed = revealedFloors[revealedFloors.length - 1 - (currentFloor - idx - (phase === "done" ? 0 : 0))];
    const floorReveal = revealedFloors.find((_, ri) => ri === idx);
    const isDone = phase === "done" || idx < currentFloor;
    
    return (
      <div key={idx} className={`flex items-center gap-2 ${idx > currentFloor && phase === "playing" ? "opacity-30" : ""}`}>
        <span className={`text-[9px] font-mono w-12 text-right shrink-0 ${idx < currentFloor ? "text-emerald-400" : isActive ? "text-amber-400 font-black" : "text-slate-600"}`}>
          {FLOOR_MULTIPLIERS[idx]}x
        </span>
        <div className="flex gap-1.5 flex-1">
          {Array.from({ length: COLS }, (_, col) => {
            const fr = floorReveal;
            const showResult = fr !== undefined;
            const cellVal = showResult ? floors[idx][col] : null;
            const wasChosen = fr?.chosen === col;
            const isBomb = cellVal === "bomb";
            return (
              <button key={col} onClick={() => isActive && pickCell(col)}
                disabled={!isActive}
                className={`flex-1 h-10 rounded-xl border text-sm transition-all ${
                  isActive ? "bg-blue-900/40 border-blue-500/30 hover:bg-blue-800/60 hover:border-blue-400 cursor-pointer active:scale-95" :
                  showResult && wasChosen && isBomb ? "bg-red-700/40 border-red-500" :
                  showResult && wasChosen ? "bg-emerald-500/20 border-emerald-500" :
                  showResult && isBomb ? "bg-red-900/20 border-red-700/30" :
                  showResult ? "bg-white/3 border-white/5" :
                  "bg-white/3 border-white/5"
                }`}>
                {showResult ? (isBomb ? "💣" : wasChosen ? "✅" : "🟩") : isActive ? "?" : ""}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3 select-none">
      {/* Tower - render from top to bottom (floor 9 first) */}
      <div className="bg-black/40 border border-white/5 rounded-xl p-3 space-y-1.5">
        <div className="text-[9px] font-mono text-slate-500 uppercase font-bold mb-2 flex justify-between">
          <span>FLOOR</span><span>MULTIPLIER</span>
        </div>
        {Array.from({ length: FLOORS }, (_, i) => FLOORS - 1 - i).map(idx => renderFloor(idx))}
      </div>

      <p className="text-xs text-center text-slate-300 bg-white/5 border border-white/5 rounded-xl py-2 px-3 font-bold leading-snug">{message}</p>

      {phase === "idle" || phase === "done" ? (
        <div className="space-y-3">
          <StakeSlider balance={balance} stake={safeStake} setStake={setStake} label="CLIMB STAKE" />
          <button onClick={startGame} disabled={balance <= 0}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm py-3 rounded-2xl transition-all active:scale-95 disabled:opacity-40 cursor-pointer uppercase block text-center">
            🏗️ {phase === "done" ? "CLIMB AGAIN" : "START CLIMBING"}
          </button>
        </div>
      ) : (
        currentFloor > 0 && (
          <button onClick={cashout}
            className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs py-2.5 rounded-2xl transition-all active:scale-95 cursor-pointer uppercase block text-center">
            💰 CASHOUT ${formatMoney(pool)} ({FLOOR_MULTIPLIERS[currentFloor - 1]}x)
          </button>
        )
      )}
      <div className="text-[9px] text-slate-600 font-mono text-center">3 doors per floor • 1 safe per floor • Top prize 50x</div>
    </div>
  );
};
