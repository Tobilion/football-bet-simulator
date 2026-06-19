import React from "react";
import { Fixture, Team } from "../types";
import { TeamCrest } from "./TeamCrest";

interface TournamentBracketProps {
  fixtures: Fixture[];
  teams: Team[];
}

export const TournamentBracket: React.FC<TournamentBracketProps> = ({ fixtures, teams }) => {
  
  const getTeam = (id: string): Team | undefined => {
    return teams.find(t => t.id === id);
  };

  const getTeamName = (id: string, short: boolean = false) => {
    const t = getTeam(id);
    return t ? (short ? t.shortName : t.name) : "Loading";
  };

  const formatScore = (score: number) => {
    if (score % 1 === 0) return score.toString();
    return Math.floor(score).toString(); // hide shootout decimal
  };

  const hasShootout = (fixture: Fixture) => {
    return fixture.homeScore % 1 !== 0 || fixture.awayScore % 1 !== 0;
  };

  // Compile fixtures for each round
  const r0 = fixtures.filter(f => f.roundIndex === 0);
  const r1 = fixtures.filter(f => f.roundIndex === 1);
  const r2 = fixtures.filter(f => f.roundIndex === 2);
  const r3 = fixtures.filter(f => f.roundIndex === 3);
  const r4 = fixtures.filter(f => f.roundIndex === 4);

  // High-fidelity node rendering
  const renderMatchNode = (
    fixture: Fixture | undefined,
    roundIdx: number,
    matchIndex: number
  ) => {
    if (!fixture) {
      // Return placeholder card
      const parentMatchIndex1 = matchIndex * 2;
      const parentMatchIndex2 = matchIndex * 2 + 1;
      const prevRoundLetter = roundIdx === 1 ? "Ro32" : roundIdx === 2 ? "Ro16" : roundIdx === 3 ? "QF" : "SF";

      return (
        <div className="glass-card bg-white/2 border border-white/5 rounded-2xl p-3 flex flex-col justify-center h-20 min-w-[210px] select-none text-[9px] text-slate-500 font-mono italic text-center leading-tight">
          🛡️ Awaiting results:<br />
          Winner of {prevRoundLetter}-M{parentMatchIndex1 + 1}<br />
          vs Winner of {prevRoundLetter}-M{parentMatchIndex2 + 1}
        </div>
      );
    }

    const homeT = getTeam(fixture.homeTeamId);
    const awayT = getTeam(fixture.awayTeamId);
    const isFT = fixture.status === "FT";
    
    // Evaluate winner
    const homeWins = isFT && fixture.homeScore > fixture.awayScore;
    const awayWins = isFT && fixture.awayScore > fixture.homeScore;

    return (
      <div className={`glass-card border rounded-2xl p-2.5 flex flex-col justify-center h-20 min-w-[210px] select-none transition-all duration-150 ${
        isFT ? "border-white/5 bg-black/35 opacity-90 hover:bg-white/5" : "border-emerald-450 bg-emerald-500/5 shadow-[0_0_15px_rgba(16,185,129,0.1)] scale-[1.01]"
      }`}>
        <span className="text-[7px] text-slate-400 font-bold font-mono tracking-widest block uppercase mb-1 leading-none text-center">
          MATCH {matchIndex + 1} {fixture.status === "FT" ? "• FT" : fixture.status === "LIVE" ? "• LIVE" : "• SCH"}
        </span>

        {/* Home Team Row */}
        <div className={`flex items-center justify-between text-[11px] py-0.5 ${homeWins ? "font-bold text-emerald-400 font-sans" : isFT ? "text-slate-500" : "text-slate-300"}`}>
          <div className="flex items-center gap-1.5 truncate max-w-[70%]">
            <TeamCrest team={homeT || { id: "p1", shortName: "??", primaryColor: "#333", secondaryColor: "#444" }} size={16} />
            <span className="truncate">{getTeamName(fixture.homeTeamId, true)}</span>
          </div>
          {isFT ? (
            <span className="font-mono">{formatScore(fixture.homeScore)}</span>
          ) : (
            <span className="text-[8px] text-slate-600 font-mono">-</span>
          )}
        </div>

        {/* Away Team Row */}
        <div className={`flex items-center justify-between text-[11px] py-0.5 ${awayWins ? "font-bold text-emerald-400 font-sans" : isFT ? "text-slate-500" : "text-slate-300"}`}>
          <div className="flex items-center gap-1.5 truncate max-w-[70%]">
            <TeamCrest team={awayT || { id: "p2", shortName: "??", primaryColor: "#333", secondaryColor: "#444" }} size={16} />
            <span className="truncate">{getTeamName(fixture.awayTeamId, true)}</span>
          </div>
          {isFT ? (
            <span className="font-mono">{formatScore(fixture.awayScore)}</span>
          ) : (
            <span className="text-[8px] text-slate-600 font-mono">-</span>
          )}
        </div>

        {/* Penalty details marker */}
        {isFT && hasShootout(fixture) && (
          <span className="text-[7px] font-extrabold text-emerald-400 font-mono uppercase text-center block mt-1 leading-none">
            {fixture.homeScore > fixture.awayScore 
              ? `${getTeamName(fixture.homeTeamId, true)} Qualified (${fixture.penaltyScore || "pens"})` 
              : `${getTeamName(fixture.awayTeamId, true)} Qualified (${fixture.penaltyScore || "pens"})`}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 min-height-0 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6 no-scrollbar max-h-none">
      
      {/* Title */}
      <div className="border-b border-white/5 pb-3 select-none">
        <span className="text-[10px] text-emerald-400 font-mono tracking-widest block uppercase font-bold">
          TOURNAMENT PROGRESS TREE
        </span>
        <h2 className="text-sm font-bold text-slate-100 font-sans tracking-tight mt-1">
          Visual Tournament Bracket Roadmap (Ro32 to Grand Final)
        </h2>
      </div>

      {/* Bracket Scrolling viewport */}
      <div className="overflow-x-auto pb-4 pt-1 flex items-start gap-8 min-width-full no-scrollbar select-none">
        
        {/* Stages columns */}
        {[
          { label: "Round of 32", fixtures: r0, count: 16, roundIdx: 0, gapClass: "space-y-4" },
          { label: "Round of 16", fixtures: r1, count: 8, roundIdx: 1, gapClass: "space-y-12 py-8" },
          { label: "Quarterfinals", fixtures: r2, count: 4, roundIdx: 2, gapClass: "space-y-28 py-16" },
          { label: "Semifinals", fixtures: r3, count: 2, roundIdx: 3, gapClass: "space-y-[240px] py-[100px]" },
          { label: "Grand Final", fixtures: r4, count: 1, roundIdx: 4, gapClass: "space-y-0 py-[260px]" }
        ].map(stage => {
          return (
            <div key={stage.label} className="flex flex-col gap-2 shrink-0">
              {/* Column Label indicator */}
              <div className="glass-panel bg-white/5 border border-white/10 rounded-xl p-2 text-center text-[10px] font-extrabold tracking-widest text-slate-300 uppercase font-mono mb-2">
                {stage.label}
              </div>

              {/* Rows matching gaps */}
              <div className={`flex flex-col justify-around ${stage.gapClass} h-full`}>
                {Array.from({ length: stage.count }).map((_, index) => {
                  const fix = stage.fixtures[index];
                  return (
                    <div key={index} className="flex flex-col justify-center">
                      {renderMatchNode(fix, stage.roundIdx, index)}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
