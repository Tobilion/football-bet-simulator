import { Fixture, Profile, Team, Tipster, BetTicket, TransferListing } from "../types";
import {
  generateNextRoundFixtures,
  updateRostersAndStatsAfterFixture,
  applyRelegationPromotion,
  initializeNewLeagueSeason,
} from "../data/tournament";
import {
  generateTipsterBetsForRound,
  resolveTipsterRound,
} from "../data/tipsters";
import { persistStateToCache } from "../utils/storage";
import { resolveTransferAuctions, applyTransferResultsToTeams } from "../engine/transferEngine";
import { settleBetBuilderTicket } from "../utils/betBuilderUtils";
import { calculateMOTM } from "../utils/motmUtils";
import { addToast } from "../hooks/useToast";

interface UseRoundAdvanceDeps {
  gameMode: "TOURNAMENT" | "LEAGUE" | null;
  activeSlot: number;
  userProfile: Profile | null;
  teams: Team[];
  fixtures: Fixture[];
  tipsters: Tipster[];
  tipsterTickets: { [id: string]: BetTicket };
  isSimulating: boolean;
  transferListings: TransferListing[];
  userBid: { listingId: string; amount: number } | null;
  setUserProfile: React.Dispatch<React.SetStateAction<Profile | null>>;
  setTeams: React.Dispatch<React.SetStateAction<Team[]>>;
  setFixtures: React.Dispatch<React.SetStateAction<Fixture[]>>;
  setTipsters: React.Dispatch<React.SetStateAction<Tipster[]>>;
  setTipsterTickets: React.Dispatch<React.SetStateAction<{ [id: string]: BetTicket }>>;
  setSelectedBets: React.Dispatch<React.SetStateAction<import("../types").BetSelection[]>>;
  setTicks: React.Dispatch<React.SetStateAction<number>>;
  setActiveTab: (tab: string) => void;
  setShowWinnerCelebration: React.Dispatch<React.SetStateAction<boolean>>;
  setOwnerRevenueReport: React.Dispatch<
    React.SetStateAction<{
      revenue: number;
      fixtures: {
        fixtureId: string;
        baseIncome: number;
        bonus: number;
        result: "WIN" | "DRAW" | "LOSS";
        scoreline: string;
      }[];
      teamName: string;
    } | null>
  >;
  setTransferListings: React.Dispatch<React.SetStateAction<TransferListing[]>>;
  setUserBid: React.Dispatch<React.SetStateAction<{ listingId: string; amount: number } | null>>;
  onTransferToast: (msg: string) => void;
}

