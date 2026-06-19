import React, { useState } from "react";
import { Fixture, Team, BetSelection, MarketType } from "../types";
import { TeamCrest } from "./TeamCrest";

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
  
  // Track which fixtures have expanded sub-markets open
  const [expandedFixtureId, setExpandedFixtureId] = useState<string | null>(null);

  const getTeam = (id: string): Team => {
    return teams.find(t => t.id === id) || teams[0];
  };

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
            const isExpanded = expandedFixtureId === fixture.id;

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
                      onClick={() => setExpandedFixtureId(isExpanded ? null : fixture.id)}
                      className="text-[10px] text-emerald-400 hover:text-emerald-350 font-bold font-sans tracking-wide cursor-pointer flex items-center gap-1"
                    >
                      <span>{isExpanded ? "🔽 COLLAPSE MARKETS" : "▶️ EXPAND MARKETS (SCORE/GOALSCORER)"}</span>
                    </button>
                  )}
                  <span className="text-[9px] text-slate-500 font-mono font-bold select-none cursor-default">
                    ID: {fixture.id}
                  </span>
                </div>

                {/* Accordian expanded sub odds (Correct score, Goalscorer lists) */}
                {isExpanded && !isFT && !isLive && (
                  <div className="bg-black/35 border-t border-white/5 p-3.5 space-y-4 max-h-[300px] overflow-y-auto no-scrollbar glass-scrollbar">
                    {/* Correct Scores */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-slate-400 font-bold block">⚽ CORRECT SCORE MARKETS</span>
                      <div className="grid grid-cols-3 gap-1.5">
                        {fixture.odds.exactScores.map(sc => {
                          const parts = sc.score.split("-");
                          const homeS = parts[0];
                          const awayS = parts[1];
                          const text = `${homeTeam.shortName} ${homeS} - ${awayS} ${awayTeam.shortName}`;

                          return (
                            <button
                              key={sc.score}
                              onClick={() =>
                                handleMarketClick(
                                  fixture,
                                  "EXACT_SCORE",
                                  sc.score,
                                  sc.odds,
                                  `Score: ${sc.score}`,
                                  "Correct Score"
                                )
                              }
                              className={`py-1.5 rounded-lg text-[10px] text-center border transition-all cursor-pointer font-mono whitespace-nowrap ${
                                isSelected(fixture.id, "EXACT_SCORE", sc.score)
                                  ? "bg-emerald-500/15 border-emerald-500 text-emerald-400 font-extrabold"
                                  : "bg-white/5 border-white/5 hover:border-white/15 text-slate-300"
                              }`}
                            >
                              <span className="block text-[8px] text-slate-400 truncate px-0.5">{text}</span>
                              <span className="font-bold">@{sc.odds.toFixed(1)}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Anytime Goalscorers */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-slate-400 font-bold block">🥅 ANYTIME GOALSCORER MARKETS (NON-EXCLUSIVE)</span>
                      <div className="border border-white/5 rounded-xl overflow-hidden bg-black/45">
                        <div className="grid grid-cols-12 bg-white/5 px-2.5 py-1.5 text-[8px] text-slate-400 font-mono font-bold uppercase select-none border-b border-white/5">
                          <span className="col-span-6">Player Name</span>
                          <span className="col-span-3 text-center">Pos</span>
                          <span className="col-span-3 text-right">Odds</span>
                        </div>
                        <div className="divide-y divide-white/5 max-h-[140px] overflow-y-auto no-scrollbar">
                          {fixture.odds.goalscorers.map(gs => {
                            const active = isSelected(fixture.id, "ANYTIME_GOALSCORER", gs.playerId);
                            return (
                              <div
                                key={gs.playerId}
                                onClick={() =>
                                  handleMarketClick(
                                    fixture,
                                    "ANYTIME_GOALSCORER",
                                    gs.playerId,
                                    gs.odds,
                                    `${gs.name} Anytime Goal`,
                                    "Anytime Goalscorer"
                                  )
                                }
                                className={`grid grid-cols-12 px-2.5 py-2 text-[10px] cursor-pointer items-center transition-all ${
                                  active 
                                    ? "bg-emerald-500/15 text-emerald-400 font-extrabold" 
                                    : "text-slate-300 hover:bg-white/5"
                                }`}
                              >
                                <span className="col-span-6 font-semibold font-sans truncate">{gs.name}</span>
                                <span className="col-span-3 text-center text-[9px] font-mono text-slate-500">{gs.position}</span>
                                <span className="col-span-3 text-right font-mono font-bold text-emerald-450">@{gs.odds.toFixed(2)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
