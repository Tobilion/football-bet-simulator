import React, { useState } from "react";
import { X, Zap } from "lucide-react";
import { Fixture, Team, BetBuilderSelection, MarketType } from "../types";
import { TeamCrest } from "./TeamCrest";
import { formatMoney } from "../utils";
import {
  calculateBetBuilderOdds,
  validateBetBuilderSelections,
} from "../utils/betBuilderUtils";

interface BetBuilderProps {
  fixture: Fixture;
  teams: Team[];
  balance: number;
  onPlace: (selections: BetBuilderSelection[], stake: number, combinedOdds: number) => void;
  onClose: () => void;
}

type Category = "MAIN" | "GOALS" | "PLAYERS";

function getTeam(teams: Team[], id: string): Team {
  return teams.find((t) => t.id === id) ?? teams[0];
}

function selKey(s: BetBuilderSelection) {
  return `${s.marketType}:${s.selectionId}`;
}

const CONFLICT_GROUPS: MarketType[][] = [
  ["MATCH_WINNER", "DOUBLE_CHANCE", "EXACT_SCORE"],
];

function removeConflicts(
  prev: BetBuilderSelection[],
  next: BetBuilderSelection,
): BetBuilderSelection[] {
  for (const group of CONFLICT_GROUPS) {
    if (group.includes(next.marketType)) {
      return prev.filter((s) => !group.includes(s.marketType));
    }
  }
  // O/U: remove same line opposite direction
  if (
    next.marketType === "OVER_UNDER_GOALS" ||
    next.marketType === "OVER_UNDER_CORNERS" ||
    next.marketType === "OVER_UNDER_CARDS"
  ) {
    const line = next.selectionId.replace(/^(OVER|UNDER)_/, "");
    return prev.filter(
      (s) =>
        !(s.marketType === next.marketType && s.selectionId.replace(/^(OVER|UNDER)_/, "") === line),
    );
  }
  // BTTS: only one
  if (next.marketType === "BOTH_TEAMS_TO_SCORE") {
    return prev.filter((s) => s.marketType !== "BOTH_TEAMS_TO_SCORE");
  }
  return prev;
}

