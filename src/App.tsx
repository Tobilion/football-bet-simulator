import { useState, useEffect, useRef } from "react";
import {
  Team,
  Fixture,
  BetTicket,
  Profile,
  Tipster,
  TransferListing,
  BetBuilderSelection,
} from "./types";
import { Header } from "./components/Header";
import { BettingSlip } from "./components/BettingSlip";
import { LiveMatches } from "./components/LiveMatches";
import { FootysimMatchViewer } from "./components/FootysimMatchViewer";
import type { FootysimMatch } from "./engine/footysimBridge";
import { FixturesOdds } from "./components/FixturesOdds";
import { MyBets } from "./components/MyBets";
import { TeamsList } from "./components/TeamsList";
import { Analytics } from "./components/Analytics";
import { TournamentBracket } from "./components/TournamentBracket";
import { Leaderboard } from "./components/Leaderboard";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { SplashGate } from "./components/SplashGate";
import { LeagueStandings } from "./components/LeagueStandings";
import { CasinoSuite } from "./components/CasinoSuite";
import { VIPStore } from "./components/VIPStore";
import { ClubManager } from "./components/ClubManager";
import { SocialFeed } from "./components/SocialFeed";
import { TransferMarket } from "./components/TransferMarket";
import { BetBuilder } from "./components/BetBuilder";
import { WalletModal } from "./components/modals/WalletModal";
import { WinnerCelebrationModal } from "./components/modals/WinnerCelebrationModal";
import { GlobalEntityPreviewModal } from "./components/modals/GlobalEntityPreviewModal";
import { OwnerRevenueModal } from "./components/modals/OwnerRevenueModal";
import { MatchHighlightsModal } from "./components/modals/MatchHighlightsModal";

import {
  initializeNewTournament,
  initializeNewLeague,
  ROUND_LABELS,
} from "./data/tournament";
import { INITIAL_TIPSTERS, generateTipsterBetsForRound } from "./data/tipsters";
import {
  getKeysForMode,
  persistStateToCache,
  isSaveCompatible,
} from "./utils/storage";
import {
  generateTransferListings,
  applyUserWinsToOwnedTeam,
} from "./engine/transferEngine";
import { useProfile } from "./hooks/useProfile";
import { useSimulation } from "./hooks/useSimulation";
import { useBetting } from "./hooks/useBetting";
import { buildHandleAdvanceRound } from "./hooks/useRoundAdvance";
import { useTransferMarket } from "./hooks/useTransferMarket";
import { useChallenges } from "./hooks/useChallenges";
import { Challenges } from "./components/Challenges";
import { CareerStats } from "./components/CareerStats";
import { loadCareerProfile } from "./utils/careerUtils";
import { CareerProfile } from "./types";
import { ToastContainer } from "./components/ui/Toast";
import { OnboardingOverlay } from "./components/OnboardingOverlay";

