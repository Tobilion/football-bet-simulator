import React, { useState } from "react";
import { GameProps, StakeSlider } from "./shared";
import { formatMoney } from "../../utils";

type Suit = "♠"|"♥"|"♦"|"♣";
type CardVal = "A"|"2"|"3"|"4"|"5"|"6"|"7"|"8"|"9"|"10"|"J"|"Q"|"K";
const SUITS: Suit[] = ["♠","♥","♦","♣"];
const VALS: CardVal[] = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
interface Card { val: CardVal; suit: Suit; }
function randCard(): Card { return { val: VALS[Math.floor(Math.random()*13)], suit: SUITS[Math.floor(Math.random()*4)] }; }
function cardPt(val: CardVal): number {
  if (["10","J","Q","K"].includes(val)) return 0;
  if (val === "A") return 1;
  return parseInt(val);
}
function handPt(hand: Card[]): number { return hand.reduce((s,c) => (s + cardPt(c.val)) % 10, 0); }
function isRed(s: Suit) { return s === "♥" || s === "♦"; }

const CardUI: React.FC<{ card: Card }> = ({ card }) => (
  <div className="w-9 h-13 sm:w-10 sm:h-14 rounded-lg bg-white border border-white/10 flex flex-col items-start justify-start p-1 shadow-md">
    <span className={`text-[9px] font-black leading-none ${isRed(card.suit) ? "text-red-600" : "text-slate-900"}`}>{card.val}</span>
    <span className={`text-xs ${isRed(card.suit) ? "text-red-600" : "text-slate-900"}`}>{card.suit}</span>
  </div>
);

type Side = "player" | "banker" | "tie";

