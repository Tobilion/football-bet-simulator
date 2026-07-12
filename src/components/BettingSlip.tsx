import React, { useState, useEffect } from "react";
import { computeAccaOdds } from "../utils/betBuilderUtils";
import { dedupeForAccumulator } from "../utils/betSlipUtils";
import { BetSelection, Fixture, Team, MarketType } from "../types";
import { formatMoney } from "../utils";
import { Sparkles, Check, ChevronDown, ChevronUp } from "lucide-react";
import { EmptyState } from "./ui/EmptyState";

interface RecommendedSelection extends BetSelection {
  advice: string;
  fixtureName: string;
}

const getSafestSelectionForFixture = (fixture: Fixture, teams: Team[]): RecommendedSelection => {
  const homeTeam = teams.find(t => t.id === fixture.homeTeamId) || teams[0];
  const awayTeam = teams.find(t => t.id === fixture.awayTeamId) || teams[0];
  
  const oHome = fixture.odds.homeWin;
  const oDraw = fixture.odds.draw;
  const oAway = fixture.odds.awayWin;
  
  const choices = [
    { selectionId: "HOME", odds: oHome, details: `${homeTeam.shortName} to Win`, teamName: homeTeam.name, rating: homeTeam.rating, oppName: awayTeam.name, oppRating: awayTeam.rating },
    { selectionId: "DRAW", odds: oDraw, details: `Draw: ${homeTeam.shortName} vs ${awayTeam.shortName}`, teamName: "Draw", rating: 0, oppName: "", oppRating: 0 },
    { selectionId: "AWAY", odds: oAway, details: `${awayTeam.shortName} to Win`, teamName: awayTeam.name, rating: awayTeam.rating, oppName: homeTeam.name, oppRating: homeTeam.rating }
  ];
  
  const safest = choices.reduce((prev, curr) => prev.odds < curr.odds ? prev : curr);
  
  let advice = "";
  if (safest.selectionId === "HOME") {
    const ratingDiff = homeTeam.rating - awayTeam.rating;
    if (ratingDiff > 1.0) {
      advice = `Strong class favorite. ${homeTeam.shortName} (⭐️${homeTeam.rating.toFixed(1)}) dominates playing on their local pitch against ${awayTeam.shortName}.`;
    } else if (ratingDiff > 0) {
      advice = `${homeTeam.shortName} holds a minor ratings edge (⭐️${homeTeam.rating.toFixed(1)} vs ⭐️${awayTeam.rating.toFixed(1)}) plus home comfort.`;
    } else {
      advice = `Home court advantage tips the balance in a highly balanced clash.`;
    }
  } else if (safest.selectionId === "AWAY") {
    const ratingDiff = awayTeam.rating - homeTeam.rating;
    if (ratingDiff > 1.0) {
      advice = `Clear class difference. ${awayTeam.shortName} (⭐️${awayTeam.rating.toFixed(1)}) has too much offensive firepower for ${homeTeam.shortName}.`;
    } else if (ratingDiff > 0) {
      advice = `${awayTeam.shortName} (⭐️${awayTeam.rating.toFixed(1)}) presents a stronger overall squad on the sheet compared to ${homeTeam.shortName}.`;
    } else {
      advice = `Away side holds stronger current lineup options, priced as narrow favorite.`;
    }
  } else {
    advice = `Tactically defensive setups on both sides indicate potential low-scoring gridlock.`;
  }
  
  return {
    fixtureId: fixture.id,
    marketType: "MATCH_WINNER" as MarketType,
    selectionId: safest.selectionId,
    odds: safest.odds,
    details: safest.details,
    marketName: "Match Winner",
    fixtureName: `${homeTeam.shortName} vs ${awayTeam.shortName}`,
    advice
  };
};

const getSafestRecommendedSels = (fixtures: Fixture[], teams: Team[], quantity: number, currentRoundIndex: number): RecommendedSelection[] => {
  // Only recommend games from the CURRENT round. In a league every matchday is
  // scheduled up-front, so without this filter the advisor could suggest a fixture
  // several matchdays away that never settles when the round advances (voiding the leg).
  const scheduled = fixtures.filter(f => f.status === "SCHEDULED" && f.roundIndex === currentRoundIndex);
  if (scheduled.length === 0) return [];
  
  const safestChoices = scheduled.map(f => getSafestSelectionForFixture(f, teams));
  // Sort by lowest odds (descending probability)
  safestChoices.sort((a, b) => a.odds - b.odds);
  
  return safestChoices.slice(0, quantity);
};

