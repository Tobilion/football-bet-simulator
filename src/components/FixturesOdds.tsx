import React, { useState } from "react";
import { Fixture, Team, BetSelection, MarketType } from "../types";
import { TeamCrest } from "./TeamCrest";
import { Info, X } from "lucide-react";
import { InfoButton } from "./InfoButton";
import { getLiveInPlayOdds } from "../utils";

interface FixturesOddsProps {
  fixtures: Fixture[];
  teams: Team[];
  roundIndex: number;
  currentRoundLabel: string;
  selectedBets: BetSelection[];
  onAddBetSelection: (selection: BetSelection) => void;
  onRemoveSelection: (fixtureId: string, marketType: MarketType, selectionId: string) => void;
  ownedTeamId?: string;
}

export const FixturesOdds: React.FC<FixturesOddsProps> = ({
  fixtures,
  teams,
  roundIndex,
  currentRoundLabel,
  selectedBets,
  onAddBetSelection,
  onRemoveSelection,
  ownedTeamId
}) => {
  const applyOwnerBoost = (odds: number | null, isOwnerMatch: boolean): number | null => {
    if (!odds || !isOwnerMatch) return odds;
    return Math.round(odds * 1.05 * 100) / 100;
  };
  // Filter scheduled fixtures of current round
  const roundFixtures = fixtures.filter(f => f.roundIndex === roundIndex);
  
  // Track which fixture's modal is currently open
  const [activeModalFixtureId, setActiveModalFixtureId] = useState<string | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<"ALL" | "MAIN" | "GOALS" | "HALF" | "CORNER" | "CARDS">("ALL");

  const getTeam = (id: string): Team => {
    return teams.find(t => t.id === id) || teams[0];
  };

  const activeFixture = fixtures.find(f => f.id === activeModalFixtureId);
  const activeFixtureHomeTeam = activeFixture ? getTeam(activeFixture.homeTeamId) : null;
  const activeFixtureAwayTeam = activeFixture ? getTeam(activeFixture.awayTeamId) : null;

  // Helper to check if a specific prediction is already selected in the slip
  const isSelected = (fixtureId: string, marketType: MarketType, selectionId: string) => {
    return selectedBets.some(
      b => b.fixtureId === fixtureId && b.marketType === marketType && b.selectionId === selectionId
    );
  };

  // Helper to calculate modal dynamic in-play odds
  const getModalLiveOdds = (marketType: MarketType, selId: string, base: number): number | null => {
    if (!activeFixture) return base;
    return getLiveInPlayOdds(activeFixture, marketType, selId, base);
  };

  // Helper to toggle a selection
  const handleMarketClick = (
    fixture: Fixture,
    marketType: MarketType,
    selectionId: string,
    odds: number | null,
    details: string,
    marketName: string
  ) => {
    if (odds === null) return;
    const active = isSelected(fixture.id, marketType, selectionId);
    if (active) {
      onRemoveSelection(fixture.id, marketType, selectionId);
    } else {
      onAddBetSelection({
        fixtureId: fixture.id,
        marketType,
        selectionId,
        odds,
        details,
        marketName
      });
    }
  };

  return (
    <div className="flex-1 min-height-0 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6 no-scrollbar max-h-none">
      
      {/* Title Header */}
      <div className="border-b border-white/5 pb-3 flex items-center justify-between">
        <div>
          <span className="text-[10px] text-emerald-400 font-mono tracking-widest block uppercase font-bold">
            AVAILABLE BETTING LINES
          </span>
          <h2 className="text-sm font-bold text-slate-100 font-sans tracking-tight mt-1">
            {currentRoundLabel} matches & odds selections
          </h2>
        </div>
        <div className="text-right text-[10px] text-slate-500 font-mono">
          Select odds prediction to load ticket slip
        </div>
      </div>

      {roundFixtures.length === 0 ? (
        <div className="text-center text-slate-500 py-12">
          🏆 No fixtures found. Press Reset inside settings to restart.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {roundFixtures.map(fixture => {
            const homeTeam = getTeam(fixture.homeTeamId);
            const awayTeam = getTeam(fixture.awayTeamId);
            const isFT = fixture.status === "FT";
            const isHalfTimePause = fixture.status === "LIVE" && fixture.elapsedTicks >= 7 && sessionStorage.getItem(`ht_resume_${fixture.id}`) !== "true";
            const isLive = fixture.status === "LIVE" && !isHalfTimePause;
            const isBettingDisabled = isFT;
            const isOwnerMatch = ownedTeamId
              ? fixture.homeTeamId === ownedTeamId || fixture.awayTeamId === ownedTeamId
              : false;
            const ownedTeamObj = isOwnerMatch ? teams.find(t => t.id === ownedTeamId) : null;
            const getLiveOdds = (mType: MarketType, selId: string, base: number): number | null => {
              const raw = getLiveInPlayOdds(fixture, mType, selId, base);
              return applyOwnerBoost(raw, isOwnerMatch);
            };

            return (
              <div
                key={fixture.id}
                className={`glass-card rounded-2xl overflow-hidden flex flex-col justify-between transition-all duration-250 border ${
                  isOwnerMatch
                    ? "border-yellow-500/40 shadow-[0_0_18px_rgba(234,179,8,0.12)]"
                    : isFT
                    ? "border-white/5 opacity-55"
                    : isLive
                    ? "border-red-500/30 shadow-sm"
                    : isHalfTimePause
                    ? "border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                    : "border-white/5 hover:border-white/15 hover:bg-white/5"
                }`}
              >
                {/* Owner Insider Banner */}
                {isOwnerMatch && ownedTeamObj && (
                  <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-3 py-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-yellow-400 text-[10px]">&#x1F451;</span>
                      <span className="text-[9px] font-black text-yellow-400 uppercase tracking-widest font-mono">
                        YOUR CLUB · OWNER&apos;S VIEW
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[9px] font-mono">
                      <span className="text-slate-400">
                        Morale:{" "}
                        <span className={`font-bold ${(ownedTeamObj.morale ?? 60) >= 70 ? "text-emerald-400" : (ownedTeamObj.morale ?? 60) >= 45 ? "text-yellow-400" : "text-red-400"}`}>
                          {(ownedTeamObj.morale ?? 60) >= 70 ? "HIGH" : (ownedTeamObj.morale ?? 60) >= 45 ? "MID" : "LOW"}
                        </span>
                      </span>
                      <span className="text-yellow-500/60 font-bold">+5% ODDS</span>
                    </div>
                  </div>
                )}

                {/* Match Card Header */}
                <div className="bg-white/5 p-2 px-3 border-b border-white/5 flex items-center justify-between text-[11px] text-slate-400 select-none">
                  {/* Team strength difference / star ratings */}
                  <div className="flex gap-1 text-yellow-500">
                    {"⭐".repeat(Math.round(homeTeam.rating))}
                    <span className="text-slate-400 font-mono text-[9px] ml-1">
                      ({homeTeam.rating.toFixed(1)})
                    </span>
                  </div>
                  
                  <span className="font-mono text-[9px] tracking-widest font-black uppercase text-emerald-400">
                    {isFT ? "FT - LOCKED" : isLive ? "LIVE IN PROGRESS" : "1X2 MATCH WINNER"}
                  </span>

                  <div className="flex gap-1 text-yellow-500">
                    <span className="text-slate-400 font-mono text-[9px] mr-1">
                      ({awayTeam.rating.toFixed(1)})
                    </span>
                    {"⭐".repeat(Math.round(awayTeam.rating))}
                  </div>
                </div>

                {/* Main Matchup section */}
                <div className="p-3.5 flex items-center justify-between select-none">
                  <div
                    onClick={() => window.dispatchEvent(new CustomEvent("open-global-entity", { detail: { type: "team", id: homeTeam.id } }))}
                    className="flex items-center gap-3 w-[40%] cursor-pointer hover:opacity-85 transition-opacity"
                    title={`View ${homeTeam.name} dossier`}
                  >
                    <TeamCrest team={homeTeam} size={36} />
                    <div className="overflow-hidden">
                      <span className="text-xs font-bold text-slate-200 truncate block hover:underline">
                        {homeTeam.name}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        Home
                      </span>
                    </div>
                  </div>

                  <div className="text-center font-bold px-2 shrink-0 flex flex-col items-center">
                    {fixture.status !== "SCHEDULED" ? (
                      <>
                        <span className="text-sm font-black font-mono text-emerald-400">
                          {Math.floor(fixture.homeScore)} - {Math.floor(fixture.awayScore)}
                        </span>
                        {fixture.penaltyScore && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            ({fixture.penaltyScore} pens)
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-slate-500 tracking-wider">VS</span>
                    )}
                  </div>

                  <div
                    onClick={() => window.dispatchEvent(new CustomEvent("open-global-entity", { detail: { type: "team", id: awayTeam.id } }))}
                    className="flex items-center gap-3 w-[40%] flex-row-reverse text-right cursor-pointer hover:opacity-85 transition-opacity"
                    title={`View ${awayTeam.name} dossier`}
                  >
                    <TeamCrest team={awayTeam} size={36} />
                    <div className="overflow-hidden">
                      <span className="text-xs font-bold text-slate-200 truncate block hover:underline">
                        {awayTeam.name}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        Away
                      </span>
                    </div>
                  </div>
                </div>

                {/* 1X2 market Betting buttons (Locked if FT or suspended) */}
                {(() => {
                  const homeOdds = getLiveOdds("MATCH_WINNER", "HOME", fixture.odds.homeWin);
                  const drawOdds = getLiveOdds("MATCH_WINNER", "DRAW", fixture.odds.draw);
                  const awayOdds = getLiveOdds("MATCH_WINNER", "AWAY", fixture.odds.awayWin);
                  
                  return (
                    <div className="px-3 pb-3 grid grid-cols-3 gap-2 border-b border-white/5">
                      <button
                        disabled={isBettingDisabled || homeOdds === null}
                        onClick={() =>
                          handleMarketClick(
                            fixture,
                            "MATCH_WINNER",
                            "HOME",
                            homeOdds,
                            `${homeTeam.shortName} to Win`,
                            "Match Winner"
                          )
                        }
                        className={`py-2 rounded-xl flex flex-col items-center justify-center border transition-all cursor-pointer ${
                          isBettingDisabled || homeOdds === null
                            ? "bg-black/30 border-transparent text-slate-600 cursor-not-allowed opacity-50"
                            : isSelected(fixture.id, "MATCH_WINNER", "HOME")
                            ? "bg-emerald-500/15 border-emerald-500 text-emerald-400 font-bold"
                            : "bg-black/20 border-white/5 text-slate-300 hover:border-white/15 hover:bg-white/5"
                        }`}
                      >
                        <span className="text-[9px] text-slate-400 font-bold block leading-none">HOME</span>
                        <span className="text-[11px] font-mono font-black tracking-tight leading-none mt-1 text-slate-100">
                          {homeOdds !== null ? `@${homeOdds.toFixed(2)}` : "🔒 SUSP"}
                        </span>
                      </button>

                      <button
                        disabled={isBettingDisabled || drawOdds === null}
                        onClick={() =>
                          handleMarketClick(
                            fixture,
                            "MATCH_WINNER",
                            "DRAW",
                            drawOdds,
                            `Draw: ${homeTeam.shortName} vs ${awayTeam.shortName}`,
                            "Match Winner"
                          )
                        }
                        className={`py-2 rounded-xl flex flex-col items-center justify-center border transition-all cursor-pointer ${
                          isBettingDisabled || drawOdds === null
                            ? "bg-black/30 border-transparent text-slate-600 cursor-not-allowed opacity-50"
                            : isSelected(fixture.id, "MATCH_WINNER", "DRAW")
                            ? "bg-emerald-500/15 border-emerald-500 text-emerald-400 font-bold"
                            : "bg-black/20 border-white/5 text-slate-300 hover:border-white/15 hover:bg-white/5"
                        }`}
                      >
                        <span className="text-[9px] text-slate-400 font-bold block leading-none">DRAW</span>
                        <span className="text-[11px] font-mono font-black tracking-tight leading-none mt-1 text-slate-100">
                          {drawOdds !== null ? `@${drawOdds.toFixed(2)}` : "🔒 SUSP"}
                        </span>
                      </button>

                      <button
                        disabled={isBettingDisabled || awayOdds === null}
                        onClick={() =>
                          handleMarketClick(
                            fixture,
                            "MATCH_WINNER",
                            "AWAY",
                            awayOdds,
                            `${awayTeam.shortName} to Win`,
                            "Match Winner"
                          )
                        }
                        className={`py-2 rounded-xl flex flex-col items-center justify-center border transition-all cursor-pointer ${
                          isBettingDisabled || awayOdds === null
                            ? "bg-black/30 border-transparent text-slate-600 cursor-not-allowed opacity-50"
                            : isSelected(fixture.id, "MATCH_WINNER", "AWAY")
                            ? "bg-emerald-500/15 border-emerald-500 text-emerald-400 font-bold"
                            : "bg-black/20 border-white/5 text-slate-300 hover:border-white/15 hover:bg-white/5"
                        }`}
                      >
                        <span className="text-[9px] text-slate-400 font-bold block leading-none">AWAY</span>
                        <span className="text-[11px] font-mono font-black tracking-tight leading-none mt-1 text-slate-100">
                          {awayOdds !== null ? `@${awayOdds.toFixed(2)}` : "🔒 SUSP"}
                        </span>
                      </button>
                    </div>
                  );
                })()}

                {/* Expand sub markets trigger (Odds details draw) */}
                <div className="bg-white/5 px-3 py-1.5 flex items-center justify-between">
                  {isFT ? (
                    <span className="text-[9px] text-slate-500 font-mono font-bold uppercase select-none">
                      🔒 Match Finished • Bets Blocked
                    </span>
                  ) : isLive ? (
                    <span className="text-[9px] text-red-400 font-mono font-bold uppercase select-none flex items-center gap-1 animate-pulse">
                      ⚡ In-Play Live • Betting Open
                    </span>
                  ) : isHalfTimePause ? (
                    <span className="text-[9px] text-emerald-400 font-mono font-bold uppercase select-none animate-pulse">
                      ⏳ Half-Time • In-Play Betting Open
                    </span>
                  ) : (
                    <span className="text-[9px] text-emerald-400 font-mono font-bold uppercase select-none">
                      ✅ Kickoff Tbl • Wagering Active
                    </span>
                  )}
                  
                  <button
                    disabled={isBettingDisabled}
                    onClick={() => setActiveModalFixtureId(fixture.id)}
                    className="text-[10px] text-emerald-400 hover:text-emerald-350 font-bold font-sans tracking-wide cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    <span>▶️ ALL MARKETS ({Object.keys(fixture.odds).length}+)</span>
                  </button>
                  <span className="text-[9px] text-slate-500 font-mono font-bold select-none cursor-default">
                    ID: {fixture.id}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* Modals & Popups */}
      {activeModalFixtureId && activeFixture && activeFixtureHomeTeam && activeFixtureAwayTeam && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0b1016] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl relative overflow-hidden">
            {/* Header */}
            <div className="bg-[#r] p-4 border-b border-white/5 flex items-center justify-between shrink-0 sticky top-0 bg-[#111720] z-10">
              <div className="flex flex-col">
                <span className="text-[10px] text-emerald-400 font-mono tracking-widest uppercase font-bold mb-1">Live Betting Detailed Markets</span>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <TeamCrest team={activeFixtureHomeTeam} size={24} />
                    <span className="text-sm font-bold text-slate-100">{activeFixtureHomeTeam.name}</span>
                  </div>
                  <span className="text-xs text-slate-500 font-bold">vs</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-100">{activeFixtureAwayTeam.name}</span>
                    <TeamCrest team={activeFixtureAwayTeam} size={24} />
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setActiveModalFixtureId(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex items-center overflow-x-auto no-scrollbar border-b border-white/5 shrink-0 bg-[#0e141d]">
              {["ALL", "MAIN", "GOALS", "HALF", "CORNERS", "CARDS"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveModalTab(tab as any)}
                  className={`px-5 py-3 text-xs font-bold whitespace-nowrap transition-colors tracking-wide ${
                    activeModalTab === tab 
                      ? "text-emerald-400 border-b-2 border-emerald-400 bg-emerald-500/5" 
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              
              {/* Main 1X2 - Shows in ALL and MAIN */}
              {(activeModalTab === "ALL" || activeModalTab === "MAIN") && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-slate-200 font-bold">1X2 Match Winner</span>
                    <InfoButton text="Predict the final outcome of the match: Home Win, Draw, or Away Win" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "HOME", t: activeFixtureHomeTeam.name, o: getModalLiveOdds("MATCH_WINNER", "HOME", activeFixture.odds.homeWin), n: `${activeFixtureHomeTeam.shortName} to Win` },
                      { id: "DRAW", t: "Draw", o: getModalLiveOdds("MATCH_WINNER", "DRAW", activeFixture.odds.draw), n: `Draw` },
                      { id: "AWAY", t: activeFixtureAwayTeam.name, o: getModalLiveOdds("MATCH_WINNER", "AWAY", activeFixture.odds.awayWin), n: `${activeFixtureAwayTeam.shortName} to Win` },
                    ].map(b => (
                      <button
                        key={b.id}
                        disabled={b.o === null}
                        onClick={() => handleMarketClick(activeFixture, "MATCH_WINNER", b.id, b.o, b.n, "Match Winner")}
                        className={`py-3 px-3 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between border cursor-pointer transition-all ${
                          b.o === null
                            ? "bg-black/40 border-transparent text-slate-600 cursor-not-allowed opacity-50"
                            : isSelected(activeFixture.id, "MATCH_WINNER", b.id)
                            ? "bg-emerald-500/15 border-emerald-500 text-emerald-400 font-bold"
                            : "bg-[#18212a] border-white/5 hover:bg-white/5 text-slate-300"
                        }`}
                      >
                        <span className="text-[10px] sm:text-xs font-semibold">{b.t}</span>
                        <span className="text-xs font-black font-mono">{b.o !== null ? `@${b.o.toFixed(2)}` : "🔒 SUSP"}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Double Chance */}
              {activeFixture.odds.doubleChance && (activeModalTab === "ALL" || activeModalTab === "MAIN") && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-slate-200 font-bold">Double Chance</span>
                    <InfoButton text="Bet on two of three possible outcomes (e.g., Home or Draw)" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "HOME_OR_DRAW", t: "Home/Draw", o: getModalLiveOdds("DOUBLE_CHANCE", "1X", activeFixture.odds.doubleChance.homeOrDraw), n: `Home or Draw` },
                      { id: "HOME_OR_AWAY", t: "Home/Away", o: getModalLiveOdds("DOUBLE_CHANCE", "12", activeFixture.odds.doubleChance.homeOrAway), n: `Home or Away` },
                      { id: "DRAW_OR_AWAY", t: "Draw/Away", o: getModalLiveOdds("DOUBLE_CHANCE", "X2", activeFixture.odds.doubleChance.drawOrAway), n: `Draw or Away` },
                    ].map(b => (
                      <button
                        key={b.id}
                        disabled={b.o === null}
                        onClick={() => handleMarketClick(activeFixture, "DOUBLE_CHANCE", b.id, b.o, b.n, "Double Chance")}
                        className={`py-3 px-3 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between border cursor-pointer transition-all ${
                          b.o === null
                            ? "bg-black/40 border-transparent text-slate-600 cursor-not-allowed opacity-50"
                            : isSelected(activeFixture.id, "DOUBLE_CHANCE", b.id)
                            ? "bg-emerald-500/15 border-emerald-500 text-emerald-400 font-bold"
                            : "bg-[#18212a] border-white/5 hover:bg-white/5 text-slate-300"
                        }`}
                      >
                        <span className="text-[10px] sm:text-xs font-semibold">{b.t}</span>
                        <span className="text-xs font-black font-mono">{b.o !== null ? `@${b.o.toFixed(2)}` : "🔒 SUSP"}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Goal Markets */}
              {(activeModalTab === "ALL" || activeModalTab === "GOALS") && (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-slate-200 font-bold">Over/Under Goals</span>
                      <InfoButton text="Predict if the total goals scored will be over or under the line" />
                    </div>
                    {activeFixture.odds.overUnder && (
                      <div className="space-y-2">
                        {["0.5", "1.5", "2.5", "3.5", "4.5"].map((line) => {
                          const ou = activeFixture.odds.overUnder as any;
                          const tLine = line.replace(".", "_");
                          const liveOverOdds = getModalLiveOdds("OVER_UNDER_GOALS", `OVER_${tLine}`, ou[`over${tLine}`]);
                          const liveUnderOdds = getModalLiveOdds("OVER_UNDER_GOALS", `UNDER_${tLine}`, ou[`under${tLine}`]);
                          return (
                            <div key={line} className="grid grid-cols-2 gap-2">
                              <button
                                disabled={liveOverOdds === null}
                                onClick={() => handleMarketClick(activeFixture, "OVER_UNDER_GOALS", `OVER_${tLine}`, liveOverOdds, `Over ${line} Goals`, `Over/Under`)}
                                className={`py-3 px-4 rounded-lg flex items-center justify-between border cursor-pointer transition-all ${
                                  liveOverOdds === null
                                    ? "bg-black/40 border-transparent text-slate-600 cursor-not-allowed opacity-50"
                                    : isSelected(activeFixture.id, "OVER_UNDER_GOALS", `OVER_${tLine}`)
                                    ? "bg-emerald-500/15 border-emerald-500 text-emerald-400 font-bold"
                                    : "bg-[#18212a] border-white/5 hover:bg-white/5 text-slate-300"
                                }`}
                              >
                                <span className="text-[10px] sm:text-xs font-semibold">Over {line}</span>
                                <span className="text-xs font-black font-mono">{liveOverOdds !== null ? `@${liveOverOdds.toFixed(2)}` : "🔒 SUSP"}</span>
                              </button>
                              <button
                                disabled={liveUnderOdds === null}
                                onClick={() => handleMarketClick(activeFixture, "OVER_UNDER_GOALS", `UNDER_${tLine}`, liveUnderOdds, `Under ${line} Goals`, `Over/Under`)}
                                className={`py-3 px-4 rounded-lg flex items-center justify-between border cursor-pointer transition-all ${
                                  liveUnderOdds === null
                                    ? "bg-black/40 border-transparent text-slate-600 cursor-not-allowed opacity-50"
                                    : isSelected(activeFixture.id, "OVER_UNDER_GOALS", `UNDER_${tLine}`)
                                    ? "bg-emerald-500/15 border-emerald-500 text-emerald-400 font-bold"
                                    : "bg-[#18212a] border-white/5 hover:bg-white/5 text-slate-300"
                                }`}
                              >
                                <span className="text-[10px] sm:text-xs font-semibold">Under {line}</span>
                                <span className="text-xs font-black font-mono">{liveUnderOdds !== null ? `@${liveUnderOdds.toFixed(2)}` : "🔒 SUSP"}</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  
                  {activeFixture.odds?.bothTeamsToScore && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-slate-200 font-bold">Both Teams to Score (GG/NG)</span>
                        <InfoButton text="Will both teams score at least 1 goal?" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {(() => {
                          const liveBttsYes = getModalLiveOdds("BOTH_TEAMS_TO_SCORE", "YES", activeFixture.odds!.bothTeamsToScore!.yes);
                          const liveBttsNo = getModalLiveOdds("BOTH_TEAMS_TO_SCORE", "NO", activeFixture.odds!.bothTeamsToScore!.no);
                          return (
                            <>
                              <button
                                disabled={liveBttsYes === null}
                                onClick={() => handleMarketClick(activeFixture, "BOTH_TEAMS_TO_SCORE", "YES", liveBttsYes, `BTTS: Yes`, "BTTS")}
                                className={`py-3 px-4 rounded-lg flex items-center justify-between border cursor-pointer transition-all ${
                                  liveBttsYes === null
                                    ? "bg-black/40 border-transparent text-slate-600 cursor-not-allowed opacity-50"
                                    : isSelected(activeFixture.id, "BOTH_TEAMS_TO_SCORE", "YES") ? "bg-emerald-500/15 border-emerald-500 text-emerald-400 font-bold" : "bg-[#18212a] border-white/5 hover:bg-white/5 text-slate-300"
                                }`}
                              >
                                <span className="text-[10px] sm:text-xs font-semibold">Yes (GG)</span>
                                <span className="text-xs font-black font-mono">{liveBttsYes !== null ? `@${liveBttsYes.toFixed(2)}` : "🔒 SUSP"}</span>
                              </button>
                              <button
                                disabled={liveBttsNo === null}
                                onClick={() => handleMarketClick(activeFixture, "BOTH_TEAMS_TO_SCORE", "NO", liveBttsNo, `BTTS: No`, "BTTS")}
                                className={`py-3 px-4 rounded-lg flex items-center justify-between border cursor-pointer transition-all ${
                                  liveBttsNo === null
                                    ? "bg-black/40 border-transparent text-slate-600 cursor-not-allowed opacity-50"
                                    : isSelected(activeFixture.id, "BOTH_TEAMS_TO_SCORE", "NO") ? "bg-emerald-500/15 border-emerald-500 text-emerald-400 font-bold" : "bg-[#18212a] border-white/5 hover:bg-white/5 text-slate-300"
                                }`}
                              >
                                <span className="text-[10px] sm:text-xs font-semibold">No (NG)</span>
                                <span className="text-xs font-black font-mono">{liveBttsNo !== null ? `@${liveBttsNo.toFixed(2)}` : "🔒 SUSP"}</span>
                              </button>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-slate-200 font-bold">Correct Score</span>
                      <InfoButton text="Predict the exact final score of the match. High odds, high risk!" />
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {activeFixture.odds.exactScores.map(sc => {
                        const isSel = isSelected(activeFixture.id, "EXACT_SCORE", sc.score);
                        const liveScoOdds = getModalLiveOdds("EXACT_SCORE", sc.score, sc.odds);
                        return (
                          <button
                            key={sc.score}
                            disabled={liveScoOdds === null}
                            onClick={() => handleMarketClick(activeFixture, "EXACT_SCORE", sc.score, liveScoOdds, `Score: ${sc.score}`, "Correct Score")}
                            className={`py-2 px-2 rounded-lg text-center border cursor-pointer font-mono whitespace-nowrap transition-all flex flex-col items-center ${
                              liveScoOdds === null
                                ? "bg-black/40 border-transparent text-slate-600 cursor-not-allowed opacity-50"
                                : isSel ? "bg-emerald-500/15 border-emerald-500 text-emerald-400" : "bg-[#18212a] border-white/5 hover:bg-white/5 text-slate-300"
                            }`}
                          >
                            <span className="text-[10px] sm:text-xs font-bold">{sc.score}</span>
                            <span className="text-[10px] font-black tracking-tight">{liveScoOdds !== null ? `@${liveScoOdds.toFixed(2)}` : "🔒 SUSP"}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* Player Specials (Half/Others) */}
              {(activeModalTab === "ALL" || activeModalTab === "HALF") && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-slate-200 font-bold">Anytime Goalscorers</span>
                    <InfoButton text="Predict a player to score at any time during the match." />
                  </div>
                  <div className="grid grid-cols-1 gap-1">
                    {activeFixture.odds.goalscorers.map(gs => {
                      const liveGsOdds = getModalLiveOdds("ANYTIME_GOALSCORER", gs.playerId, gs.odds);
                      return (
                        <button
                          key={gs.playerId}
                          disabled={liveGsOdds === null}
                          onClick={() => handleMarketClick(activeFixture, "ANYTIME_GOALSCORER", gs.playerId, liveGsOdds, `${gs.name} to Score`, "Goalscorer")}
                          className={`py-2 px-3 rounded-lg flex items-center justify-between border cursor-pointer transition-all ${
                            liveGsOdds === null
                              ? "bg-black/40 border-transparent text-slate-600 cursor-not-allowed opacity-50"
                              : isSelected(activeFixture.id, "ANYTIME_GOALSCORER", gs.playerId) ? "bg-emerald-500/15 border-emerald-500 text-emerald-400 font-bold" : "bg-[#18212a] border-white/5 hover:bg-white/5 text-slate-300"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold">{gs.name}</span>
                            <span className="text-[9px] text-slate-500 font-mono">{gs.position}</span>
                          </div>
                          <span className="text-xs font-black font-mono">{liveGsOdds !== null ? `@${liveGsOdds.toFixed(2)}` : "🔒 SUSP"}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Corners */}
              {activeFixture.odds.overUnderCorners && activeFixture.odds.overUnderCorners.length > 0 && (activeModalTab === "ALL" || activeModalTab === "CORNERS") && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-slate-200 font-bold">Total Corners</span>
                    <InfoButton text="Will the match have over or under the total number of corners?" />
                  </div>
                  <div className="flex flex-col gap-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                    {activeFixture.odds.overUnderCorners.map((ou) => {
                      const liveOver = getModalLiveOdds("OVER_UNDER_CORNERS", `OVER_${ou.line}`, ou.over);
                      const liveUnder = getModalLiveOdds("OVER_UNDER_CORNERS", `UNDER_${ou.line}`, ou.under);
                      return (
                        <div key={`corners-${ou.line}`} className="grid grid-cols-[auto_1fr_1fr] gap-2 items-center">
                          <span className="text-xs font-bold text-slate-400 w-8">{ou.line}</span>
                          <button
                            disabled={liveOver === null}
                            onClick={() => handleMarketClick(activeFixture, "OVER_UNDER_CORNERS", `OVER_${ou.line}`, liveOver, `Over ${ou.line} Corners`, "Corners")}
                            className={`py-2 px-3 rounded-lg flex items-center justify-between border cursor-pointer transition-all ${
                              liveOver === null
                                ? "bg-black/40 border-transparent text-slate-600 cursor-not-allowed opacity-50"
                                : isSelected(activeFixture.id, "OVER_UNDER_CORNERS", `OVER_${ou.line}`) ? "bg-emerald-500/15 border-emerald-500 text-emerald-400" : "bg-[#18212a] border-white/5 hover:bg-white/5 text-slate-300"
                            }`}
                          >
                            <span className="text-[10px] font-semibold">Over</span>
                            <span className="text-[10px] font-black font-mono">{liveOver !== null ? `@${liveOver.toFixed(2)}` : "🔒 SUSP"}</span>
                          </button>
                          <button
                            disabled={liveUnder === null}
                            onClick={() => handleMarketClick(activeFixture, "OVER_UNDER_CORNERS", `UNDER_${ou.line}`, liveUnder, `Under ${ou.line} Corners`, "Corners")}
                            className={`py-2 px-3 rounded-lg flex items-center justify-between border cursor-pointer transition-all ${
                              liveUnder === null
                                ? "bg-black/40 border-transparent text-slate-600 cursor-not-allowed opacity-50"
                                : isSelected(activeFixture.id, "OVER_UNDER_CORNERS", `UNDER_${ou.line}`) ? "bg-emerald-500/15 border-emerald-500 text-emerald-400" : "bg-[#18212a] border-white/5 hover:bg-white/5 text-slate-300"
                            }`}
                          >
                            <span className="text-[10px] font-semibold">Under</span>
                            <span className="text-[10px] font-black font-mono">{liveUnder !== null ? `@${liveUnder.toFixed(2)}` : "🔒 SUSP"}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Cards */}
              {activeFixture.odds.overUnderCards && activeFixture.odds.overUnderCards.length > 0 && (activeModalTab === "ALL" || activeModalTab === "CARDS") && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-slate-200 font-bold">Total Cards Issued</span>
                    <InfoButton text="Will the ref issue over or under the total number of cards?" />
                  </div>
                  <div className="flex flex-col gap-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                    {activeFixture.odds.overUnderCards.map((ou) => {
                      const liveOver = getModalLiveOdds("OVER_UNDER_CARDS", `OVER_${ou.line}`, ou.over);
                      const liveUnder = getModalLiveOdds("OVER_UNDER_CARDS", `UNDER_${ou.line}`, ou.under);
                      return (
                        <div key={`cards-${ou.line}`} className="grid grid-cols-[auto_1fr_1fr] gap-2 items-center">
                          <span className="text-xs font-bold text-slate-400 w-8">{ou.line}</span>
                          <button
                            disabled={liveOver === null}
                            onClick={() => handleMarketClick(activeFixture, "OVER_UNDER_CARDS", `OVER_${ou.line}`, liveOver, `Over ${ou.line} Cards`, "Cards")}
                            className={`py-2 px-3 rounded-lg flex items-center justify-between border cursor-pointer transition-all ${
                              liveOver === null
                                ? "bg-black/40 border-transparent text-slate-600 cursor-not-allowed opacity-50"
                                : isSelected(activeFixture.id, "OVER_UNDER_CARDS", `OVER_${ou.line}`) ? "bg-emerald-500/15 border-emerald-500 text-emerald-400" : "bg-[#18212a] border-white/5 hover:bg-white/5 text-slate-300"
                            }`}
                          >
                            <span className="text-[10px] font-semibold">Over</span>
                            <span className="text-[10px] font-black font-mono">{liveOver !== null ? `@${liveOver.toFixed(2)}` : "🔒 SUSP"}</span>
                          </button>
                          <button
                            disabled={liveUnder === null}
                            onClick={() => handleMarketClick(activeFixture, "OVER_UNDER_CARDS", `UNDER_${ou.line}`, liveUnder, `Under ${ou.line} Cards`, "Cards")}
                            className={`py-2 px-3 rounded-lg flex items-center justify-between border cursor-pointer transition-all ${
                              liveUnder === null
                                ? "bg-black/40 border-transparent text-slate-600 cursor-not-allowed opacity-50"
                                : isSelected(activeFixture.id, "OVER_UNDER_CARDS", `UNDER_${ou.line}`) ? "bg-emerald-500/15 border-emerald-500 text-emerald-400" : "bg-[#18212a] border-white/5 hover:bg-white/5 text-slate-300"
                            }`}
                          >
                            <span className="text-[10px] font-semibold">Under</span>
                            <span className="text-[10px] font-black font-mono">{liveUnder !== null ? `@${liveUnder.toFixed(2)}` : "🔒 SUSP"}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Goalkeeper Saves */}
              {activeFixture.odds.overUnderSaves && activeFixture.odds.overUnderSaves.length > 0 && (activeModalTab === "ALL" || activeModalTab === "MAIN") && (
                 <div className="space-y-2">
                   <div className="flex items-center gap-2 mb-1">
                     <span className="text-xs text-slate-200 font-bold">Total Scrapes & Saves</span>
                     <InfoButton text="Will both Goalkeepers make more combined saves than this number?" />
                   </div>
                   <div className="flex flex-col gap-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                     {activeFixture.odds.overUnderSaves.map((ou) => {
                       const liveOver = getModalLiveOdds("OVER_UNDER_SAVES", `OVER_${ou.line}`, ou.over);
                       const liveUnder = getModalLiveOdds("OVER_UNDER_SAVES", `UNDER_${ou.line}`, ou.under);
                       return (
                         <div key={`saves-${ou.line}`} className="grid grid-cols-[auto_1fr_1fr] gap-2 items-center">
                           <span className="text-xs font-bold text-slate-400 w-8">{ou.line}</span>
                           <button
                             disabled={liveOver === null}
                             onClick={() => handleMarketClick(activeFixture, "OVER_UNDER_SAVES", `OVER_${ou.line}`, liveOver, `Over ${ou.line} Saves`, "Saves")}
                             className={`py-2 px-3 rounded-lg flex items-center justify-between border cursor-pointer transition-all ${
                               liveOver === null
                                 ? "bg-black/40 border-transparent text-slate-600 cursor-not-allowed opacity-50"
                                 : isSelected(activeFixture.id, "OVER_UNDER_SAVES", `OVER_${ou.line}`) ? "bg-emerald-500/15 border-emerald-500 text-emerald-400" : "bg-[#18212a] border-white/5 hover:bg-white/5 text-slate-300"
                             }`}
                           >
                             <span className="text-[10px] font-semibold">Over</span>
                             <span className="text-[10px] font-black font-mono">{liveOver !== null ? `@${liveOver.toFixed(2)}` : "🔒 SUSP"}</span>
                           </button>
                           <button
                             disabled={liveUnder === null}
                             onClick={() => handleMarketClick(activeFixture, "OVER_UNDER_SAVES", `UNDER_${ou.line}`, liveUnder, `Under ${ou.line} Saves`, "Saves")}
                             className={`py-2 px-3 rounded-lg flex items-center justify-between border cursor-pointer transition-all ${
                               liveUnder === null
                                 ? "bg-black/40 border-transparent text-slate-600 cursor-not-allowed opacity-50"
                                 : isSelected(activeFixture.id, "OVER_UNDER_SAVES", `UNDER_${ou.line}`) ? "bg-emerald-500/15 border-emerald-500 text-emerald-400" : "bg-[#18212a] border-white/5 hover:bg-white/5 text-slate-300"
                             }`}
                           >
                             <span className="text-[10px] font-semibold">Under</span>
                             <span className="text-[10px] font-black font-mono">{liveUnder !== null ? `@${liveUnder.toFixed(2)}` : "🔒 SUSP"}</span>
                           </button>
                         </div>
                       );
                     })}
                   </div>
                 </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
};