export const BaccaratGame: React.FC<GameProps> = ({ balance, onUpdateBalance, addLog }) => {
  const [stake, setStake] = useState(() => Math.max(1, Math.min(50, Math.floor(balance))));
  const [betSide, setBetSide] = useState<Side>("player");
  const [phase, setPhase] = useState<"idle"|"dealing"|"done">("idle");
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [bankerHand, setBankerHand] = useState<Card[]>([]);
  const [message, setMessage] = useState("Choose PLAYER, BANKER, or TIE and deal!");
  const safeStake = Math.max(1, Math.min(stake, Math.max(1, balance)));

  const deal = () => {
    if (balance < safeStake) { setMessage("❌ Insufficient balance."); return; }
    onUpdateBalance(p => Math.max(0, p - safeStake));
    setPhase("dealing");

    // Initial 2 cards each
    let pH = [randCard(), randCard()];
    let bH = [randCard(), randCard()];
    let pPt = handPt(pH); let bPt = handPt(bH);

    // Natural check
    const natural = pPt >= 8 || bPt >= 8;

    // Player draws if point ≤ 5 (and no natural)
    if (!natural && pPt <= 5) { const pThird = randCard(); pH = [...pH, pThird]; pPt = handPt(pH);
      const pThirdVal = cardPt(pThird.val);
      // Banker draws based on third card rule
      if (bPt <= 2) { bH = [...bH, randCard()]; }
      else if (bPt === 3 && pThirdVal !== 8) { bH = [...bH, randCard()]; }
      else if (bPt === 4 && [2,3,4,5,6,7].includes(pThirdVal)) { bH = [...bH, randCard()]; }
      else if (bPt === 5 && [4,5,6,7].includes(pThirdVal)) { bH = [...bH, randCard()]; }
      else if (bPt === 6 && [6,7].includes(pThirdVal)) { bH = [...bH, randCard()]; }
    } else if (!natural && bPt <= 5) { bH = [...bH, randCard()]; }

    bPt = handPt(bH); pPt = handPt(pH);

    setPlayerHand(pH); setBankerHand(bH);

    let winner: Side;
    if (pPt > bPt) winner = "player";
    else if (bPt > pPt) winner = "banker";
    else winner = "tie";

    let payout = 0; let status: "WIN"|"LOSS" = "LOSS"; let msg = "";

    if (winner === betSide) {
      if (betSide === "player") { payout = safeStake * 2; msg = `✅ Player ${pPt} beats Banker ${bPt}! Win $${formatMoney(payout)}`; }
      else if (betSide === "banker") { payout = safeStake * 1.95; msg = `✅ Banker ${bPt} beats Player ${pPt}! Win $${formatMoney(payout)} (5% comm.)`; }
      else { payout = safeStake * 9; msg = `🎉 TIE! Both ${pPt}! Win $${formatMoney(payout)} (8:1)!`; }
      status = "WIN";
    } else if (winner === "tie" && betSide !== "tie") {
      payout = safeStake; status = "WIN"; msg = `🤝 Tie! Stake returned (${pPt} each).`;
    } else {
      msg = `❌ ${winner === "player" ? `Player ${pPt}` : `Banker ${bPt}`} wins. You bet ${betSide}. Lost $${formatMoney(safeStake)}.`;
    }

    if (payout > 0) onUpdateBalance(p => p + payout);
    setMessage(msg); setPhase("done");
    addLog("Baccarat Royale", safeStake, payout > 0 ? payout / safeStake : 0, status, msg.slice(0, 50));
  };

  return (
    <div className="space-y-3 select-none">
      {/* Hands */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "PLAYER", hand: playerHand, pts: handPt(playerHand) },
          { label: "BANKER", hand: bankerHand, pts: handPt(bankerHand) },
        ].map(({ label, hand, pts }) => (
          <div key={label} className="bg-black/40 border border-white/5 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-mono text-slate-400 uppercase font-bold">{label}</span>
              {hand.length > 0 && <span className="text-lg font-black text-emerald-400 font-mono">{pts}</span>}
            </div>
            <div className="flex gap-1.5 min-h-[3.5rem]">
              {hand.map((c, i) => <CardUI key={i} card={c} />)}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-center text-slate-300 bg-white/5 border border-white/5 rounded-xl py-2.5 px-3 font-bold leading-snug">{message}</p>

      {/* Bet selection */}
      <div className="grid grid-cols-3 gap-2">
        {([
          { side: "player" as Side, label: "PLAYER", odds: "1:1", color: "blue" },
          { side: "banker" as Side, label: "BANKER", odds: "0.95:1", color: "red" },
          { side: "tie" as Side, label: "TIE", odds: "8:1", color: "emerald" },
        ]).map(b => (
          <button key={b.side} onClick={() => { if (phase !== "dealing") { setBetSide(b.side); if (phase === "done") setPhase("idle"); } }}
            className={`py-2.5 rounded-xl border text-center transition-all cursor-pointer ${
              betSide === b.side ? `bg-${b.color}-500/20 border-${b.color}-500 text-${b.color}-400 font-black` : "bg-white/3 border-white/5 text-slate-400 hover:border-white/20"
            }`}>
            <div className="text-[11px] font-bold uppercase">{b.label}</div>
            <div className="text-[9px] text-slate-500 font-mono">{b.odds}</div>
          </button>
        ))}
      </div>

      <StakeSlider balance={balance} stake={safeStake} setStake={setStake} disabled={phase === "dealing"} label="BET STAKE" />

      <button onClick={phase === "done" ? () => { setPlayerHand([]); setBankerHand([]); setPhase("idle"); setMessage("Choose side and deal again!"); } : deal}
        disabled={phase === "dealing" || balance <= 0}
        className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm py-3 rounded-2xl transition-all active:scale-95 disabled:opacity-40 cursor-pointer uppercase block text-center">
        🎴 {phase === "done" ? "NEW SHOE" : "DEAL"}
      </button>
      <div className="text-[9px] text-slate-600 font-mono text-center">Tie pushes on side bets • Banker 5% commission • RTP ~98.9%</div>
    </div>
  );
};