export function buildHandleAdvanceRound(deps: UseRoundAdvanceDeps) {
  const {
    gameMode,
    activeSlot,
    userProfile,
    teams,
    fixtures,
    tipsters,
    tipsterTickets,
    isSimulating,
    transferListings,
    userBid,
    setUserProfile,
    setTeams,
    setFixtures,
    setTipsters,
    setTipsterTickets,
    setSelectedBets,
    setTicks,
    setActiveTab,
    setShowWinnerCelebration,
    setOwnerRevenueReport,
    setTransferListings,
    setUserBid,
    onTransferToast,
  } = deps;

  return function handleAdvanceRound() {
    if (!userProfile || isSimulating) return;

    const currentRoundIndex = userProfile.currentRoundIndex;
    const roundFixturesList = fixtures.filter(
      (f) => f.roundIndex === currentRoundIndex,
    );
    const completedFixtures = roundFixturesList.filter((f) => f.status === "FT");

    if (
      roundFixturesList.length > 0 &&
      completedFixtures.length !== roundFixturesList.length
    ) {
      alert("Please simulate or complete all matches in the current round before advancing!");
      return;
    }

    if (completedFixtures.length === 0) return;

    // 1. Settle transfer auctions
    let updatedTeamsList = [...teams];
    let toastMsg = "";
    if (transferListings.length > 0) {
      const { resolvedListings, toastMessage } = resolveTransferAuctions(
        transferListings,
        updatedTeamsList,
        userProfile,
        userBid,
      );
      updatedTeamsList = applyTransferResultsToTeams(updatedTeamsList, resolvedListings);
      toastMsg = toastMessage;
      setTransferListings(resolvedListings.map((l) => ({
        ...l,
        status: l.highestBidder === "USER" ? "SOLD" : l.status === "OPEN" ? "EXPIRED" : l.status,
      })));
      setUserBid(null);
      if (toastMsg) { onTransferToast(toastMsg); addToast({ type: "transfer", title: "🔄 Transfer", message: toastMsg, duration: 6000 }); }
    }

    // 2. Evaluate user pending tickets
    let totalWinPayoutSum = 0;
    const finalTickets = userProfile.tickets.map((ticket) => {
      if (ticket.status !== "PENDING") return ticket;

      let wonAll = true;
      ticket.selections.forEach((sel) => {
        const match = completedFixtures.find((f) => f.id === sel.fixtureId);
        if (!match) { wonAll = false; return; }

        const hScore = Math.floor(match.homeScore);
        const aScore = Math.floor(match.awayScore);

        if (sel.marketType === "MATCH_WINNER") {
          const outcome = hScore > aScore ? "HOME" : aScore > hScore ? "AWAY" : "DRAW";
          if (sel.selectionId !== outcome) wonAll = false;
        } else if (sel.marketType === "DOUBLE_CHANCE") {
          const outcome = hScore > aScore ? "HOME" : aScore > hScore ? "AWAY" : "DRAW";
          if (sel.selectionId === "HOME_OR_DRAW" && outcome === "AWAY") wonAll = false;
          if (sel.selectionId === "HOME_OR_AWAY" && outcome === "DRAW") wonAll = false;
          if (sel.selectionId === "DRAW_OR_AWAY" && outcome === "HOME") wonAll = false;
        } else if (sel.marketType === "BOTH_TEAMS_TO_SCORE") {
          const bothScored = hScore > 0 && aScore > 0;
          if (sel.selectionId === "YES" && !bothScored) wonAll = false;
          if (sel.selectionId === "NO" && bothScored) wonAll = false;
        } else if (sel.marketType === "OVER_UNDER_GOALS") {
          const totalGoals = hScore + aScore;
          const [mode, lineStr] = sel.selectionId.split("_");
          const line = parseFloat(lineStr.replace("_", "."));
          if (mode === "OVER" && totalGoals <= line) wonAll = false;
          if (mode === "UNDER" && totalGoals >= line) wonAll = false;
        } else if (sel.marketType === "OVER_UNDER_CORNERS") {
          const totalCorners = (match.stats?.home.corners || 0) + (match.stats?.away.corners || 0);
          const [mode, lineStr] = sel.selectionId.split("_");
          const line = parseFloat((lineStr || "0").replace("_", "."));
          if (mode === "OVER" && totalCorners <= line) wonAll = false;
          if (mode === "UNDER" && totalCorners >= line) wonAll = false;
        } else if (sel.marketType === "OVER_UNDER_CARDS") {
          const totalCards =
            (match.stats?.home.yellowCards || 0) + (match.stats?.home.redCards || 0) +
            (match.stats?.away.yellowCards || 0) + (match.stats?.away.redCards || 0);
          const [mode, lineStr] = sel.selectionId.split("_");
          const line = parseFloat((lineStr || "0").replace("_", "."));
          if (mode === "OVER" && totalCards <= line) wonAll = false;
          if (mode === "UNDER" && totalCards >= line) wonAll = false;
        } else if (sel.marketType === "OVER_UNDER_SAVES") {
          const totalSaves = (match.stats?.home.saves || 0) + (match.stats?.away.saves || 0);
          const [mode, lineStr] = sel.selectionId.split("_");
          const line = parseFloat((lineStr || "0").replace("_", "."));
          if (mode === "OVER" && totalSaves <= line) wonAll = false;
          if (mode === "UNDER" && totalSaves >= line) wonAll = false;
        } else if (sel.marketType === "EXACT_SCORE") {
          if (sel.selectionId !== `${hScore}-${aScore}`) wonAll = false;
        } else if (sel.marketType === "ANYTIME_GOALSCORER") {
          const scored = match.events.some(
            (ev) => ev.type === "GOAL" && ev.playerId === sel.selectionId,
          );
          if (!scored) wonAll = false;
        }
      });

      const updatedStatus = wonAll ? ("WON" as const) : ("LOST" as const);
      if (wonAll) totalWinPayoutSum += ticket.potentialPayout;
      return { ...ticket, status: updatedStatus };
    });

    // 2a. Toast won/lost regular tickets
    finalTickets.forEach((ticket, idx) => {
      if (userProfile.tickets[idx]?.status === "PENDING") {
        if (ticket.status === "WON") {
          addToast({ type: "win", title: "🏆 Ticket Won!", message: `+$${ticket.potentialPayout.toFixed(2)} payout`, duration: 5000 });
        } else if (ticket.status === "LOST") {
          addToast({ type: "loss", title: "Ticket Lost", message: `-$${ticket.stake.toFixed(2)} stake lost`, duration: 3000 });
        }
      }
    });

        // 2b. Settle BetBuilder tickets
    let bbPayoutSum = 0;
    const finalBbTickets = (userProfile.betBuilderTickets || []).map((ticket) => {
      if (ticket.status !== "PENDING") return ticket;
      const match = completedFixtures.find((f) => f.id === ticket.fixtureId);
      if (!match) return ticket;
      const result = settleBetBuilderTicket(ticket, match);
      if (result === "WON") bbPayoutSum += ticket.potentialPayout;
      return { ...ticket, status: result };
    });

    // 3. Settle tipsters
    const updatedTipsters = resolveTipsterRound(tipsters, tipsterTickets, completedFixtures);

    // 4. Update player rosters
    completedFixtures.forEach((fix) => {
      updatedTeamsList = updateRostersAndStatsAfterFixture(updatedTeamsList, fix);
    });

    // 5. Check campaign completion
    const isLeagueCompleted = gameMode === "LEAGUE" && currentRoundIndex === 14;
    const isFinalFinished =
      (gameMode === "TOURNAMENT" && currentRoundIndex === 4) || isLeagueCompleted;

    let nextRoundIdx = currentRoundIndex;
    let nextFixturesList = [...fixtures];
    let nextTipsterTickets: typeof tipsterTickets = {};

    if (!isFinalFinished) {
      nextRoundIdx = currentRoundIndex + 1;
      if (gameMode === "TOURNAMENT") {
        const newFixtures = generateNextRoundFixtures(fixtures, updatedTeamsList, nextRoundIdx);
        nextFixturesList = [...fixtures, ...newFixtures];
      } else {
        nextFixturesList = [...fixtures];
      }
      nextTipsterTickets = generateTipsterBetsForRound(updatedTipsters, nextFixturesList, updatedTeamsList);
    } else if (gameMode === "LEAGUE") {
      setShowWinnerCelebration(true);
      const allTeamsWithDivisions = applyRelegationPromotion(
        [...teams, ...updatedTeamsList.filter((ut) => !teams.find((t) => t.id === ut.id))],
        completedFixtures,
      );
      const mergedAll = allTeamsWithDivisions.map((t) => {
        const updated = updatedTeamsList.find((u) => u.id === t.id);
        return updated ? { ...t, division: t.division } : t;
      });
      const { teams: newSeasonTeams, fixtures: newSeasonFixtures } = initializeNewLeagueSeason(mergedAll);
      nextRoundIdx = 0;
      updatedTeamsList = newSeasonTeams;
      nextFixturesList = newSeasonFixtures;
      nextTipsterTickets = generateTipsterBetsForRound(updatedTipsters, newSeasonFixtures, newSeasonTeams);
    } else {
      setShowWinnerCelebration(true);
    }

    // 6. Club ownership passive income
    let ownershipRevenue = 0;
    let ownershipRevenueDetail: {
      fixtureId: string;
      baseIncome: number;
      bonus: number;
      result: "WIN" | "DRAW" | "LOSS";
      scoreline: string;
    }[] = [];

    if (userProfile.ownedTeamId) {
      const ownedTeam = updatedTeamsList.find((t) => t.id === userProfile.ownedTeamId);
      if (ownedTeam?.ownership) {
        const baseIncome = ownedTeam.ownership.passiveIncomePerMatch;
        completedFixtures.forEach((fix) => {
          const isHome = fix.homeTeamId === userProfile.ownedTeamId;
          const isAway = fix.awayTeamId === userProfile.ownedTeamId;
          if (!isHome && !isAway) return;
          const hScore = Math.floor(fix.homeScore);
          const aScore = Math.floor(fix.awayScore);
          const ownedScored = isHome ? hScore : aScore;
          const oppScored = isHome ? aScore : hScore;
          let result: "WIN" | "DRAW" | "LOSS" = "DRAW";
          let bonus = 0;
          if (ownedScored > oppScored) { result = "WIN"; bonus = Math.round(baseIncome * 0.25); }
          else if (ownedScored < oppScored) { result = "LOSS"; bonus = -Math.round(baseIncome * 0.10); }
          ownershipRevenue += baseIncome + bonus;
          ownershipRevenueDetail.push({
            fixtureId: fix.id,
            baseIncome,
            bonus,
            result,
            scoreline: isHome ? `${hScore}-${aScore}` : `${aScore}-${hScore}`,
          });
        });
      }
    }

    // 7. Update transfer balance for auction winners
    let transferBalanceAdjust = 0;
    if (userBid && transferListings.length > 0) {
      const won = transferListings.find(
        (l) => l.id === userBid.listingId && l.status === "OPEN",
      );
      if (won) {
        const allBids = [...won.bids, { bidderId: "USER" as const, amount: userBid.amount }];
        const maxBid = Math.max(...allBids.map((b) => b.amount));
        if (userBid.amount >= maxBid) {
          transferBalanceAdjust = -userBid.amount;
        }
      }
    }

    const nextBalance =
      Math.round(
        (userProfile.balance + totalWinPayoutSum + bbPayoutSum + ownershipRevenue + transferBalanceAdjust) * 100,
      ) / 100;

    const finalNetProfit = finalTickets.reduce((acc, t) => {
      if (t.status === "WON") return acc + (t.potentialPayout - t.stake);
      if (t.status === "LOST") return acc - t.stake;
      return acc;
    }, 0);

    const nextProfile: Profile = {
      ...userProfile,
      balance: nextBalance,
      netProfit: finalNetProfit,
      tickets: finalTickets,
      betBuilderTickets: finalBbTickets,
      currentRoundIndex: nextRoundIdx,
    };

    persistStateToCache(gameMode, activeSlot, nextProfile, updatedTeamsList, nextFixturesList, updatedTipsters, nextTipsterTickets);

    setUserProfile(nextProfile);

    if (ownershipRevenue > 0 && ownershipRevenueDetail.length > 0 && userProfile.ownedTeamId) {
      const ownedTeam = updatedTeamsList.find((t) => t.id === userProfile.ownedTeamId);
      setOwnerRevenueReport({
        revenue: ownershipRevenue,
        fixtures: ownershipRevenueDetail,
        teamName: ownedTeam?.name || "Your Club",
      });
    }

    // Annotate each newly-settled fixture with its MOTM result
    nextFixturesList = nextFixturesList.map((f) => {
      if (f.status === "FT" && !f.motm) {
        const motmResult = calculateMOTM(f, updatedTeamsList);
        return motmResult ? { ...f, motm: motmResult } : f;
      }
      return f;
    });

    setTeams(updatedTeamsList);
    setFixtures(nextFixturesList);
    setTipsters(updatedTipsters);
    setTipsterTickets(nextTipsterTickets);
    setSelectedBets([]);
    setTicks(0);

    if (!isFinalFinished) {
      setActiveTab("fixtures");
    } else {
      setActiveTab("live");
    }
  };
}