export default function App() {
  const [showOnboarding, setShowOnboarding] = useState<boolean>(
    () => localStorage.getItem("cubet_onboarded") !== "true",
  );
  const [activeSlot, setActiveSlot] = useState<number>(() =>
    parseInt(localStorage.getItem("fs_selected_game_slot") || "1"),
  );
  const [dummyUpdateSlot, setDummyUpdateSlot] = useState(0);
  // Always null on a fresh page load — every visit goes through the splash
  // gate + WelcomeScreen save picker rather than auto-resuming silently.
  // WelcomeScreen preselects the last-used mode/slot so resuming is one click.
  const [gameMode, setGameMode] = useState<"TOURNAMENT" | "LEAGUE" | null>(
    null,
  );

  const [activeTab, setActiveTab] = useState("fixtures");
  const [collapsedSlip, setCollapsedSlip] = useState(false);
  const [showWinnerCelebration, setShowWinnerCelebration] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [ownerRevenueReport, setOwnerRevenueReport] = useState<{
    revenue: number;
    fixtures: {
      fixtureId: string;
      baseIncome: number;
      bonus: number;
      result: "WIN" | "DRAW" | "LOSS";
      scoreline: string;
    }[];
    teamName: string;
  } | null>(null);
  const [betBuilderFixtureId, setBetBuilderFixtureId] = useState<string | null>(
    null,
  );
  const [globalEntity, setGlobalEntity] = useState<{
    type: "team" | "player";
    id: string;
  } | null>(null);
  const [showHighlightsFixture, setShowHighlightsFixture] =
    useState<Fixture | null>(null);
  const [careerProfile, setCareerProfile] = useState<CareerProfile>(() =>
    loadCareerProfile(),
  );
  const [selectedFixtureId, setSelectedFixtureId] = useState<string>(
    () => localStorage.getItem("lastSelectedFixtureId") || "",
  );

  const [teams, setTeams] = useState<Team[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [tipsters, setTipsters] = useState<Tipster[]>([]);
  const [tipsterTickets, setTipsterTickets] = useState<{
    [id: string]: BetTicket;
  }>({});

  const profileHook = useProfile({
    gameMode,
    activeSlot,
    teams,
    setTeams,
    fixtures,
    tipsters,
    tipsterTickets,
  });
  const { userProfile, setUserProfile, persist } = profileHook;

  const {
    transferListings,
    setTransferListings,
    userBids,
    setUserBids,
    transferToast,
    handlePlaceUserBid,
    handleWithdrawBid,
    handleRefreshListings,
    showTransferToast,
  } = useTransferMarket({ userProfile, setUserProfile, persist, teams });

  const simHook = useSimulation({
    teams,
    userProfile,
    gameMode,
    activeSlot,
    fixtures,
    setFixtures,
    setActiveTab,
  });
  const { isSimulating, setIsSimulating, ticks, setTicks, simTimerRef } =
    simHook;

  const challengesHook = useChallenges({
    userProfile,
    setUserProfile,
    persist,
  });

  const bettingHook = useBetting({
    userProfile,
    setUserProfile,
    fixtures,
    teams,
    tipsters,
    tipsterTickets,
    gameMode,
    activeSlot,
    setCollapsedSlip,
  });
  const { selectedBets, setSelectedBets } = bettingHook;

  // ─── Auto-settle tickets when their matches finish ─────────────────
  // Tickets should never sit pending/"suspended" after full time — settle
  // any whose fixtures have all reached FT without waiting for a round advance.
  useEffect(() => {
    bettingHook.settleFinishedTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixtures]);

  // ─── Global entity modal events ────────────────────────────────────
  useEffect(() => {
    const handleOpenEntity = (e: Event) => {
      const ev = e as CustomEvent<{ type: "team" | "player"; id: string }>;
      if (ev.detail) setGlobalEntity(ev.detail);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setGlobalEntity(null);
    };
    window.addEventListener("open-global-entity", handleOpenEntity);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("open-global-entity", handleOpenEntity);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // ─── Highlights modal events ───────────────────────────────────────
  useEffect(() => {
    const handleOpenHighlights = (e: Event) => {
      const ev = e as CustomEvent<{ fixtureId: string }>;
      if (!ev.detail) return;
      const fx = fixtures.find((f) => f.id === ev.detail.fixtureId);
      if (fx) setShowHighlightsFixture(fx);
    };
    window.addEventListener("open-highlights", handleOpenHighlights);
    return () =>
      window.removeEventListener("open-highlights", handleOpenHighlights);
  }, [fixtures]);

  // Reload career stats whenever a season concludes
  useEffect(() => {
    if (showWinnerCelebration) setCareerProfile(loadCareerProfile());
  }, [showWinnerCelebration]);

  useEffect(() => {
    if (selectedFixtureId)
      localStorage.setItem("lastSelectedFixtureId", selectedFixtureId);
  }, [selectedFixtureId]);

  // ─── Load / initialise game state ──────────────────────────────────
  useEffect(() => {
    if (!gameMode) return;
    localStorage.setItem("fs_selected_game_mode", gameMode);
    const keys = getKeysForMode(gameMode, activeSlot);
    const cp = localStorage.getItem(keys.profile);
    const ct = localStorage.getItem(keys.teams);
    const cf = localStorage.getItem(keys.fixtures);
    const cs = localStorage.getItem(keys.tipsters);
    const ck = localStorage.getItem(keys.tipsterTickets);

    if (cp && ct && cf && cs && isSaveCompatible(keys)) {
      try {
        const parsedProfile: Profile = JSON.parse(cp);
        const parsedTeams: Team[] = JSON.parse(ct);
        const parsedFixtures: Fixture[] = JSON.parse(cf);
        const parsedTipsters: Tipster[] = JSON.parse(cs);
        const parsedTickets = ck ? JSON.parse(ck) : {};
        setUserProfile(parsedProfile);
        setTeams(parsedTeams);
        setFixtures(parsedFixtures);
        setTipsters(parsedTipsters);
        setTipsterTickets(parsedTickets);
        const activeRound = parsedFixtures.filter(
          (f) => f.roundIndex === parsedProfile.currentRoundIndex,
        );
        const live = activeRound.filter((f) => f.status === "LIVE");
        if (live.length > 0) {
          setTicks(live[0].elapsedTicks);
          setActiveTab("live");
        } else if (
          activeRound.length > 0 &&
          activeRound.every((f) => f.status === "FT")
        ) {
          setTicks(15);
          setActiveTab("live");
        } else {
          setTicks(0);
          setActiveTab("fixtures");
        }
      } catch {
        handleResetAndGenerate();
      }
    } else {
      handleResetAndGenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameMode]);

  // Sync selectedFixtureId to valid fixture
  useEffect(() => {
    if (!userProfile || fixtures.length === 0) return;
    const roundFixtures = fixtures.filter(
      (f) => f.roundIndex === userProfile.currentRoundIndex,
    );
    if (roundFixtures.length === 0) return;
    const isValid = roundFixtures.some((f) => f.id === selectedFixtureId);
    if (!isValid) {
      const first =
        roundFixtures.find((f) => f.status !== "FT") || roundFixtures[0];
      setSelectedFixtureId(first.id);
    }
  }, [userProfile?.currentRoundIndex, fixtures, selectedFixtureId]);

  // Bankroll history tracker
  useEffect(() => {
    if (!userProfile) return;
    const history = userProfile.bankrollHistory || [];
    const lastBal =
      history.length > 0 ? history[history.length - 1].balance : null;
    if (lastBal === null || Math.abs(userProfile.balance - lastBal) > 0.01) {
      setUserProfile((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          bankrollHistory: [
            ...(prev.bankrollHistory || []),
            { timestamp: Date.now(), balance: prev.balance, detail: "Update" },
          ],
        };
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.balance]);

  // ─── Reset / new campaign helpers ──────────────────────────────────
  const handleResetAndGenerate = (keepRecords = false) => {
    if (!gameMode) return;
    let { teams: newTeams, fixtures: newFixtures } =
      gameMode === "TOURNAMENT"
        ? initializeNewTournament()
        : initializeNewLeague();

    // When continuing (keepRecords), permanent history must survive the new
    // tournament/season: club ownership — which holds the trophy cabinet — and
    // each team's season-by-season record history are carried onto the freshly
    // generated teams by matching team id. Without this the trophy room and
    // records are wiped every rollover.
    if (keepRecords) {
      newTeams = newTeams.map((nt) => {
        const prev = teams.find((t) => t.id === nt.id);
        if (!prev) return nt;
        return {
          ...nt,
          ...(prev.ownership ? { ownership: prev.ownership } : {}),
          ...(prev.seasonHistory ? { seasonHistory: prev.seasonHistory } : {}),
        };
      });
    }

    const initialProfile: Profile = {
      username: userProfile?.username || "Tobi",
      balance: keepRecords ? (userProfile?.balance ?? 1000) : 1000,
      netProfit: keepRecords ? (userProfile?.netProfit ?? 0) : 0,
      tickets: keepRecords ? (userProfile?.tickets ?? []) : [],
      currentRoundIndex: 0,
      createdTime: keepRecords
        ? (userProfile?.createdTime ?? Date.now())
        : Date.now(),
      // Permanent player-level records also persist across rollovers.
      ...(keepRecords
        ? {
            ownedTeamId: userProfile?.ownedTeamId,
            ownedTeamIds: userProfile?.ownedTeamIds,
            purchasedItems: userProfile?.purchasedItems,
            bankrollHistory: userProfile?.bankrollHistory,
            betBuilderTickets: userProfile?.betBuilderTickets,
            challenges: userProfile?.challenges,
          }
        : {}),
    };
    const ts = [...INITIAL_TIPSTERS];
    const tk = generateTipsterBetsForRound(ts, newFixtures, newTeams);
    persistStateToCache(
      gameMode,
      activeSlot,
      initialProfile,
      newTeams,
      newFixtures,
      ts,
      tk,
    );
    setUserProfile(initialProfile);
    setTeams(newTeams);
    setFixtures(newFixtures);
    setTipsters(ts);
    setTipsterTickets(tk);
    setSelectedBets([]);
    setTicks(0);
    setIsSimulating(false);
    setShowWinnerCelebration(false);
    setTransferListings([]);
    setUserBids([]);
    setActiveTab("fixtures");
    localStorage.removeItem("fs_social_posts"); // clear stale live-chat banter
    if (simTimerRef.current) clearInterval(simTimerRef.current);
  };

  const handleStartNewCampaign = (
    username: string,
    startingBalance: number,
    mode: "TOURNAMENT" | "LEAGUE",
    slot: number,
  ) => {
    setActiveSlot(slot);
    localStorage.setItem("fs_selected_game_slot", String(slot));
    const { teams: newTeams, fixtures: newFixtures } =
      mode === "TOURNAMENT" ? initializeNewTournament() : initializeNewLeague();
    const initialProfile: Profile = {
      username,
      balance: startingBalance,
      netProfit: 0,
      tickets: [],
      currentRoundIndex: 0,
      createdTime: Date.now(),
    };
    const ts = [...INITIAL_TIPSTERS];
    const tk = generateTipsterBetsForRound(ts, newFixtures, newTeams);
    const keys = getKeysForMode(mode, slot);
    localStorage.setItem(keys.profile, JSON.stringify(initialProfile));
    localStorage.setItem(keys.teams, JSON.stringify(newTeams));
    localStorage.setItem(keys.fixtures, JSON.stringify(newFixtures));
    localStorage.setItem(keys.tipsters, JSON.stringify(ts));
    localStorage.setItem(keys.tipsterTickets, JSON.stringify(tk));
    localStorage.setItem("fs_selected_game_mode", mode);
    setGameMode(mode);
    setUserProfile(initialProfile);
    setTeams(newTeams);
    setFixtures(newFixtures);
    setTipsters(ts);
    setTipsterTickets(tk);
    setSelectedBets([]);
    setTicks(0);
    setIsSimulating(false);
    setShowWinnerCelebration(false);
    setTransferListings([]);
    setUserBids([]);
    setActiveTab("fixtures");
    localStorage.removeItem("fs_social_posts"); // fresh live-chat for a new campaign
    if (simTimerRef.current) clearInterval(simTimerRef.current);
  };

  const exitToMenu = () => {
    localStorage.removeItem("fs_selected_game_mode");
    setGameMode(null);
    setUserProfile(null);
    setTeams([]);
    setFixtures([]);
    setTipsters([]);
    setTipsterTickets({});
    setSelectedBets([]);
  };

  // ─── Generate transfer listings at round start ──────────────────────
  useEffect(() => {
    if (!userProfile || teams.length === 0) return;
    const currentListings = generateTransferListings(
      teams,
      userProfile.currentRoundIndex,
      transferListings,
    );
    setTransferListings(currentListings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.currentRoundIndex]);

  // ─── Apply user transfer wins to owned team ─────────────────────────
  const applyTransferWinsToTeam = (
    resolvedListings: TransferListing[],
    currentTeams: Team[],
    ownedTeamId: string,
    pricePaid: number,
  ) => {
    const updated = applyUserWinsToOwnedTeam(
      currentTeams,
      resolvedListings,
      ownedTeamId,
    );
    setTeams(updated);
    if (userProfile) {
      const nextProfile = {
        ...userProfile,
        balance: userProfile.balance - pricePaid,
      };
      setUserProfile(nextProfile);
      persist(nextProfile, updated);
    }
  };
  void applyTransferWinsToTeam;

  // ─── Bet Builder placement ────────────────────────────────────────
  const handleBBPlace = (
    sels: BetBuilderSelection[],
    stake: number,
    odds: number,
  ) => {
    if (!betBuilderFixtureId) return;
    if (
      bettingHook.handlePlaceBetBuilder(betBuilderFixtureId, sels, stake, odds)
    ) {
      setBetBuilderFixtureId(null);
    }
  };

  // Brief branded loading splash shown on EVERY app open, followed by the
  // click-through gate screen — both appear before the save-slot picker.
  const [booting, setBooting] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setBooting(false), 900);
    return () => clearTimeout(t);
  }, []);
  const [gateEntered, setGateEntered] = useState(false);

  // 2D spatial-engine (footysim) match viewer state + result apply.
  const [footysim2DId, setFootysim2DId] = useState<string | null>(null);
  const applyFootysimResult = (fixtureId: string, m: FootysimMatch) => {
    setFixtures((prev) => {
      const next = prev.map((f) =>
        f.id === fixtureId
          ? {
              ...f,
              status: "FT" as const,
              currentMinute: 90,
              elapsedTicks: 15,
              homeScore: m.homeScore,
              awayScore: m.awayScore,
              ...(m.penaltyScore ? { penaltyScore: m.penaltyScore } : {}),
              stats: m.stats,
              events: [...(f.events || []), ...m.events],
            }
          : f,
      );
      if (gameMode) {
        try {
          localStorage.setItem(
            getKeysForMode(gameMode, activeSlot).fixtures,
            JSON.stringify(next),
          );
        } catch {
          /* ignore */
        }
      }
      return next;
    });
    // Note: does NOT close the viewer — the modal shows the full-time summary and
    // the user closes it via "Back to Live" when ready.
  };

  const handleAdvanceRound = buildHandleAdvanceRound({
    gameMode,
    activeSlot,
    userProfile,
    teams,
    fixtures,
    tipsters,
    tipsterTickets,
    isSimulating,
    transferListings,
    userBids,
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
    setUserBids,
    onTransferToast: showTransferToast,
  });

  // ─── Champion name ──────────────────────────────────────────────────
  const getChampion = (): { name: string; crest: Team } => {
    if (!teams.length) return { name: "Champion", crest: teams[0] };
    if (gameMode === "LEAGUE") {
      const sorted = [...teams].sort((a, b) => {
        const pa = a.wonMatches * 3 + a.drawnMatches;
        const pb = b.wonMatches * 3 + b.drawnMatches;
        if (pb !== pa) return pb - pa;
        const da = a.goalsScored - a.goalsConceded;
        const db = b.goalsScored - b.goalsConceded;
        return db !== da ? db - da : b.goalsScored - a.goalsScored;
      });
      return { name: sorted[0].name, crest: sorted[0] };
    }
    const fin =
      fixtures.find((f) => f.roundIndex === 4 && f.status === "FT") ||
      fixtures.find((f) => f.roundIndex === 4);
    if (!fin) return { name: "Champion", crest: teams[0] };
    const winnerId =
      fin.homeScore > fin.awayScore ? fin.homeTeamId : fin.awayTeamId;
    const club = teams.find((t) => t.id === winnerId) || teams[0];
    return { name: club.name, crest: club };
  };

  const currentRoundLabel =
    gameMode === "LEAGUE"
      ? `Matchday ${(userProfile?.currentRoundIndex ?? 0) + 1}`
      : ROUND_LABELS[userProfile?.currentRoundIndex || 0] ||
        "Session Concluded";

  // ─── Welcome screen ─────────────────────────────────────────────────
  if (booting) {
    return (
      <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center gap-5 bg-[#05070a] text-slate-100">
        <div className="text-3xl font-black tracking-widest">
          <span className="text-emerald-400">CU</span> BET
        </div>
        <div className="h-1 w-40 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/2 rounded-full bg-emerald-500 animate-[loadbar_1.2s_ease-in-out_infinite]" />
        </div>
        <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-slate-500">
          Loading matchday…
        </span>
        <style>{`@keyframes loadbar{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>
      </div>
    );
  }

  if (!gateEntered) {
    return <SplashGate onEnter={() => setGateEntered(true)} />;
  }

  if (!gameMode || !userProfile) {
    const savedTournaments = [
      localStorage.getItem("fs_profile_v3_tournament_slot1") !== null ||
        localStorage.getItem("fs_profile_v3_tournament") !== null,
      localStorage.getItem("fs_profile_v3_tournament_slot2") !== null,
      localStorage.getItem("fs_profile_v3_tournament_slot3") !== null,
    ];
    const savedLeagues = [
      localStorage.getItem("fs_profile_v3_league_slot1") !== null ||
        localStorage.getItem("fs_profile_v3_league") !== null,
      localStorage.getItem("fs_profile_v3_league_slot2") !== null,
      localStorage.getItem("fs_profile_v3_league_slot3") !== null,
    ];

    const handleResumeCampaign = (
      mode: "TOURNAMENT" | "LEAGUE",
      slot: number,
    ) => {
      const keys = getKeysForMode(mode, slot);
      if (slot === 1 && localStorage.getItem(keys.profile) === null) {
        const m = mode.toLowerCase();
        ["profile", "teams", "fixtures", "tipsters", "tipsterTickets"].forEach(
          (k) => {
            const old = localStorage.getItem(
              `fs_${k === "tipsterTickets" ? "tipster_tickets" : k}_v3_${m}`,
            );
            if (old)
              localStorage.setItem((keys as Record<string, string>)[k], old);
          },
        );
      }
      setActiveSlot(slot);
      localStorage.setItem("fs_selected_game_slot", String(slot));
      setGameMode(mode);
    };

    const handleDeleteSave = (mode: "TOURNAMENT" | "LEAGUE", slot: number) => {
      const keys = getKeysForMode(mode, slot);
      Object.values(keys).forEach((k) => localStorage.removeItem(k));
      if (slot === 1) {
        const m = mode.toLowerCase();
        ["profile", "teams", "fixtures", "tipsters", "tipster_tickets"].forEach(
          (k) => localStorage.removeItem(`fs_${k}_v3_${m}`),
        );
      }
      setDummyUpdateSlot((p) => p + 1);
    };

    void dummyUpdateSlot;

    return (
      <>
        {showOnboarding && (
          <OnboardingOverlay onEnter={() => setShowOnboarding(false)} />
        )}
        <WelcomeScreen
          onKickoff={handleStartNewCampaign}
          savedTournaments={savedTournaments}
          savedLeagues={savedLeagues}
          resumeActiveMode={handleResumeCampaign}
          onDeleteSave={handleDeleteSave}
        />
      </>
    );
  }

  const champion = getChampion();

  return (
    <>
      {showOnboarding && (
        <OnboardingOverlay onEnter={() => setShowOnboarding(false)} />
      )}
      <div
        id="app"
        className="h-screen w-screen bg-gradient-to-br from-[#0b0e14] via-[#05070a] to-[#121620] text-slate-100 flex flex-col overflow-hidden font-sans animate-fade-in"
      >
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          username={userProfile.username}
          balance={userProfile.balance}
          addFunds={() => setShowWalletModal(true)}
          resetTournament={handleResetAndGenerate}
          currentRoundLabel={currentRoundLabel}
          gameMode={gameMode}
          exitToMenu={exitToMenu}
          hasOwnedClub={!!userProfile.ownedTeamId}
        />

        <div
          id="workspace-split"
          className="flex flex-1 min-h-0 overflow-hidden relative"
        >
          <main className="flex-1 min-h-0 flex flex-col overflow-hidden bg-transparent">
            {activeTab === "live" && (
              <LiveMatches
                fixtures={fixtures}
                teams={teams}
                roundIndex={userProfile.currentRoundIndex}
                currentRoundLabel={currentRoundLabel}
                isSimulating={isSimulating}
                onStartSimulation={simHook.handleStartSimulation}
                onPauseSimulation={simHook.handlePauseSimulation}
                onSimulateTick={simHook.handleSimulateTick}
                onSimulateInstant={simHook.handleSimulateInstant}
                onSimulateRemainingInstant={
                  simHook.handleSimulateRemainingInstant
                }
                onAdvanceRound={handleAdvanceRound}
                ticks={ticks}
                selectedFixtureId={selectedFixtureId}
                setSelectedFixtureId={setSelectedFixtureId}
                selectedBets={selectedBets}
                onAddBetSelection={bettingHook.handleAddBetSelection}
                onRemoveSelection={bettingHook.handleRemoveSelection}
                ownedTeamId={userProfile.ownedTeamId}
                onWatch2D={setFootysim2DId}
              />
            )}
            {activeTab === "fixtures" && (
              <FixturesOdds
                fixtures={fixtures}
                teams={teams}
                roundIndex={userProfile.currentRoundIndex}
                currentRoundLabel={currentRoundLabel}
                selectedBets={selectedBets}
                onAddBetSelection={bettingHook.handleAddBetSelection}
                onRemoveSelection={bettingHook.handleRemoveSelection}
                onOpenBetBuilder={setBetBuilderFixtureId}
              />
            )}
            {activeTab === "bets" && (
              <MyBets
                tickets={userProfile.tickets}
                fixtures={fixtures}
                teams={teams}
                balance={userProfile.balance}
                onCashOut={bettingHook.handleCashOut}
                betBuilderTickets={userProfile.betBuilderTickets || []}
                challengesSlot={
                  <Challenges
                    challenges={challengesHook.activeChallenges}
                    currentRoundIndex={userProfile.currentRoundIndex}
                    onClaim={challengesHook.handleClaimChallenge}
                    onDismiss={challengesHook.handleDismissChallenge}
                  />
                }
              />
            )}
            {activeTab === "teams" && (
              <TeamsList teams={teams} fixtures={fixtures} />
            )}
            {activeTab === "analytics" && (
              <Analytics
                teams={teams}
                fixtures={fixtures}
                userProfile={userProfile}
              />
            )}
            {activeTab === "tournament" &&
              (gameMode === "LEAGUE" ? (
                <LeagueStandings
                  teams={teams}
                  fixtures={fixtures}
                  currentRoundIndex={userProfile.currentRoundIndex}
                />
              ) : (
                <TournamentBracket fixtures={fixtures} teams={teams} />
              ))}
            {activeTab === "career" && (
              <CareerStats
                career={careerProfile}
                liveProfile={userProfile}
                gameMode={gameMode}
              />
            )}
            {activeTab === "leaderboard" && (
              <Leaderboard
                tipsters={tipsters}
                userBalance={userProfile.balance}
                username={userProfile.username}
                tickets={userProfile.tickets}
              />
            )}
            {activeTab === "casino" && (
              <CasinoSuite
                balance={userProfile.balance}
                onUpdateBalance={profileHook.handleUpdateBalanceCasino}
                username={userProfile.username}
                currentRoundIndex={userProfile.currentRoundIndex}
              />
            )}
            {activeTab === "store" && (
              <VIPStore
                balance={userProfile.balance}
                purchasedItems={userProfile.purchasedItems || []}
                onPurchase={profileHook.handlePurchaseVIPItem}
                onLiquidate={profileHook.handleLiquidateVIPItem}
                teams={teams}
                ownedTeamId={userProfile.ownedTeamId}
                ownedTeamIds={userProfile.ownedTeamIds}
                onRenameStadium={profileHook.handleRenameStadium}
                onBoostRatings={profileHook.handleBoostClubRatings}
              />
            )}
            {activeTab === "myclub" && userProfile.ownedTeamId && (
              <ClubManager
                ownedTeamId={userProfile.ownedTeamId}
                ownedTeamIds={userProfile.ownedTeamIds}
                teams={teams}
                balance={userProfile.balance}
                onUpdateOwnership={profileHook.handleUpdateClubOwnership}
                onUpgradeFacility={profileHook.handleUpgradeFacility}
                onUpdateBalance={(delta: number) => {
                  if (!userProfile) return;
                  const nextProfile = {
                    ...userProfile,
                    balance: Math.max(0, userProfile.balance + delta),
                  };
                  setUserProfile(nextProfile);
                  persist(nextProfile);
                }}
              />
            )}
            {activeTab === "transfers" && userProfile.ownedTeamId && (
              <TransferMarket
                listings={transferListings}
                teams={teams}
                ownedTeamId={userProfile.ownedTeamId}
                ownedTeamIds={userProfile.ownedTeamIds}
                currentRoundIndex={userProfile.currentRoundIndex}
                balance={userProfile.balance}
                userBids={userBids}
                onPlaceBid={handlePlaceUserBid}
                onWithdrawBid={handleWithdrawBid}
                onRefresh={() =>
                  handleRefreshListings(teams, userProfile.currentRoundIndex)
                }
              />
            )}
            {activeTab === "feed" && (
              <SocialFeed
                fixtures={fixtures}
                teams={teams}
                roundLabel={currentRoundLabel}
              />
            )}
          </main>

          {!["casino", "store", "feed", "myclub", "transfers"].includes(
            activeTab,
          ) && (
            <BettingSlip
              selections={selectedBets}
              fixtures={fixtures}
              teams={teams}
              currentRoundIndex={userProfile.currentRoundIndex}
              onRemoveSelection={bettingHook.handleRemoveSelection}
              onClearAll={bettingHook.handleClearAllSelections}
              balance={userProfile.balance}
              onPlaceBet={bettingHook.handlePlaceBet}
              collapsed={collapsedSlip}
              setCollapsed={setCollapsedSlip}
              onAddSelections={bettingHook.handleAddMultipleSelections}
            />
          )}
        </div>

        {/* Transfer toast */}
        {transferToast && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-sm font-semibold px-5 py-2.5 rounded-xl shadow-xl z-[200] animate-fade-in">
            {transferToast}
          </div>
        )}

        {showWalletModal && (
          <WalletModal
            balance={userProfile.balance}
            onConfirmTransaction={profileHook.handleConfirmWalletTransaction}
            onClose={() => setShowWalletModal(false)}
          />
        )}
        {showWinnerCelebration && (
          <WinnerCelebrationModal
            gameMode={gameMode}
            balance={userProfile.balance}
            championName={champion.name}
            championCrest={champion.crest}
            onClose={() => setShowWinnerCelebration(false)}
            onResetRound={handleResetAndGenerate}
          />
        )}
        {ownerRevenueReport && (
          <OwnerRevenueModal
            teamName={ownerRevenueReport.teamName}
            revenue={ownerRevenueReport.revenue}
            fixtures={ownerRevenueReport.fixtures}
            onClose={() => setOwnerRevenueReport(null)}
          />
        )}
        {globalEntity && (
          <GlobalEntityPreviewModal
            globalEntity={globalEntity}
            teams={teams}
            onClose={() => setGlobalEntity(null)}
            onChangeEntity={(entity) => setGlobalEntity(entity)}
            onNavigateToTeams={() => {
              setGlobalEntity(null);
              setActiveTab("teams");
            }}
          />
        )}
        {betBuilderFixtureId &&
          (() => {
            const bbFixture = fixtures.find(
              (f) => f.id === betBuilderFixtureId,
            );
            return bbFixture ? (
              <BetBuilder
                fixture={bbFixture}
                teams={teams}
                balance={userProfile.balance}
                onPlace={handleBBPlace}
                onClose={() => setBetBuilderFixtureId(null)}
              />
            ) : null;
          })()}
        {showHighlightsFixture && (
          <MatchHighlightsModal
            fixture={showHighlightsFixture}
            teams={teams}
            onClose={() => setShowHighlightsFixture(null)}
          />
        )}
        {(() => {
          if (!footysim2DId) return null;
          const fx = fixtures.find((f) => f.id === footysim2DId);
          const home = fx && teams.find((t) => t.id === fx.homeTeamId);
          const away = fx && teams.find((t) => t.id === fx.awayTeamId);
          if (!fx || !home || !away) return null;
          return (
            <FootysimMatchViewer
              homeTeam={home}
              awayTeam={away}
              seed={
                (fx.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) +
                  userProfile.currentRoundIndex * 31) >>>
                0
              }
              knockout={gameMode === "TOURNAMENT"}
              onClose={() => setFootysim2DId(null)}
              onApply={(m) => applyFootysimResult(fx.id, m)}
            />
          );
        })()}
        <ToastContainer />
      </div>
    </>
  );
}
