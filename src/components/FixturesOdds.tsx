import React, { useState } from "react";
import { Fixture, Team, BetSelection, MarketType } from "../types";
import { TeamCrest } from "./TeamCrest";
import { Info, X } from "lucide-react";
import { InfoButton } from "./InfoButton";

interface FixturesOddsProps {
  fixtures: Fixture[];
  teams: Team[];
  roundIndex: number;
  currentRoundLabel: string;
  selectedBets: BetSelection[];
  onAddBetSelection: (selection: BetSelection) => void;
  onRemoveSelection: (fixtureId: string, marketType: MarketType, selectionId: string) => void;
}

export const FixturesOdds: React.FC<FixturesOddsProps> = ({
  fixtures,
  teams,
  roundIndex,
  currentRoundLabel,
  selectedBets,
  onAddBetSelection,
  onRemoveSelection
}) => {
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

  // Helper to toggle a selection
  const handleMarketClick = (
    fixture: Fixture,
    marketType: MarketType,
    selectionId: string,
    odds: number,
    details: string,
    marketName: string
  ) => {
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
            const isLive = fixture.status === "LIVE";
            const isFT = fixture.status === "FT";

            return (
              <div
                key={fixture.id}
                className={`glass-card rounded-2xl overflow-hidden flex flex-col justify-between transition-all duration-250 border ${
                  isFT 
                    ? "border-white/5 opacity-55" 
                    : isLive 
                    ? "border-red-500/30 shadow-sm" 
                    : "border-white/5 hover:border-white/15 hover:bg-white/5"
                }`}
              >
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

                {/* 1X2 market Betting buttons (Locked if FT) */}
                <div className="px-3 pb-3 grid grid-cols-3 gap-2 border-b border-white/5">
                  <button
                    disabled={isFT || isLive}
                    onClick={() =>
                      handleMarketClick(
                        fixture,
                        "MATCH_WINNER",
                        "HOME",
                        fixture.odds.homeWin,
                        `${homeTeam.shortName} to Win`,
                        "Match Winner"
                      )
                    }
                    className={`py-2 rounded-xl flex flex-col items-center justify-center border transition-all cursor-pointer ${
                      isFT || isLive
                        ? "bg-black/30 border-transparent text-slate-600 cursor-not-allowed"
                        : isSelected(fixture.id, "MATCH_WINNER", "HOME")
                        ? "bg-emerald-500/15 border-emerald-500 text-emerald-400 font-bold"
                        : "bg-black/20 border-white/5 text-slate-300 hover:border-white/15 hover:bg-white/5"
                    }`}
                  >
                    <span className="text-[9px] text-slate-400 font-bold block leading-none">HOME</span>
                    <span className="text-[11px] font-mono font-black tracking-tight leading-none mt-1 text-slate-100">
                      @{fixture.odds.homeWin.toFixed(2)}
                    </span>
                  </button>

                  <button
                    disabled={isFT || isLive}
                    onClick={() =>
                      handleMarketClick(
                        fixture,
                        "MATCH_WINNER",
                        "DRAW",
                        fixture.odds.draw,
                        `Draw: ${homeTeam.shortName} vs ${awayTeam.shortName}`,
                        "Match Winner"
                      )
                    }
                    className={`py-2 rounded-xl flex flex-col items-center justify-center border transition-all cursor-pointer ${
                      isFT || isLive
                        ? "bg-black/30 border-transparent text-slate-600 cursor-not-allowed"
                        : isSelected(fixture.id, "MATCH_WINNER", "DRAW")
                        ? "bg-emerald-500/15 border-emerald-500 text-emerald-400 font-bold"
                        : "bg-black/20 border-white/5 text-slate-300 hover:border-white/15 hover:bg-white/5"
                    }`}
                  >
                    <span className="text-[9px] text-slate-400 font-bold block leading-none">DRAW</span>
                    <span className="text-[11px] font-mono font-black tracking-tight leading-none mt-1 text-slate-100">
                      @{fixture.odds.draw.toFixed(2)}
                    </span>
                  </button>

                  <button
                    disabled={isFT || isLive}
                    onClick={() =>
                      handleMarketClick(
                        fixture,
                        "MATCH_WINNER",
                        "AWAY",
                        fixture.odds.awayWin,
                        `${awayTeam.shortName} to Win`,
                        "Match Winner"
                      )
                    }
                    className={`py-2 rounded-xl flex flex-col items-center justify-center border transition-all cursor-pointer ${
                      isFT || isLive
                        ? "bg-black/30 border-transparent text-slate-600 cursor-not-allowed"
                        : isSelected(fixture.id, "MATCH_WINNER", "AWAY")
                        ? "bg-emerald-500/15 border-emerald-500 text-emerald-400 font-bold"
                        : "bg-black/20 border-white/5 text-slate-300 hover:border-white/15 hover:bg-white/5"
                    }`}
                  >
                    <span className="text-[9px] text-slate-400 font-bold block leading-none">AWAY</span>
                    <span className="text-[11px] font-mono font-black tracking-tight leading-none mt-1 text-slate-100">
                      @{fixture.odds.awayWin.toFixed(2)}
                    </span>
                  </button>
                </div>

                {/* Expand sub markets trigger (Odds details draw) */}
                <div className="bg-white/5 px-3 py-1.5 flex items-center justify-between">
                  {isFT ? (
                    <span className="text-[9px] text-slate-500 font-mono font-bold uppercase select-none">
                      🔒 Match Finished • Bets Blocked
                    </span>
                  ) : isLive ? (
                    <span className="text-[9px] text-red-400 font-mono font-bold uppercase select-none">
                      🔒 Live Match • Markets Blocked
                    </span>
                  ) : (
                    <button
                      onClick={() => setActiveModalFixtureId(fixture.id)}
                      className="text-[10px] text-emerald-400 hover:text-emerald-350 font-bold font-sans tracking-wide cursor-pointer flex items-center gap-1"
                    >
                      <span>▶️ ALL MARKETS ({Object.keys(fixture.odds).length}+)</span>
                    </button>
                  )}
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
                      { id: "HOME", t: activeFixtureHomeTeam.name, o: activeFixture.odds.homeWin, n: `${activeFixtureHomeTeam.shortName} to Win` },
                      { id: "DRAW", t: "Draw", o: activeFixture.odds.draw, n: `Draw` },
                      { id: "AWAY", t: activeFixtureAwayTeam.name, o: activeFixture.odds.awayWin, n: `${activeFixtureAwayTeam.shortName} to Win` },
                    ].map(b => (
                      <button
                        key={b.id}
                        onClick={() => handleMarketClick(activeFixture, "MATCH_WINNER", b.id, b.o, b.n, "Match Winner")}
                        className={`py-3 px-3 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between border cursor-pointer transition-all ${
                          isSelected(activeFixture.id, "MATCH_WINNER", b.id)
                            ? "bg-emerald-500/15 border-emerald-500 text-emerald-400"
                            : "bg-[#18212a] border-white/5 hover:bg-white/5 text-slate-300"
                        }`}
                      >
                        <span className="text-[10px] sm:text-xs font-semibold">{b.t}</span>
                        <span className="text-xs font-black font-mono">{b.o.toFixed(2)}</span>
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
                      { id: "HOME_OR_DRAW", t: "Home/Draw", o: activeFixture.odds.doubleChance.homeOrDraw, n: `Home or Draw` },
                      { id: "HOME_OR_AWAY", t: "Home/Away", o: activeFixture.odds.doubleChance.homeOrAway, n: `Home or Away` },
                      { id: "DRAW_OR_AWAY", t: "Draw/Away", o: activeFixture.odds.doubleChance.drawOrAway, n: `Draw or Away` },
                    ].map(b => (
                      <button
                        key={b.id}
                        onClick={() => handleMarketClick(activeFixture, "DOUBLE_CHANCE", b.id, b.o, b.n, "Double Chance")}
                        className={`py-3 px-3 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between border cursor-pointer transition-all ${
                          isSelected(activeFixture.id, "DOUBLE_CHANCE", b.id)
                            ? "bg-emerald-500/15 border-emerald-500 text-emerald-400"
                            : "bg-[#18212a] border-white/5 hover:bg-white/5 text-slate-300"
                        }`}
                      >
                        <span className="text-[10px] sm:text-xs font-semibold">{b.t}</span>
                        <span className="text-xs font-black font-mono">{b.o.toFixed(2)}</span>
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
                          return (
                            <div key={line} className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => handleMarketClick(activeFixture, "OVER_UNDER_GOALS", `OVER_${tLine}`, ou[`over${tLine}`], `Over ${line} Goals`, `Over/Under`)}
                                className={`py-3 px-4 rounded-lg flex items-center justify-between border cursor-pointer transition-all ${
                                  isSelected(activeFixture.id, "OVER_UNDER_GOALS", `OVER_${tLine}`)
                                    ? "bg-emerald-500/15 border-emerald-500 text-emerald-400"
                                    : "bg-[#18212a] border-white/5 hover:bg-white/5 text-slate-300"
                                }`}
                              >
                                <span className="text-[10px] sm:text-xs font-semibold">Over {line}</span>
                                <span className="text-xs font-black font-mono">{ou[`over${tLine}`]?.toFixed(2)}</span>
                              </button>
                              <button
                                onClick={() => handleMarketClick(activeFixture, "OVER_UNDER_GOALS", `UNDER_${tLine}`, ou[`under${tLine}`], `Under ${line} Goals`, `Over/Under`)}
                                className={`py-3 px-4 rounded-lg flex items-center justify-between border cursor-pointer transition-all ${
                                  isSelected(activeFixture.id, "OVER_UNDER_GOALS", `UNDER_${tLine}`)
                                    ? "bg-emerald-500/15 border-emerald-500 text-emerald-400"
                                    : "bg-[#18212a] border-white/5 hover:bg-white/5 text-slate-300"
                                }`}
                              >
                                <span className="text-[10px] sm:text-xs font-semibold">Under {line}</span>
                                <span className="text-xs font-black font-mono">{ou[`under${tLine}`]?.toFixed(2)}</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  
                  {activeFixture.odds.bothTeamsToScore && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-slate-200 font-bold">Both Teams to Score (GG/NG)</span>
                        <InfoButton text="Will both teams score at least 1 goal?" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleMarketClick(activeFixture, "BOTH_TEAMS_TO_SCORE", "YES", activeFixture.odds.bothTeamsToScore!.yes, `BTTS: Yes`, "BTTS")}
                          className={`py-3 px-4 rounded-lg flex items-center justify-between border cursor-pointer transition-all ${
                            isSelected(activeFixture.id, "BOTH_TEAMS_TO_SCORE", "YES") ? "bg-emerald-500/15 border-emerald-500 text-emerald-400" : "bg-[#18212a] border-white/5 hover:bg-white/5 text-slate-300"
                          }`}
                        >
                          <span className="text-[10px] sm:text-xs font-semibold">Yes (GG)</span>
                          <span className="text-xs font-black font-mono">{activeFixture.odds.bothTeamsToScore.yes.toFixed(2)}</span>
                        </button>
                        <button
                          onClick={() => handleMarketClick(activeFixture, "BOTH_TEAMS_TO_SCORE", "NO", activeFixture.odds.bothTeamsToScore!.no, `BTTS: No`, "BTTS")}
                          className={`py-3 px-4 rounded-lg flex items-center justify-between border cursor-pointer transition-all ${
                            isSelected(activeFixture.id, "BOTH_TEAMS_TO_SCORE", "NO") ? "bg-emerald-500/15 border-emerald-500 text-emerald-400" : "bg-[#18212a] border-white/5 hover:bg-white/5 text-slate-300"
                          }`}
                        >
                          <span className="text-[10px] sm:text-xs font-semibold">No (NG)</span>
                          <span className="text-xs font-black font-mono">{activeFixture.odds.bothTeamsToScore.no.toFixed(2)}</span>
                        </button>
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
                        return (
                          <button
                            key={sc.score}
                            onClick={() => handleMarketClick(activeFixture, "EXACT_SCORE", sc.score, sc.odds, `Score: ${sc.score}`, "Correct Score")}
                            className={`py-2 px-2 rounded-lg text-center border cursor-pointer font-mono whitespace-nowrap transition-all flex flex-col items-center ${
                              isSel ? "bg-emerald-500/15 border-emerald-500 text-emerald-400" : "bg-[#18212a] border-white/5 hover:bg-white/5 text-slate-300"
                            }`}
                          >
                            <span className="text-[10px] sm:text-xs font-bold">{sc.score}</span>
                            <span className="text-[10px] font-black tracking-tight">{sc.odds.toFixed(2)}</span>
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
                    {activeFixture.odds.goalscorers.map(gs => (
                      <button
                        key={gs.playerId}
                        onClick={() => handleMarketClick(activeFixture, "ANYTIME_GOALSCORER", gs.playerId, gs.odds, `${gs.name} to Score`, "Goalscorer")}
                        className={`py-2 px-3 rounded-lg flex items-center justify-between border cursor-pointer transition-all ${
                          isSelected(activeFixture.id, "ANYTIME_GOALSCORER", gs.playerId) ? "bg-emerald-500/15 border-emerald-500 text-emerald-400" : "bg-[#18212a] border-white/5 hover:bg-white/5 text-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold">{gs.name}</span>
                          <span className="text-[9px] text-slate-500 font-mono">{gs.position}</span>
                        </div>
                        <span className="text-xs font-black font-mono">{gs.odds.toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Corners */}
              {activeFixture.odds.overUnderCorners && (activeModalTab === "ALL" || activeModalTab === "CORNERS") && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-slate-200 font-bold">Total Corners</span>
                    <InfoButton text="Will the match have over or under the total number of corners?" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleMarketClick(activeFixture, "OVER_UNDER_CORNERS", "OVER", activeFixture.odds.overUnderCorners!.over, `Over ${activeFixture.odds.overUnderCorners!.line} Corners`, "Corners")}
                      className={`py-3 px-4 rounded-lg flex items-center justify-between border cursor-pointer transition-all ${
                        isSelected(activeFixture.id, "OVER_UNDER_CORNERS", "OVER") ? "bg-emerald-500/15 border-emerald-500 text-emerald-400" : "bg-[#18212a] border-white/5 hover:bg-white/5 text-slate-300"
                      }`}
                    >
                      <span className="text-xs font-semibold">Over {activeFixture.odds.overUnderCorners.line}</span>
                      <span className="text-xs font-black font-mono">{activeFixture.odds.overUnderCorners.over.toFixed(2)}</span>
                    </button>
                    <button
                      onClick={() => handleMarketClick(activeFixture, "OVER_UNDER_CORNERS", "UNDER", activeFixture.odds.overUnderCorners!.under, `Under ${activeFixture.odds.overUnderCorners!.line} Corners`, "Corners")}
                      className={`py-3 px-4 rounded-lg flex items-center justify-between border cursor-pointer transition-all ${
                        isSelected(activeFixture.id, "OVER_UNDER_CORNERS", "UNDER") ? "bg-emerald-500/15 border-emerald-500 text-emerald-400" : "bg-[#18212a] border-white/5 hover:bg-white/5 text-slate-300"
                      }`}
                    >
                      <span className="text-xs font-semibold">Under {activeFixture.odds.overUnderCorners.line}</span>
                      <span className="text-xs font-black font-mono">{activeFixture.odds.overUnderCorners.under.toFixed(2)}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Cards */}
              {activeFixture.odds.overUnderCards && (activeModalTab === "ALL" || activeModalTab === "CARDS") && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-slate-200 font-bold">Total Cards Issued</span>
                    <InfoButton text="Will the ref issue over or under the total number of cards?" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleMarketClick(activeFixture, "OVER_UNDER_CARDS", "OVER", activeFixture.odds.overUnderCards!.over, `Over ${activeFixture.odds.overUnderCards!.line} Cards`, "Cards")}
                      className={`py-3 px-4 rounded-lg flex items-center justify-between border cursor-pointer transition-all ${
                        isSelected(activeFixture.id, "OVER_UNDER_CARDS", "OVER") ? "bg-emerald-500/15 border-emerald-500 text-emerald-400" : "bg-[#18212a] border-white/5 hover:bg-white/5 text-slate-300"
                      }`}
                    >
                      <span className="text-xs font-semibold">Over {activeFixture.odds.overUnderCards.line}</span>
                      <span className="text-xs font-black font-mono">{activeFixture.odds.overUnderCards.over.toFixed(2)}</span>
                    </button>
                    <button
                      onClick={() => handleMarketClick(activeFixture, "OVER_UNDER_CARDS", "UNDER", activeFixture.odds.overUnderCards!.under, `Under ${activeFixture.odds.overUnderCards!.line} Cards`, "Cards")}
                      className={`py-3 px-4 rounded-lg flex items-center justify-between border cursor-pointer transition-all ${
                        isSelected(activeFixture.id, "OVER_UNDER_CARDS", "UNDER") ? "bg-emerald-500/15 border-emerald-500 text-emerald-400" : "bg-[#18212a] border-white/5 hover:bg-white/5 text-slate-300"
                      }`}
                    >
                      <span className="text-xs font-semibold">Under {activeFixture.odds.overUnderCards.line}</span>
                      <span className="text-xs font-black font-mono">{activeFixture.odds.overUnderCards.under.toFixed(2)}</span>
                    </button>
                  </div>
                </div>
              )}
              
              {/* Goalkeeper Saves */}
              {activeFixture.odds.overUnderSaves && (activeModalTab === "ALL" || activeModalTab === "MAIN") && (
                 <div className="space-y-2">
                   <div className="flex items-center gap-2 mb-1">
                     <span className="text-xs text-slate-200 font-bold">Total Scrapes & Saves</span>
                     <InfoButton text="Will both Goalkeepers make more combined saves than this number?" />
                   </div>
                   <div className="grid grid-cols-2 gap-2">
                     <button
                       onClick={() => handleMarketClick(activeFixture, "OVER_UNDER_SAVES", "OVER", activeFixture.odds.overUnderSaves!.over, `Over ${activeFixture.odds.overUnderSaves!.line} Saves`, "Saves")}
                       className={`py-3 px-4 rounded-lg flex items-center justify-between border cursor-pointer transition-all ${
                         isSelected(activeFixture.id, "OVER_UNDER_SAVES", "OVER") ? "bg-emerald-500/15 border-emerald-500 text-emerald-400" : "bg-[#18212a] border-white/5 hover:bg-white/5 text-slate-300"
                       }`}
                     >
                       <span className="text-xs font-semibold">Over {activeFixture.odds.overUnderSaves.line}</span>
                       <span className="text-xs font-black font-mono">{activeFixture.odds.overUnderSaves.over.toFixed(2)}</span>
                     </button>
                     <button
                       onClick={() => handleMarketClick(activeFixture, "OVER_UNDER_SAVES", "UNDER", activeFixture.odds.overUnderSaves!.under, `Under ${activeFixture.odds.overUnderSaves!.line} Saves`, "Saves")}
                       className={`py-3 px-4 rounded-lg flex items-center justify-between border cursor-pointer transition-all ${
                         isSelected(activeFixture.id, "OVER_UNDER_SAVES", "UNDER") ? "bg-emerald-500/15 border-emerald-500 text-emerald-400" : "bg-[#18212a] border-white/5 hover:bg-white/5 text-slate-300"
                       }`}
                     >
                       <span className="text-xs font-semibold">Under {activeFixture.odds.overUnderSaves.line}</span>
                       <span className="text-xs font-black font-mono">{activeFixture.odds.overUnderSaves.under.toFixed(2)}</span>
                     </button>
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
