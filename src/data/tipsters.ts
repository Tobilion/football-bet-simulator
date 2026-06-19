import { Tipster, Fixture, Team, BetTicket, BetSelection } from "../types";

export const INITIAL_TIPSTERS: Tipster[] = [
  {
    id: "t1",
    name: "The Oracle",
    avatar: "🧙‍♂️",
    bio: "Continuous statistical regression and mathematical expected value models. Avoids high margins.",
    balance: 1000,
    accuracy: 68,
    betsWon: 17,
    betsTotal: 25,
    riskProfile: "BALANCED",
    recentTips: []
  },
  {
    id: "t2",
    name: "The Statistician",
    avatar: "📊",
    bio: "Deep historical performance metrics. Prefers short odds, heavy home-advantage favourites.",
    balance: 1200,
    accuracy: 75,
    betsWon: 21,
    betsTotal: 28,
    riskProfile: "SAFE",
    recentTips: []
  },
  {
    id: "t3",
    name: "High-Risk King",
    avatar: "🚀",
    bio: "Accumulator hunter. Hunts exact scorecards and anytime goalscorers for monster payouts.",
    balance: 650,
    accuracy: 36,
    betsWon: 9,
    betsTotal: 25,
    riskProfile: "AGGRESSIVE",
    recentTips: []
  },
  {
    id: "t4",
    name: "Underdog Prophet",
    avatar: "🐕",
    bio: "Specializes in locating high-value draws and heavy underdog spreads.",
    balance: 850,
    accuracy: 42,
    betsWon: 10,
    betsTotal: 24,
    riskProfile: "AGGRESSIVE",
    recentTips: []
  },
  {
    id: "t5",
    name: "Gut Instinct",
    avatar: "🧠",
    bio: "Hybrid model blending form index tracking with real-time squad morale factors.",
    balance: 950,
    accuracy: 54,
    betsWon: 13,
    betsTotal: 24,
    riskProfile: "BALANCED",
    recentTips: []
  }
];

// Helper to let virtual tipsters create logical bets on current round's scheduled fixtures
export function generateTipsterBetsForRound(
  tipsters: Tipster[],
  fixtures: Fixture[],
  teams: Team[]
): { [tipsterId: string]: BetTicket } {
  const roundBets: { [tipsterId: string]: BetTicket } = {};

  const teamMap = new Map(teams.map(t => [t.id, t]));

  tipsters.forEach(tip => {
    // Collect active, scheduled games
    const scheduled = fixtures.filter(f => f.status === "SCHEDULED");
    if (scheduled.length === 0) return;

    const selections: BetSelection[] = [];
    let ticketType: "SINGLE" | "ACCUMULATOR" = "SINGLE";
    let stake = 50;

    if (tip.riskProfile === "SAFE") {
      // Pick 1 very safe fixture match winner
      const sortedByDiff = [...scheduled].sort((a, b) => {
        const homeT = teamMap.get(a.homeTeamId);
        const awayT = teamMap.get(a.awayTeamId);
        const diffA = Math.abs((homeT?.rating || 4.0) - (awayT?.rating || 4.0));
        
        const homeT2 = teamMap.get(b.homeTeamId);
        const awayT2 = teamMap.get(b.awayTeamId);
        const diffB = Math.abs((homeT2?.rating || 4.0) - (awayT2?.rating || 4.0));
        return diffB - diffA; // largest gap first
      });

      const bestFix = sortedByDiff[0];
      const homeT = teamMap.get(bestFix.homeTeamId);
      const awayT = teamMap.get(bestFix.awayTeamId);

      if (homeT && awayT) {
        const isHomeFav = homeT.rating >= awayT.rating;
        const winnerSel = isHomeFav ? "HOME" : "AWAY";
        const winnerOdds = isHomeFav ? bestFix.odds.homeWin : bestFix.odds.awayWin;
        const nameText = isHomeFav ? homeT.name : awayT.name;

        selections.push({
          fixtureId: bestFix.id,
          marketType: "MATCH_WINNER",
          selectionId: winnerSel,
          odds: winnerOdds,
          details: `${nameText} to Win`,
          marketName: "Match Winner"
        });
      }
      stake = 80;
      ticketType = "SINGLE";

    } else if (tip.riskProfile === "BALANCED") {
      // Create a 2-fixture safe Accumulator or 2 singles
      const roll = Math.random();
      if (roll < 0.5 && scheduled.length >= 2) {
        ticketType = "ACCUMULATOR";
        // Select top 2 fixtures with strong favorite
        for (let idx = 0; idx < Math.min(2, scheduled.length); idx++) {
          const f = scheduled[idx];
          const homeT = teamMap.get(f.homeTeamId);
          const awayT = teamMap.get(f.awayTeamId);
          if (homeT && awayT) {
            const preferHome = homeT.rating >= awayT.rating;
            selections.push({
              fixtureId: f.id,
              marketType: "MATCH_WINNER",
              selectionId: preferHome ? "HOME" : "AWAY",
              odds: preferHome ? f.odds.homeWin : f.odds.awayWin,
              details: `${preferHome ? homeT.name : awayT.name} to Win`,
              marketName: "Match Winner"
            });
          }
        }
      } else {
        ticketType = "SINGLE";
        const f = scheduled[Math.floor(Math.random() * scheduled.length)];
        const homeT = teamMap.get(f.homeTeamId);
        const awayT = teamMap.get(f.awayTeamId);
        if (homeT && awayT) {
          selections.push({
            fixtureId: f.id,
            marketType: "MATCH_WINNER",
            selectionId: "DRAW",
            odds: f.odds.draw,
            details: `Draw: ${homeT.shortName} vs ${awayT.shortName}`,
            marketName: "Match Winner"
          });
        }
      }
      stake = 50;

    } else {
      // AGGRESSIVE profile
      // Wants High Accumulator or Exact Score (or anytime goalscorer)
      const roll = Math.random();
      if (roll < 0.4 && scheduled.length >= 3) {
        // 3-team Accumulator!
        ticketType = "ACCUMULATOR";
        const sample = [...scheduled].sort(() => 0.5 - Math.random()).slice(0, 3);
        sample.forEach(f => {
          const homeT = teamMap.get(f.homeTeamId);
          const awayT = teamMap.get(f.awayTeamId);
          if (homeT && awayT) {
            const oddsVal = Math.random() < 0.5;
            selections.push({
              fixtureId: f.id,
              marketType: "MATCH_WINNER",
              selectionId: oddsVal ? "HOME" : "DRAW",
              odds: oddsVal ? f.odds.homeWin : f.odds.draw,
              details: oddsVal ? `${homeT.name} to Win` : `Draw ${homeT.shortName} vs ${awayT.shortName}`,
              marketName: "Match Winner"
            });
          }
        });
      } else if (roll < 0.7) {
        // Correct Score bet
        ticketType = "SINGLE";
        const f = scheduled[Math.floor(Math.random() * scheduled.length)];
        const homeT = teamMap.get(f.homeTeamId);
        const scoreOption = f.odds.exactScores[Math.floor(Math.random() * 4)]; // pick a common one
        if (homeT && scoreOption) {
          selections.push({
            fixtureId: f.id,
            marketType: "EXACT_SCORE",
            selectionId: scoreOption.score,
            odds: scoreOption.odds,
            details: `Exact Score: ${scoreOption.score}`,
            marketName: "Correct Score"
          });
        }
      } else {
        // Goalscorer on star player
        ticketType = "SINGLE";
        const f = scheduled[Math.floor(Math.random() * scheduled.length)];
        const topScorerSelection = f.odds.goalscorers[0]; // first has lowest odds/most likely
        if (topScorerSelection) {
          selections.push({
            fixtureId: f.id,
            marketType: "ANYTIME_GOALSCORER",
            selectionId: topScorerSelection.playerId,
            odds: topScorerSelection.odds,
            details: `${topScorerSelection.name} Anytime Goalscorer`,
            marketName: "Anytime Goalscorer"
          });
        }
      }
      stake = 30; // lower stakes on high odds
    }

    if (selections.length > 0) {
      const totalOdds = Math.round(selections.reduce((acc, sel) => acc * sel.odds, 1) * 100) / 100;
      
      const ticket: BetTicket = {
        id: `ticket-${tip.id}-${Date.now()}-${Math.floor(Math.random()*1000)}`,
        type: ticketType,
        selections,
        totalOdds,
        stake,
        potentialPayout: Math.round(stake * totalOdds * 100) / 100,
        status: "PENDING",
        timestamp: Date.now()
      };

      roundBets[tip.id] = ticket;
      
      // Update Tipster recent tips descriptions
      const tipDescs = selections.map(s => `${s.details} (@${s.odds})`);
      tip.recentTips = [
        `${ticketType} Stake $${stake} @ odds ${totalOdds}: ${tipDescs.join(" + ")}`,
        ...tip.recentTips.slice(0, 2)
      ];
    }
  });

  return roundBets;
}

