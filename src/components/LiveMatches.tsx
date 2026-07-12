import React, { useState, useEffect, useRef } from "react";
import { Fixture, Team, BetSelection } from "../types";
import { calculateMOTM } from "../utils/motmUtils";
import { computeMatchRatings, ratingColorClass } from "../utils/playerRatingUtils";
import { cleanPlayerName } from "../utils/playerUtils";
import { TeamCrest } from "./TeamCrest";
import { getLiveInPlayOdds } from "../utils";
import { getTeamForm, getHeadToHead, getTeamGoalAvg } from "../utils/formUtils";
import { MarketType } from "../types";

interface LiveMatchesProps {
  fixtures: Fixture[];
  teams: Team[];
  roundIndex: number;
  currentRoundLabel: string;
  isSimulating: boolean;
  onStartSimulation: (speedMs: number, watchedId: string) => void;
  onPauseSimulation: () => void;
  onSimulateTick: (watchedId: string) => void;
  onSimulateInstant: () => void;
  onSimulateRemainingInstant: (watchedId: string) => void;
  onAdvanceRound: () => void;
  ticks: number; // general ticks indicator
  selectedFixtureId: string;
  setSelectedFixtureId: (id: string) => void;
  selectedBets: BetSelection[];
  onAddBetSelection: (sel: BetSelection) => void;
  onRemoveSelection: (fixId: string, type: string, selId: string) => void;
  ownedTeamId?: string;
}