export const BetBuilder: React.FC<BetBuilderProps> = ({
  fixture,
  teams,
  balance,
  onPlace,
  onClose,
}) => {
  const [selections, setSelections] = useState<BetBuilderSelection[]>([]);
  const [activeCategory, setActiveCategory] = useState<Category>("MAIN");
  const [stake, setStake] = useState("");
  const [toast, setToast] = useState("");

  const homeTeam = getTeam(teams, fixture.homeTeamId);
  const awayTeam = getTeam(teams, fixture.awayTeamId);
  const combinedOdds = calculateBetBuilderOdds(selections);
  const stakeNum = parseFloat(stake) || 0;
  const payout = Math.round(stakeNum * combinedOdds * 100) / 100;
  const validationErr = validateBetBuilderSelections(selections);

  const toggleSel = (sel: BetBuilderSelection) => {
    const key = selKey(sel);
    const isActive = selections.some((s) => selKey(s) === key);
    if (isActive) {
      setSelections((prev) => prev.filter((s) => selKey(s) !== key));
    } else {
      setSelections((prev) => [...removeConflicts(prev, sel), sel]);
      if (CONFLICT_GROUPS.some((g) => g.includes(sel.marketType) && selections.some((s) => g.includes(s.marketType)))) {
        setToast("Conflicting leg removed");
        setTimeout(() => setToast(""), 2000);
      }
    }
  };

  const isActive = (marketType: MarketType, selectionId: string) =>
    selections.some((s) => s.marketType === marketType && s.selectionId === selectionId);

  const btn = (marketType: MarketType, selectionId: string, label: string, odds: number | null | undefined) => {
    if (!odds || odds <= 1) return null;
    const active = isActive(marketType, selectionId);
    return (
      <button
        key={`${marketType}-${selectionId}`}
        type="button"
        onClick={() => toggleSel({ marketType, selectionId, odds, label })}
        className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs border transition-all cursor-pointer ${
          active
            ? "bg-amber-500/20 border-amber-500/60 text-amber-300 font-bold"
            : "bg-white/5 border-white/10 text-slate-300 hover:border-white/25 hover:text-white"
        }`}
      >
        <span className="truncate mr-2">{label}</span>
        <span className={`font-mono font-bold shrink-0 ${active ? "text-amber-400" : "text-emerald-400"}`}>
          {odds.toFixed(2)}
        </span>
      </button>
    );
  };

  const o = fixture.odds;

  const mainMarkets = (
    <div className="space-y-3">
      <p className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">Match Result</p>
      <div className="grid grid-cols-3 gap-1.5">
        {btn("MATCH_WINNER", "HOME", `${homeTeam.shortName} Win`, o.homeWin)}
        {btn("MATCH_WINNER", "DRAW", "Draw", o.draw)}
        {btn("MATCH_WINNER", "AWAY", `${awayTeam.shortName} Win`, o.awayWin)}
      </div>
      {o.doubleChance && (
        <>
          <p className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">Double Chance</p>
          <div className="grid grid-cols-3 gap-1.5">
            {btn("DOUBLE_CHANCE", "HOME_OR_DRAW", `${homeTeam.shortName}/Draw`, o.doubleChance.homeOrDraw)}
            {btn("DOUBLE_CHANCE", "HOME_OR_AWAY", "Home/Away", o.doubleChance.homeOrAway)}
            {btn("DOUBLE_CHANCE", "DRAW_OR_AWAY", `Draw/${awayTeam.shortName}`, o.doubleChance.drawOrAway)}
          </div>
        </>
      )}
      {o.bothTeamsToScore && (
        <>
          <p className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">Both Teams to Score</p>
          <div className="grid grid-cols-2 gap-1.5">
            {btn("BOTH_TEAMS_TO_SCORE", "YES", "BTTS Yes", o.bothTeamsToScore.yes)}
            {btn("BOTH_TEAMS_TO_SCORE", "NO", "BTTS No", o.bothTeamsToScore.no)}
          </div>
        </>
      )}
    </div>
  );

  const goalsMarkets = o.overUnder ? (
    <div className="space-y-2">
      <p className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">Total Goals</p>
      {(["0_5","1_5","2_5","3_5","4_5"] as const).map((line) => {
        const lineNum = parseFloat(line.replace("_", "."));
        const key = `over${line.replace("_","_")}` as keyof typeof o.overUnder;
        const overVal = (o.overUnder as Record<string, number>)[`over${line}`];
        const underVal = (o.overUnder as Record<string, number>)[`under${line}`];
        if (!overVal && !underVal) return null;
        return (
          <div key={line} className="grid grid-cols-2 gap-1.5 items-center">
            <div className="text-[9px] text-slate-500 font-mono text-center col-span-2 -mb-1">Line {lineNum}</div>
            {btn("OVER_UNDER_GOALS", `OVER_${lineNum}`, `Over ${lineNum}`, overVal)}
            {btn("OVER_UNDER_GOALS", `UNDER_${lineNum}`, `Under ${lineNum}`, underVal)}
          </div>
        );
      })}
    </div>
  ) : <p className="text-slate-600 text-xs">No goals markets available.</p>;

  const playerMarkets = o.goalscorers?.length ? (
    <div className="space-y-2">
      <p className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">Anytime Goalscorer</p>
      <div className="grid grid-cols-1 gap-1.5">
        {o.goalscorers.slice(0, 10).map((g) =>
          btn("ANYTIME_GOALSCORER", g.playerId, g.name, g.odds)
        )}
      </div>
    </div>
  ) : <p className="text-slate-600 text-xs">No player markets available.</p>;

  const handlePlace = () => {
    if (validationErr || stakeNum <= 0 || stakeNum > balance) return;
    onPlace(selections, stakeNum, combinedOdds);
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 animate-fade-in">
      <div className="bg-[#090d14] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-white/5 shrink-0">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-amber-400" />
            <span className="text-sm font-black text-amber-400 uppercase tracking-widest">Bet Builder</span>
            <TeamCrest team={homeTeam} size={20} />
            <span className="text-xs text-slate-300 font-semibold">{homeTeam.shortName} vs {awayTeam.shortName}</span>
            <TeamCrest team={awayTeam} size={20} />
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* LEFT: Markets */}
          <div className="flex-1 flex flex-col min-h-0 border-r border-white/5">
            <div className="flex border-b border-white/5 shrink-0">
              {(["MAIN","GOALS","PLAYERS"] as Category[]).map((cat) => (
                <button key={cat} type="button" onClick={() => setActiveCategory(cat)}
                  className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${activeCategory===cat?"text-amber-400 border-b-2 border-amber-400 bg-amber-500/5":"text-slate-500 hover:text-slate-300"}`}>
                  {cat}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
              {activeCategory === "MAIN" && mainMarkets}
              {activeCategory === "GOALS" && goalsMarkets}
              {activeCategory === "PLAYERS" && playerMarkets}
            </div>
          </div>

          {/* RIGHT: Builder slip */}
          <div className="w-64 flex flex-col shrink-0 bg-white/[0.02]">
            <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
              <p className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest mb-2">
                Your Builder ({selections.length} legs)
              </p>
              {selections.length === 0 ? (
                <p className="text-slate-600 text-xs text-center py-6">Select at least 2 legs from the left</p>
              ) : (
                selections.map((s) => (
                  <div key={selKey(s)} className="flex items-center justify-between bg-amber-500/10 border border-amber-500/25 rounded-lg px-2.5 py-1.5 gap-2">
                    <span className="text-xs text-amber-300 truncate">{s.label}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] font-mono font-bold text-amber-400">{s.odds.toFixed(2)}</span>
                      <button type="button" onClick={() => setSelections((p) => p.filter((x) => selKey(x) !== selKey(s)))} className="text-slate-500 hover:text-red-400 transition-colors cursor-pointer">
                        <X size={10} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Combined odds + stake */}
            <div className="p-4 border-t border-white/5 space-y-3 shrink-0">
              <div className="text-center">
                <p className="text-[9px] text-slate-500 font-mono uppercase">Combined Odds</p>
                <p className="text-3xl font-black font-mono text-amber-400">{combinedOdds.toFixed(2)}</p>
                <p className="text-[9px] text-slate-600 font-mono">incl. 7% correlation discount/leg</p>
              </div>
              <input
                type="number" min="1" step="1" placeholder="Stake ($)"
                value={stake} onChange={(e) => setStake(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/60"
              />
              {stakeNum > 0 && (
                <p className="text-[10px] text-center font-mono text-slate-400">
                  Potential: <span className="text-emerald-400 font-bold">${formatMoney(payout)}</span>
                </p>
              )}
              {toast && <p className="text-[10px] text-amber-400 font-mono text-center">{toast}</p>}
              <button
                type="button" onClick={handlePlace}
                disabled={!!validationErr || stakeNum <= 0 || stakeNum > balance}
                className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-black text-xs py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                {validationErr ?? (stakeNum > balance ? "Insufficient funds" : "Place Builder Bet")}
              </button>
              <p className="text-[9px] text-slate-600 text-center font-mono">Balance: ${formatMoney(balance)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