// Evaluates tickets for tipsters at the end of the round
export function resolveTipsterRound(
  tipsters: Tipster[],
  roundTickets: { [tipsterId: string]: BetTicket },
  completedFixtures: Fixture[]
): Tipster[] {
  const fixtureMap = new Map(completedFixtures.map(f => [f.id, f]));

  return tipsters.map(tip => {
    const ticket = roundTickets[tip.id];
    if (!ticket) return tip;

    // Evaluate selections
    let wonAll = true;
    
    // Check elements
    ticket.selections.forEach(sel => {
      const f = fixtureMap.get(sel.fixtureId);
      if (!f) {
        wonAll = false;
        return;
      }

      const rawH = f.homeScore;
      const rawA = f.awayScore;
      
      // Remove shootout decimals if they exist
      const hScore = Math.floor(rawH);
      const aScore = Math.floor(rawA);

      if (sel.marketType === "MATCH_WINNER") {
        let actual: "HOME" | "DRAW" | "AWAY" = "DRAW";
        if (hScore > aScore) actual = "HOME";
        if (aScore > hScore) actual = "AWAY";

        if (sel.selectionId !== actual) wonAll = false;

      } else if (sel.marketType === "EXACT_SCORE") {
        const actualScore = `${hScore}-${aScore}`;
        if (sel.selectionId !== actualScore) wonAll = false;

      } else if (sel.marketType === "ANYTIME_GOALSCORER") {
        // Check if player scored in goals list
        const scored = f.events.some(ev => ev.type === "GOAL" && ev.playerId === sel.selectionId);
        if (!scored) wonAll = false;
      }
    });

    const profitAndLoss = wonAll ? (ticket.potentialPayout - ticket.stake) : -ticket.stake;
    const nextBalance = Math.max(10, Math.round((tip.balance + profitAndLoss) * 100) / 100);
    const nextTotal = tip.betsTotal + 1;
    const nextWon = tip.betsWon + (wonAll ? 1 : 0);
    const nextAccuracy = Math.round((nextWon / nextTotal) * 100);

    return {
      ...tip,
      balance: nextBalance,
      betsWon: nextWon,
      betsTotal: nextTotal,
      accuracy: nextAccuracy
    };
  });
}
