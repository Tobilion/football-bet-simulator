import React, { useState, useMemo } from "react";
import { BankrollChart } from "./charts/BankrollChart";
import { Team, Player, Profile } from "../types";
import { formatMoney } from "../utils";
import { TeamCrest } from "./TeamCrest";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart } from "recharts";

interface AnalyticsProps {
  teams: Team[];
  fixtures: any[]; // all fixtures generated so far
  userProfile?: Profile;
}

export const Analytics: React.FC<AnalyticsProps> = ({ teams, fixtures, userProfile }) => {
  const [primaryTab, setPrimaryTab] = useState<"sports" | "finance">("finance");
  const [activeStatTab, setActiveStatTab] = useState<"goals" | "assists" | "saves" | "discipline">("goals");

  const triggerGlobalEntity = (type: "team" | "player", id: string) => {
    const evt = new CustomEvent("open-global-entity", {
      detail: { type, id }
    });
    window.dispatchEvent(evt);
  };

  // State to toggle remaining top 5 for each category
  const [showTop5, setShowTop5] = useState<{ [key: string]: boolean }>({
    goals: false,
    assists: false,
    saves: false,
    discipline: false,
  });

  const toggleTop5 = (category: string) => {
    setShowTop5(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  // Collect all players across all 32 teams with complete squad references
  const allPlayers: (Player & { teamName: string; teamCrest: Pick<Team, "id" | "shortName" | "primaryColor" | "secondaryColor"> })[] = [];
  teams.forEach(t => {
    t.players.forEach(p => {
      allPlayers.push({
        ...p,
        teamName: t.name,
        teamCrest: { id: t.id, shortName: t.shortName, primaryColor: t.primaryColor, secondaryColor: t.secondaryColor }
      });
    });
  });

  // Filters for completed fixtures
  const ftFixtures = fixtures.filter(f => f.status === "FT");
  const totalCompleted = ftFixtures.length;

  // Calculate Overall Averages
  const totalGoals = ftFixtures.reduce((acc, f) => acc + Math.floor(f.homeScore + f.awayScore), 0);
  const avgGoals = totalCompleted > 0 ? (totalGoals / totalCompleted).toFixed(2) : "0.00";
  
  const totalYellows = ftFixtures.reduce((acc, f) => acc + f.stats.home.yellowCards + f.stats.away.yellowCards, 0);
  const totalReds = ftFixtures.reduce((acc, f) => acc + f.stats.home.redCards + f.stats.away.redCards, 0);

  // Leaderboard lists (Top 6: Rank 1, plus remaining 5 options)
  const topScorers = [...allPlayers].sort((a, b) => b.goals - a.goals || b.rating - a.rating).slice(0, 6);
  const topAssists = [...allPlayers].sort((a, b) => b.assists - a.assists || b.rating - a.rating).slice(0, 6);
  const topSaves = [...allPlayers].filter(p => p.position === "GK").sort((a, b) => b.saves - a.saves || b.rating - a.rating).slice(0, 6);
  
  // Discipline index tracker (yellow = 1pt, red = 2pt)
  const getDisciplineScore = (p: any) => p.yellowCards * 1 + p.redCards * 2;
  const topCards = [...allPlayers]
    .filter(p => p.yellowCards > 0 || p.redCards > 0)
    .sort((a, b) => getDisciplineScore(b) - getDisciplineScore(a) || b.rating - a.rating)
    .slice(0, 6);

  // Team goals comparison data
  const teamGoalsData = [...teams]
    .map(t => ({ name: t.name, short: t.shortName, goals: t.goalsScored, crest: t }))
    .sort((a, b) => b.goals - a.goals)
    .slice(0, 10);

  // Quick helper to render the First-Placed Player Hero Card
  const renderFirstPlaceHero = (player: typeof allPlayers[0], metricLabel: string, metricValue: any, subLabel: string, labelBg: string) => {
    if (!player) return null;
    return (
      <div className="bg-gradient-to-r from-emerald-500/10 via-emerald-600/5 to-transparent border border-emerald-500/30 p-5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 select-none relative overflow-hidden shadow-lg shadow-emerald-500/5 mb-4 animate-fade-in">
        <div className="absolute right-0 top-0 text-7xl translate-y-2 translate-x-2 text-white/2 select-none pointer-events-none font-black opacity-10">
          👑
        </div>
        
        <div className="flex items-center gap-4 text-center md:text-left flex-col md:flex-row">
          {/* Rank Badge */}
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-500 p-0.5 flex items-center justify-center text-slate-950 shadow-md transform hover:scale-105 active:scale-95 transition-all">
            <div className="bg-slate-900 text-amber-400 h-full w-full rounded-2xl flex flex-col items-center justify-center font-bold">
              <span className="text-[9px] uppercase leading-none font-black tracking-widest text-slate-400 font-sans">RANK</span>
              <span className="text-xl font-sans leading-none mt-1 font-extrabold">#1</span>
            </div>
          </div>

          <div className="flex flex-col items-center md:items-start gap-1">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => triggerGlobalEntity("team", player.teamCrest.id)}
                className="transform hover:scale-110 active:scale-95 transition-all cursor-pointer"
                title="View Team Profile"
              >
                <TeamCrest team={player.teamCrest} size={24} />
              </button>
              <h4 
                onClick={() => triggerGlobalEntity("player", player.id)}
                className="text-sm font-black text-slate-100 hover:text-emerald-400 cursor-pointer hover:underline transition-all font-sans tracking-tight"
                title="View Player Portrait Capabilities"
              >
                {player.name}
              </h4>
            </div>
            
            <p className="text-[10px] text-slate-400 font-mono">
              Club: <span onClick={() => triggerGlobalEntity("team", player.teamCrest.id)} className="text-slate-300 hover:text-emerald-405 font-bold hover:underline cursor-pointer">{player.teamName}</span> • Position: <span className="font-bold text-emerald-400">{player.position}</span> (OVR {player.rating})
            </p>
          </div>
        </div>

        {/* Highlight Score column */}
        <div className="text-center md:text-right bg-black/45 border border-white/5 py-3 px-5 rounded-xl min-w-[110px]">
          <span className={`text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded leading-none ${labelBg}`}>
            {metricLabel}
          </span>
          <span className="text-2xl font-mono font-black text-emerald-400 mt-1 block leading-none">
            {metricValue}
          </span>
          <span className="text-[9px] text-slate-404 font-mono mt-1 block uppercase">
            {subLabel}
          </span>
        </div>
      </div>
    );
  };

  // --- FINANCE & BETTING DNA CALCULATIONS ---
  const financeData = useMemo(() => {
    if (!userProfile) return null;
    
    // Bankroll Chart Data (with fallback if history is empty)
    const history = userProfile.bankrollHistory || [];
    let chartData = history.map((h, idx) => ({
      name: idx,
      time: new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      balance: h.balance
    }));
    
    // If few points, add implicit starting balance
    if (chartData.length < 2) {
      chartData = [
         { name: 0, time: 'Start', balance: 1000 },
         ...chartData,
         { name: chartData.length + 1, time: 'Now', balance: userProfile.balance }
      ];
    }
    
    // Win Rate and Biggest Win
    const legacyBB = (userProfile.betBuilderTickets || []).map(bb => ({
      status: bb.status, stake: bb.stake, potentialPayout: bb.potentialPayout,
      cashedOutAmount: undefined as number | undefined,
      selections: bb.selections.map(s => ({ marketType: s.marketType })),
    }));
    const allT = [...userProfile.tickets, ...legacyBB] as typeof userProfile.tickets;
    const completedTickets = allT.filter(t => t.status === "WON" || t.status === "LOST" || t.status === "CASHED_OUT");
    const wonTickets = allT.filter(t => t.status === "WON" || t.status === "CASHED_OUT");
    const winRate = completedTickets.length > 0 ? ((wonTickets.length / completedTickets.length) * 100).toFixed(1) : "0.0";
    
    let biggestWin = 0;
    wonTickets.forEach(t => {
      const profit = (t.status === "CASHED_OUT" ? (t.cashedOutAmount || 0) : t.potentialPayout) - t.stake;
      if (profit > biggestWin) biggestWin = profit;
    });

    // Best Market Analysis
    const marketProfits: Record<string, number> = {};
    completedTickets.forEach(t => {
       t.selections.forEach(sel => {
           if (!marketProfits[sel.marketType]) marketProfits[sel.marketType] = 0;
           const isCashed = t.status === "CASHED_OUT";
           const isWon = t.status === "WON";
           const fraction = 1 / t.selections.length; 
           let profitContrif = 0;
           if (isWon) profitContrif = (t.potentialPayout - t.stake) * fraction;
           else if (isCashed) profitContrif = ((t.cashedOutAmount || 0) - t.stake) * fraction;
           else if (t.status === "LOST") profitContrif = -t.stake * fraction;
           
           marketProfits[sel.marketType] += profitContrif;
       });
    });

    let bestMarket = "N/A";
    let bestMarketProfit = -Infinity;
    let totalWinsProfits = 0;

    Object.entries(marketProfits).forEach(([mkt, prof]) => {
      if (prof > 0) totalWinsProfits += prof;
      if (prof > bestMarketProfit) {
         bestMarketProfit = prof;
         bestMarket = mkt;
      }
    });

    const bestMarketPct = totalWinsProfits > 0 && bestMarketProfit > 0 ? ((bestMarketProfit / totalWinsProfits) * 100).toFixed(0) : "0";
    
    const marketLabelMap: Record<string, string> = {
      MATCH_WINNER: "Match Winner",
      EXACT_SCORE: "Exact Score",
      OVER_UNDER_GOALS: "Over/Under Goals",
      OVER_UNDER_CORNERS: "Over/Under Corners",
      BOTH_TEAMS_TO_SCORE: "BTTS",
      ANYTIME_GOALSCORER: "Goalscorer"
    };

    return {
      chartData,
      winRate,
      completedCount: completedTickets.length,
      biggestWin,
      bestMarket: marketLabelMap[bestMarket] || bestMarket.replace(/_/g, ' '),
      bestMarketPct
    };
  }, [userProfile]);

  return (
    <div className="flex-1 min-height-0 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6 no-scrollbar max-h-none">

      {/* Bankroll Curve */}
      {userProfile && (userProfile.bankrollHistory?.length ?? 0) >= 2 && (
        <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">Bankroll Curve</p>
              <p className="text-xs font-semibold text-slate-200 mt-0.5">Balance history across all activity</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-slate-500 font-mono">Current</p>
              <p className={`text-sm font-black font-mono ${userProfile.balance >= 1000 ? "text-emerald-400" : "text-red-400"}`}>
                ${userProfile.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
          <BankrollChart history={userProfile.bankrollHistory} startingBalance={1000} />
        </div>
      )}

      {/* Tab Switcher for Primary Content */}
      <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 mb-6 max-w-sm">
        <button
          onClick={() => setPrimaryTab("finance")}
          className={`flex-1 py-1.5 text-xs font-bold font-mono uppercase tracking-wider rounded-lg transition-all ${
            primaryTab === "finance" ? "bg-white/10 text-emerald-400 shadow" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          My Finance
        </button>
        <button
          onClick={() => setPrimaryTab("sports")}
          className={`flex-1 py-1.5 text-xs font-bold font-mono uppercase tracking-wider rounded-lg transition-all ${
            primaryTab === "sports" ? "bg-white/10 text-emerald-400 shadow" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Sports Stats
        </button>
      </div>

      {primaryTab === "sports" ? (
      <>
      {/* Title */}
      <div className="border-b border-white/5 pb-3">
        <span className="text-[10px] text-emerald-400 font-mono tracking-widest block uppercase font-bold">
          STATISTICAL DATABASE CENTRE
        </span>
        <h2 className="text-sm font-bold text-slate-100 font-sans tracking-tight mt-1">
          Player Leaderboards & Team Performance Metrics

        </h2>
      </div>

      {/* Tournament benchmarks Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass-card border border-white/5 rounded-2xl p-4 flex flex-col justify-between text-center select-none">
          <span className="text-[9px] text-slate-400 font-bold uppercase font-sans">TOTAL MATCHES SIMULATED</span>
          <span className="text-base font-black font-mono text-slate-200 mt-1">
            {totalCompleted}
          </span>
          <p className="text-[8px] text-slate-500 font-mono mt-1 uppercase">
            COMPLETED OUTCOMES
          </p>
        </div>

        <div className="glass-card border border-white/5 rounded-2xl p-4 flex flex-col justify-between text-center select-none">
          <span className="text-[9px] text-slate-400 font-bold uppercase font-sans">TOTAL GOALS SCORED</span>
          <span className="text-base font-black font-mono text-emerald-400 mt-1">
            {totalGoals}
          </span>
          <p className="text-[8px] text-emerald-500/60 font-mono mt-1 uppercase">
            AVG: {avgGoals} PER MATCH
          </p>
        </div>

        <div className="glass-card border border-white/5 rounded-2xl p-4 flex flex-col justify-between text-center select-none">
          <span className="text-[9px] text-slate-400 font-bold uppercase font-sans">YELLOW CAUTIONS SHOWN</span>
          <span className="text-base font-black font-mono text-yellow-405 mt-1">
            {totalYellows}
          </span>
          <p className="text-[8px] text-yellow-500/60 font-mono mt-1 uppercase">
            WARNINGS LOGGED
          </p>
        </div>

        <div className="glass-card border border-white/5 rounded-2xl p-4 flex flex-col justify-between text-center select-none">
          <span className="text-[9px] text-slate-400 font-bold uppercase font-sans">RED CARDS / SEND-OFFS</span>
          <span className="text-base font-black font-mono text-rose-455 mt-1">
            {totalReds}
          </span>
          <p className="text-[8px] text-red-500/60 font-mono mt-1 uppercase">
            EJECTIONS DEALT
          </p>
        </div>
      </div>

      {/* Main content grid split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Top Player statistics Lists (Col-span 7) */}
        <div className="lg:col-span-7 glass-panel-heavy rounded-2xl border border-white/10 overflow-hidden">
          {/* Tabs header */}
          <div className="bg-white/5 border-b border-white/5 p-1 px-1.5 grid grid-cols-4 gap-1">
            {(["goals", "assists", "saves", "discipline"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveStatTab(tab)}
                className={`py-2 rounded-xl text-[10px] font-bold tracking-wider uppercase transition-all cursor-pointer ${
                  activeStatTab === tab
                    ? "bg-white/10 text-emerald-400 border border-white/5 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {tab === "goals" ? "⚽ SCORERS" : tab === "assists" ? "🎯 ASSISTS" : tab === "saves" ? "🧤 SAVES" : "🟥 DISCIPLINE"}
              </button>
            ))}
          </div>

          <div className="p-4">
            <span className="text-[10px] text-slate-400 font-mono font-bold uppercase block tracking-wider mb-3 font-sans">
              {activeStatTab === "goals" && "GOLDEN BOOT • LEADERBOARD STANDING"}
              {activeStatTab === "assists" && "CREATIVE MAESTRO • TOP PASS DIRECTS"}
              {activeStatTab === "saves" && "GOLDEN GLOVE • GOALKEEPER REFLEX BLOCKS"}
              {activeStatTab === "discipline" && "DISCIPLINARY BENCHMARKS • CAUTION WEIGHT INDEX"}
            </span>

            {/* TAB LAYOUT WITH HERO #1 AND COLLAPSED TOP 5 */}
            <div className="space-y-3">
              {activeStatTab === "goals" && (
                <>
                  {topScorers.length > 0 ? (
                    <>
                      {/* Hero First Person */}
                      {renderFirstPlaceHero(topScorers[0], "GOLDEN BOOT", `${topScorers[0].goals} Goals`, "TOTAL SCORES", "bg-emerald-500/20 text-emerald-400")}
                      
                      {/* Interactive toggle for the remaining top 5 */}
                      <button
                        onClick={() => toggleTop5("goals")}
                        className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-xs font-bold font-mono text-slate-350 hover:text-white cursor-pointer transition-all flex items-center justify-center gap-2 select-none"
                      >
                        {showTop5.goals ? "▲ Hide Remaining Positions" : "▼ Show Remaining top 5 positions"}
                      </button>

                      {/* Collapsible list */}
                      {showTop5.goals && (
                        <div className="space-y-2 mt-2 animate-fade-in border-t border-white/5 pt-3">
                          {topScorers.slice(1).map((p, idx) => (
                            <div 
                              key={p.id} 
                              onClick={() => triggerGlobalEntity("player", p.id)}
                              className="bg-black/25 hover:bg-white/5 cursor-pointer border border-white/5 p-2 px-3 rounded-xl flex items-center justify-between text-xs transition-all hover:border-emerald-500/30 select-none"
                              title="Click to view capabilities portrait"
                            >
                              <div className="flex items-center gap-3">
                                <span className="font-mono text-slate-500 font-black w-4 text-center">#{idx + 2}.</span>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    triggerGlobalEntity("team", p.teamCrest.id);
                                  }}
                                  className="transform hover:scale-110 active:scale-95 transition-all cursor-pointer"
                                  title="View Team Profile"
                                >
                                  <TeamCrest team={p.teamCrest} size={20} />
                                </button>
                                <div>
                                  <span className="font-black text-slate-200 hover:text-emerald-400 font-sans block text-xs">{p.name}</span>
                                  <span className="text-[10px] text-slate-400 font-mono block">
                                    <span 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        triggerGlobalEntity("team", p.teamCrest.id);
                                      }}
                                      className="hover:underline hover:text-slate-200"
                                    >
                                      {p.teamName}
                                    </span> • OVR {p.rating}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-[13px] font-mono font-black text-emerald-450">{p.goals}</span>
                                <span className="text-[9px] text-slate-500 font-mono block uppercase leading-none mt-0.5">Goals</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-center text-slate-500 text-xs py-8">Simulate matches to populate player lists!</p>
                  )}
                </>
              )}

              {activeStatTab === "assists" && (
                <>
                  {topAssists.length > 0 ? (
                    <>
                      {renderFirstPlaceHero(topAssists[0], "CREATIVE MAESTRO", `${topAssists[0].assists} Assists`, "TOTAL ASSISTS", "bg-sky-500/20 text-sky-405")}
                      
                      <button
                        onClick={() => toggleTop5("assists")}
                        className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-xs font-bold font-mono text-slate-350 hover:text-white cursor-pointer transition-all flex items-center justify-center gap-2 select-none"
                      >
                        {showTop5.assists ? "▲ Hide Remaining Positions" : "▼ Show Remaining top 5 positions"}
                      </button>

                      {showTop5.assists && (
                        <div className="space-y-2 mt-2 animate-fade-in border-t border-white/5 pt-3">
                          {topAssists.slice(1).map((p, idx) => (
                            <div 
                              key={p.id} 
                              onClick={() => triggerGlobalEntity("player", p.id)}
                              className="bg-black/25 hover:bg-white/5 cursor-pointer border border-white/5 p-2 px-3 rounded-xl flex items-center justify-between text-xs transition-all hover:border-emerald-500/30 select-none"
                              title="Click to view capabilities portrait"
                            >
                              <div className="flex items-center gap-3">
                                <span className="font-mono text-slate-500 font-black w-4 text-center">#{idx + 2}.</span>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    triggerGlobalEntity("team", p.teamCrest.id);
                                  }}
                                  className="transform hover:scale-110 active:scale-95 transition-all cursor-pointer"
                                  title="View Team Profile"
                                >
                                  <TeamCrest team={p.teamCrest} size={20} />
                                </button>
                                <div>
                                  <span className="font-black text-slate-200 hover:text-emerald-400 font-sans block text-xs">{p.name}</span>
                                  <span className="text-[10px] text-slate-400 font-mono block">
                                    <span 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        triggerGlobalEntity("team", p.teamCrest.id);
                                      }}
                                      className="hover:underline hover:text-slate-200"
                                    >
                                      {p.teamName}
                                    </span> • OVR {p.rating}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-[13px] font-mono font-black text-sky-400">{p.assists}</span>
                                <span className="text-[9px] text-slate-500 font-mono block uppercase leading-none mt-0.5">Assists</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-center text-slate-500 text-xs py-8">Simulate matches to populate player lists!</p>
                  )}
                </>
              )}

              {activeStatTab === "saves" && (
                <>
                  {topSaves.length > 0 ? (
                    <>
                      {renderFirstPlaceHero(topSaves[0], "GOLDEN GLOVE", `${topSaves[0].saves} Saves`, "REFLEX BLOCKS", "bg-emerald-500/20 text-emerald-400")}
                      
                      <button
                        onClick={() => toggleTop5("saves")}
                        className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-xs font-bold font-mono text-slate-350 hover:text-white cursor-pointer transition-all flex items-center justify-center gap-2 select-none"
                      >
                        {showTop5.saves ? "▲ Hide Remaining Positions" : "▼ Show Remaining top 5 positions"}
                      </button>

                      {showTop5.saves && (
                        <div className="space-y-2 mt-2 animate-fade-in border-t border-white/5 pt-3">
                          {topSaves.slice(1).map((p, idx) => (
                            <div 
                              key={p.id} 
                              onClick={() => triggerGlobalEntity("player", p.id)}
                              className="bg-black/25 hover:bg-white/5 cursor-pointer border border-white/5 p-2 px-3 rounded-xl flex items-center justify-between text-xs transition-all hover:border-emerald-500/30 select-none"
                              title="Click to view capabilities portrait"
                            >
                              <div className="flex items-center gap-3">
                                <span className="font-mono text-slate-500 font-black w-4 text-center">#{idx + 2}.</span>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    triggerGlobalEntity("team", p.teamCrest.id);
                                  }}
                                  className="transform hover:scale-110 active:scale-95 transition-all cursor-pointer"
                                  title="View Team Profile"
                                >
                                  <TeamCrest team={p.teamCrest} size={20} />
                                </button>
                                <div>
                                  <span className="font-black text-slate-200 hover:text-emerald-400 font-sans block text-xs">{p.name}</span>
                                  <span className="text-[10px] text-slate-400 font-mono block">
                                    <span 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        triggerGlobalEntity("team", p.teamCrest.id);
                                      }}
                                      className="hover:underline hover:text-slate-200"
                                    >
                                      {p.teamName}
                                    </span> • OVR {p.rating}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-[13px] font-mono font-black text-emerald-450">{p.saves}</span>
                                <span className="text-[9px] text-slate-500 font-mono block uppercase leading-none mt-0.5">Saves</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-center text-slate-500 text-xs py-8">Simulate matches to populate player lists!</p>
                  )}
                </>
              )}

              {activeStatTab === "discipline" && (
                <>
                  {topCards.length > 0 ? (
                    <>
                      {renderFirstPlaceHero(topCards[0], "CAUTION WEIGHT", `${getDisciplineScore(topCards[0])} Pts`, "DISCIPLINE SEVERE", "bg-red-500/20 text-red-405")}
                      
                      <button
                        onClick={() => toggleTop5("discipline")}
                        className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-xs font-bold font-mono text-slate-350 hover:text-white cursor-pointer transition-all flex items-center justify-center gap-2 select-none"
                      >
                        {showTop5.discipline ? "▲ Hide Remaining Positions" : "▼ Show Remaining top 5 positions"}
                      </button>

                      {showTop5.discipline && (
                        <div className="space-y-2 mt-2 animate-fade-in border-t border-white/5 pt-3">
                          {topCards.slice(1).map((p, idx) => {
                            const score = getDisciplineScore(p);
                            return (
                              <div 
                                key={p.id} 
                                onClick={() => triggerGlobalEntity("player", p.id)}
                                className="bg-black/25 hover:bg-white/5 cursor-pointer border border-white/5 p-2 px-3 rounded-xl flex items-center justify-between text-xs transition-all hover:border-emerald-500/30 select-none"
                                title="Click to view capabilities portrait"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="font-mono text-slate-500 font-black w-4 text-center">#{idx + 2}.</span>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      triggerGlobalEntity("team", p.teamCrest.id);
                                    }}
                                    className="transform hover:scale-110 active:scale-95 transition-all cursor-pointer"
                                    title="View Team Profile"
                                  >
                                    <TeamCrest team={p.teamCrest} size={20} />
                                  </button>
                                  <div>
                                    <span className="font-black text-slate-200 hover:text-emerald-400 font-sans block text-xs">{p.name}</span>
                                    <span className="text-[10px] text-slate-400 font-mono block">
                                      <span 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          triggerGlobalEntity("team", p.teamCrest.id);
                                        }}
                                        className="hover:underline hover:text-slate-200"
                                      >
                                        {p.teamName}
                                      </span> • Pos: {p.position}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 text-right">
                                  <div>
                                    <span className="text-[8px] text-slate-505 font-mono block uppercase">SCORE</span>
                                    <span className="text-[12px] font-mono font-black text-rose-500 leading-none">{score} PTS</span>
                                  </div>
                                  <div className="text-[10px] font-bold font-mono">
                                    {p.yellowCards > 0 && <span className="bg-yellow-500 text-slate-900 px-1 rounded-sm mr-1 font-bold">🟨 {p.yellowCards}</span>}
                                    {p.redCards > 0 && <span className="bg-red-600 text-slate-100 px-1 rounded-sm font-bold">🟥 {p.redCards}</span>}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-center text-slate-500 text-xs py-8">Simulate matches to populate player lists!</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Visual Charts Comparison: Team Goals Scored (Col-span 5) */}
        <div className="lg:col-span-5 glass-panel-heavy border border-white/10 rounded-2xl p-4.5 space-y-4">
          <div className="select-none">
            <span className="text-[10px] text-slate-400 font-mono font-bold uppercase block tracking-wider">
              GOAL RATING BENCHMARKS
            </span>
            <h3 className="text-xs font-bold text-slate-300 font-sans tracking-tight font-sans">
              Top 10 highest-scoring teams in season
            </h3>
          </div>

          {/* Graphical custom CSS bars chart */}
          <div className="space-y-3.5 select-none font-mono text-slate-200 text-xs">
            {teamGoalsData.length === 0 || teamGoalsData.every(t => t.goals === 0) ? (
              <div className="text-center text-slate-600 font-mono py-16 text-[11px]">
                🛡️ Chart awaiting simulated match stats...
              </div>
            ) : (
              (() => {
                const maxGoals = teamGoalsData[0].goals || 1;
                return teamGoalsData.map((td, index) => {
                  const barPct = Math.round((td.goals / maxGoals) * 100);
                  
                  return (
                    <div 
                      key={index} 
                      onClick={() => triggerGlobalEntity("team", td.crest.id)} 
                      className="space-y-1 hover:bg-white/5 p-1 rounded-lg transition-all cursor-pointer select-none"
                      title="Click to view club dossier"
                    >
                      <div className="flex items-center justify-between text-[10px] leading-tight font-medium">
                        <div className="flex items-center gap-1.5 font-bold">
                          <span className="text-[9px] text-slate-500 font-mono shrink-0 select-none w-3">
                            {index + 1}
                          </span>
                          <TeamCrest team={td.crest} size={16} />
                          <span className="truncate max-w-[120px] font-sans text-slate-350 hover:text-emerald-400 hover:underline transition-all">
                            {td.name}
                          </span>
                        </div>
                        <span className="font-extrabold text-[#34d399] tracking-wider block">
                          {td.goals} goals
                        </span>
                      </div>
                      {/* CSS progress track */}
                      <div className="h-2 bg-black/55 rounded-full flex shadow-inner border border-white/5">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                          style={{ width: `${barPct}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                });
              })()
            )}
          </div>
        </div>
      </div>
      </>
      ) : (
      /* FINANCE & BETTING DNA TAB */
      <div className="space-y-6 animate-fade-in">
        <div className="border-b border-white/5 pb-3">
          <span className="text-[10px] text-emerald-400 font-mono tracking-widest block uppercase font-bold">
            BANKROLL ANALYTICS
          </span>
          <h2 className="text-sm font-bold text-slate-100 font-sans tracking-tight mt-1">
            Profit Visualizer & Betting DNA
          </h2>
        </div>

        {/* DNA Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="glass-card border border-white/5 rounded-2xl p-4 flex flex-col justify-between text-center select-none">
            <span className="text-[9px] text-slate-400 font-bold uppercase font-sans">WIN RATE</span>
            <span className="text-xl font-black font-mono text-emerald-400 mt-1">
              {financeData?.winRate}%
            </span>
            <p className="text-[8px] text-slate-500 font-mono mt-1 uppercase">
              {financeData?.completedCount} COMPLETED TICKETS
            </p>
          </div>
          <div className="glass-card border border-white/5 rounded-2xl p-4 flex flex-col justify-between text-center select-none">
            <span className="text-[9px] text-slate-400 font-bold uppercase font-sans">BIGGEST WIN</span>
            <span className="text-xl font-black font-mono text-amber-400 mt-1">
              ${financeData ? formatMoney(financeData.biggestWin) : "0.00"}
            </span>
            <p className="text-[8px] text-amber-500/60 font-mono mt-1 uppercase">
              PURE PROFIT
            </p>
          </div>
          <div className="glass-card border border-white/5 rounded-2xl p-4 flex flex-col justify-between text-center select-none col-span-2">
            <span className="text-[9px] text-slate-400 font-bold uppercase font-sans">MOST PROFITABLE MARKET</span>
            <span className="text-xl font-black font-sans text-sky-400 mt-1 uppercase tracking-tight">
              {financeData?.bestMarket}
            </span>
            <p className="text-[8px] text-sky-500/60 font-mono mt-1 uppercase">
              MAKES UP {financeData?.bestMarketPct}% OF YOUR WINNINGS
            </p>
          </div>
        </div>

        {/* Bankroll Chart */}
        <div className="glass-panel-heavy border border-white/10 rounded-2xl p-6 relative">
          <div className="absolute top-4 left-6 z-10 pointer-events-none select-none">
             <h3 className="text-xs font-bold text-slate-300 font-sans tracking-tight uppercase tracking-wider">
               Bankroll Trajectory
             </h3>
             <p className="text-[10px] text-slate-500 font-mono">Current Balance: <span className="text-emerald-400 font-bold">${userProfile ? formatMoney(userProfile.balance) : "0.00"}</span></p>
          </div>
          <div className="h-72 w-full mt-8">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={financeData?.chartData || []}>
                <defs>
                  <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" stroke="#475569" fontSize={10} tickMargin={8} minTickGap={20} tickLine={false} axisLine={false} />
                <YAxis stroke="#475569" fontSize={10} domain={['auto', 'auto']} tickFormatter={(value) => `$${value}`} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', fontSize: '12px', color: '#f8fafc' }}
                  itemStyle={{ color: '#34d399', fontWeight: 'bold' }}
                  labelStyle={{ color: '#94a3b8', marginBottom: '4px', fontSize: '10px' }}
                />
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <Area type="monotone" dataKey="balance" stroke="#34d399" strokeWidth={3} fillOpacity={1} fill="url(#colorBalance)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};