interface BettingSlipProps {
  selections: BetSelection[];
  fixtures: Fixture[];
  teams: Team[];
  onRemoveSelection: (fixtureId: string, marketType: MarketType, selectionId: string) => void;
  onClearAll: () => void;
  balance: number;
  onPlaceBet: (type: "SINGLE" | "ACCUMULATOR", stake: number, selectionStakes?: { [key: string]: number }) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  onAddSelections: (selections: BetSelection[]) => void;
  currentRoundIndex: number;
}

export const BettingSlip: React.FC<BettingSlipProps> = ({
  selections,
  fixtures,
  teams,
  onRemoveSelection,
  onClearAll,
  balance,
  onPlaceBet,
  collapsed,
  setCollapsed,
  onAddSelections,
  currentRoundIndex
}) => {
  const [betMode, setBetMode] = useState<"SINGLE" | "ACCUMULATOR">("SINGLE");
  
  // Local states to prevent parent re-renders and input blurring as specified!
  const [singleStakes, setSingleStakes] = useState<{ [key: string]: string }>({});
  const [accaStake, setAccaStake] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [distributeAmount, setDistributeAmount] = useState<string>("");

  // States for Smart Advisor
  const [showAdvisor, setShowAdvisor] = useState(false);
  const [recommendQty, setRecommendQty] = useState<number>(3);
  const [advisorSuccess, setAdvisorSuccess] = useState<boolean>(false);

  const scheduledFixtures = fixtures.filter(f => f.status === "SCHEDULED" && f.roundIndex === currentRoundIndex);
  const maxAvailable = scheduledFixtures.length;
  const recommendedSels = getSafestRecommendedSels(fixtures, teams, recommendQty, currentRoundIndex);

  // Clamp recommended quantity if fixtures decrease
  useEffect(() => {
    if (maxAvailable > 0 && recommendQty > maxAvailable) {
      setRecommendQty(maxAvailable);
    } else if (maxAvailable > 0 && recommendQty === 3 && maxAvailable < 3) {
      setRecommendQty(maxAvailable);
    }
  }, [maxAvailable]);

  // Synchronize/clean stakes when selections are removed
  useEffect(() => {
    const nextStakes: typeof singleStakes = {};
    selections.forEach(sel => {
      const key = `${sel.fixtureId}-${sel.marketType}-${sel.selectionId}`;
      if (singleStakes[key]) {
        nextStakes[key] = singleStakes[key];
      } else {
        nextStakes[key] = ""; // default empty
      }
    });
    setSingleStakes(nextStakes);
    setErrorMessage(null);
  }, [selections]);

  // Accumulators can never contain two mutually-exclusive picks from the same
  // match. In acca mode (whether the user switched modes or added a conflicting
  // pick) drop the extras and tell the user. Singles are unaffected, so Home +
  // Away can still be placed as two separate singles.
  useEffect(() => {
    if (betMode !== "ACCUMULATOR") return;
    const { dropped } = dedupeForAccumulator(selections);
    if (dropped.length > 0) {
      dropped.forEach((d) => onRemoveSelection(d.fixtureId, d.marketType, d.selectionId));
      setErrorMessage(
        `Removed ${dropped.length} conflicting pick${dropped.length > 1 ? "s" : ""}: an accumulator can't combine two outcomes from the same market of one match. Use SINGLES for that.`,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [betMode, selections]);

  // #3 - distribute a single amount across the singles in the slip.
  const applyStakeDistribution = (mode: "split" | "same") => {
    const amount = parseFloat(distributeAmount) || 0;
    if (amount <= 0 || selections.length === 0) {
      setErrorMessage("Enter an amount to distribute across your singles.");
      return;
    }
    const per = mode === "split"
      ? Math.round((amount / selections.length) * 100) / 100
      : amount;
    const next: { [key: string]: string } = {};
    selections.forEach((sel) => {
      next[`${sel.fixtureId}-${sel.marketType}-${sel.selectionId}`] = String(per);
    });
    setSingleStakes(next);
    setErrorMessage(null);
  };

  // Map fixture ID to team names
  const getFixtureMatchup = (fixId: string) => {
    const fix = fixtures.find(f => f.id === fixId);
    if (!fix) return "Unknown Match";
    const homeT = teams.find(t => t.id === fix.homeTeamId);
    const awayT = teams.find(t => t.id === fix.awayTeamId);
    return `${homeT?.shortName || "H"} vs ${awayT?.shortName || "A"}`;
  };

  // Calculations for ACCUMULATOR
  const totalAccaOdds = computeAccaOdds(selections);
  const hasSameGameMulti = new Set(selections.map((s) => s.fixtureId)).size < selections.length;
  const formattedAccaOdds = Math.round(totalAccaOdds * 100) / 100;
  const numAccaStake = parseFloat(accaStake) || 0;
  const accaPayout = Math.round(numAccaStake * formattedAccaOdds * 100) / 100;

  const handleSingleStakeChange = (key: string, val: string) => {
    // Only allow positive numbers
    if (val !== "" && !/^\d*\.?\d*$/.test(val)) return;
    setSingleStakes(prev => ({
      ...prev,
      [key]: val
    }));
    setErrorMessage(null);
  };

  const handleAccaStakeChange = (val: string) => {
    if (val !== "" && !/^\d*\.?\d*$/.test(val)) return;
    setAccaStake(val);
    setErrorMessage(null);
  };

  const handleLoadRecommended = () => {
    if (recommendedSels.length === 0) return;
    onAddSelections(recommendedSels);
    if (recommendedSels.length >= 2) {
      setBetMode("ACCUMULATOR");
    }
    setAdvisorSuccess(true);
    setTimeout(() => {
      setAdvisorSuccess(false);
      setShowAdvisor(false); // Minimize advisor screen area to reveal the loaded selections in the slip
    }, 800);
    setErrorMessage(null);
  };

  const handlePlaceBetClick = () => {
    if (selections.length === 0) {
      setErrorMessage("Please select a bet from Fixtures first!");
      return;
    }

    if (betMode === "SINGLE") {
      // Find all selections with valid stakes
      const parsedStakes: { [key: string]: number } = {};
      let totalAmountRequired = 0;
      let hasOneStake = false;

      selections.forEach(sel => {
        const key = `${sel.fixtureId}-${sel.marketType}-${sel.selectionId}`;
        const sVal = singleStakes[key];
        const num = parseFloat(sVal || "0");
        if (num > 0) {
          parsedStakes[key] = num;
          totalAmountRequired += num;
          hasOneStake = true;
        }
      });

      if (!hasOneStake) {
        setErrorMessage("Please enter a valid stake for at least one selection!");
        return;
      }

      if (totalAmountRequired > balance) {
        setErrorMessage(`Insufficient balance! Total required is $${formatMoney(totalAmountRequired)}`);
        return;
      }

      // Execute Place single bet
      onPlaceBet("SINGLE", totalAmountRequired, parsedStakes);
      setSingleStakes({});
      setErrorMessage(null);
      setCollapsed(true); // Auto-collapse/minimize full slip view to watch matches

    } else {
      // ACCUMULATOR mode
      if (numAccaStake <= 0) {
        setErrorMessage("Please enter a valid global stake!");
        return;
      }

      if (numAccaStake > balance) {
        setErrorMessage(`Insufficient balance! Wallet has $${formatMoney(balance)}`);
        return;
      }

      if (selections.length < 2) {
        setErrorMessage("Accumulator require a minimum of 2 selections!");
        return;
      }

      onPlaceBet("ACCUMULATOR", numAccaStake);
      setAccaStake("");
      setErrorMessage(null);
      setCollapsed(true); // Auto-collapse/minimize full slip view to watch matches
    }
  };

  if (collapsed) {
    return (
      <>
        {/* Mobile: bottom-center FAB */}
        <div className="fixed bottom-5 right-4 md:hidden z-50">
          <button
            onClick={() => setCollapsed(false)}
            className={`flex items-center gap-2 shadow-emerald-500/30 font-black transition-all cursor-pointer bg-emerald-500 hover:bg-emerald-600 text-slate-950 border border-emerald-400 shadow-lg ${selections.length > 0 ? "h-12 px-4 rounded-full" : "h-12 w-12 rounded-full justify-center"}`}
            title="Open Betting Slip"
          >
            <span>🎫</span>
            {selections.length > 0 && (
              <span className="bg-red-500 text-white font-mono text-[10px] h-5 w-5 rounded-full flex items-center justify-center font-bold shrink-0">
                {selections.length}
              </span>
            )}
          </button>
        </div>
        {/* Desktop: rotated tab on edge */}
        <div className="hidden md:flex absolute -right-8 top-1/2 -translate-y-1/2 -rotate-90 items-center gap-2 z-50 pointer-events-none">
          <button
            onClick={() => setCollapsed(false)}
            className={`pointer-events-auto flex items-center gap-2 shadow-emerald-500/20 font-black shrink-0 transition-all cursor-pointer bg-emerald-500 hover:bg-emerald-600 text-slate-950 border border-emerald-400 ${selections.length > 0 ? "h-10 w-auto px-4 rounded-full gap-3 shadow-lg" : "h-10 w-10 rounded-full justify-center shadow-lg"}`}
            title="Open Betting Slip"
          >
            <span>🎫</span>
            {selections.length > 0 && (
              <span className="bg-red-500 text-white font-mono text-[10px] h-5 w-5 rounded-full flex items-center justify-center font-bold shrink-0">
                {selections.length}
              </span>
            )}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-30 md:hidden backdrop-blur-sm"
        onClick={() => setCollapsed(true)}
      />
      <aside
        id="betting-slip"
        className="fixed bottom-0 inset-x-0 h-[88vh] md:h-full md:static md:w-[330px] md:shrink-0 glass-panel border-y-0 md:border-r-0 rounded-t-2xl md:rounded-none flex flex-col overflow-hidden select-none z-40 transition-all duration-300"
      >
      {/* Header element */}
      <div className="bg-white/5 p-3 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎫</span>
          <h2 className="text-xs font-bold tracking-wider uppercase text-slate-250">
            BET SLIP
          </h2>
          {selections.length > 0 && (
            <span className="bg-emerald-500 text-slate-950 font-bold px-1.5 py-0.5 rounded text-[10px] shadow-sm">
              {selections.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selections.length > 0 && (
            <button
              onClick={onClearAll}
              className="text-[10px] text-red-400 hover:text-red-300 underline font-mono cursor-pointer"
            >
              Clear All
            </button>
          )}
          <button
            onClick={() => setCollapsed(true)}
            className="text-xs text-slate-400 hover:text-slate-200 p-1 rounded-md hover:bg-white/5 cursor-pointer"
            title="Collapse Slip"
          >
            ❌
          </button>
        </div>
      </div>

      {/* Slip Modes Toggle */}
      <div className="grid grid-cols-2 p-2 border-b border-white/5 bg-black/10">
        <button
          onClick={() => {
            setBetMode("SINGLE");
            setErrorMessage(null);
          }}
          className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            betMode === "SINGLE"
              ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/10"
              : "text-slate-400 hover:bg-white/5 hover:text-white"
          }`}
        >
          SINGLES
        </button>
        <button
          onClick={() => {
            setBetMode("ACCUMULATOR");
            setErrorMessage(null);
          }}
          className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            betMode === "ACCUMULATOR"
              ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/10"
              : "text-slate-400 hover:bg-white/5 hover:text-white"
          }`}
        >
          ACCUM (ACCA)
        </button>
      </div>

      {/* Smart Bet Advisor Header / Drawer */}
      <div className="bg-amber-500/5 border-b border-amber-500/10 p-2.5">
        <button
          onClick={() => setShowAdvisor(!showAdvisor)}
          className="w-full flex items-center justify-between text-xs font-bold text-amber-400 hover:text-amber-300 transition-all cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-amber-400 animate-pulse animate-duration-[3000ms]" />
            <span className="font-heading">🔮 STATS-BASED BET ADVISOR</span>
          </div>
          <div className="flex items-center gap-1.5 font-sans">
            <span className="text-[9px] text-slate-400 bg-white/5 border border-white/15 px-1.5 py-0.5 rounded font-mono font-bold leading-none">
              {maxAvailable} Scheduled
            </span>
            {showAdvisor ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </button>

        {showAdvisor && (
          <div className="mt-2.5 pt-2.5 border-t border-amber-500/15 text-xs text-slate-300 space-y-3 animate-fade-in">
            <p className="text-[10px] text-slate-405 leading-normal">
              Select your desired number of games. Our stats-engine reviews team strengths, home court factors, and market probabilities to curate the safest slate:
            </p>

            {maxAvailable === 0 ? (
              <div className="bg-black/25 text-center text-[10px] text-slate-500 py-3.5 rounded-xl border border-white/5 font-mono">
                🔒 All matches currently live or finished.
                <br />
                Wait for the next championship round!
              </div>
            ) : (
              <div className="space-y-3">
                {/* Quantity selector */}
                <div className="space-y-1">
                  <span className="text-[9px] text-slate-500 font-mono tracking-wider block uppercase font-bold">
                    1. CHOOSE HOW MANY GAMES:
                  </span>
                  <div className="flex flex-wrap items-center gap-1">
                    {[1, 2, 3, 4, 5, 8].filter(n => n <= maxAvailable).map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => {
                          setRecommendQty(n);
                          setErrorMessage(null);
                        }}
                        className={`h-7 px-3 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer border ${
                          recommendQty === n
                            ? "bg-amber-500 border-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                            : "bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-100 border-white/5"
                        }`}
                      >
                        {n} {n === 1 ? "Game" : "Games"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Selections preview list with explanations/advice */}
                <div className="space-y-1">
                  <span className="text-[9px] text-slate-500 font-mono tracking-wider block uppercase flex justify-between font-bold">
                    <span>2. STATS PREVIEW & ADVICE:</span>
                    <span className="text-amber-400 font-black font-mono text-[10px]">Combined: @{recommendedSels.reduce((acc, s) => acc * s.odds, 1).toFixed(2)}</span>
                  </span>
                  <div className="bg-black/35 rounded-xl border border-white/5 p-2.5 space-y-3 max-h-[170px] overflow-y-auto no-scrollbar glass-scrollbar">
                    {recommendedSels.map((sel, idx) => (
                      <div key={sel.fixtureId} className="text-[11px] space-y-1 border-b border-white/5 last:border-0 pb-2.5 last:pb-0">
                        <div className="flex justify-between items-center font-bold text-slate-100 leading-none">
                          <span className="truncate max-w-[170px]">
                            {idx + 1}. {sel.fixtureName}
                          </span>
                          <span className="text-amber-400 font-mono text-[10px] bg-white/5 px-1 py-0.5 rounded leading-none">@{sel.odds.toFixed(2)}</span>
                        </div>
                        <div className="text-emerald-400 font-mono font-black text-[9px] uppercase leading-none mt-0.5">
                          👉 {sel.details} (Match Winner)
                        </div>
                        <p className="text-[10px] text-slate-400 leading-tight italic pl-1.5 border-l-2 border-amber-500/20 py-0.5">
                          "{sel.advice}"
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Add to slip button */}
                <button
                  type="button"
                  onClick={handleLoadRecommended}
                  className={`w-full py-2 px-3 rounded-xl text-xs font-black tracking-wider transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer shadow-md ${
                    advisorSuccess
                      ? "bg-emerald-500 text-slate-950 shadow-emerald-500/20"
                      : "bg-amber-500 hover:bg-amber-600 text-slate-950 hover:scale-[1.01] shadow-amber-500/10"
                  }`}
                >
                  {advisorSuccess ? (
                    <>
                      <Check size={13} strokeWidth={3} className="animate-bounce" />
                      <span>SAFEST SLATE APPLIED!</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={13} className="text-slate-950 animate-pulse" />
                      <span>LOAD SAFEST SLATE</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selections List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 no-scrollbar max-h-none glass-scrollbar">
        {selections.length === 0 ? (
          <EmptyState
            title="Betting Slip is Empty"
            description="Explore Fixtures & Odds and select predictions to build your custom ticket."
            icon="bet"
          />
        ) : (
          selections.map(sel => {
            const stakeKey = `${sel.fixtureId}-${sel.marketType}-${sel.selectionId}`;
            const sValue = singleStakes[stakeKey] || "";
            const numStake = parseFloat(sValue) || 0;
            const singlePayout = Math.round(numStake * sel.odds * 100) / 100;

            return (
              <div
                key={stakeKey}
                className="glass-card rounded-xl p-3 relative flex flex-col gap-1 transition-all hover:bg-white/5 hover:border-emerald-500/20"
              >
                {/* Delete cross */}
                <button
                  onClick={() => onRemoveSelection(sel.fixtureId, sel.marketType, sel.selectionId)}
                  className="absolute top-1.5 right-1.5 text-xs text-slate-500 hover:text-red-400 cursor-pointer"
                  title="Remove selection"
                >
                  ✕
                </button>

                {/* Match names */}
                <span className="text-[10px] text-slate-400 font-semibold tracking-tight">
                  {getFixtureMatchup(sel.fixtureId)}
                </span>

                {/* Selection and Odds */}
                <div className="flex items-center justify-between pr-4 mt-0.5">
                  <span className="text-xs font-black text-emerald-400">
                    {sel.details}
                  </span>
                  <span className="text-[10px] font-extrabold text-white font-mono bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-md">
                    @{sel.odds.toFixed(2)}
                  </span>
                </div>

                <span className="text-[9px] text-slate-500 font-mono tracking-wide">
                  {sel.marketName}
                </span>

                {/* Input for single stake */}
                {betMode === "SINGLE" && (
                  <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 bg-black/35 border border-white/10 rounded-lg px-2 py-1 max-w-[130px]">
                      <span className="text-[10px] text-slate-500 leading-none">$</span>
                      <input
                        type="text"
                        placeholder="Stake"
                        value={sValue}
                        onChange={(e) => handleSingleStakeChange(stakeKey, e.target.value)}
                        className="w-full bg-transparent border-none text-xs text-emerald-400 focus:outline-none placeholder-slate-700 font-mono font-bold leading-none"
                      />
                    </div>
                    {/* Live payout update as specified */}
                    <div className="text-right">
                      <span className="text-[8px] text-slate-550 block leading-none font-mono">EST PAYOUT</span>
                      <span className="text-xs font-bold text-emerald-400 font-mono">
                        ${formatMoney(singlePayout)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Slip Footer Actions */}
      <div className="bg-white/5 p-3.5 border-t border-white/10 space-y-2.5 backdrop-blur-md">
        {/* #3 - quick stake distribution for singles */}
        {betMode === "SINGLE" && selections.length > 1 && (
          <div className="bg-black/25 border border-white/5 rounded-xl p-2.5 space-y-2">
            <span className="text-[9px] text-slate-400 font-mono uppercase tracking-wider font-bold block">
              Quick Stake - {selections.length} singles
            </span>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1 flex-1">
                <span className="text-[10px] text-slate-500 leading-none">$</span>
                <input
                  type="text"
                  placeholder="Amount"
                  value={distributeAmount}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "" || /^\d*\.?\d*$/.test(v)) setDistributeAmount(v);
                  }}
                  className="w-full bg-transparent border-none text-xs text-emerald-400 focus:outline-none font-mono font-bold leading-none"
                />
              </div>
              <button
                onClick={() => applyStakeDistribution("split")}
                className="text-[9px] font-bold uppercase bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 px-2 py-1.5 rounded-lg cursor-pointer transition-all"
                title="Divide the amount equally across all singles"
              >
                Split total
              </button>
              <button
                onClick={() => applyStakeDistribution("same")}
                className="text-[9px] font-bold uppercase bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 px-2 py-1.5 rounded-lg cursor-pointer transition-all"
                title="Apply the amount to every single"
              >
                Same each
              </button>
            </div>
            <p className="text-[8.5px] text-slate-500 leading-tight">
              Split divides the amount across all singles; Same applies it to each. You can still edit any stake individually below.
            </p>
          </div>
        )}

        {betMode === "ACCUMULATOR" && selections.length >= 2 && (
          <div className="space-y-2 bg-black/25 border border-white/5 rounded-xl p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Total Selections:</span>
              <span className="text-xs font-extrabold text-slate-200">{selections.length}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Combined Odds:
                {hasSameGameMulti && (
                  <span className="ml-1.5 text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-1 py-0.5 uppercase tracking-wide">SGM priced</span>
                )}
              </span>
              <span className="text-xs font-black text-emerald-400 font-mono">
                @{formattedAccaOdds.toFixed(2)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4 pt-2 border-t border-white/5">
              <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1 max-w-[140px]">
                <span className="text-xs text-slate-500 leading-none">$</span>
                <input
                  type="text"
                  placeholder="Acca Stake"
                  value={accaStake}
                  onChange={(e) => handleAccaStakeChange(e.target.value)}
                  className="w-full bg-transparent border-none text-xs text-emerald-400 focus:outline-none font-mono font-bold leading-none"
                />
              </div>

              <div className="text-right">
                <span className="text-[8px] text-slate-500 block leading-none font-mono">EST PAYOUT</span>
                <span className="text-xs font-black text-emerald-400 font-mono">
                  ${formatMoney(accaPayout)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Warning messages */}
        {errorMessage && (
          <div className="bg-red-500/10 border border-red-550/20 text-red-400 p-2 rounded-lg text-center text-[10px] font-semibold leading-tight">
            ⚠️ {errorMessage}
          </div>
        )}

        {/* Overall Place Bet button */}
        <button
          onClick={handlePlaceBetClick}
          disabled={selections.length === 0}
          className={`w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${
            selections.length > 0
              ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 active:scale-[0.98]"
              : "bg-white/5 text-slate-500 cursor-not-allowed"
          }`}
        >
          {selections.length === 0 ? "Add Selections to Slip" : `Place Bet${selections.length > 1 ? "s" : ""} →`}
        </button>
      </div>
      </aside>
    </>
  );
};
