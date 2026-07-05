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
import { evaluateChallenges } from "../data/challenges";
import { recordSeasonEnd } from "../utils/careerUtils";
import { settlePendingTickets } from "../utils/betSettlement";

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

// Append a trophy to a champion club's ownership record, but only if the player owns it.
function awardTrophyToOwnedChampion(
  teamsList: Team[],
  championId: string | undefined,
  ownedIds: string[],
  competition: string,
): Team[] {
  if (!championId || !ownedIds.includes(championId)) return teamsList;
  const trophy = { competition, wonAt: new Date().toLocaleDateString() };
  return teamsList.map((t) =>
    t.id === championId && t.ownership
      ? { ...t, ownership: { ...t.ownership, trophies: [...(t.ownership.trophies ?? []), trophy] } }
      : t,
  );
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
      updatedTeamsList = applyTransferResultsToTeams(updatedTeamsList, resolvedListings, userProfile.ownedTeamId);
      toastMsg = toastMessage;
      setTransferListings(resolvedListings.map((l) => ({
        ...l,
        status: l.highestBidder === "USER" ? "SOLD" : l.status === "OPEN" ? "EXPIRED" : l.status,
      })));
      setUserBid(null);
      if (toastMsg) { onTransferToast(toastMsg); addToast({ type: "transfer", title: "🔄 Transfer", message: toastMsg, duration: 6000 }); }
    }

    // 2. Evaluate user pending tickets
    const { finalTickets, totalWinPayoutSum } = settlePendingTickets(
      userProfile.tickets,
      completedFixtures,
    );

    // 2a. Toast won/lost regular tickets
    finalTickets.forEach((ticket, idx) => {
      if (userProfile.tickets[idx]?.status === "PENDING") {
        if (ticket.status === "WON") {
          addToast({ type: "win", title: "🏆 Ticket Won!", message: `+$${(ticket.settledPayout ?? ticket.potentialPayout).toFixed(2)} payout`, duration: 5000 });
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

    let championName = "Champion";
    const ownedIds = userProfile.ownedTeamIds ?? (userProfile.ownedTeamId ? [userProfile.ownedTeamId] : []);
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
      const leagueSorted = [...updatedTeamsList].sort((a, b) => {
        const pa = a.wonMatches * 3 + a.drawnMatches;
        const pb = b.wonMatches * 3 + b.drawnMatches;
        if (pb !== pa) return pb - pa;
        return (b.goalsScored - b.goalsConceded) - (a.goalsScored - a.goalsConceded);
      });
      championName = leagueSorted[0]?.name ?? "Champion";
      const leagueChampionId = leagueSorted[0]?.id;
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
      updatedTeamsList = awardTrophyToOwnedChampion(newSeasonTeams, leagueChampionId, ownedIds, "League Title");
      nextFixturesList = newSeasonFixtures;
      nextTipsterTickets = generateTipsterBetsForRound(updatedTipsters, newSeasonFixtures, newSeasonTeams);
    } else {
      setShowWinnerCelebration(true);
      const finalFx = completedFixtures[completedFixtures.length - 1];
      if (finalFx) {
        const winnerId = finalFx.homeScore > finalFx.awayScore ? finalFx.homeTeamId : finalFx.awayTeamId;
        championName = updatedTeamsList.find((t) => t.id === winnerId)?.name ?? "Champion";
        updatedTeamsList = awardTrophyToOwnedChampion(updatedTeamsList, winnerId, ownedIds, "Cup Title");
      }
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

    const finalNetProfit = Math.round(finalTickets.reduce((acc, t) => {
      if (t.status === "WON") return acc + ((t.settledPayout ?? t.potentialPayout) - t.stake);
      if (t.status === "LOST") return acc - t.stake;
      if (t.status === "CASHED_OUT") return acc + ((t.cashedOutAmount ?? 0) - t.stake);
      return acc;
    }, 0) * 100) / 100;

    // 8. Evaluate betting challenges against this round's settled bets
    const settledThisRound = finalTickets.filter(
      (t, idx) => userProfile.tickets[idx]?.status === "PENDING" && t.status !== "PENDING",
    );
    const settledBbThisRound = finalBbTickets.filter(
      (t, idx) => (userProfile.betBuilderTickets || [])[idx]?.status === "PENDING" && t.status !== "PENDING",
    );
    const evaluatedChallenges = evaluateChallenges(
      userProfile.challenges ?? [],
      settledThisRound,
      completedFixtures,
      currentRoundIndex,
      settledBbThisRound,
    );
    evaluatedChallenges.forEach((c) => {
      const prev = (userProfile.challenges ?? []).find((pc) => pc.id === c.id);
      if (prev?.status === "ACTIVE" && c.status === "COMPLETED") {
        addToast({ type: "win", title: "🎯 Challenge Complete!", message: `${c.title} — claim $${c.reward} in My Bets`, duration: 6000 });
      }
    });

    const nextProfile: Profile = {
      ...userProfile,
      balance: nextBalance,
      netProfit: finalNetProfit,
      tickets: finalTickets,
      betBuilderTickets: finalBbTickets,
      currentRoundIndex: nextRoundIdx,
      challenges: evaluatedChallenges,
    };

    // 9. Record completed season into career stats (fs_career_v1)
    if (isFinalFinished && gameMode) {
      const career = recordSeasonEnd(nextProfile, championName, gameMode);
      addToast({
        type: "info",
        title: "📜 Season Recorded",
        message: `Career: ${career.totalSeasonsPlayed} seasons • ${career.prestigeTitle}`,
        duration: 6000,
      });
    }

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