export const LiveMatches: React.FC<LiveMatchesProps> = ({
  fixtures,
  teams,
  roundIndex,
  currentRoundLabel,
  isSimulating,
  onStartSimulation,
  onPauseSimulation,
  onSimulateTick,
  onSimulateInstant,
  onSimulateRemainingInstant,
  onAdvanceRound,
  ticks,
  selectedFixtureId,
  setSelectedFixtureId,
  selectedBets,
  onAddBetSelection,
  onRemoveSelection,
  ownedTeamId
}) => {
  // Filters active fixtures for current round
  const activeFixtures = fixtures.filter(f => f.roundIndex === roundIndex);
  
  useEffect(() => {
    if (activeFixtures.length > 0 && !selectedFixtureId) {
      setSelectedFixtureId(activeFixtures[0].id);
    }
  }, [activeFixtures, selectedFixtureId, setSelectedFixtureId]);

  // Speed selection — default to broadcast (90s total watch time)
  const [speedMode, setSpeedMode] = useState<"broadcast" | "fast">("broadcast");
  const speedMap = { "broadcast": 8000, "fast": 2500 };

  // "Pause at half-time" preference — persisted across matches and reloads.
  // useSimulation reads the same key (fs_pause_at_halftime) to decide whether to
  // halt at HT. Default ON (pause).
  const [pauseAtHalftime, setPauseAtHalftime] = useState<boolean>(
    () => localStorage.getItem("fs_pause_at_halftime") !== "false",
  );
  const togglePauseAtHalftime = () => {
    setPauseAtHalftime((prev) => {
      const next = !prev;
      localStorage.setItem("fs_pause_at_halftime", next ? "true" : "false");
      return next;
    });
  };

  const triggerGlobalEntity = (type: "team" | "player", id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent("open-global-entity", { detail: { type, id } }));
  };

  const triggerOpenHighlights = (fixtureId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent("open-highlights", { detail: { fixtureId } }));
  };

  const getTeamName = (id: string, short: boolean = false) => {
    const t = teams.find(team => team.id === id);
    return t ? (short ? t.shortName : t.name) : "Loading";
  };

  const getTeamCrest = (id: string) => {
    const t = teams.find(team => team.id === id);
    if (!t) return { id, shortName: "??", primaryColor: "#ccc", secondaryColor: "#999" };
    return t;
  };

  // Finds currently selected active fixture for the details viewer
  const selectedFixture = activeFixtures.find(f => f.id === selectedFixtureId) || activeFixtures[0];

  // Owner match detection
  const isOwnerMatchSelected = ownedTeamId
    ? selectedFixture?.homeTeamId === ownedTeamId || selectedFixture?.awayTeamId === ownedTeamId
    : false;
  const ownedTeamObj = isOwnerMatchSelected ? teams.find(t => t.id === ownedTeamId) : null;
  const ownedTeamFatigue = ownedTeamObj ? (ownedTeamObj.players.length ? ownedTeamObj.players.reduce((a, p) => a + (p.fatigue ?? 0), 0) / ownedTeamObj.players.length : 0) : 0;

  // Auto scroll commentary container
  const commentaryEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (commentaryEndRef.current) {
      commentaryEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedFixture?.events?.length]);

  // Check if all fixtures of current round are finished (FT)
  const allFinished = activeFixtures.every(f => f.status === "FT");

  const hasShootout = (fixture: Fixture) => {
    return fixture.homeScore % 1 !== 0 || fixture.awayScore % 1 !== 0;
  };

  const formatScore = (score: number) => {
    if (score % 1 === 0) return score.toString();
    return Math.floor(score).toString();
  };

  const getShootoutWinner = (fixture: Fixture) => {
    if (fixture.homeScore > fixture.awayScore) return "home";
    return "away";
  };

  // Dynamic visual location on pitch based on latest event type (Attacks, goals, midfield fouls)
  const getPitchActionOverlay = () => {
    if (!selectedFixture || selectedFixture.events.length === 0) {
      return { msg: "Teams are warming up...", x: "50%", y: "50%", teamColor: "#F59E0B" };
    }
    
    const lastEvent = selectedFixture.events[selectedFixture.events.length - 1];
    const isHomeEvent = lastEvent.teamId === selectedFixture.homeTeamId;
    const homT = teams.find(t => t.id === selectedFixture.homeTeamId);
    const awyT = teams.find(t => t.id === selectedFixture.awayTeamId);
    const color = isHomeEvent ? homT?.primaryColor || "#38bdf8" : awyT?.primaryColor || "#f43f5e";

    if (lastEvent.type === "KICKOFF") {
      return { msg: "Kickoff at center pitch!", x: "50%", y: "50%", teamColor: "#64748b" };
    }
    if (lastEvent.type === "HALF_TIME" || lastEvent.type === "FULL_TIME") {
      return { msg: lastEvent.type === "HALF_TIME" ? "Halftime break." : "Ref whistles full-time!", x: "50%", y: "50%", teamColor: "#64748b" };
    }
    if (lastEvent.type === "GOAL") {
      return {
        msg: `⚽ GOAL! ${lastEvent.playerName} scores!`,
        x: isHomeEvent ? "90%" : "10%",
        y: "50%",
        teamColor: color,
        pulse: true
      };
    }
    if (lastEvent.type === "SAVE") {
      return {
        msg: `🧤 Save! Keeper blocks shot!`,
        x: isHomeEvent ? "10%" : "90%",
        y: "40%",
        teamColor: color
      };
    }
    if (lastEvent.type === "MISS") {
      return {
        msg: "🎯 Shot sails wide of target!",
        x: isHomeEvent ? "85%" : "15%",
        y: "30%",
        teamColor: color
      };
    }
    if (lastEvent.type === "YELLOW_CARD" || lastEvent.type === "RED_CARD") {
      return {
        msg: lastEvent.type === "YELLOW_CARD" ? `🟨 Caution for ${lastEvent.playerName}` : `🟥 Red card for ${lastEvent.playerName}`,
        x: isHomeEvent ? "35%" : "65%",
        y: "60%",
        teamColor: "#e11d48"
      };
    }
    return {
      msg: isHomeEvent 
        ? `${homT?.shortName} builds attack in opposition half!`
        : `${awyT?.shortName} builds attack in opposition half!`,
      x: isHomeEvent ? "70%" : "30%",
      y: "45%",
      teamColor: color
    };
  };

  const pitchAction = getPitchActionOverlay();

  // Selected fixture is finished if its status is FT
  const isSelectedFT = selectedFixture ? selectedFixture.status === "FT" : false;
  
  const isHalfTimePause = selectedFixture?.elapsedTicks === 7 && sessionStorage.getItem(`ht_resume_${selectedFixture?.id}`) !== "true";

  const isSelected = (fixId: string, marketType: string, selId: string) => {
    return selectedBets.some(b => b.fixtureId === fixId && b.marketType === marketType && b.selectionId === selId);
  };

  const handleMarketClick = (
    fixture: Fixture,
    marketType: MarketType,
    selectionId: string,
    odds: number | null,
    details: string,
    marketName: string
  ) => {
    if (odds === null) return;
    if (isSelected(fixture.id, marketType, selectionId)) {
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
    <div className="flex-1 min-height-0 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6 no-scrollbar relative max-h-none animate-fade-in">
      
      {/* Simulation Ribbon */}
      <div className="glass-panel rounded-2xl p-4.5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] text-emerald-400 font-mono tracking-widest block uppercase font-black select-none">
            LIVE WATCH CHANNELS • {currentRoundLabel.toUpperCase()}
          </span>
          <div className="flex items-center gap-2 mt-1">
            <h2 className="text-sm font-bold text-slate-100 font-sans tracking-tight">
              {allFinished 
                ? "Round Finished - Settling bets available" 
                : isSelectedFT 
                  ? "Watched Match Finished — Progress other scheduled matches" 
                  : isSimulating 
                    ? `Watching: ${getTeamName(selectedFixture?.homeTeamId, true)} vs ${getTeamName(selectedFixture?.awayTeamId, true)} (LIVE)` 
                    : "Simulcast ready — select and watch matches individually"}
            </h2>
            <div className={`h-2.5 w-2.5 rounded-full ${isSimulating ? "bg-red-500 animate-pulse" : allFinished ? "bg-emerald-500" : "bg-slate-600"}`}></div>
          </div>
          
          {/* Watching Match Minute progress bar */}
          {selectedFixture && (
            <div className="flex items-center gap-3 mt-2 min-w-[200px]">
              <span className="text-[10px] text-slate-400 font-mono select-none">Live Match Clock:</span>
              <div className="flex-1 h-2 bg-black/40 rounded-full overflow-hidden relative border border-white/5">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${(selectedFixture.currentMinute / 90) * 100}%` }}
                ></div>
              </div>
              <span className="text-[10px] text-emerald-450 font-mono font-bold select-none">
                {selectedFixture.currentMinute}' / 90'
              </span>
            </div>
          )}
        </div>

        {/* Action Triggers Grid */}
        <div className="flex flex-wrap items-center gap-2">
          {!allFinished ? (
            <>
              {/* Play / Pause Toggle for Watched Match */}
              {!isSelectedFT && (
                <>
                  {isSimulating ? (
                    <button
                      onClick={onPauseSimulation}
                      className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black px-4 py-2 rounded-xl text-xs cursor-pointer flex items-center gap-1 shadow-md transition-all"
                    >
                      ⏸️ PAUSE LIVE
                    </button>
                  ) : (
                    <button
                      onClick={() => onStartSimulation(speedMap[speedMode], selectedFixtureId)}
                      className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black px-4 py-2 rounded-xl text-xs cursor-pointer flex items-center gap-1 shadow-md shadow-emerald-500/10 animate-pulse transition-all"
                    >
                      {isHalfTimePause ? "▶️ START 2ND HALF (RESUME)" : "▶️ WATCH MATCH LIVE (90 mins)"}
                    </button>
                  )}

                  {/* Single Tick Advance (+6 min) for Watched Match */}
                  <button
                    onClick={() => onSimulateTick(selectedFixtureId)}
                    disabled={isSimulating}
                    className="bg-white/5 hover:bg-white/10 border border-white/10 text-slate-250 hover:text-white px-3 py-1.5 rounded-xl text-xs cursor-pointer flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    title="Advance watched match 6 minutes"
                  >
                    ⏩ +6 MINS
                  </button>
                </>
              )}

              {/* Instant Sim for other matches of the round */}
              <button
                onClick={() => onSimulateRemainingInstant(selectedFixtureId)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all"
                title="Instantly finishes other matches of this round"
              >
                ⚡ SIM REMAINING MATCHES
              </button>

              {/* Instant Skip All */}
              <button
                onClick={onSimulateInstant}
                className="bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-450 border border-emerald-500/30 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all"
                title="Instantly simulates ALL round matches"
              >
                ⚡ SIM ALL ROUND (INSTANT)
              </button>

              {/* Speed adjustment tabs */}
              {!isSelectedFT && (
                <div className="bg-black/30 p-1 border border-white/5 rounded-xl flex gap-1 select-none items-center">
                  <button
                    onClick={() => {
                       setSpeedMode("broadcast");
                       if (isSimulating) {
                         onPauseSimulation();
                         setTimeout(() => onStartSimulation(6000, selectedFixtureId), 50);
                       }
                    }}
                    className={`px-3 py-1.5 text-[9px] font-bold rounded-lg cursor-pointer transition-all ${
                      speedMode === "broadcast"
                        ? "bg-emerald-500 text-slate-950 font-black border border-emerald-500/20"
                        : "text-slate-400 hover:text-white"
                    }`}
                    title="Watch immersive 90 seconds live broadcast feed"
                  >
                    📺 BROADCAST (90S)
                  </button>
                  <button
                    onClick={() => {
                       setSpeedMode("fast");
                       if (isSimulating) {
                         onPauseSimulation();
                         setTimeout(() => onStartSimulation(450, selectedFixtureId), 50);
                       }
                    }}
                    className={`px-3 py-1.5 text-[9px] font-bold rounded-lg cursor-pointer transition-all ${
                      speedMode === "fast"
                        ? "bg-emerald-500 text-slate-950 font-black border border-emerald-500/20"
                        : "text-slate-400 hover:text-white"
                    }`}
                    title="Run fast-forward simulation under 6 seconds"
                  >
                    ⏩ FAST FORWARD (6S)
                  </button>
                </div>
              )}

              {/* Pause-at-half-time toggle (persisted) */}
              {!isSelectedFT && (
                <button
                  onClick={togglePauseAtHalftime}
                  className={`px-3 py-1.5 rounded-xl text-[9px] font-bold cursor-pointer transition-all border flex items-center gap-1.5 select-none ${
                    pauseAtHalftime
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      : "bg-white/5 text-slate-400 border-white/10"
                  }`}
                  title="When on, the match halts at half-time until you continue. When off, it plays straight through to full time."
                >
                  <span>{pauseAtHalftime ? "⏸️" : "▶️"}</span>
                  PAUSE AT HALF-TIME: {pauseAtHalftime ? "ON" : "OFF"}
                </button>
              )}
            </>
          ) : (
            // Advance Round action button
            <button
              onClick={onAdvanceRound}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black px-5 py-2.5 rounded-xl text-xs cursor-pointer flex items-center gap-1.5 shadow-xl shadow-emerald-500/15 hover:scale-[1.02] active:scale-100 animate-bounce transition-all"
            >
              🎉 RESOLVE & ADVANCE TO NEXT ROUND
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Left is Simulcast Cards list, Right is Showcase Match stats detail */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 min-height-0">
        
        {/* Match Cards Simulcast List */}
        <div className="xl:col-span-7 space-y-3">
          <div className="flex items-center justify-between select-none">
            <h3 className="text-xs font-bold font-sans tracking-wide uppercase text-slate-400">
              SIMULCAST SCOREBOARD ({activeFixtures.length})
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">
              Click match card to Watch and view 2D field events
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {activeFixtures.map(fixture => {
              const isSelected = fixture.id === selectedFixtureId;
              const isLive = fixture.status === "LIVE";
              const isFT = fixture.status === "FT";
              const homeCrest = getTeamCrest(fixture.homeTeamId);
              const awayCrest = getTeamCrest(fixture.awayTeamId);

              // Extract scorer and highlights summaries
              const latestGoals = fixture.events.filter(e => e.type === "GOAL").slice(-2);

              return (
                <div
                  key={fixture.id}
                  onClick={() => {
                    setSelectedFixtureId(fixture.id);
                    onPauseSimulation(); // stop running from prior match
                  }}
                  className={`glass-card rounded-xl p-3.5 transition-all duration-150 cursor-pointer flex flex-col justify-between hover:bg-white/5 border ${
                    isSelected
                      ? "border-emerald-450 bg-emerald-500/5 shadow-[0_0_15px_rgba(16,185,129,0.1)] scale-[1.01]"
                      : isLive
                      ? "border-red-500/30 hover:border-red-500"
                      : "border-white/5 hover:border-white/15"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2 select-none">
                    <div className="flex items-center gap-1">
                      {isLive && (
                        <span className="flex h-2 w-2 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                        </span>
                      )}
                      <span className={`text-[9px] font-mono font-bold uppercase rounded px-1.5 py-0.5 ${
                        isLive ? "bg-red-500/10 text-red-405" : isFT ? "bg-white/10 text-slate-400" : "bg-black/40 text-slate-500 border border-white/5"
                      }`}>
                        {isLive ? `Live ${fixture.currentMinute}'` : isFT ? "FT" : "Scheduled"}
                      </span>
                    </div>

                    <span className="text-[9px] text-slate-505 font-mono">
                      Shots: {fixture.stats.home.shots} - {fixture.stats.away.shots}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    {/* Home Team */}
                    <div 
                      onClick={(e) => triggerGlobalEntity("team", fixture.homeTeamId, e)}
                      className="flex items-center gap-2 max-w-[40%] hover:text-emerald-400 cursor-help"
                      title="Click to view Team info"
                    >
                      <TeamCrest team={homeCrest} size={24} />
                      <span className="text-xs font-bold text-slate-250 truncate select-none border-b border-dashed border-slate-650 hover:border-emerald-400">
                        {getTeamName(fixture.homeTeamId, true)}
                      </span>
                    </div>

                    {/* Scores */}
                    <div className="flex flex-col items-center justify-center flex-1">
                      <span className={`text-xs md:text-sm font-black font-mono tracking-tight ${isFT ? "text-slate-400" : "text-emerald-450 animate-pulse"}`}>
                        {formatScore(fixture.homeScore)} - {formatScore(fixture.awayScore)}
                      </span>
                      {hasShootout(fixture) && (
                        <div className="flex flex-col items-center gap-0.5 mt-0.5">
                          <span className="text-[8px] font-extrabold text-emerald-400 bg-emerald-500/10 px-1 rounded uppercase tracking-wider font-sans border border-emerald-500/20">
                            {getShootoutWinner(fixture) === "home" ? `${getTeamName(fixture.homeTeamId, true)} WPens` : `${getTeamName(fixture.awayTeamId, true)} WPens`}
                          </span>
                          {fixture.penaltyScore && (
                            <span className="text-[9px] font-bold text-slate-400 font-mono">
                              ({fixture.penaltyScore} pens)
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Away Team */}
                    <div 
                      onClick={(e) => triggerGlobalEntity("team", fixture.awayTeamId, e)}
                      className="flex items-center gap-2 max-w-[40%] flex-row-reverse text-right hover:text-emerald-400 cursor-help"
                      title="Click to view Team info"
                    >
                      <TeamCrest team={awayCrest} size={24} />
                      <span className="text-xs font-bold text-slate-250 truncate select-none border-b border-dashed border-slate-650 hover:border-emerald-400">
                        {getTeamName(fixture.awayTeamId, true)}
                      </span>
                    </div>
                  </div>

                  {/* Tiny goals logs */}
                  {latestGoals.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-white/5 flex flex-col gap-0.5 text-[8px] text-slate-400 font-sans leading-none">
                      {latestGoals.map((g, i) => (
                        <div 
                          key={i} 
                          onClick={(e) => triggerGlobalEntity("player", g.playerId, e)}
                          className="truncate hover:text-emerald-400 cursor-help flex items-center gap-1 select-none"
                          title="Click to view Player info"
                        >
                          <span>⚽ {g.playerName} ({g.minute}')</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {isFT && (
                    <button
                      onClick={(e) => triggerOpenHighlights(fixture.id, e)}
                      className="mt-2 w-full text-[9px] font-black tracking-widest uppercase text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-md py-1 hover:bg-amber-500/20 transition-colors"
                    >
                      📋 Highlights
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Match detailed Showcase */}
        {selectedFixture && (
          <div className="xl:col-span-5 glass-panel-heavy rounded-2xl flex flex-col overflow-hidden min-h-[540px] border-white/10">
            {/* Showcase Header */}
            <div className="bg-white/5 p-4 border-b border-white/5 text-center">
              <span className="text-[9px] text-slate-405 block uppercase font-black font-mono tracking-widest select-none font-sans">
                EVENT FOCUS • GRAPHIC SPORTSCAST
              </span>
              {selectedFixture.weather && (
                <span className="text-[9px] text-sky-400 block uppercase font-bold font-mono mt-1">
                  {selectedFixture.weather === "Clear Sky" ? "☀️"
                    : selectedFixture.weather === "Overcast" ? "🌥️"
                    : selectedFixture.weather === "Light Rain" ? "🌦️"
                    : selectedFixture.weather === "Heavy Rain" ? "🌧️"
                    : selectedFixture.weather === "Thunderstorm" ? "⛈️"
                    : selectedFixture.weather === "Blizzard" ? "❄️"
                    : selectedFixture.weather === "Heatwave" ? "🔥"
                    : selectedFixture.weather === "Fierce Wind" ? "💨"
                    : selectedFixture.weather === "Fierce Derby" ? "⚔️" : "🌡️"
                  }{" "}WEATHER: {selectedFixture.weather}
                  {selectedFixture.weather === "Blizzard" && " · ↓Goals ↑Fouls"}
                  {selectedFixture.weather === "Heavy Rain" && " · ↓Goals ↑Cards"}
                  {selectedFixture.weather === "Thunderstorm" && " · ↓↓Goals ↑Chaos"}
                  {selectedFixture.weather === "Heatwave" && " · ↑Late Goals"}
                  {selectedFixture.weather === "Fierce Wind" && " · ↓Goals ↑Errors"}
                  {selectedFixture.weather === "Fierce Derby" && " · ↑↑Cards ↑Intensity"}
                </span>
              )}
              
              {/* Owner Live Banner */}
              {isOwnerMatchSelected && ownedTeamObj && (
                <div className="mx-3 mt-2 bg-yellow-500/10 border border-yellow-500/25 rounded-xl px-3 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-yellow-400">&#x1F451;</span>
                    <span className="text-[9px] font-black text-yellow-400 uppercase tracking-widest font-mono">
                      YOUR CLUB · LIVE
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[9px] font-mono">
                    <span className="text-slate-400">
                      Morale:{" "}
                      <span className={`font-bold ${(ownedTeamObj.morale ?? 60) >= 70 ? "text-emerald-400" : (ownedTeamObj.morale ?? 60) >= 45 ? "text-yellow-400" : "text-red-400"}`}>
                        {(ownedTeamObj.morale ?? 60) >= 70 ? "HIGH" : (ownedTeamObj.morale ?? 60) >= 45 ? "MID" : "LOW"}
                      </span>
                    </span>
                    <span className="text-slate-400">
                      Fatigue:{" "}
                      <span className={`font-bold ${ownedTeamFatigue <= 30 ? "text-emerald-400" : ownedTeamFatigue <= 60 ? "text-yellow-400" : "text-red-400"}`}>
                        {ownedTeamFatigue <= 30 ? "FRESH" : ownedTeamFatigue <= 60 ? "TIRED" : "SPENT"}
                      </span>
                    </span>
                    <span className="text-yellow-500/60 font-bold">+5% ODDS</span>
                  </div>
                </div>
              )}

                            <div className="flex items-center justify-between px-3 mt-2">
                <div 
                  onClick={(e) => triggerGlobalEntity("team", selectedFixture.homeTeamId, e)}
                  className="flex flex-col items-center max-w-[35%] cursor-help hover:text-emerald-400"
                  title="Click to view Team info"
                >
                  <TeamCrest team={getTeamCrest(selectedFixture.homeTeamId)} size={48} />
                  <span className="text-xs font-black text-slate-200 mt-1.5 truncate border-b border-dashed border-slate-600 hover:border-emerald-400 select-none">
                    {getTeamName(selectedFixture.homeTeamId)}
                  </span>
                </div>

                <div className="text-center">
                  <span className="text-2xl font-black font-mono text-emerald-450 block">
                    {formatScore(selectedFixture.homeScore)} - {formatScore(selectedFixture.awayScore)}
                  </span>
                  {hasShootout(selectedFixture) && selectedFixture.penaltyScore && (
                    <span className="text-[11px] font-bold text-slate-400 font-mono block">
                      ({selectedFixture.penaltyScore} pens)
                    </span>
                  )}
                  <span className="text-[10px] font-mono text-slate-400 uppercase mt-1 block font-bold select-none">
                    {selectedFixture.status === "LIVE" ? `Live ${selectedFixture.currentMinute}'` : selectedFixture.status === "FT" ? "FINISHED" : "PENDING KICKOFF"}
                  </span>
                </div>

                <div 
                  onClick={(e) => triggerGlobalEntity("team", selectedFixture.awayTeamId, e)}
                  className="flex flex-col items-center max-w-[35%] cursor-help hover:text-emerald-400"
                  title="Click to view Team info"
                >
                  <TeamCrest team={getTeamCrest(selectedFixture.awayTeamId)} size={48} />
                  <span className="text-xs font-black text-slate-200 mt-1.5 truncate border-b border-dashed border-slate-600 hover:border-emerald-400 select-none">
                    {getTeamName(selectedFixture.awayTeamId)}
                  </span>
                </div>
              </div>
            </div>

            {/* Form & H2H Strip */}
            {(() => {
              if (!selectedFixture) return null;
              const hId = selectedFixture.homeTeamId;
              const aId = selectedFixture.awayTeamId;
              const homeForm = getTeamForm(hId, fixtures);
              const awayForm = getTeamForm(aId, fixtures);
              const h2h = getHeadToHead(hId, aId, fixtures);
              const homeAvg = getTeamGoalAvg(hId, fixtures);
              const awayAvg = getTeamGoalAvg(aId, fixtures);
              const dot = (r: "W"|"D"|"L", i: number) => (
                <span key={i} className={`w-4 h-4 rounded-full text-[7px] font-black flex items-center justify-center ${r==="W"?"bg-emerald-500 text-white":r==="D"?"bg-yellow-500 text-black":"bg-red-500 text-white"}`}>{r}</span>
              );
              return (
                <div className="border-b border-white/5 bg-white/[0.02] px-4 py-2 flex items-center gap-3 text-[9px] font-mono select-none">
                  {/* Home form */}
                  <div className="flex flex-col items-center gap-1 min-w-0">
                    <span className="text-slate-500 uppercase tracking-wider font-bold text-[8px]">Form</span>
                    <div className="flex gap-0.5">{homeForm.length ? homeForm.map((r,i)=>dot(r,i)) : <span className="text-slate-600">—</span>}</div>
                    <span className="text-slate-500 text-[8px]">{homeAvg.scored}G / <span className="text-red-400">{homeAvg.conceded}GA</span></span>
                  </div>

                  {/* H2H centre */}
                  <div className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-slate-500 uppercase tracking-wider font-bold text-[8px]">H2H ({h2h.played} played)</span>
                    {h2h.played > 0 ? (
                      <>
                        <div className="flex items-center gap-1 w-full max-w-[140px]">
                          <span className="text-emerald-400 font-bold w-6 text-right">{h2h.homeWins}</span>
                          <div className="flex-1 h-1.5 rounded-full overflow-hidden flex bg-white/5">
                            <div className="bg-emerald-500 h-full" style={{width:`${(h2h.homeWins/h2h.played)*100}%`}}></div>
                            <div className="bg-yellow-500 h-full" style={{width:`${(h2h.draws/h2h.played)*100}%`}}></div>
                            <div className="bg-red-500 h-full flex-1"></div>
                          </div>
                          <span className="text-red-400 font-bold w-6">{h2h.awayWins}</span>
                        </div>
                        {h2h.lastMeeting && (
                          <span className="text-slate-500 text-[8px]">Last: <span className="text-white font-bold">{h2h.lastMeeting.scoreline}</span> · R{h2h.lastMeeting.roundIndex+1}</span>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-600">No previous meetings</span>
                    )}
                    <div className="flex gap-2 text-[8px] text-slate-500">
                      <span className="text-emerald-400">Avg {homeAvg.scored}g</span>
                      <span>vs</span>
                      <span className="text-red-400">Avg {awayAvg.scored}g</span>
                    </div>
                  </div>

                  {/* Away form */}
                  <div className="flex flex-col items-center gap-1 min-w-0">
                    <span className="text-slate-500 uppercase tracking-wider font-bold text-[8px]">Form</span>
                    <div className="flex gap-0.5">{awayForm.length ? awayForm.map((r,i)=>dot(r,i)) : <span className="text-slate-600">—</span>}</div>
                    <span className="text-slate-500 text-[8px]">{awayAvg.scored}G / <span className="text-red-400">{awayAvg.conceded}GA</span></span>
                  </div>
                </div>
              );
            })()}

            {isHalfTimePause ? (
              <div className="bg-black/60 aspect-[16/10] relative flex flex-col items-center justify-center overflow-hidden border-b border-emerald-500/30 p-6 shadow-inner animate-fade-in">
                <h2 className="text-3xl font-black font-sans text-white tracking-widest uppercase text-center mb-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                   HALF TIME
                </h2>
                <div className="text-[11px] font-mono font-bold text-emerald-400 border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 rounded-full mb-6">
                   LIVE ODDS UPDATED • IN-PLAY BETTING OPEN
                </div>
                
                <div className="grid grid-cols-2 gap-4 w-full max-w-lg mb-6">
                   <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                     <span className="text-[9px] text-slate-400 font-bold uppercase block mb-1">
                       CURRENT OUTCOME
                     </span>
                     <span className="text-xl font-black font-mono text-white">
                        {selectedFixture.homeScore === selectedFixture.awayScore ? "DRAW" : selectedFixture.homeScore > selectedFixture.awayScore ? getTeamName(selectedFixture.homeTeamId, true).toUpperCase() : getTeamName(selectedFixture.awayTeamId, true).toUpperCase()}
                     </span>
                   </div>
                   <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                     <span className="text-[9px] text-slate-400 font-bold uppercase block mb-1">
                       TOTAL GOALS
                     </span>
                     <span className="text-xl font-black font-mono text-white">
                        {Math.floor(selectedFixture.homeScore) + Math.floor(selectedFixture.awayScore)} GOALS
                     </span>
                   </div>
                </div>

                <div className="text-center text-[10px] text-emerald-400 font-mono">
                  You can now place new in-play bets from the panel before resuming.
                </div>
              </div>
            ) : (
              <div className="bg-black/40 p-3 aspect-[18/10] relative flex items-center justify-center overflow-hidden border-b border-white/5">
                {/* 2D High-Fidelity Soccer Field Arena */}
                <div className="absolute inset-3 border border-emerald-500/20 rounded-lg bg-gradient-to-tr from-[#08230b] via-[#103e18] to-[#08230b] shadow-2xl select-none overflow-hidden flex items-center justify-center w-full h-full">
                  
                  {/* Field Grass stripes */}
                  <div className="absolute inset-0 flex divide-x divide-white/[0.02] pointer-events-none">
                    <div className="flex-1 bg-black/[0.05]"></div>
                    <div className="flex-1 bg-white/[0.02]"></div>
                    <div className="flex-1 bg-black/[0.05]"></div>
                    <div className="flex-1 bg-white/[0.02]"></div>
                    <div className="flex-1 bg-black/[0.05]"></div>
                    <div className="flex-1 bg-white/[0.02]"></div>
                  </div>

                  {/* Pitch Line markings */}
                  <div className="absolute inset-2 border border-white/10 rounded-md pointer-events-none"></div>
                  <div className="absolute inset-y-2 left-2 w-12 border-r border-y border-white/10 pointer-events-none"></div>
                  <div className="absolute inset-y-2 right-2 w-12 border-l border-y border-white/10 pointer-events-none"></div>
                  <div className="absolute inset-y-1/3 left-2 w-6 border-r border-y border-white/5 pointer-events-none"></div>
                  <div className="absolute inset-y-1/3 right-2 w-6 border-l border-y border-white/5 pointer-events-none"></div>

                  {/* Midfield Line & Center circle */}
                  <div className="absolute inset-y-0 left-1/2 w-[1px] bg-white/10 pointer-events-none"></div>
                  <div className="absolute h-16 w-16 rounded-full border border-white/10 pointer-events-none"></div>
                  <div className="absolute h-2 w-2 rounded-full bg-white/20 pointer-events-none"></div>

                  {/* Stadium Spotlights Corner Glow */}
                  <div className="absolute -top-12 -left-12 w-24 h-24 bg-sky-400/10 rounded-full blur-xl pointer-events-none"></div>
                  <div className="absolute -top-12 -right-12 w-24 h-24 bg-sky-400/10 rounded-full blur-xl pointer-events-none"></div>

                  {/* Animated Attack Indicators (Pulse Ring) */}
                  <div 
                    className="absolute h-8 w-8 rounded-full border-2 border-emerald-400 bg-emerald-400/10 animate-ping pointer-events-none duration-1000 transition-all ease-out transform -translate-x-1/2 -translate-y-1/2"
                    style={{ left: pitchAction.y, top: pitchAction.x }}
                  ></div>

                  {/* Dynamic Action Overlay indicator badge */}
                  <div
                    className="absolute text-center flex flex-col items-center justify-center transition-all duration-700 ease-out z-10 p-2 text-[10px] sm:text-xs rounded-xl bg-slate-950/90 border border-emerald-500/20 shadow-2xl transform -translate-x-1/2 -translate-y-1/2 backdrop-blur-md"
                    style={{ left: pitchAction.y, top: pitchAction.x }}
                  >
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      <span className="h-2 w-2 rounded-full animate-pulse" style={{ backgroundColor: pitchAction.teamColor }}></span>
                      <span className="font-bold text-slate-100 font-sans tracking-wide uppercase">{pitchAction.msg}</span>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* Match Stats Bars */}
            <div className="p-4 space-y-3 border-b border-white/5">
              <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase select-none pb-1 font-mono tracking-wider border-b border-white/5">
                <span>STATS</span>
                <span>MATCH STATISTICS</span>
                <span>STATS</span>
              </div>
              
              {[
                { label: "Shots", homeVal: selectedFixture.stats.home.shots, awayVal: selectedFixture.stats.away.shots },
                { label: "Shots on Target", homeVal: selectedFixture.stats.home.shotsOnTarget, awayVal: selectedFixture.stats.away.shotsOnTarget },
                { label: "Passes Completed", homeVal: selectedFixture.stats.home.passes, awayVal: selectedFixture.stats.away.passes },
                { label: "Fouls Committed", homeVal: selectedFixture.stats.home.fouls, awayVal: selectedFixture.stats.away.fouls },
                { label: "Goalkeeper Saves", homeVal: selectedFixture.stats.home.saves, awayVal: selectedFixture.stats.away.saves },
              ].map((stat, sIdx) => {
                const total = stat.homeVal + stat.awayVal || 1;
                const hPct = Math.round((stat.homeVal / total) * 100);
                const aPct = Math.round((stat.awayVal / total) * 100);
                
                return (
                  <div key={sIdx} className="space-y-1 text-slate-200">
                    <div className="flex items-center justify-between text-[11px] font-mono leading-none select-none">
                      <span className="font-semibold text-emerald-400">{stat.homeVal}</span>
                      <span className="text-slate-500 font-sans uppercase font-bold text-[9px] text-center">{stat.label}</span>
                      <span className="font-semibold text-sky-400">{stat.awayVal}</span>
                    </div>
                    <div className="h-1.5 bg-black/45 rounded-full overflow-hidden flex relative border border-white/5">
                      <div className="h-full bg-emerald-500" style={{ width: `${hPct}%` }}></div>
                      <div className="h-full bg-slate-800/40 flex-1"></div>
                      <div className="h-full bg-sky-500" style={{ width: `${aPct}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* LIVE IN-PLAY BETTING */}
            {selectedFixture.status !== "FT" && (
              <div className="p-4 border-b border-white/5 space-y-4">
                <div className="flex items-center justify-between text-[10px] text-emerald-400 font-bold uppercase select-none pb-1 font-mono tracking-wider border-b border-white/5">
                  <span>IN-PLAY MARKETS</span>
                  <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span> LIVE ODDS</span>
                </div>
                
                {/* MATCH WINNER */}
                <div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase mb-2">1X2 Match Winner</div>
                  {(() => {
                    const boost = isOwnerMatchSelected ? 1.05 : 1;
                    const homeOdds = (() => { const r = getLiveInPlayOdds(selectedFixture, "MATCH_WINNER", "HOME", selectedFixture.odds?.homeWin ?? 2.0); return r ? Math.round(r * boost * 100) / 100 : null; })();
                    const drawOdds = (() => { const r = getLiveInPlayOdds(selectedFixture, "MATCH_WINNER", "DRAW", selectedFixture.odds?.draw ?? 3.0); return r ? Math.round(r * boost * 100) / 100 : null; })();
                    const awayOdds = (() => { const r = getLiveInPlayOdds(selectedFixture, "MATCH_WINNER", "AWAY", selectedFixture.odds?.awayWin ?? 2.0); return r ? Math.round(r * boost * 100) / 100 : null; })();
                    
                    return (
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: "HOME", odds: homeOdds, label: "HOME", fullName: `${getTeamName(selectedFixture.homeTeamId)} to Win` },
                          { id: "DRAW", odds: drawOdds, label: "DRAW", fullName: `Draw` },
                          { id: "AWAY", odds: awayOdds, label: "AWAY", fullName: `${getTeamName(selectedFixture.awayTeamId)} to Win` },
                        ].map(m => (
                          <button
                            key={m.id}
                            disabled={m.odds === null}
                            onClick={() => handleMarketClick(selectedFixture, "MATCH_WINNER", m.id, m.odds, m.fullName, "Match Winner")}
                            className={`py-2 rounded-xl flex flex-col items-center justify-center border transition-all cursor-pointer ${
                              m.odds === null
                                ? "bg-black/30 border-transparent text-slate-600 cursor-not-allowed opacity-50"
                                : isSelected(selectedFixture.id, "MATCH_WINNER", m.id)
                                ? "bg-emerald-500/15 border-emerald-500 text-emerald-400 font-bold"
                                : "bg-black/20 border-white/5 text-slate-300 hover:border-white/15 hover:bg-white/5"
                            }`}
                          >
                            <span className="text-[9px] text-slate-400 font-bold block leading-none mb-1">{m.label}</span>
                            <span className="text-[11px] font-mono font-black tracking-tight leading-none text-slate-100">
                              {m.odds !== null ? `@${m.odds.toFixed(2)}` : "🔒 SUSP"}
                            </span>
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {/* BTTS */}
                <div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase mb-2">Both Teams To Score</div>
                  {(() => {
                    const boost = isOwnerMatchSelected ? 1.05 : 1;
                    const yesOdds = (() => { const r = getLiveInPlayOdds(selectedFixture, "BOTH_TEAMS_TO_SCORE", "YES", selectedFixture.odds?.bothTeamsToScore?.yes ?? 1.90); return r ? Math.round(r * boost * 100) / 100 : null; })();
                    const noOdds = (() => { const r = getLiveInPlayOdds(selectedFixture, "BOTH_TEAMS_TO_SCORE", "NO", selectedFixture.odds?.bothTeamsToScore?.no ?? 1.90); return r ? Math.round(r * boost * 100) / 100 : null; })();
                    
                    return (
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: "YES", odds: yesOdds, label: "YES", fullName: `Both Teams To Score: Yes` },
                          { id: "NO", odds: noOdds, label: "NO", fullName: `Both Teams To Score: No` },
                        ].map(m => (
                          <button
                            key={m.id}
                            disabled={m.odds === null}
                            onClick={() => handleMarketClick(selectedFixture, "BOTH_TEAMS_TO_SCORE", m.id, m.odds, m.fullName, "BTTS")}
                            className={`py-2 rounded-xl flex flex-col items-center justify-center border transition-all cursor-pointer ${
                              m.odds === null
                                ? "bg-black/30 border-transparent text-slate-600 cursor-not-allowed opacity-50"
                                : isSelected(selectedFixture.id, "BOTH_TEAMS_TO_SCORE", m.id)
                                ? "bg-emerald-500/15 border-emerald-500 text-emerald-400 font-bold"
                                : "bg-black/20 border-white/5 text-slate-300 hover:border-white/15 hover:bg-white/5"
                            }`}
                          >
                            <span className="text-[9px] text-slate-400 font-bold block leading-none mb-1">{m.label}</span>
                            <span className="text-[11px] font-mono font-black tracking-tight leading-none text-slate-100">
                              {m.odds !== null ? `@${m.odds.toFixed(2)}` : "🔒 SUSP"}
                            </span>
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Commentary Timelines (autoscrolling list) */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 max-h-[220px] no-scrollbar glass-scrollbar">
              <span className="text-[10px] font-mono font-bold tracking-widest text-slate-505 uppercase block mb-1 select-none">
                COMMENTARY FLIGHT DECK
              </span>
              
              {selectedFixture.events.length === 0 ? (
                <div className="text-center text-[11px] text-slate-600 font-mono py-8">
                  📻 Match awaiting whistle... Click "Watch Match Live" to start!
                </div>
              ) : (
                selectedFixture.events.map((ev, evIdx) => {
                  let eventIcon = "💬";
                  if (ev.type === "GOAL") eventIcon = "⚽";
                  if (ev.type === "SAVE") eventIcon = "🧤";
                  if (ev.type === "YELLOW_CARD") eventIcon = "🟨";
                  if (ev.type === "RED_CARD") eventIcon = "🟥";
                  if (ev.type === "HALF_TIME" || ev.type === "FULL_TIME") eventIcon = "⏸️";
                  
                  return (
                    <div key={evIdx} className="flex gap-2.5 items-start text-[11px] leading-tight">
                      <span className="font-mono text-emerald-450 font-extrabold shrink-0 w-8 text-right">
                        {ev.minute}'
                      </span>
                      <span className="bg-white/5 border border-white/10 text-[9px] p-1 rounded-md shrink-0">
                        {eventIcon}
                      </span>
                      <p className="text-slate-300 font-medium">
                        {ev.commentary}
                      </p>
                    </div>
                  );
                })
              )}
              {isSelectedFT && (() => {
                const motm = selectedFixture.motm ?? calculateMOTM(selectedFixture, teams);
                if (!motm) return null;
                const motmTeam = teams.find((t) => t.id === motm.teamId);
                return (
                  <div className="mt-4 mb-1 rounded-xl border border-yellow-500/40 bg-yellow-500/8 p-3.5 shadow-[0_0_16px_rgba(234,179,8,0.08)]">
                    <p className="text-[9px] font-mono font-black uppercase tracking-widest text-yellow-400 mb-2">
                      ⭐ Player of the Match
                    </p>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-white">{motm.playerName}</p>
                        <p className="text-[10px] text-yellow-300/70 font-mono">{motmTeam?.shortName ?? motmTeam?.name ?? ""}</p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5 capitalize">{motm.reason}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-2xl font-black text-yellow-400 font-mono">{motm.score.toFixed(1)}</p>
                        <p className="text-[9px] text-slate-500 font-mono uppercase tracking-wider">Match Rating</p>
                      </div>
                    </div>
                  </div>
                );
              })()}
              {isSelectedFT && (() => {
                const { home, away } = computeMatchRatings(selectedFixture, teams);
                if (home.length === 0 && away.length === 0) return null;
                const hTeam = teams.find((t) => t.id === selectedFixture.homeTeamId);
                const aTeam = teams.find((t) => t.id === selectedFixture.awayTeamId);
                const renderCol = (label: string, list: typeof home) => (
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-mono font-black uppercase tracking-widest text-slate-400 mb-1.5 truncate">{label}</p>
                    <div className="space-y-1">
                      {[...list].sort((x, y) => y.rating - x.rating).map((r) => (
                        <div key={r.playerId} className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1 border ${r.isMotm ? "border-yellow-500/40 bg-yellow-500/5" : "border-white/5 bg-black/20"}`}>
                          <span className="text-[10px] text-slate-200 truncate flex items-center gap-1 min-w-0">
                            {r.isMotm && <span title="Player of the Match">⭐</span>}
                            <span className="truncate">{cleanPlayerName(r.name)}</span>
                          </span>
                          <span className={`text-[10px] font-black font-mono px-1.5 py-0.5 rounded border shrink-0 ${ratingColorClass(r.rating)}`}>{r.rating.toFixed(1)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
                return (
                  <div className="mt-3 rounded-xl border border-white/5 bg-black/20 p-3">
                    <p className="text-[9px] font-mono font-black uppercase tracking-widest text-emerald-400 mb-2">📊 Player Ratings (Full Time)</p>
                    <div className="flex gap-3">
                      {renderCol(hTeam?.shortName ?? "Home", home)}
                      {renderCol(aTeam?.shortName ?? "Away", away)}
                    </div>
                  </div>
                );
              })()}
              <div ref={commentaryEndRef}></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
