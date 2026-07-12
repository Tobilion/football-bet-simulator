import React, { useState } from "react";
import { BetTicket, BetBuilderTicket, Fixture, Team, MarketType } from "../types";
import { BetBuilderTicketsList } from "./BetBuilderTicketsList";
import { calculateCashOutValue, isCashOutEligible, buildCurrentOddsMap } from "../utils/cashOutUtils";
import { formatMoney } from "../utils";
import { EmptyState } from "./ui/EmptyState";

interface MyBetsProps {
  tickets: BetTicket[];
  fixtures: Fixture[];
  teams: Team[];
  balance: number;
  onCashOut?: (ticketId: string, offer: number) => void;
  challengesSlot?: React.ReactNode;
  betBuilderTickets?: BetBuilderTicket[];
}

export const MyBets: React.FC<MyBetsProps> = ({ tickets, fixtures, teams, balance, onCashOut, challengesSlot, betBuilderTickets = [] }) => {
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);

  // Calculate Betting stats
  const totalPlaced = tickets.length;
  // A cashed-out ticket is a positive resolution and counts toward wins (kept
  // consistent with Analytics/careerUtils which also treat CASHED_OUT as won).
  const wonTickets = tickets.filter(t => t.status === "WON" || t.status === "CASHED_OUT");
  const lostTickets = tickets.filter(t => t.status === "LOST");
  const pendingTickets = tickets.filter(t => t.status === "PENDING");
  
  const winsCount = wonTickets.length;
  const accuracy = totalPlaced > 0 ? Math.round((winsCount / (totalPlaced - pendingTickets.length || 1)) * 100) : 0;
  
  // Calculate total net profit
  const totalNetProfit = tickets.reduce((acc, t) => {
    if (t.status === "WON") {
      return acc + ((t.settledPayout ?? t.potentialPayout) - t.stake);
    } else if (t.status === "LOST") {
      return acc - t.stake;
    } else if (t.status === "CASHED_OUT" && t.cashedOutAmount) {
      return acc + (t.cashedOutAmount - t.stake);
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
    const penStr = f.penaltyScore ? ` (Pens: ${f.penaltyScore})` : "";
    const ftDisplay = `${homeS}-${awayS}${penStr}`;

    if (marketType === "MATCH_WINNER") {
      let actual: "HOME" | "DRAW" | "AWAY" = "DRAW";
      if (homeS > awayS) actual = "HOME";
      if (awayS > homeS) actual = "AWAY";

      const matched = selectionId === actual;
      let extraInfo = "";
      if (actual === "DRAW" && f.penaltyScore && !matched) {
         const [hPen, aPen] = f.penaltyScore.split("-").map(Number);
         if (hPen > aPen) extraInfo = ` (Home won on pens)`;
         if (aPen > hPen) extraInfo = ` (Away won on pens)`;
      }

      return {
        text: `FT: ${ftDisplay}. Prediction ${selectionId === "HOME" ? "Home Win" : selectionId === "AWAY" ? "Away Win" : "Draw"} ${matched ? "Hit!" : "Missed"}${extraInfo}`,
        state: f.status === "FT" ? (matched ? "WON" : "LOST") : "LIVE"
      };

    } else if (marketType === "DOUBLE_CHANCE") {
      let actual: "HOME" | "DRAW" | "AWAY" = "DRAW";
      if (homeS > awayS) actual = "HOME";
      if (awayS > homeS) actual = "AWAY";
      
      let matched = true;
      if (selectionId === "HOME_OR_DRAW" && actual === "AWAY") matched = false;
      if (selectionId === "HOME_OR_AWAY" && actual === "DRAW") matched = false;
      if (selectionId === "DRAW_OR_AWAY" && actual === "HOME") matched = false;
      
      return {
        text: `FT: ${ftDisplay}. Prediction Double Chance ${matched ? "Hit!" : "Missed"}`,
        state: f.status === "FT" ? (matched ? "WON" : "LOST") : "LIVE"
      };
      
    } else if (marketType === "BOTH_TEAMS_TO_SCORE") {
      const bothScored = homeS > 0 && awayS > 0;
      let matched = false;
      if (selectionId === "YES" && bothScored) matched = true;
      if (selectionId === "NO" && !bothScored) matched = true;
      
      let stateResult = f.status === "FT" ? (matched ? "WON" : "LOST") : "LIVE";
      if (f.status === "LIVE") {
        if (selectionId === "YES" && bothScored) stateResult = "WON_EARLY";
        if (selectionId === "NO" && bothScored) stateResult = "LOST_EARLY";
      }

      return {
        text: `Current Score: ${ftDisplay}. Both Scored: ${bothScored ? "Yes" : "No"}`,
        state: stateResult
      };
      
    } else if (marketType === "OVER_UNDER_GOALS") {
      const totalGoals = homeS + awayS;
      const [mode, lineStr] = selectionId.split("_");
      const line = parseFloat(lineStr.replace("_", "."));
      let matched = false;
      if (mode === "OVER" && totalGoals > line) matched = true;
      if (mode === "UNDER" && totalGoals < line) matched = true;
      
      let stateResult = f.status === "FT" ? (matched ? "WON" : "LOST") : "LIVE";
      if (f.status === "LIVE") {
         if (mode === "OVER" && totalGoals > line) stateResult = "WON_EARLY";
         if (mode === "UNDER" && totalGoals > line) stateResult = "LOST_EARLY"; // Cannot go back under
      }

      return {
        text: `Score: ${ftDisplay} (${totalGoals} goals). Prediction: Over/Under ${line}`,
        state: stateResult
      };
      
    } else if (marketType === "OVER_UNDER_CORNERS" || marketType === "OVER_UNDER_CARDS" || marketType === "OVER_UNDER_SAVES") {
      let val = 0;
      let statName = "";
      
      const [mode, lineStr] = selectionId.split("_");
      const paramLine = parseFloat((lineStr || "0").replace("_", "."));
      
      if (marketType === "OVER_UNDER_CORNERS") { 
        val = (f.stats?.home.corners || 0) + (f.stats?.away.corners || 0); 
        statName = "Corners";
      }
      if (marketType === "OVER_UNDER_CARDS") { 
        val = (f.stats?.home.yellowCards || 0) + (f.stats?.home.redCards || 0) + (f.stats?.away.yellowCards || 0) + (f.stats?.away.redCards || 0); 
        statName = "Cards"; 
      }
      if (marketType === "OVER_UNDER_SAVES") { 
        val = (f.stats?.home.saves || 0) + (f.stats?.away.saves || 0); 
        statName = "Saves"; 
      }
      
      let matched = false;
      if (mode === "OVER" && val > paramLine) matched = true;
      if (mode === "UNDER" && val < paramLine) matched = true;
      
      let stateResult = f.status === "FT" ? (matched ? "WON" : "LOST") : "LIVE";
      if (f.status === "LIVE") {
         if (mode === "OVER" && val > paramLine) stateResult = "WON_EARLY";
         if (mode === "UNDER" && val > paramLine) stateResult = "LOST_EARLY";
      }
      
      return {
        text: `Total ${statName}: ${val}. Prediction: ${mode} ${paramLine} ${matched ? "Hit!" : "Missed"}`,
        state: stateResult
      };
      
    } else if (marketType === "EXACT_SCORE") {
      const actualScore = `${homeS}-${awayS}`;
      const matched = selectionId === actualScore;
      return {
        text: `FT Score: ${ftDisplay}. Prediction: ${selectionId} ${matched ? "Hit!" : "Missed"}`,
        state: f.status === "FT" ? (matched ? "WON" : "LOST") : "LIVE"
      };

    } else {
      // Goalscorer
      const scorer = teams.flatMap(t => t.players).find(p => p.id === selectionId);
      const goalsFound = f.events.filter(ev => ev.type === "GOAL" && ev.playerId === selectionId).length;
      const matched = goalsFound > 0;
      
      let stateResult = f.status === "FT" ? (matched ? "WON" : "LOST") : "LIVE";
      if (f.status === "LIVE") {
         if (goalsFound > 0) stateResult = "WON_EARLY";
      }

      return {
        text: `${scorer?.name || "Player"} scored ${goalsFound} goals in this match.`,
        state: stateResult
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
      {challengesSlot}
      
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
          <EmptyState
            title="No Active Bets Placed"
            description="Explore Fixtures & Odds, select predictions, and lock-in wagers inside the Betting Slip."
            icon="ticket"
          />
        ) : (
          <div className="space-y-2.5">
            {[...tickets].reverse().map(ticket => {
              const isExpanded = expandedTicketId === ticket.id;
              const isWon = ticket.status === "WON";
              const isLost = ticket.status === "LOST";
              const isPending = ticket.status === "PENDING";
              const isCashedOut = ticket.status === "CASHED_OUT";

              let netRet = isWon ? ((ticket.settledPayout ?? ticket.potentialPayout) - ticket.stake) : isLost ? -ticket.stake : 0;
              if (isCashedOut && ticket.cashedOutAmount) {
                netRet = ticket.cashedOutAmount - ticket.stake;
              }

              const coEligible = isCashOutEligible(ticket, fixtures);
              const coOddsMap = coEligible ? buildCurrentOddsMap(ticket, fixtures) : {};
              const cashOutValue = coEligible
                ? calculateCashOutValue(ticket, fixtures, coOddsMap)
                : null;

              return (
                <div
                  key={ticket.id}
                  className={`glass-card rounded-2xl overflow-hidden transition-all duration-150 border ${
                    isWon
                      ? "border-emerald-500/20 hover:border-emerald-500/40 shadow-md"
                      : isLost
                      ? "border-red-500/10 hover:border-red-500/30"
                      : isCashedOut
                      ? "border-amber-500/20 hover:border-amber-500/40"
                      : "border-white/5 hover:border-white/15"
                  }`}
                >
                  {/* Ticket Header bar (Now fully clickable with premium feedback hover state) */}
                  <div 
                    onClick={() => setExpandedTicketId(isExpanded ? null : ticket.id)}
                    className="p-3.5 flex items-center justify-between flex-wrap gap-2 text-xs select-none cursor-pointer hover:bg-white/[0.04] transition-colors"
                  >
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
                        Stake: <b className="text-slate-200 font-medium">${formatMoney(ticket.stake)}</b>
                      </span>
                      <span className="font-mono text-emerald-450 font-bold bg-black/40 border border-white/5 rounded-lg px-2 py-0.5">
                        @{ticket.totalOdds.toFixed(2)}
                      </span>

                      {/* Status Tag */}
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold text-center w-auto min-w-[72px] ${
                        isWon
                          ? "bg-emerald-500/20 text-emerald-400"
                          : isLost
                          ? "bg-red-500/20 text-red-400"
                          : isCashedOut
                          ? "bg-amber-500/20 text-amber-400"
                          : "bg-white/5 text-slate-500"
                      }`}>
                        {ticket.status}
                      </span>
                      
                      {/* Live cash-out pip in header */}
                      {coEligible && cashOutValue !== null && cashOutValue > 0 && (
                        <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded animate-pulse">
                          💰 LIVE CO
                        </span>
                      )}

                      {/* Toggle Expand button display */}
                      <span className="text-slate-400 text-xs">
                        {isExpanded ? "🔼" : "🔽"}
                      </span>
                    </div>
                  </div>

                  {/* ── Live Cash Out Banner ── */}
                  {coEligible && cashOutValue !== null && onCashOut && (
                    <div className={`px-4 py-2.5 flex items-center justify-between border-y ${cashOutValue >= ticket.stake ? "bg-emerald-500/8 border-emerald-500/20" : "bg-red-500/8 border-red-500/20"}`}>
                      <div>
                        <p className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider">
                          ⚡ Live Cash Out Available
                        </p>
                        <p className="text-[9px] text-slate-500 font-mono">
                          {cashOutValue < ticket.stake ? "⚠️ Below stake — losing position" : "Lock in profit · 8% margin applied"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onCashOut(ticket.id, cashOutValue)}
                        className={`font-black text-sm px-5 py-1.5 rounded-xl cursor-pointer transition-colors shadow-lg ${cashOutValue >= ticket.stake ? "bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20" : "bg-red-500/80 hover:bg-red-500 text-white shadow-red-500/20"}`}
                      >
                        CASH OUT ${formatMoney(cashOutValue)}
                      </button>
                    </div>
                  )}
                  {coEligible && cashOutValue === null && (
                    <div className="px-4 py-2.5 flex items-center justify-between border-y bg-slate-500/8 border-white/10">
                      <div>
                        <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                          ⏸️ Cash Out Temporarily Suspended
                        </p>
                        <p className="text-[9px] text-slate-500 font-mono">
                          A live market on this ticket is suspended — try again in a moment
                        </p>
                      </div>
                      <span className="font-black text-sm px-5 py-1.5 rounded-xl bg-white/5 text-slate-500 select-none">
                        SUSPENDED
                      </span>
                    </div>
                  )}
                  {/* Collapsed Selection indicator lines (Displays what teams were bet on when collapsed!) */}
                  {!isExpanded && (
                    <div className="px-3.5 pb-3 flex flex-wrap gap-2 pt-0.5 border-t border-dashed border-white/5">
                      {ticket.selections.map((sel, idx) => {
                        const fix = fixtures.find(f => f.id === sel.fixtureId);
                        const matchupLabel = fix 
                          ? `${getTeamName(fix.homeTeamId, true)} vs ${getTeamName(fix.awayTeamId, true)}` 
                          : "Unknown Matchup";
                        
                        return (
                          <div 
                            key={idx} 
                            onClick={() => setExpandedTicketId(ticket.id)}
                            className="bg-white/5 border border-white/5 hover:border-emerald-500/25 hover:bg-emerald-500/[0.02] text-[10px] px-2.5 py-1 rounded-xl text-slate-350 font-sans tracking-wide cursor-pointer transition-all flex items-center gap-1.5"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/50"></span>
                            <span className="font-semibold text-slate-200">{matchupLabel}</span>
                            <span className="text-slate-500 font-mono">•</span>
                            <span className="text-slate-400 font-mono text-[9px]">{sel.details}</span>
                            <span className="text-emerald-400 font-mono font-bold text-[9px] bg-emerald-500/10 px-1 rounded">@{sel.odds.toFixed(2)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Summary Net performance and payout bar */}
                  <div className="bg-black/30 px-3.5 py-2 px-3 flex items-center justify-between text-[11px] font-mono border-t border-white/5 text-slate-400 select-none">
                    <span>
                      Est Payout: <b className="text-emerald-400 font-bold">${formatMoney(ticket.potentialPayout)}</b>
                    </span>
                    {!isPending && (
                      <span className={`${netRet >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {netRet >= 0 ? `Net Gain: +$${formatMoney(netRet)}` : `Net Cost: -$${formatMoney(Math.abs(netRet))}`}
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
                                    Individual Stake: ${formatMoney(indStake)} • Est Payout: ${formatMoney(indStake * sel.odds)}
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
                                  isSelWon || resultObj.state === "WON_EARLY"
                                    ? "bg-emerald-500/20 text-emerald-400"
                                    : isSelLost || resultObj.state === "LOST_EARLY"
                                    ? "bg-red-500/20 text-red-400"
                                    : "bg-white/5 text-slate-500 border border-white/5"
                                }`}>
                                  {resultObj.state.replace("_", " ")}
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

      {/* Bet Builder tickets log */}
      <BetBuilderTicketsList tickets={betBuilderTickets} fixtures={fixtures} teams={teams} />
    </div>
  );
};
