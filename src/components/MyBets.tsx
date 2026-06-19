import React, { useState } from "react";
import { BetTicket, Fixture, Team, MarketType } from "../types";

interface MyBetsProps {
  tickets: BetTicket[];
  fixtures: Fixture[];
  teams: Team[];
  balance: number;
}

export const MyBets: React.FC<MyBetsProps> = ({ tickets, fixtures, teams, balance }) => {
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);

  // Calculate Betting stats
  const totalPlaced = tickets.length;
  const wonTickets = tickets.filter(t => t.status === "WON");
  const lostTickets = tickets.filter(t => t.status === "LOST");
  const pendingTickets = tickets.filter(t => t.status === "PENDING");
  
  const winsCount = wonTickets.length;
  const accuracy = totalPlaced > 0 ? Math.round((winsCount / (totalPlaced - pendingTickets.length || 1)) * 100) : 0;
  
  // Calculate total net profit
  const totalNetProfit = tickets.reduce((acc, t) => {
    if (t.status === "WON") {
      return acc + (t.potentialPayout - t.stake);
    } else if (t.status === "LOST") {
      return acc - t.stake;
    }
    return acc;
  }, 0);

  const getTeamName = (id: string, short: boolean = false) => {
    const t = teams.find(team => team.id === id);
    return t ? (short ? t.shortName : t.name) : "Loading";
  };

  const getMatchupString = (fixId: string) => {
    const fix = fixtures.find(f => f.id === fixId);
    if (!fix) return "Unknown Fixture";
    return `${getTeamName(fix.homeTeamId, true)} vs ${getTeamName(fix.awayTeamId, true)}`;
  };

  // Evaluate the live result / outcome text for an completed/active selection
  const getSelectionResultText = (fixId: string, marketType: MarketType, selectionId: string) => {
    const f = fixtures.find(fix => fix.id === fixId);
    if (!f) return { text: "No fixture details", state: "PENDING" };
    
    if (f.status === "SCHEDULED") {
      return { text: "Fixture Scheduled", state: "PENDING" };
    }

    const homeS = Math.floor(f.homeScore);
    const awayS = Math.floor(f.awayScore);

    if (marketType === "MATCH_WINNER") {
      let actual: "HOME" | "DRAW" | "AWAY" = "DRAW";
      if (homeS > awayS) actual = "HOME";
      if (awayS > homeS) actual = "AWAY";

      const matched = selectionId === actual;
      return {
        text: `FT: ${homeS}-${awayS}. Prediction ${selectionId === "HOME" ? "Home Win" : selectionId === "AWAY" ? "Away Win" : "Draw"} ${matched ? "Hit!" : "Missed"}`,
        state: f.status === "FT" ? (matched ? "WON" : "LOST") : "LIVE"
      };

    } else if (marketType === "EXACT_SCORE") {
      const actualScore = `${homeS}-${awayS}`;
      const matched = selectionId === actualScore;
      return {
        text: `FT Score: ${homeS}-${awayS}. Prediction: ${selectionId} ${matched ? "Hit!" : "Missed"}`,
        state: f.status === "FT" ? (matched ? "WON" : "LOST") : "LIVE"
      };

    } else {
      // Goalscorer
      const scorer = teams.flatMap(t => t.players).find(p => p.id === selectionId);
      const goalsFound = f.events.filter(ev => ev.type === "GOAL" && ev.playerId === selectionId).length;
      const matched = goalsFound > 0;
      return {
        text: `${scorer?.name || "Player"} scored ${goalsFound} goals in this match.`,
        state: f.status === "FT" ? (matched ? "WON" : "LOST") : "LIVE"
      };
    }
  };

  // Format penalty scores
  const cleanScore = (score: number) => {
    if (score % 1 === 0) return score.toString();
    return `${Math.floor(score)} (pens)`;
  };

  return (
    <div className="flex-1 min-height-0 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6 no-scrollbar max-h-none">
      
      {/* Title */}
      <div className="border-b border-white/5 pb-3">
        <span className="text-[10px] text-emerald-400 font-mono tracking-widest block uppercase font-bold">
          Virtual Betting Logbook
        </span>
        <h2 className="text-sm font-bold text-slate-100 font-sans tracking-tight mt-1">
          Personal Betting History & Tickets Dashboard
        </h2>
      </div>

      {/* Stats Board */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Net Profit Card */}
        <div className="glass-card border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 font-bold uppercase font-sans">NET PERFORMANCE</span>
          <span className={`text-lg font-black font-mono mt-1 ${totalNetProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {totalNetProfit >= 0 ? "+" : ""}${totalNetProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <p className="text-[9px] text-slate-500 font-mono mt-2 uppercase leading-none">
            TOTAL EARNINGS GAINED
          </p>
        </div>

        {/* Total Placed Card */}
        <div className="glass-card border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 font-bold uppercase font-sans">TOTAL TICKETS</span>
          <span className="text-lg font-black font-mono text-slate-200 mt-1 select-none font-sans">
            {totalPlaced}
          </span>
          <div className="flex gap-2 text-[9px] text-slate-500 font-mono mt-2 leading-none">
            <span>WON: {winsCount}</span>
            <span>LOST: {lostTickets.length}</span>
            <span>PEND: {pendingTickets.length}</span>
          </div>
        </div>

        {/* Accuracy Card */}
        <div className="glass-card border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 font-bold uppercase font-sans">PREDICTION HIT ACCURACY</span>
          <span className="text-lg font-black font-mono text-emerald-400 mt-1">
            {accuracy}%
          </span>
          <p className="text-[9px] text-slate-500 font-mono mt-2 uppercase leading-none">
            SETTLED WIN % RATE
          </p>
        </div>

        {/* Current Wealth Card */}
        <div className="glass-card border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 font-bold uppercase font-sans">TOTAL SYSTEM WEALTH</span>
          <span className="text-lg font-black font-mono text-emerald-400 mt-1">
            ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <p className="text-[9px] text-slate-500 font-mono mt-2 uppercase leading-none">
            AVAIL LIQUID WALLET
          </p>
        </div>
      </div>

      {/* Tickets log */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold font-sans tracking-wide uppercase text-slate-400 select-none">
          BET TICKET LOGS ({tickets.length})
        </h3>

        {tickets.length === 0 ? (
          <div className="glass-card border border-white/5 rounded-2xl p-12 text-center text-slate-500">
            <span className="text-4xl mb-3 block opacity-40">🎫</span>
            <p className="text-xs font-semibold text-slate-400">You haven't placed any bet tickets yet.</p>
            <p className="text-[11px] text-slate-500 mt-1">Go to <b>Fixtures & Odds</b>, lock-in predictions and place wagers inside the right Betting Slip.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {[...tickets].reverse().map(ticket => {
              const isExpanded = expandedTicketId === ticket.id;
              const isWon = ticket.status === "WON";
              const isLost = ticket.status === "LOST";
              const isPending = ticket.status === "PENDING";

              const netRet = isWon ? (ticket.potentialPayout - ticket.stake) : isLost ? -ticket.stake : 0;

              return (
                <div
                  key={ticket.id}
                  className={`glass-card rounded-2xl overflow-hidden transition-all duration-150 border ${
                    isWon
                      ? "border-emerald-500/20 hover:border-emerald-500/40 shadow-md"
                      : isLost
                      ? "border-red-500/10 hover:border-red-500/30"
                      : "border-white/5 hover:border-white/15"
                  }`}
                >
                  {/* Ticket Header bar */}
                  <div className="p-3.5 flex items-center justify-between flex-wrap gap-2 text-xs select-none">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold tracking-tight uppercase ${
                        ticket.type === "ACCUMULATOR" ? "bg-emerald-500/15 text-emerald-450 border border-emerald-500/10" : "bg-sky-500/15 text-sky-400 border border-sky-500/10"
                      }`}>
                        {ticket.type}
                      </span>
                      <span className="font-mono text-slate-500 text-[10px]">
                        ID: {ticket.id.slice(7, 18)}...
                      </span>
                      <span className="text-slate-600 font-mono text-[9px]">
                        • {new Date(ticket.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Stake & combined odds info */}
                      <span className="font-mono text-slate-400">
                        Stake: <b className="text-slate-200 font-medium">${ticket.stake.toFixed(2)}</b>
                      </span>
                      <span className="font-mono text-emerald-450 font-bold bg-black/40 border border-white/5 rounded-lg px-2 py-0.5">
                        @{ticket.totalOdds.toFixed(2)}
                      </span>

                      {/* Status Tag */}
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold text-center w-18 ${
                        isWon
                          ? "bg-emerald-500/20 text-emerald-400"
                          : isLost
                          ? "bg-red-500/20 text-red-00"
                          : "bg-white/5 text-slate-500"
                      }`}>
                        {ticket.status}
                      </span>

                      {/* Toggle Expand button */}
                      <button
                        onClick={() => setExpandedTicketId(isExpanded ? null : ticket.id)}
                        className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 cursor-pointer text-[10px]"
                      >
                        {isExpanded ? "🔼" : "🔽"}
                      </button>
                    </div>
                  </div>

                  {/* Summary Net performance and payout bar */}
                  <div className="bg-black/30 px-3.5 py-2 px-3 flex items-center justify-between text-[11px] font-mono border-t border-white/5 text-slate-400 select-none">
                    <span>
                      Est Payout: <b className="text-emerald-400 font-bold">${ticket.potentialPayout.toFixed(2)}</b>
                    </span>
                    {!isPending && (
                      <span className={`${netRet >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {netRet >= 0 ? `Net Gain: +$${netRet.toFixed(2)}` : `Net Cost: -$${Math.abs(netRet).toFixed(2)}`}
                      </span>
                    )}
                  </div>

                  {/* Expanded Selections matches list details */}
                  {isExpanded && (
                    <div className="border-t border-white/5 bg-black/40">
                      <div className="divide-y divide-white/5">
                        {ticket.selections.map((sel, idx) => {
                          const fix = fixtures.find(f => f.id === sel.fixtureId);
                          const resultObj = getSelectionResultText(sel.fixtureId, sel.marketType, sel.selectionId);
                          const isSelWon = resultObj.state === "WON";
                          const isSelLost = resultObj.state === "LOST";

                          // Get individual selection stake for Single mode
                          const indStake = ticket.selectionStakes?.[`${sel.fixtureId}-${sel.marketType}-${sel.selectionId}`];

                          return (
                            <div key={idx} className="p-3 pl-6 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-300">
                                    {fix ? (
                                      <span className="inline-flex items-center">
                                        <button
                                          type="button"
                                          onClick={() => window.dispatchEvent(new CustomEvent("open-global-entity", { detail: { type: "team", id: fix.homeTeamId } }))}
                                          className="hover:underline hover:text-emerald-400 cursor-pointer bg-transparent border-0 p-0 font-bold text-slate-300"
                                        >
                                          {getTeamName(fix.homeTeamId, true)}
                                        </button>
                                        <span className="text-slate-500 mx-1 select-none font-mono font-normal">vs</span>
                                        <button
                                          type="button"
                                          onClick={() => window.dispatchEvent(new CustomEvent("open-global-entity", { detail: { type: "team", id: fix.awayTeamId } }))}
                                          className="hover:underline hover:text-emerald-400 cursor-pointer bg-transparent border-0 p-0 font-bold text-slate-300"
                                        >
                                          {getTeamName(fix.awayTeamId, true)}
                                        </button>
                                      </span>
                                    ) : (
                                      "Unknown Matchup"
                                    )}
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-mono">
                                    ({sel.marketName})
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-400">
                                  Selected: <b className="text-emerald-400">{sel.details}</b> @ odds <b className="text-slate-300">@{sel.odds.toFixed(2)}</b>
                                </p>
                                {indStake !== undefined && (
                                  <p className="text-[9px] text-slate-500 font-mono">
                                    Individual Stake: ${indStake.toFixed(2)} • Est Payout: ${(indStake * sel.odds).toFixed(2)}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-3">
                                {/* Result Description text */}
                                <span className="text-[11px] font-mono text-slate-400 text-right">
                                  {resultObj.text}
                                </span>

                                {/* Selection validation indicator tag */}
                                <span className={`px-2 py-0.5 rounded text-[8px] tracking-tight uppercase font-black ${
                                  isSelWon
                                    ? "bg-emerald-500/20 text-emerald-400"
                                    : isSelLost
                                    ? "bg-red-500/20 text-red-00"
                                    : "bg-white/5 text-slate-500 border border-white/5"
                                }`}>
                                  {resultObj.state}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
