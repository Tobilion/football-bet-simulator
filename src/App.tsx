import { useState, useEffect, useRef } from "react";
import {
  Team,
  Fixture,
  BetSelection,
  BetTicket,
  Profile,
  Tipster,
  MarketType,
} from "./types";
import { Header } from "./components/Header";
import { BettingSlip } from "./components/BettingSlip";
import { LiveMatches } from "./components/LiveMatches";
import { FixturesOdds } from "./components/FixturesOdds";
import { MyBets } from "./components/MyBets";
import { TeamsList } from "./components/TeamsList";
import { Analytics } from "./components/Analytics";
import { TournamentBracket } from "./components/TournamentBracket";
import { Leaderboard } from "./components/Leaderboard";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { LeagueStandings } from "./components/LeagueStandings";
import { CasinoSuite } from "./components/CasinoSuite";
import { VIPStore } from "./components/VIPStore";
import { ClubManager } from "./components/ClubManager";
import { SocialFeed } from "./components/SocialFeed";
import { WalletModal } from "./components/modals/WalletModal";
import { WinnerCelebrationModal } from "./components/modals/WinnerCelebrationModal";
import { GlobalEntityPreviewModal } from "./components/modals/GlobalEntityPreviewModal";
import { OwnerRevenueModal } from "./components/modals/OwnerRevenueModal";

import {
  initializeNewTournament,
  initializeNewLeague,
  generateNextRoundFixtures,
  updateRostersAndStatsAfterFixture,
  applyRelegationPromotion,
  initializeNewLeagueSeason,
  ROUND_LABELS,
} from "./data/tournament";
import {
  INITIAL_TIPSTERS,
  generateTipsterBetsForRound,
  resolveTipsterRound,
} from "./data/tipsters";
import {
  simulateMatchTick,
  simulateFullMatchInstantly,
} from "./engine/matchEngine";
import { TeamCrest } from "./components/TeamCrest";

const getKeysForMode = (mode: "TOURNAMENT" | "LEAGUE", slotNum: number = 1) => {
  const m = mode.toLowerCase();
  const suffix = `_slot${slotNum}`;
  return {
    profile: `fs_profile_v3_${m}${suffix}`,
    teams: `fs_teams_v3_${m}${suffix}`,
    fixtures: `fs_fixtures_v3_${m}${suffix}`,
    tipsters: `fs_tipsters_v3_${m}${suffix}`,
    tipsterTickets: `fs_tipster_tickets_v3_${m}${suffix}`,
  };
};

