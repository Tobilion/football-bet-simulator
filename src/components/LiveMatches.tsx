import React, { useState, useEffect, useRef } from "react";
import { Fixture, Team } from "../types";
import { TeamCrest } from "./TeamCrest";

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
  setSelectedFixtureId
}) => {
  // Filters active fixtures for current round
  const activeFixtures = fixtures.filter(f => f.roundIndex === roundIndex);
  
  useEffect(() => {
    if (activeFixtures.length > 0 && !selectedFixtureId) {
      setSelectedFixtureId(activeFixtures[0].id);
    }
  }, [activeFixtures, selectedFixtureId, setSelectedFixtureId]);

  // Speed selection
  const [speedMode, setSpeedMode] = useState<"broadcast" | "fast">("fast");
  const speedMap = { "broadcast": 6000, "fast": 450 };

  const triggerGlobalEntity = (type: "team" | "player", id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent("open-global-entity", { detail: { type, id } }));
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
                      ▶️ WATCH MATCH LIVE (90 mins)
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
              <span className="text-[9px] text-slate-405 block uppercase font-black font-mono tracking-widest mb-1 select-none font-sans">
                EVENT FOCUS • GRAPHIC SPORTSCAST
              </span>
              
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

            {/* 2D Mini Soccer Field visual attack */}
            <div className="bg-black/40 p-2 aspect-[16/10] relative flex items-center justify-center overflow-hidden border-b border-white/5">
              <div className="absolute inset-2 border-2 border-slate-700/20 rounded-lg flex items-center justify-center bg-radial from-[#133f21] to-[#0a2612] shadow-inner select-none opacity-85">
                <div className="h-16 w-16 rounded-full border-2 border-slate-600/10 absolute"></div>
                <div className="h-full w-0.5 bg-slate-600/10 absolute"></div>
                <div className="absolute left-0 top-1/4 bottom-1/4 w-12 border border-r border-l-0 border-slate-600/10"></div>
                <div className="absolute right-0 top-1/4 bottom-1/4 w-12 border border-l border-r-0 border-slate-600/10"></div>
              </div>

              {/* Dynamic Action Overlay indicator */}
              <div
                className="absolute text-center flex flex-col items-center justify-center transition-all duration-500 scale-100 ease-out z-10 p-2 text-xs rounded bg-slate-900/95 border border-white/10 shadow-md transform -translate-x-1/2 -translate-y-1/2"
                style={{ left: pitchAction.x, top: pitchAction.y }}
              >
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: pitchAction.teamColor }}></span>
                  <span className="font-semibold text-slate-205">{pitchAction.msg}</span>
                </div>
              </div>
            </div>

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
              <div ref={commentaryEndRef}></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