export default function App() {
  // Save slots
  const [activeSlot, setActiveSlot] = useState<number>(() => {
    return parseInt(localStorage.getItem("fs_selected_game_slot") || "1");
  });
  const [dummyUpdateSlot, setDummyUpdateSlot] = useState<number>(0);

  // Game Mode
  const [gameMode, setGameMode] = useState<"TOURNAMENT" | "LEAGUE" | null>(
    () => {
      return localStorage.getItem("fs_selected_game_mode") as
        | "TOURNAMENT"
        | "LEAGUE"
        | null;
    },
  );

  // Navigation & UI States
  const [activeTab, setActiveTab] = useState<string>("fixtures");
  const [collapsedSlip, setCollapsedSlip] = useState<boolean>(false);
  const [showWinnerCelebration, setShowWinnerCelebration] =
    useState<boolean>(false);

  // Core Persistent States
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [tipsters, setTipsters] = useState<Tipster[]>([]);
  const [tipsterTickets, setTipsterTickets] = useState<{
    [tipsterId: string]: BetTicket;
  }>({});

  // Active Selections in Slip
  const [selectedBets, setSelectedBets] = useState<BetSelection[]>([]);

  // Simulation Running State & Ticks
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [ticks, setTicks] = useState<number>(0);
  const [selectedFixtureId, setSelectedFixtureId] = useState<string>(() => {
    return localStorage.getItem("lastSelectedFixtureId") || "";
  });

  useEffect(() => {
    if (selectedFixtureId) localStorage.setItem("lastSelectedFixtureId", selectedFixtureId);
  }, [selectedFixtureId]);

  // Custom states for Wallet Modal
  const [showWalletModal, setShowWalletModal] = useState<boolean>(false);
  const [ownerRevenueReport, setOwnerRevenueReport] = useState<{
    revenue: number;
    fixtures: { fixtureId: string; baseIncome: number; bonus: number; result: "WIN" | "DRAW" | "LOSS"; scoreline: string }[];
    teamName: string;
  } | null>(null);

  // Global Entity Hover/Tap Information Portal States
  const [globalEntity, setGlobalEntity] = useState<{
    type: "team" | "player";
    id: string;
  } | null>(null);

  // Interval Ref for accurate cleanup
  const simTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Listen to the global entity select event and escape key press
  useEffect(() => {
    const handleOpenEntity = (e: Event) => {
      const customEvent = e as CustomEvent<{
        type: "team" | "player";
        id: string;
      }>;
      if (customEvent.detail) {
        setGlobalEntity({
          type: customEvent.detail.type,
          id: customEvent.detail.id,
        });
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setGlobalEntity(null);
      }
    };
    window.addEventListener("open-global-entity", handleOpenEntity);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("open-global-entity", handleOpenEntity);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // 1. Initialize or Load State based on selected GameMode
  useEffect(() => {
    if (!gameMode) return;

    localStorage.setItem("fs_selected_game_mode", gameMode);

    const keys = getKeysForMode(gameMode, activeSlot);
    const cachedProfile = localStorage.getItem(keys.profile);
    const cachedTeams = localStorage.getItem(keys.teams);
    const cachedFixtures = localStorage.getItem(keys.fixtures);
    const cachedTipsters = localStorage.getItem(keys.tipsters);
    const cachedTipsterTickets = localStorage.getItem(keys.tipsterTickets);

    if (cachedProfile && cachedTeams && cachedFixtures && cachedTipsters) {
      try {
        const parsedProfile: Profile = JSON.parse(cachedProfile);
        const parsedTeams: Team[] = JSON.parse(cachedTeams);
        const parsedFixtures: Fixture[] = JSON.parse(cachedFixtures);
        const parsedTipsters: Tipster[] = JSON.parse(cachedTipsters);
        const parsedTickets = cachedTipsterTickets
          ? JSON.parse(cachedTipsterTickets)
          : {};

        setUserProfile(parsedProfile);
        setTeams(parsedTeams);
        setFixtures(parsedFixtures);
        setTipsters(parsedTipsters);
        setTipsterTickets(parsedTickets);

        // Resume running status check
        const activeRoundFixtures = parsedFixtures.filter(
          (f) => f.roundIndex === parsedProfile.currentRoundIndex,
        );
        const liveFixes = activeRoundFixtures.filter(
          (f) => f.status === "LIVE",
        );
        if (liveFixes.length > 0) {
          setTicks(liveFixes[0].elapsedTicks);
          setActiveTab("live");
        } else if (
          activeRoundFixtures.length > 0 &&
          activeRoundFixtures.every((f) => f.status === "FT")
        ) {
          setTicks(15);
          setActiveTab("live");
        } else {
          setTicks(0);
          setActiveTab("fixtures");
        }
      } catch (err) {
        console.error(
          "Failed to parse cached data for mode, resetting...",
          err,
        );
        handleResetAndGenerate();
      }
    } else {
      handleResetAndGenerate();
    }
  }, [gameMode]);

  // Sync selectedFixtureId automatically to ensure we have a valid focus matchup for the round
  useEffect(() => {
    if (userProfile && fixtures.length > 0) {
      const activeRoundIdx = userProfile.currentRoundIndex;
      const activeRoundFixtures = fixtures.filter(
        (f) => f.roundIndex === activeRoundIdx,
      );
      if (activeRoundFixtures.length > 0) {
        const isFocusValid = activeRoundFixtures.some(
          (f) => f.id === selectedFixtureId,
        );
        if (!isFocusValid) {
          // Default to first scheduled or alive fixture
          const firstNotFt =
            activeRoundFixtures.find((f) => f.status !== "FT") ||
            activeRoundFixtures[0];
          setSelectedFixtureId(firstNotFt.id);
        }
      }
    }
  }, [userProfile?.currentRoundIndex, fixtures, selectedFixtureId]);

  // 2. Wipe and Reset current Mode Championship Seeder
  const handleResetAndGenerate = (keepRecords: boolean = false) => {
    if (!gameMode) return;
    const { teams: newTeams, fixtures: newFixtures } =
      gameMode === "TOURNAMENT"
        ? initializeNewTournament()
        : initializeNewLeague();

    const initialProfile: Profile = {
      username: userProfile?.username || "Tobi",
      balance: keepRecords ? (userProfile?.balance ?? 1000.0) : 1000.0,
      netProfit: keepRecords ? (userProfile?.netProfit ?? 0.0) : 0.0,
      tickets: keepRecords ? (userProfile?.tickets ?? []) : [],
      currentRoundIndex: 0,
      createdTime: keepRecords
        ? (userProfile?.createdTime ?? Date.now())
        : Date.now(),
    };

    const initialTipstersData = [...INITIAL_TIPSTERS];

    // Virtual tipsters place bets on first round
    const initialTipsterTickets = generateTipsterBetsForRound(
      initialTipstersData,
      newFixtures,
      newTeams,
    );

    // Save state
    persistStateToCache(
      initialProfile,
      newTeams,
      newFixtures,
      initialTipstersData,
      initialTipsterTickets,
    );

    // Update States
    setUserProfile(initialProfile);
    setTeams(newTeams);
    setFixtures(newFixtures);
    setTipsters(initialTipstersData);
    setTipsterTickets(initialTipsterTickets);
    setSelectedBets([]);
    setTicks(0);
    setIsSimulating(false);
    setShowWinnerCelebration(false);
    setActiveTab("fixtures");

    if (simTimerRef.current) {
      clearInterval(simTimerRef.current);
    }
  };

  // Kickoff brand new campaign from onboarding welcome screen
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
      netProfit: 0.0,
      tickets: [],
      currentRoundIndex: 0,
      createdTime: Date.now(),
    };

    const initialTipstersData = [...INITIAL_TIPSTERS];
    const initialTipsterTickets = generateTipsterBetsForRound(
      initialTipstersData,
      newFixtures,
      newTeams,
    );

    // Dynamic keys writing
    const keys = getKeysForMode(mode, slot);
    localStorage.setItem(keys.profile, JSON.stringify(initialProfile));
    localStorage.setItem(keys.teams, JSON.stringify(newTeams));
    localStorage.setItem(keys.fixtures, JSON.stringify(newFixtures));
    localStorage.setItem(keys.tipsters, JSON.stringify(initialTipstersData));
    localStorage.setItem(
      keys.tipsterTickets,
      JSON.stringify(initialTipsterTickets),
    );
    localStorage.setItem("fs_selected_game_mode", mode);

    // Set state triggering layout load
    setGameMode(mode);
    setUserProfile(initialProfile);
    setTeams(newTeams);
    setFixtures(newFixtures);
    setTipsters(initialTipstersData);
    setTipsterTickets(initialTipsterTickets);
    setSelectedBets([]);
    setTicks(0);
    setIsSimulating(false);
    setShowWinnerCelebration(false);
    setActiveTab("fixtures");

    if (simTimerRef.current) {
      clearInterval(simTimerRef.current);
    }
  };

  // Exit back to onboard main menu
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

  // Safe manual state persistence helper
  const persistStateToCache = (
    updatedProfile: Profile,
    updatedTeams: Team[],
    updatedFixtures: Fixture[],
    updatedTipsters: Tipster[],
    updatedTipsterTickets: { [id: string]: BetTicket },
  ) => {
    if (!gameMode) return;
    const keys = getKeysForMode(gameMode, activeSlot);
    localStorage.setItem(keys.profile, JSON.stringify(updatedProfile));
    localStorage.setItem(keys.teams, JSON.stringify(updatedTeams));
    localStorage.setItem(keys.fixtures, JSON.stringify(updatedFixtures));
    localStorage.setItem(keys.tipsters, JSON.stringify(updatedTipsters));
    localStorage.setItem(
      keys.tipsterTickets,
      JSON.stringify(updatedTipsterTickets),
    );
  };

  // ROBUST FUNCTIONAL STATE UPDATE FOR CASINO INTERACTIONS
  const handleUpdateBalanceCasino = (
    update: number | ((prev: number) => number),
  ) => {
    if (!userProfile) return;
    setUserProfile((prev) => {
      if (!prev) return prev;
      let nextBalance =
        typeof update === "function" ? update(prev.balance) : update;
      nextBalance = Math.max(0, nextBalance); // Prevent negative balance
      const updated = {
        ...prev,
        balance: Math.round(nextBalance * 100) / 100,
        netProfit:
          Math.round((prev.netProfit + (nextBalance - prev.balance)) * 100) /
          100,
      };
      if (gameMode) {
        localStorage.setItem(
          getKeysForMode(gameMode, activeSlot).profile,
          JSON.stringify(updated),
        );
      }
      return updated;
    });
  };

  // Track Bankroll History automatically for Analytics
  useEffect(() => {
    if (userProfile) {
      const history = userProfile.bankrollHistory || [];
      const currentBal = userProfile.balance;
      const lastBal = history.length > 0 ? history[history.length - 1].balance : null;

      // Only push new history point if changed
      if (lastBal === null || Math.abs(currentBal - lastBal) > 0.01) {
        setUserProfile((prev) => {
           if (!prev) return prev;
           return {
             ...prev,
             bankrollHistory: [...(prev.bankrollHistory || []), { timestamp: Date.now(), balance: prev.balance, detail: "Update" }]
           };
        });
      }
    }
  }, [userProfile?.balance]);

  // 3. Increment Simulation Tickers (Exclusive Watched Match Focus)
  const handleStartSimulation = (speedMs: number, watchedId: string) => {
    if (!userProfile) return;
    setIsSimulating(true);
    setActiveTab("live");

    const watchedFixCheck = fixtures.find((f) => f.id === watchedId);
    if (watchedFixCheck && watchedFixCheck.elapsedTicks === 7) {
      sessionStorage.setItem(`ht_resume_${watchedId}`, "true"); // User clicked resume
    }

    if (simTimerRef.current) clearInterval(simTimerRef.current);

    simTimerRef.current = setInterval(() => {
      setFixtures((prevFixtures) => {
        const teamMap = new Map<string, Team>(teams.map((t) => [t.id, t]));

        // Find watched match
        const watchedFix = prevFixtures.find((f) => f.id === watchedId);
        if (!watchedFix || watchedFix.status === "FT") {
          setIsSimulating(false);
          if (simTimerRef.current) clearInterval(simTimerRef.current);
          return prevFixtures;
        }

        // --- HALF TIME PAUSE LOGIC ---
        // If we are exactly at tick 7 (Minute 45, Half Time event logged) 
        // and we haven't explicitly instructed to resume...
        const htResumeKey = `ht_resume_${watchedId}`;
        if (watchedFix.elapsedTicks === 7 && sessionStorage.getItem(htResumeKey) !== "true") {
           setIsSimulating(false);
           if (simTimerRef.current) clearInterval(simTimerRef.current);
           // Dispatch event for UI to know half time has struck and show dashboard
           window.dispatchEvent(new CustomEvent('halftime-pause', { detail: { matchId: watchedId }}));
           return prevFixtures;
        }

        const nextTick = watchedFix.elapsedTicks + 1;
        if (nextTick > 20) {
          setIsSimulating(false);
          if (simTimerRef.current) clearInterval(simTimerRef.current);
          return prevFixtures;
        }

        let isNowFT = false;
        const updatedFixturesList = prevFixtures.map((f) => {
          if (
            f.id === watchedId &&
            (f.status === "SCHEDULED" || f.status === "LIVE")
          ) {
            const hTeam = teamMap.get(f.homeTeamId)!;
            const aTeam = teamMap.get(f.awayTeamId)!;
            const simmed = simulateMatchTick(f, hTeam, aTeam, nextTick);
            if (simmed.status === "FT") {
              isNowFT = true;
            }
            return simmed;
          }
          return f;
        });

        if (gameMode)
          localStorage.setItem(
            getKeysForMode(gameMode, activeSlot).fixtures,
            JSON.stringify(updatedFixturesList),
          );

        // When match ticks finish or status turns FT, stop simulation
        if (isNowFT) {
          setIsSimulating(false);
          if (simTimerRef.current) clearInterval(simTimerRef.current);
          setTicks(nextTick);
        } else {
          setTicks(nextTick);
        }

        return updatedFixturesList;
      });
    }, speedMs);
  };

  const handlePauseSimulation = () => {
    setIsSimulating(false);
    if (simTimerRef.current) clearInterval(simTimerRef.current);
  };

  // Simulate tick manually (+6 minutes trigger) for the watched match
  const handleSimulateTick = (watchedId: string) => {
    if (!userProfile || isSimulating) return;

    setFixtures((prevFixtures) => {
      const watchedFix = prevFixtures.find((f) => f.id === watchedId);
      if (!watchedFix || watchedFix.status === "FT") return prevFixtures;

      if (watchedFix.elapsedTicks === 7) {
        sessionStorage.setItem(`ht_resume_${watchedId}`, "true"); // User clicked resume
      }

      const nextTick = watchedFix.elapsedTicks + 1;
      if (nextTick > 20) return prevFixtures;

      const teamMap = new Map<string, Team>(teams.map((t) => [t.id, t]));
      const updatedFixturesList = prevFixtures.map((f) => {
        if (
          f.id === watchedId &&
          (f.status === "SCHEDULED" || f.status === "LIVE")
        ) {
          const hTeam = teamMap.get(f.homeTeamId)!;
          const aTeam = teamMap.get(f.awayTeamId)!;
          const simmed = simulateMatchTick(f, hTeam, aTeam, nextTick);
          return simmed;
        }
        return f;
      });

      if (gameMode) {
        localStorage.setItem(
          getKeysForMode(gameMode, activeSlot).fixtures,
          JSON.stringify(updatedFixturesList),
        );
      }
      setTicks(nextTick);
      return updatedFixturesList;
    });
  };

  // Instantly simulate all OTHER matches in the current round except the watched one
  const handleSimulateRemainingInstant = (watchedId: string) => {
    if (!userProfile || isSimulating) return;

    setFixtures((prevFixtures) => {
      const teamMap = new Map<string, Team>(teams.map((t) => [t.id, t]));
      const updatedFixturesList = prevFixtures.map((f) => {
        if (
          f.roundIndex === userProfile.currentRoundIndex &&
          f.id !== watchedId &&
          f.status !== "FT"
        ) {
          const hTeam = teamMap.get(f.homeTeamId)!;
          const aTeam = teamMap.get(f.awayTeamId)!;
          // Run instant full simulation
          const simmed = simulateFullMatchInstantly(f, hTeam, aTeam);
          simmed.status = "FT";
          simmed.currentMinute = 90;
          return simmed;
        }
        return f;
      });

      if (gameMode) {
        localStorage.setItem(
          getKeysForMode(gameMode, activeSlot).fixtures,
          JSON.stringify(updatedFixturesList),
        );
      }
      return updatedFixturesList;
    });
  };

  // Instantly simulate ALL matches of the current round (Full skip)
  const handleSimulateInstant = () => {
    if (!userProfile || isSimulating) return;

    setFixtures((prevFixtures) => {
      const teamMap = new Map<string, Team>(teams.map((t) => [t.id, t]));
      const updatedFixturesList = prevFixtures.map((f) => {
        if (
          f.roundIndex === userProfile.currentRoundIndex &&
          f.status !== "FT"
        ) {
          const hTeam = teamMap.get(f.homeTeamId)!;
          const aTeam = teamMap.get(f.awayTeamId)!;
          const simmed = simulateFullMatchInstantly(f, hTeam, aTeam);
          simmed.status = "FT";
          simmed.currentMinute = 90;
          return simmed;
        }
        return f;
      });

      if (gameMode) {
        localStorage.setItem(
          getKeysForMode(gameMode, activeSlot).fixtures,
          JSON.stringify(updatedFixturesList),
        );
      }
      setTicks(15);
      return updatedFixturesList;
    });
  };

  // 4. Settle Round and Generate Next Pairing Stage
  const handleAdvanceRound = () => {
    if (!userProfile || isSimulating) return;

    const currentRoundIndex = userProfile.currentRoundIndex;
    const roundFixturesList = fixtures.filter(
      (f) => f.roundIndex === currentRoundIndex,
    );
    const completedFixtures = roundFixturesList.filter(
      (f) => f.status === "FT",
    );

    if (
      roundFixturesList.length > 0 &&
      completedFixtures.length !== roundFixturesList.length
    ) {
      alert(
        "Please simulate or complete all matches in the current round before advancing!",
      );
      return;
    }

    if (completedFixtures.length === 0) return;

    // 1. Evaluate User Pending Tickets
    let totalWinPayoutSum = 0;
    const finalTickets = userProfile.tickets.map((ticket) => {
      if (ticket.status !== "PENDING") return ticket;

      let wonAll = true;
      ticket.selections.forEach((sel) => {
        const match = completedFixtures.find((f) => f.id === sel.fixtureId);
        if (!match) {
          wonAll = false;
          return;
        }

        const hScore = Math.floor(match.homeScore);
        const aScore = Math.floor(match.awayScore);

        if (sel.marketType === "MATCH_WINNER") {
          let outcome = "DRAW";
          if (hScore > aScore) outcome = "HOME";
          if (aScore > hScore) outcome = "AWAY";

          if (sel.selectionId !== outcome) wonAll = false;
        } else if (sel.marketType === "DOUBLE_CHANCE") {
          let outcome = "DRAW";
          if (hScore > aScore) outcome = "HOME";
          if (aScore > hScore) outcome = "AWAY";

          if (sel.selectionId === "HOME_OR_DRAW" && outcome === "AWAY") wonAll = false;
          if (sel.selectionId === "HOME_OR_AWAY" && outcome === "DRAW") wonAll = false;
          if (sel.selectionId === "DRAW_OR_AWAY" && outcome === "HOME") wonAll = false;
        } else if (sel.marketType === "BOTH_TEAMS_TO_SCORE") {
          const bothScored = hScore > 0 && aScore > 0;
          if (sel.selectionId === "YES" && !bothScored) wonAll = false;
          if (sel.selectionId === "NO" && bothScored) wonAll = false;
        } else if (sel.marketType === "OVER_UNDER_GOALS") {
          const totalGoals = hScore + aScore;
          const [mode, lineStr] = sel.selectionId.split("_"); // e.g. "OVER", "2_5"
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
          const totalCards = (match.stats?.home.yellowCards || 0) + (match.stats?.home.redCards || 0) + (match.stats?.away.yellowCards || 0) + (match.stats?.away.redCards || 0);
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
          const outcomeScore = `${hScore}-${aScore}`;
          if (sel.selectionId !== outcomeScore) wonAll = false;
        } else if (sel.marketType === "ANYTIME_GOALSCORER") {
          const playersScored = match.events.some(
            (ev) => ev.type === "GOAL" && ev.playerId === sel.selectionId,
          );
          if (!playersScored) wonAll = false;
        }
      });

      const updatedStatus = wonAll ? ("WON" as const) : ("LOST" as const);
      if (wonAll) {
        totalWinPayoutSum += ticket.potentialPayout;
      }

      return {
        ...ticket,
        status: updatedStatus,
      };
    });

    // 2. Settle Tipster payouts
    const updatedTipsters = resolveTipsterRound(
      tipsters,
      tipsterTickets,
      completedFixtures,
    );

    // 3. Accumulate player rosters parameters
    let updatedTeamsList = [...teams];
    completedFixtures.forEach((fix) => {
      updatedTeamsList = updateRostersAndStatsAfterFixture(
        updatedTeamsList,
        fix,
      );
    });

    // Check if Campaign is finished
    const isLeagueCompleted = gameMode === "LEAGUE" && currentRoundIndex === 14;
    const isFinalFinished =
      (gameMode === "TOURNAMENT" && currentRoundIndex === 4) ||
      isLeagueCompleted;

    let nextRoundIdx = currentRoundIndex;
    let nextFixturesList = [...fixtures];
    let nextTipsterTickets: typeof tipsterTickets = {};

    if (!isFinalFinished) {
      nextRoundIdx = currentRoundIndex + 1;

      if (gameMode === "TOURNAMENT") {
        // 4. Generate next round fixture brackets
        const newFixtures = generateNextRoundFixtures(
          fixtures,
          updatedTeamsList,
          nextRoundIdx,
        );
        nextFixturesList = [...fixtures, ...newFixtures];
      } else {
        // In league mode, all fixtures for all 15 rounds are already generated!
        nextFixturesList = [...fixtures];
      }

      // Reset tickets for virtual tipsters ready for next matchups
      nextTipsterTickets = generateTipsterBetsForRound(
        updatedTipsters,
        nextFixturesList,
        updatedTeamsList,
      );
    } else if (gameMode === "LEAGUE") {
      // League season finished — apply relegation/promotion then start a new season
      setShowWinnerCelebration(true);
      const allTeamsWithNewDivisions = applyRelegationPromotion(
        [...teams, ...updatedTeamsList.filter(ut => !teams.find(t => t.id === ut.id))],
        completedFixtures,
      );
      // Merge updated stats back into division-updated pool
      const mergedAll = allTeamsWithNewDivisions.map(t => {
        const updated = updatedTeamsList.find(u => u.id === t.id);
        return updated ? { ...t, division: t.division } : t;
      });
      const { teams: newSeasonTeams, fixtures: newSeasonFixtures } = initializeNewLeagueSeason(mergedAll);
      nextRoundIdx = 0;
      updatedTeamsList = newSeasonTeams;
      nextFixturesList = newSeasonFixtures;
      nextTipsterTickets = generateTipsterBetsForRound(updatedTipsters, newSeasonFixtures, newSeasonTeams);
    } else {
      // Tournament final — show winner screen
      setShowWinnerCelebration(true);
    }

    // Club ownership passive income
    let ownershipRevenue = 0;
    let ownershipRevenueDetail: { fixtureId: string; baseIncome: number; bonus: number; result: "WIN" | "DRAW" | "LOSS"; scoreline: string }[] = [];
    if (userProfile.ownedTeamId) {
      const ownedTeam = updatedTeamsList.find(t => t.id === userProfile.ownedTeamId);
      if (ownedTeam?.ownership) {
        const baseIncome = ownedTeam.ownership.passiveIncomePerMatch;
        completedFixtures.forEach(fix => {
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
          const earned = baseIncome + bonus;
          ownershipRevenue += earned;
          ownershipRevenueDetail.push({ fixtureId: fix.id, baseIncome, bonus, result, scoreline: isHome ? `${hScore}-${aScore}` : `${aScore}-${hScore}` });
        });
      }
    }

    const nextBalance =
      Math.round((userProfile.balance + totalWinPayoutSum + ownershipRevenue) * 100) / 100;

    // Recalculate User Net profit
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
      currentRoundIndex: nextRoundIdx,
    };

    // Save everything
    persistStateToCache(
      nextProfile,
      updatedTeamsList,
      nextFixturesList,
      updatedTipsters,
      nextTipsterTickets,
    );

    // Update States
    setUserProfile(nextProfile);
      // Trigger ownership revenue modal
      if (ownershipRevenue > 0 && ownershipRevenueDetail.length > 0 && userProfile.ownedTeamId) {
        const ownedTeam = updatedTeamsList.find(t => t.id === userProfile.ownedTeamId);
        setOwnerRevenueReport({ revenue: ownershipRevenue, fixtures: ownershipRevenueDetail, teamName: ownedTeam?.name || "Your Club" });
      }
    setTeams(updatedTeamsList);
    setFixtures(nextFixturesList);
    setTipsters(updatedTipsters);
    setTipsterTickets(nextTipsterTickets);

    // Clear local lists
    setSelectedBets([]);
    setTicks(0);

    // Transition view tabs
    if (!isFinalFinished) {
      setActiveTab("fixtures");
    } else {
      setActiveTab("live");
    }
  };

  // 5. Place Bets Selections
  const handlePlaceBet = (
    type: "SINGLE" | "ACCUMULATOR",
    totalStake: number,
    selectionStakes?: { [secId: string]: number },
  ) => {
    if (!userProfile) return;

    if (userProfile.balance < totalStake) {
      alert("Insufficient wallet balance!");
      return;
    }

    const totalOdds =
      Math.round(selectedBets.reduce((acc, b) => acc * b.odds, 1) * 100) / 100;

    const newTicket: BetTicket = {
      id: `ticket-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type,
      selections: [...selectedBets],
      totalOdds: type === "SINGLE" ? 1 : totalOdds, // Accumulator uses combined, Single shows by odds item sum
      stake: totalStake,
      potentialPayout:
        type === "SINGLE"
          ? Math.round(
              selectedBets.reduce((sum, b) => {
                const key = `${b.fixtureId}-${b.marketType}-${b.selectionId}`;
                const st = selectionStakes?.[key] || 0;
                return sum + st * b.odds;
              }, 0) * 100,
            ) / 100
          : Math.round(totalStake * totalOdds * 100) / 100,
      status: "PENDING",
      timestamp: Date.now(),
      selectionStakes: selectionStakes,
    };

    const nextBalance =
      Math.round((userProfile.balance - totalStake) * 100) / 100;

    const nextProfile: Profile = {
      ...userProfile,
      balance: nextBalance,
      tickets: [...userProfile.tickets, newTicket],
    };

    // Persist to local & cache
    setUserProfile(nextProfile);
    setSelectedBets([]); // wipe slip

    persistStateToCache(nextProfile, teams, fixtures, tipsters, tipsterTickets);
  };

  const handleCashOut = (ticketId: string, offerAmount: number) => {
    if (!userProfile) return;
    
    const nextTickets = userProfile.tickets.map(t => {
       if (t.id === ticketId && t.status === "PENDING") {
           return { ...t, status: "CASHED_OUT" as const, cashedOutAmount: offerAmount };
       }
       return t;
    });

    const nextBalance = Math.round((userProfile.balance + offerAmount) * 100) / 100;

    const nextProfile: Profile = {
       ...userProfile,
       balance: nextBalance,
       tickets: nextTickets
    };

    setUserProfile(nextProfile);
    persistStateToCache(nextProfile, teams, fixtures, tipsters, tipsterTickets);
  };

  const handlePurchaseVIPItem = (itemDetails: any) => {
    if (!userProfile) return;
    if (userProfile.balance < itemDetails.price) return;
    const newItem = {
      ...itemDetails,
      dateStr: new Date().toLocaleDateString(),
      id: Math.random().toString(36).substring(7)
    };

    // Special handling: Football Club purchases grant ownership of a real team
    let nextTeams = teams;
    if (itemDetails.category === "Football Clubs" && itemDetails.teamId) {
      const targetTeam = teams.find(t => t.id === itemDetails.teamId);
      if (targetTeam && !targetTeam.ownership) {
        const defaultStarters = targetTeam.players.slice(0, 11).map(p => p.id);
        nextTeams = teams.map(t => t.id === itemDetails.teamId ? {
          ...t,
          ownership: {
            clubId: t.id,
            purchasedAt: Date.now(),
            purchasePrice: itemDetails.price,
            trainingFacilityLevel: 1,
            stadiumLevel: 1,
            totalInvested: itemDetails.price,
            passiveIncomePerMatch: 50000,
            formation: "4-4-2" as const,
            mentality: "Balanced" as const,
            pressingStyle: "Mid Block" as const,
            starterIds: defaultStarters,
            matchesManaged: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            totalGoalsFor: 0,
            totalGoalsAgainst: 0,
          }
        } : t);
        setTeams(nextTeams);
      }
    }

    const nextProfile: Profile = {
       ...userProfile,
       balance: userProfile.balance - itemDetails.price,
       purchasedItems: [...(userProfile.purchasedItems || []), newItem],
       ownedTeamId: itemDetails.category === "Football Clubs" && itemDetails.teamId
         ? itemDetails.teamId
         : userProfile.ownedTeamId,
    };
    setUserProfile(nextProfile);
    persistStateToCache(nextProfile, nextTeams, fixtures, tipsters, tipsterTickets);
  };

  const handleUpdateClubOwnership = (teamId: string, updates: Partial<import("./types").ClubOwnership>) => {
    const nextTeams = teams.map(t => t.id === teamId && t.ownership
      ? { ...t, ownership: { ...t.ownership, ...updates } }
      : t
    );
    setTeams(nextTeams);
    if (userProfile) persistStateToCache(userProfile, nextTeams, fixtures, tipsters, tipsterTickets);
  };

  const handleUpgradeFacility = (teamId: string, type: "training" | "stadium") => {
    if (!userProfile) return;
    const team = teams.find(t => t.id === teamId);
    if (!team?.ownership) return;
    const lvl = type === "training" ? team.ownership.trainingFacilityLevel : team.ownership.stadiumLevel;
    const cost = type === "training" ? lvl * 2000000 : lvl * 5000000;
    if (userProfile.balance < cost) return;
    const newIncome = type === "stadium"
      ? (lvl + 1) * 50000
      : team.ownership.passiveIncomePerMatch;
    const nextTeams = teams.map(t => t.id === teamId && t.ownership ? {
      ...t,
      ownership: {
        ...t.ownership,
        trainingFacilityLevel: type === "training" ? lvl + 1 : t.ownership.trainingFacilityLevel,
        stadiumLevel: type === "stadium" ? lvl + 1 : t.ownership.stadiumLevel,
        totalInvested: t.ownership.totalInvested + cost,
        passiveIncomePerMatch: newIncome,
      }
    } : t);
    const nextProfile: Profile = { ...userProfile, balance: userProfile.balance - cost };
    setTeams(nextTeams);
    setUserProfile(nextProfile);
    persistStateToCache(nextProfile, nextTeams, fixtures, tipsters, tipsterTickets);
  };

  const handleLiquidateVIPItem = (item: any) => {
    if (!userProfile) return;
    const items = userProfile.purchasedItems || [];
    const nextProfile: Profile = {
       ...userProfile,
       balance: userProfile.balance + item.worth,
       purchasedItems: items.filter(i => i.id !== item.id)
    };
    setUserProfile(nextProfile);
    persistStateToCache(nextProfile, teams, fixtures, tipsters, tipsterTickets);
  };

  // Add a prediction to the slip matching exclusivity constraints as specified!
  const handleAddBetSelection = (newSel: BetSelection) => {
    setCollapsedSlip(false);
    setSelectedBets((prev) => {
      let filtered = prev;

      const outcomeMarkets = ["MATCH_WINNER", "DOUBLE_CHANCE", "EXACT_SCORE"];

      if (newSel.marketType === "ANYTIME_GOALSCORER") {
        filtered = prev.filter(
          (sel) =>
            !(
              sel.fixtureId === newSel.fixtureId &&
              sel.marketType === "ANYTIME_GOALSCORER" &&
              sel.selectionId === newSel.selectionId
            ),
        );
      } else if (outcomeMarkets.includes(newSel.marketType)) {
        // Enforce mutual exclusivity among Outcome-based markets (1X2, Double Chance, Exact score)
        filtered = prev.filter(
          (sel) => !(sel.fixtureId === newSel.fixtureId && outcomeMarkets.includes(sel.marketType))
        );
      } else {
        // OVER_UNDER_GOALS, OVER_UNDER_CORNERS, BOTH_TEAMS_TO_SCORE etc...
        filtered = prev.filter(
          (sel) =>
            !(
              sel.fixtureId === newSel.fixtureId &&
              sel.marketType === newSel.marketType
            ),
        );
      }

      return [...filtered, newSel];
    });
  };

  const handleAddMultipleSelections = (newSels: BetSelection[]) => {
    setCollapsedSlip(false);
    setSelectedBets((prev) => {
      let current = [...prev];
      const outcomeMarkets = ["MATCH_WINNER", "DOUBLE_CHANCE", "EXACT_SCORE"];
      
      newSels.forEach((newSel) => {
        if (newSel.marketType === "ANYTIME_GOALSCORER") {
          current = current.filter(
            (sel) =>
              !(
                sel.fixtureId === newSel.fixtureId &&
                sel.marketType === "ANYTIME_GOALSCORER" &&
                sel.selectionId === newSel.selectionId
              ),
          );
        } else if (outcomeMarkets.includes(newSel.marketType)) {
          current = current.filter(
            (sel) => !(sel.fixtureId === newSel.fixtureId && outcomeMarkets.includes(sel.marketType))
          );
        } else {
          current = current.filter(
            (sel) =>
              !(
                sel.fixtureId === newSel.fixtureId &&
                sel.marketType === newSel.marketType
              ),
          );
        }
        current.push(newSel);
      });
      return current;
    });
  };

  const handleRemoveSelection = (
    fixtureId: string,
    marketType: MarketType,
    selectionId: string,
  ) => {
    setSelectedBets((prev) =>
      prev.filter(
        (sel) =>
          !(
            sel.fixtureId === fixtureId &&
            sel.marketType === marketType &&
            sel.selectionId === selectionId
          ),
      ),
    );
  };

  const handleClearAllSelections = () => {
    setSelectedBets([]);
  };

  // Manual Faucet funds loader modal display
  const handleAddFunds = () => {
    setShowWalletModal(true);
  };

  // ROBUST FUNCTIONAL STATE UPDATE FOR WALLET INTERACTIONS (PREVENTS RACING CONFLICTS WITH CASINO)
  const handleConfirmWalletTransaction = (
    amount: number,
    action: "DEPOSIT" | "WITHDRAW",
  ): boolean => {
    if (!userProfile) return false;

    let hasSufficientFunds = true;

    setUserProfile((prev) => {
      if (!prev) return prev;

      if (action === "WITHDRAW" && prev.balance < amount) {
        hasSufficientFunds = false;
        return prev;
      }

      const multiplier = action === "DEPOSIT" ? 1 : -1;
      const nextBalance =
        Math.round((prev.balance + amount * multiplier) * 100) / 100;
      const nextProfile = {
        ...prev,
        balance: nextBalance,
      };
      if (gameMode) {
        localStorage.setItem(
          getKeysForMode(gameMode, activeSlot).profile,
          JSON.stringify(nextProfile),
        );
      }
      return nextProfile;
    });

    if (!hasSufficientFunds) {
      alert("Insufficient wallet balance for withdrawal!");
      return false;
    }

    return true;
  };

  // Find Trophy Champion ID (last match R4 winner)
  const getChampionshipWinnerTeamName = (): { name: string; crest: Team } => {
    if (gameMode === "LEAGUE") {
      const sortedTeams = [...teams].sort((a, b) => {
        const aPoints = a.wonMatches * 3 + a.drawnMatches;
        const bPoints = b.wonMatches * 3 + b.drawnMatches;
        if (bPoints !== aPoints) return bPoints - aPoints;

        const aDiff = a.goalsScored - a.goalsConceded;
        const bDiff = b.goalsScored - b.goalsConceded;
        if (bDiff !== aDiff) return bDiff - aDiff;

        return b.goalsScored - a.goalsScored;
      });
      return { name: sortedTeams[0].name, crest: sortedTeams[0] };
    } else {
      const finalFix =
        fixtures.find((f) => f.roundIndex === 3) ||
        fixtures.find((f) => f.roundIndex === 4);
      if (!finalFix) return { name: "Champion", crest: teams[0] };
      const winnerId =
        finalFix.homeScore > finalFix.awayScore
          ? finalFix.homeTeamId
          : finalFix.awayTeamId;
      const championClub = teams.find((t) => t.id === winnerId) || teams[0];
      return { name: championClub.name, crest: championClub };
    }
  };

  const currentRoundLabel =
    gameMode === "LEAGUE"
      ? `Matchday ${(userProfile?.currentRoundIndex ?? 0) + 1}`
      : ROUND_LABELS[userProfile?.currentRoundIndex || 0] ||
        "Session Concluded";

  const handleNavigateToTeams = () => {
    setGlobalEntity(null);
    setActiveTab("teams");
  };

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
      // Migrate legacy slot-independent save files if target slot 1 is empty
      const keys = getKeysForMode(mode, slot);
      if (slot === 1 && localStorage.getItem(keys.profile) === null) {
        const m = mode.toLowerCase();
        const oldProfile = localStorage.getItem(`fs_profile_v3_${m}`);
        const oldTeams = localStorage.getItem(`fs_teams_v3_${m}`);
        const oldFixtures = localStorage.getItem(`fs_fixtures_v3_${m}`);
        const oldTipsters = localStorage.getItem(`fs_tipsters_v3_${m}`);
        const oldTickets = localStorage.getItem(`fs_tipster_tickets_v3_${m}`);

        if (oldProfile) localStorage.setItem(keys.profile, oldProfile);
        if (oldTeams) localStorage.setItem(keys.teams, oldTeams);
        if (oldFixtures) localStorage.setItem(keys.fixtures, oldFixtures);
        if (oldTipsters) localStorage.setItem(keys.tipsters, oldTipsters);
        if (oldTickets) localStorage.setItem(keys.tipsterTickets, oldTickets);

        // Clean old unslotted values
        localStorage.removeItem(`fs_profile_v3_${m}`);
        localStorage.removeItem(`fs_teams_v3_${m}`);
        localStorage.removeItem(`fs_fixtures_v3_${m}`);
        localStorage.removeItem(`fs_tipsters_v3_${m}`);
        localStorage.removeItem(`fs_tipster_tickets_v3_${m}`);
      }

      setActiveSlot(slot);
      localStorage.setItem("fs_selected_game_slot", String(slot));
      setGameMode(mode);
    };

    const handleDeleteSave = (mode: "TOURNAMENT" | "LEAGUE", slot: number) => {
      const keys = getKeysForMode(mode, slot);
      localStorage.removeItem(keys.profile);
      localStorage.removeItem(keys.teams);
      localStorage.removeItem(keys.fixtures);
      localStorage.removeItem(keys.tipsters);
      localStorage.removeItem(keys.tipsterTickets);

      // Clean up legacy keys if slot 1
      if (slot === 1) {
        const m = mode.toLowerCase();
        localStorage.removeItem(`fs_profile_v3_${m}`);
        localStorage.removeItem(`fs_teams_v3_${m}`);
        localStorage.removeItem(`fs_fixtures_v3_${m}`);
        localStorage.removeItem(`fs_tipsters_v3_${m}`);
        localStorage.removeItem(`fs_tipster_tickets_v3_${m}`);
      }
      setDummyUpdateSlot((prev) => prev + 1);
    };

    return (
      <WelcomeScreen
        onKickoff={handleStartNewCampaign}
        savedTournaments={savedTournaments}
        savedLeagues={savedLeagues}
        resumeActiveMode={handleResumeCampaign}
        onDeleteSave={handleDeleteSave}
      />
    );
  }

  return (
    <div
      id="app"
      className="h-screen w-screen bg-gradient-to-br from-[#0b0e14] via-[#05070a] to-[#121620] text-slate-100 flex flex-col overflow-hidden font-sans animate-fade-in"
    >
      {/* Top Navigation Frame bar */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        username={userProfile?.username || "Tobi"}
        balance={userProfile?.balance || 0}
        addFunds={handleAddFunds}
        resetTournament={handleResetAndGenerate}
        currentRoundLabel={currentRoundLabel}
        gameMode={gameMode}
        exitToMenu={exitToMenu}
        hasOwnedClub={!!userProfile?.ownedTeamId}
      />

      {/* Main Workspace Frame container splits */}
      <div
        id="workspace-split"
        className="flex flex-1 min-h-0 overflow-hidden relative"
      >
        {/* Tab Viewport Screen sheets (Width 75%) */}
        <main className="flex-1 min-h-0 flex flex-col overflow-hidden bg-transparent">
          {activeTab === "live" && userProfile && (
            <LiveMatches
              fixtures={fixtures}
              teams={teams}
              roundIndex={userProfile.currentRoundIndex}
              currentRoundLabel={currentRoundLabel}
              isSimulating={isSimulating}
              onStartSimulation={handleStartSimulation}
              onPauseSimulation={handlePauseSimulation}
              onSimulateTick={handleSimulateTick}
              onSimulateInstant={handleSimulateInstant}
              onSimulateRemainingInstant={handleSimulateRemainingInstant}
              onAdvanceRound={handleAdvanceRound}
              ticks={ticks}
              selectedFixtureId={selectedFixtureId}
              setSelectedFixtureId={setSelectedFixtureId}
              selectedBets={selectedBets}
              onAddBetSelection={handleAddBetSelection}
              onRemoveSelection={handleRemoveSelection}
              ownedTeamId={userProfile.ownedTeamId}
            />
          )}

          {activeTab === "fixtures" && userProfile && (
            <FixturesOdds
              fixtures={fixtures}
              teams={teams}
              roundIndex={userProfile.currentRoundIndex}
              currentRoundLabel={currentRoundLabel}
              selectedBets={selectedBets}
              onAddBetSelection={handleAddBetSelection}
              onRemoveSelection={handleRemoveSelection}
            />
          )}

          {activeTab === "bets" && userProfile && (
            <MyBets
              tickets={userProfile.tickets}
              fixtures={fixtures}
              teams={teams}
              balance={userProfile.balance}
              onCashOut={handleCashOut}
            />
          )}

          {activeTab === "teams" && (
            <TeamsList teams={teams} fixtures={fixtures} />
          )}

          {activeTab === "analytics" && userProfile && (
            <Analytics teams={teams} fixtures={fixtures} userProfile={userProfile} />
          )}

          {activeTab === "tournament" &&
            userProfile &&
            (gameMode === "LEAGUE" ? (
              <LeagueStandings
                teams={teams}
                fixtures={fixtures}
                currentRoundIndex={userProfile.currentRoundIndex}
              />
            ) : (
              <TournamentBracket fixtures={fixtures} teams={teams} />
                    ))}

          {activeTab === "leaderboard" && userProfile && (
            <Leaderboard
              tipsters={tipsters}
              userBalance={userProfile.balance}
              username={userProfile.username}
              tickets={userProfile.tickets}
            />
          )}

          {activeTab === "casino" && userProfile && (
            <CasinoSuite
              balance={userProfile.balance}
              onUpdateBalance={handleUpdateBalanceCasino}
              username={userProfile.username}
              currentRoundIndex={userProfile.currentRoundIndex}
            />
          )}

          {activeTab === "store" && userProfile && (
             <VIPStore
               balance={userProfile.balance}
               purchasedItems={userProfile.purchasedItems || []}
               onPurchase={handlePurchaseVIPItem}
               onLiquidate={handleLiquidateVIPItem}
               teams={teams}
               ownedTeamId={userProfile.ownedTeamId}
             />
          )}

          {activeTab === "myclub" && userProfile?.ownedTeamId && (
            <ClubManager
              ownedTeamId={userProfile.ownedTeamId}
              teams={teams}
              balance={userProfile.balance}
              onUpdateOwnership={handleUpdateClubOwnership}
              onUpgradeFacility={handleUpgradeFacility}
              onUpdateBalance={(delta: number) => {
                const nextProfile = { ...userProfile, balance: Math.max(0, userProfile.balance + delta) };
                setUserProfile(nextProfile);
                persistStateToCache(nextProfile, teams, fixtures, tipsters, tipsterTickets);
              }}
            />
          )}

          {activeTab === "feed" && userProfile && (
             <SocialFeed
               fixtures={fixtures}
               teams={teams}
               roundLabel={currentRoundLabel}
             />
          )}
        </main>

        {/* Collapsible right panel Betting Slip (Width 25%) */}
        {activeTab !== "casino" && activeTab !== "store" && activeTab !== "feed" && activeTab !== "myclub" && (
          <BettingSlip
            selections={selectedBets}
            fixtures={fixtures}
            teams={teams}
            onRemoveSelection={handleRemoveSelection}
            onClearAll={handleClearAllSelections}
            balance={userProfile?.balance || 0}
            onPlaceBet={handlePlaceBet}
            collapsed={collapsedSlip}
            setCollapsed={setCollapsedSlip}
            onAddSelections={handleAddMultipleSelections}
          />
        )}
      </div>

      {showWalletModal && userProfile && (
        <WalletModal
          balance={userProfile.balance}
          onConfirmTransaction={handleConfirmWalletTransaction}
          onClose={() => setShowWalletModal(false)}
        />
      )}

      {showWinnerCelebration && (
        <WinnerCelebrationModal
          winnerName={winnerName}
          onClose={() => setShowWinnerCelebration(false)}
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
          onNavigateToTeams={handleNavigateToTeams}
        />
      )}
    </div>
  );
}
