import { useState, useEffect, useRef } from "react";
import {
  Team,
  Fixture,
  BetSelection,
  BetTicket,
  Profile,
  Tipster,
  MarketType
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

import {
  initializeNewTournament,
  initializeNewLeague,
  generateNextRoundFixtures,
  updateRostersAndStatsAfterFixture,
  ROUND_LABELS
} from "./data/tournament";
import {
  INITIAL_TIPSTERS,
  generateTipsterBetsForRound,
  resolveTipsterRound
} from "./data/tipsters";
import {
  simulateMatchTick,
  simulateFullMatchInstantly
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
    tipsterTickets: `fs_tipster_tickets_v3_${m}${suffix}`
  };
};

export default function App() {
  // Save slots
  const [activeSlot, setActiveSlot] = useState<number>(() => {
    return parseInt(localStorage.getItem("fs_selected_game_slot") || "1");
  });
  const [dummyUpdateSlot, setDummyUpdateSlot] = useState<number>(0);

  // Game Mode
  const [gameMode, setGameMode] = useState<"TOURNAMENT" | "LEAGUE" | null>(() => {
    return localStorage.getItem("fs_selected_game_mode") as "TOURNAMENT" | "LEAGUE" | null;
  });

  // Navigation & UI States
  const [activeTab, setActiveTab] = useState<string>("fixtures");
  const [collapsedSlip, setCollapsedSlip] = useState<boolean>(false);
  const [showWinnerCelebration, setShowWinnerCelebration] = useState<boolean>(false);

  // Core Persistent States
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [tipsters, setTipsters] = useState<Tipster[]>([]);
  const [tipsterTickets, setTipsterTickets] = useState<{ [tipsterId: string]: BetTicket }>({});

  // Active Selections in Slip
  const [selectedBets, setSelectedBets] = useState<BetSelection[]>([]);

  // Simulation Running State & Ticks
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [ticks, setTicks] = useState<number>(0);
  const [selectedFixtureId, setSelectedFixtureId] = useState<string>("");

  // Custom states for Wallet Modal
  const [showWalletModal, setShowWalletModal] = useState<boolean>(false);
  const [walletAction, setWalletAction] = useState<"DEPOSIT" | "WITHDRAW">("DEPOSIT");
  const [walletValue, setWalletValue] = useState<string>("100");
  const [walletSuccessMsg, setWalletSuccessMsg] = useState<string>("");

  // Global Entity Hover/Tap Information Portal States
  const [globalEntity, setGlobalEntity] = useState<{ type: "team" | "player"; id: string } | null>(null);
  const [expandGlobalEntity, setExpandGlobalEntity] = useState<boolean>(false);
  const [globalPlayerTab, setGlobalPlayerTab] = useState<"stats" | "qualities">("stats");

  // Interval Ref for accurate cleanup
  const simTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Listen to the global entity select event and escape key press
  useEffect(() => {
    const handleOpenEntity = (e: Event) => {
      const customEvent = e as CustomEvent<{ type: "team" | "player"; id: string }>;
      if (customEvent.detail) {
        setGlobalEntity({ type: customEvent.detail.type, id: customEvent.detail.id });
        setExpandGlobalEntity(false); // Reset to short preview info card
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
        const parsedTickets = cachedTipsterTickets ? JSON.parse(cachedTipsterTickets) : {};

        setUserProfile(parsedProfile);
        setTeams(parsedTeams);
        setFixtures(parsedFixtures);
        setTipsters(parsedTipsters);
        setTipsterTickets(parsedTickets);

        // Resume running status check
        const activeRoundFixtures = parsedFixtures.filter(f => f.roundIndex === parsedProfile.currentRoundIndex);
        const liveFixes = activeRoundFixtures.filter(f => f.status === "LIVE");
        if (liveFixes.length > 0) {
          setTicks(liveFixes[0].elapsedTicks);
          setActiveTab("live");
        } else if (activeRoundFixtures.length > 0 && activeRoundFixtures.every(f => f.status === "FT")) {
          setTicks(15);
          setActiveTab("live");
        } else {
          setTicks(0);
          setActiveTab("fixtures");
        }
      } catch (err) {
        console.error("Failed to parse cached data for mode, resetting...", err);
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
      const activeRoundFixtures = fixtures.filter(f => f.roundIndex === activeRoundIdx);
      if (activeRoundFixtures.length > 0) {
        const isFocusValid = activeRoundFixtures.some(f => f.id === selectedFixtureId);
        if (!isFocusValid) {
          // Default to first scheduled or alive fixture
          const firstNotFt = activeRoundFixtures.find(f => f.status !== "FT") || activeRoundFixtures[0];
          setSelectedFixtureId(firstNotFt.id);
        }
      }
    }
  }, [userProfile?.currentRoundIndex, fixtures, selectedFixtureId]);

  // 2. Wipe and Reset current Mode Championship Seeder
  const handleResetAndGenerate = (keepRecords: boolean = false) => {
    if (!gameMode) return;
    const { teams: newTeams, fixtures: newFixtures } = gameMode === "TOURNAMENT"
      ? initializeNewTournament()
      : initializeNewLeague();
    
    const initialProfile: Profile = {
      username: userProfile?.username || "Tobi",
      balance: keepRecords ? (userProfile?.balance ?? 1000.0) : 1000.0,
      netProfit: keepRecords ? (userProfile?.netProfit ?? 0.0) : 0.0,
      tickets: keepRecords ? (userProfile?.tickets ?? []) : [],
      currentRoundIndex: 0,
      createdTime: keepRecords ? (userProfile?.createdTime ?? Date.now()) : Date.now()
    };

    const initialTipstersData = [...INITIAL_TIPSTERS];
    
    // Virtual tipsters place bets on first round
    const initialTipsterTickets = generateTipsterBetsForRound(initialTipstersData, newFixtures, newTeams);

    // Save state
    persistStateToCache(initialProfile, newTeams, newFixtures, initialTipstersData, initialTipsterTickets);

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
  const handleStartNewCampaign = (username: string, startingBalance: number, mode: "TOURNAMENT" | "LEAGUE", slot: number) => {
    setActiveSlot(slot);
    localStorage.setItem("fs_selected_game_slot", String(slot));

    const { teams: newTeams, fixtures: newFixtures } = mode === "TOURNAMENT"
      ? initializeNewTournament()
      : initializeNewLeague();
    
    const initialProfile: Profile = {
      username,
      balance: startingBalance,
      netProfit: 0.0,
      tickets: [],
      currentRoundIndex: 0,
      createdTime: Date.now()
    };

    const initialTipstersData = [...INITIAL_TIPSTERS];
    const initialTipsterTickets = generateTipsterBetsForRound(initialTipstersData, newFixtures, newTeams);

    // Dynamic keys writing
    const keys = getKeysForMode(mode, slot);
    localStorage.setItem(keys.profile, JSON.stringify(initialProfile));
    localStorage.setItem(keys.teams, JSON.stringify(newTeams));
    localStorage.setItem(keys.fixtures, JSON.stringify(newFixtures));
    localStorage.setItem(keys.tipsters, JSON.stringify(initialTipstersData));
    localStorage.setItem(keys.tipsterTickets, JSON.stringify(initialTipsterTickets));
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
    updatedTipsterTickets: { [id: string]: BetTicket }
  ) => {
    if (!gameMode) return;
    const keys = getKeysForMode(gameMode, activeSlot);
    localStorage.setItem(keys.profile, JSON.stringify(updatedProfile));
    localStorage.setItem(keys.teams, JSON.stringify(updatedTeams));
    localStorage.setItem(keys.fixtures, JSON.stringify(updatedFixtures));
    localStorage.setItem(keys.tipsters, JSON.stringify(updatedTipsters));
    localStorage.setItem(keys.tipsterTickets, JSON.stringify(updatedTipsterTickets));
  };

  const handleUpdateBalanceCasino = (newBalance: number) => {
    if (!userProfile) return;
    setUserProfile(prev => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        balance: newBalance,
        netProfit: prev.netProfit + (newBalance - prev.balance)
      };
      if (gameMode) {
        localStorage.setItem(getKeysForMode(gameMode, activeSlot).profile, JSON.stringify(updated));
      }
      return updated;
    });
  };

  // 3. Increment Simulation Tickers (Exclusive Watched Match Focus)
  const handleStartSimulation = (speedMs: number, watchedId: string) => {
    if (!userProfile) return;
    setIsSimulating(true);
    setActiveTab("live");

    if (simTimerRef.current) clearInterval(simTimerRef.current);

    simTimerRef.current = setInterval(() => {
      setFixtures(prevFixtures => {
        const teamMap = new Map<string, Team>(teams.map(t => [t.id, t]));
        
        // Find watched match
        const watchedFix = prevFixtures.find(f => f.id === watchedId);
        if (!watchedFix || watchedFix.status === "FT") {
          setIsSimulating(false);
          if (simTimerRef.current) clearInterval(simTimerRef.current);
          return prevFixtures;
        }

        const nextTick = watchedFix.elapsedTicks + 1;
        if (nextTick > 20) {
          setIsSimulating(false);
          if (simTimerRef.current) clearInterval(simTimerRef.current);
          return prevFixtures;
        }

        let isNowFT = false;
        const updatedFixturesList = prevFixtures.map(f => {
          if (f.id === watchedId && (f.status === "SCHEDULED" || f.status === "LIVE")) {
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

        if (gameMode) localStorage.setItem(getKeysForMode(gameMode, activeSlot).fixtures, JSON.stringify(updatedFixturesList));

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
    
    setFixtures(prevFixtures => {
      const watchedFix = prevFixtures.find(f => f.id === watchedId);
      if (!watchedFix || watchedFix.status === "FT") return prevFixtures;

      const nextTick = watchedFix.elapsedTicks + 1;
      if (nextTick > 20) return prevFixtures;

      const teamMap = new Map<string, Team>(teams.map(t => [t.id, t]));
      const updatedFixturesList = prevFixtures.map(f => {
        if (f.id === watchedId && (f.status === "SCHEDULED" || f.status === "LIVE")) {
          const hTeam = teamMap.get(f.homeTeamId)!;
          const aTeam = teamMap.get(f.awayTeamId)!;
          const simmed = simulateMatchTick(f, hTeam, aTeam, nextTick);
          return simmed;
        }
        return f;
      });

      if (gameMode) {
        localStorage.setItem(getKeysForMode(gameMode, activeSlot).fixtures, JSON.stringify(updatedFixturesList));
      }
      setTicks(nextTick);
      return updatedFixturesList;
    });
  };

  // Instantly simulate all OTHER matches in the current round except the watched one
  const handleSimulateRemainingInstant = (watchedId: string) => {
    if (!userProfile || isSimulating) return;

    setFixtures(prevFixtures => {
      const teamMap = new Map<string, Team>(teams.map(t => [t.id, t]));
      const updatedFixturesList = prevFixtures.map(f => {
        if (f.roundIndex === userProfile.currentRoundIndex && f.id !== watchedId && f.status !== "FT") {
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
        localStorage.setItem(getKeysForMode(gameMode, activeSlot).fixtures, JSON.stringify(updatedFixturesList));
      }
      return updatedFixturesList;
    });
  };

  // Instantly simulate ALL matches of the current round (Full skip)
  const handleSimulateInstant = () => {
    if (!userProfile || isSimulating) return;

    setFixtures(prevFixtures => {
      const teamMap = new Map<string, Team>(teams.map(t => [t.id, t]));
      const updatedFixturesList = prevFixtures.map(f => {
        if (f.roundIndex === userProfile.currentRoundIndex && f.status !== "FT") {
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
        localStorage.setItem(getKeysForMode(gameMode, activeSlot).fixtures, JSON.stringify(updatedFixturesList));
      }
      setTicks(15);
      return updatedFixturesList;
    });
  };

  // 4. Settle Round and Generate Next Pairing Stage
  const handleAdvanceRound = () => {
    if (!userProfile || isSimulating) return;

    const currentRoundIndex = userProfile.currentRoundIndex;
    const roundFixturesList = fixtures.filter(f => f.roundIndex === currentRoundIndex);
    const completedFixtures = roundFixturesList.filter(f => f.status === "FT");

    if (roundFixturesList.length > 0 && completedFixtures.length !== roundFixturesList.length) {
      alert("Please simulate or complete all matches in the current round before advancing!");
      return;
    }

    if (completedFixtures.length === 0) return;

    // 1. Evaluate User Pending Tickets
    let totalWinPayoutSum = 0;
    const finalTickets = userProfile.tickets.map(ticket => {
      if (ticket.status !== "PENDING") return ticket;

      let wonAll = true;
      ticket.selections.forEach(sel => {
        const match = completedFixtures.find(f => f.id === sel.fixtureId);
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

        } else if (sel.marketType === "EXACT_SCORE") {
          const outcomeScore = `${hScore}-${aScore}`;
          if (sel.selectionId !== outcomeScore) wonAll = false;

        } else if (sel.marketType === "ANYTIME_GOALSCORER") {
          const playersScored = match.events.some(ev => ev.type === "GOAL" && ev.playerId === sel.selectionId);
          if (!playersScored) wonAll = false;
        }
      });

      const updatedStatus = wonAll ? "WON" as const : "LOST" as const;
      if (wonAll) {
        totalWinPayoutSum += ticket.potentialPayout;
      }

      return {
        ...ticket,
        status: updatedStatus
      };
    });

    // 2. Settle Tipster payouts
    const updatedTipsters = resolveTipsterRound(tipsters, tipsterTickets, completedFixtures);

    // 3. Accumulate player rosters parameters
    let updatedTeamsList = [...teams];
    completedFixtures.forEach(fix => {
      updatedTeamsList = updateRostersAndStatsAfterFixture(updatedTeamsList, fix);
    });

    // Check if Campaign is finished
    const isLeagueCompleted = gameMode === "LEAGUE" && currentRoundIndex === 14;
    const isFinalFinished = (gameMode === "TOURNAMENT" && currentRoundIndex === 4) || isLeagueCompleted;

    let nextRoundIdx = currentRoundIndex;
    let nextFixturesList = [...fixtures];
    let nextTipsterTickets: typeof tipsterTickets = {};

    if (!isFinalFinished) {
      nextRoundIdx = currentRoundIndex + 1;
      
      if (gameMode === "TOURNAMENT") {
        // 4. Generate next round fixture brackets
        const newFixtures = generateNextRoundFixtures(fixtures, updatedTeamsList, nextRoundIdx);
        nextFixturesList = [...fixtures, ...newFixtures];
      } else {
        // In league mode, all fixtures for all 15 rounds are already generated!
        nextFixturesList = [...fixtures];
      }

      // Reset tickets for virtual tipsters ready for next matchups
      nextTipsterTickets = generateTipsterBetsForRound(updatedTipsters, nextFixturesList, updatedTeamsList);
    } else {
      // Final complete! Show Campaign Winner screen
      setShowWinnerCelebration(true);
    }

    const nextBalance = Math.round((userProfile.balance + totalWinPayoutSum) * 100) / 100;
    
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
      currentRoundIndex: nextRoundIdx
    };

    // Save everything
    persistStateToCache(nextProfile, updatedTeamsList, nextFixturesList, updatedTipsters, nextTipsterTickets);

    // Update States
    setUserProfile(nextProfile);
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
    selectionStakes?: { [secId: string]: number }
  ) => {
    if (!userProfile) return;

    if (userProfile.balance < totalStake) {
      alert("Insufficient wallet balance!");
      return;
    }

    const totalOdds = Math.round(selectedBets.reduce((acc, b) => acc * b.odds, 1) * 100) / 100;

    const newTicket: BetTicket = {
      id: `ticket-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type,
      selections: [...selectedBets],
      totalOdds: type === "SINGLE" ? 1 : totalOdds, // Accumulator uses combined, Single shows by odds item sum
      stake: totalStake,
      potentialPayout: type === "SINGLE"
        ? Math.round(selectedBets.reduce((sum, b) => {
            const key = `${b.fixtureId}-${b.marketType}-${b.selectionId}`;
            const st = selectionStakes?.[key] || 0;
            return sum + (st * b.odds);
          }, 0) * 100) / 100
        : Math.round(totalStake * totalOdds * 100) / 100,
      status: "PENDING",
      timestamp: Date.now(),
      selectionStakes: selectionStakes
    };

    const nextBalance = Math.round((userProfile.balance - totalStake) * 100) / 100;
    
    const nextProfile: Profile = {
      ...userProfile,
      balance: nextBalance,
      tickets: [...userProfile.tickets, newTicket]
    };

    // Persist to local & cache
    setUserProfile(nextProfile);
    setSelectedBets([]); // wipe slip
    
    persistStateToCache(nextProfile, teams, fixtures, tipsters, tipsterTickets);
  };

  // Add a prediction to the slip matching exclusivity constraints as specified!
  const handleAddBetSelection = (newSel: BetSelection) => {
    setCollapsedSlip(false); // Auto expand betting slip panel to view added selections immediately!
    setSelectedBets(prev => {
      let filtered = prev;
      
      // 1. MATCH_WINNER: Exclusive (only physical 1 per fixtureId allowed)
      if (newSel.marketType === "MATCH_WINNER") {
        filtered = prev.filter(sel => 
          !(sel.fixtureId === newSel.fixtureId && sel.marketType === "MATCH_WINNER")
        );
      }
      
      // 2. EXACT_SCORE: Exclusive (only one score predicted per match)
      else if (newSel.marketType === "EXACT_SCORE") {
        filtered = prev.filter(sel =>
          !(sel.fixtureId === newSel.fixtureId && sel.marketType === "EXACT_SCORE")
        );
      }
      
      // 3. ANYTIME_GOALSCORER: Non-exclusive, block double selecting identical players
      else if (newSel.marketType === "ANYTIME_GOALSCORER") {
        filtered = prev.filter(sel =>
          !(sel.fixtureId === newSel.fixtureId && sel.marketType === "ANYTIME_GOALSCORER" && sel.selectionId === newSel.selectionId)
        );
      }

      return [...filtered, newSel];
    });
  };

  const handleAddMultipleSelections = (newSels: BetSelection[]) => {
    setCollapsedSlip(false); // Auto expand betting slip panel to see recommended predictions immediately!
    setSelectedBets(prev => {
      let current = [...prev];
      newSels.forEach(newSel => {
        // Enforce market exclusions first
        if (newSel.marketType === "MATCH_WINNER") {
          current = current.filter(sel => 
            !(sel.fixtureId === newSel.fixtureId && sel.marketType === "MATCH_WINNER")
          );
        } else if (newSel.marketType === "EXACT_SCORE") {
          current = current.filter(sel =>
            !(sel.fixtureId === newSel.fixtureId && sel.marketType === "EXACT_SCORE")
          );
        } else if (newSel.marketType === "ANYTIME_GOALSCORER") {
          current = current.filter(sel =>
            !(sel.fixtureId === newSel.fixtureId && sel.marketType === "ANYTIME_GOALSCORER" && sel.selectionId === newSel.selectionId)
          );
        }
        current.push(newSel);
      });
      return current;
    });
  };

  const handleRemoveSelection = (fixtureId: string, marketType: MarketType, selectionId: string) => {
    setSelectedBets(prev =>
      prev.filter(sel => !(sel.fixtureId === fixtureId && sel.marketType === marketType && sel.selectionId === selectionId))
    );
  };

  const handleClearAllSelections = () => {
    setSelectedBets([]);
  };

  // Manual Faucet funds loader modal display
  const handleAddFunds = () => {
    setShowWalletModal(true);
  };

  const handleConfirmWalletTransaction = () => {
    if (!userProfile) return;
    const amount = parseFloat(walletValue);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid positive transaction amount!");
      return;
    }

    if (walletAction === "WITHDRAW" && userProfile.balance < amount) {
      alert("Insufficient wallet balance for withdrawal!");
      return;
    }

    const multiplier = walletAction === "DEPOSIT" ? 1 : -1;
    const nextBalance = Math.round((userProfile.balance + amount * multiplier) * 100) / 100;

    const nextProfile = {
      ...userProfile,
      balance: nextBalance
    };

    setUserProfile(nextProfile);
    if (gameMode) localStorage.setItem(getKeysForMode(gameMode, activeSlot).profile, JSON.stringify(nextProfile));

    setWalletSuccessMsg(
      walletAction === "DEPOSIT"
        ? `Successfully deposited $${amount.toFixed(2)} to your wallet!`
        : `Successfully withdrew $${amount.toFixed(2)} from your wallet!`
    );

    // Clear input
    setWalletValue("");
    setTimeout(() => {
      setShowWalletModal(false);
      setWalletSuccessMsg("");
    }, 1500);
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
      const finalFix = fixtures.find(f => f.roundIndex === 3) || fixtures.find(f => f.roundIndex === 4);
      if (!finalFix) return { name: "Champion", crest: teams[0] };
      const winnerId = finalFix.homeScore > finalFix.awayScore ? finalFix.homeTeamId : finalFix.awayTeamId;
      const championClub = teams.find(t => t.id === winnerId) || teams[0];
      return { name: championClub.name, crest: championClub };
    }
  };

  const currentRoundLabel = gameMode === "LEAGUE"
    ? `Matchday ${(userProfile?.currentRoundIndex ?? 0) + 1}`
    : (ROUND_LABELS[userProfile?.currentRoundIndex || 0] || "Session Concluded");

  if (!gameMode || !userProfile) {
    const savedTournaments = [
      localStorage.getItem("fs_profile_v3_tournament_slot1") !== null || localStorage.getItem("fs_profile_v3_tournament") !== null,
      localStorage.getItem("fs_profile_v3_tournament_slot2") !== null,
      localStorage.getItem("fs_profile_v3_tournament_slot3") !== null
    ];
    const savedLeagues = [
      localStorage.getItem("fs_profile_v3_league_slot1") !== null || localStorage.getItem("fs_profile_v3_league") !== null,
      localStorage.getItem("fs_profile_v3_league_slot2") !== null,
      localStorage.getItem("fs_profile_v3_league_slot3") !== null
    ];

    const handleResumeCampaign = (mode: "TOURNAMENT" | "LEAGUE", slot: number) => {
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
      setDummyUpdateSlot(prev => prev + 1);
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
    <div id="app" className="h-screen w-screen bg-gradient-to-br from-[#0b0e14] via-[#05070a] to-[#121620] text-slate-100 flex flex-col overflow-hidden font-sans animate-fade-in">
      
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
      />

      {/* Main Workspace Frame container splits */}
      <div id="workspace-split" className="flex flex-1 min-h-0 overflow-hidden relative">
        
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
            />
          )}

          {activeTab === "teams" && (
            <TeamsList teams={teams} fixtures={fixtures} />
          )}

          {activeTab === "analytics" && (
            <Analytics teams={teams} fixtures={fixtures} />
          )}

          {activeTab === "tournament" && userProfile && (
            gameMode === "LEAGUE" ? (
              <LeagueStandings
                teams={teams}
                fixtures={fixtures}
                currentRoundIndex={userProfile.currentRoundIndex}
              />
            ) : (
              <TournamentBracket fixtures={fixtures} teams={teams} />
            )
          )}

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
            />
          )}
        </main>

        {/* Collapsible right panel Betting Slip (Width 25%) */}
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
      </div>

      {/* WALLET DEPOSIT & WITHDRAWAL POPUP */}
      {showWalletModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-55 flex items-center justify-center p-4 animate-fade-in">
          <div className="relative glass-panel-heavy border border-white/10 rounded-2xl p-6 max-w-sm w-full mx-auto space-y-5 shadow-2xl">
            <button
              onClick={() => {
                setShowWalletModal(false);
                setWalletSuccessMsg("");
              }}
              className="absolute top-4 right-4 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white h-8 w-8 rounded-full flex items-center justify-center cursor-pointer text-xs"
            >
              ✕
            </button>

            <div className="text-center space-y-1 select-none">
              <span className="text-2xl block">🏦</span>
              <h3 className="text-sm font-black tracking-wider uppercase text-emerald-400 font-sans mt-2">
                SportSim Wallet Centre
              </h3>
              <p className="text-[9px] text-slate-400 font-mono tracking-tight">
                SECURE TRANSACTION PORTAL
              </p>
            </div>

            {/* Current Balance Display */}
            <div className="bg-black/35 rounded-xl border border-white/5 p-3 text-center">
              <span className="text-[8px] text-slate-500 font-mono block uppercase">CURRENT BANKROLL</span>
              <span className="text-lg font-black text-emerald-450 font-mono block mt-0.5 animate-pulse">
                ${userProfile?.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* Tabs Selector: DEPOSIT or WITHDRAW */}
            <div className="flex bg-black/30 p-1 border border-white/5 rounded-xl gap-1">
              <button
                onClick={() => setWalletAction("DEPOSIT")}
                className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg cursor-pointer transition-all ${
                  walletAction === "DEPOSIT"
                    ? "bg-emerald-500 text-slate-950 font-extrabold shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                📥 DEPOSIT
              </button>
              <button
                onClick={() => setWalletAction("WITHDRAW")}
                className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg cursor-pointer transition-all ${
                  walletAction === "WITHDRAW"
                    ? "bg-rose-650 text-slate-100 font-extrabold shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                📤 WITHDRAW
              </button>
            </div>

            {/* Numeric input value */}
            <div className="space-y-1">
              <label className="text-[9px] font-mono font-bold text-slate-400 uppercase block">
                {walletAction === "DEPOSIT" ? "ENTER DEPOSIT AMOUNT ($)" : "ENTER WITHDRAWAL AMOUNT ($)"}
              </label>
              <div className="relative bg-black/45 rounded-xl border border-white/5 flex items-center px-3.5 py-1.5">
                <span className="text-slate-500 text-xs font-bold mr-1.5">$</span>
                <input
                  type="number"
                  min="1"
                  placeholder="Enter amount (e.g. 100)"
                  value={walletValue}
                  onChange={(e) => {
                    setWalletValue(e.target.value);
                    setWalletSuccessMsg("");
                  }}
                  className="w-full bg-transparent border-none text-xs text-white focus:outline-none placeholder-slate-655 font-bold font-mono"
                />
              </div>
            </div>

            {/* Quick Presets */}
            <div className="grid grid-cols-4 gap-1.5 select-none">
              {[50, 100, 500, 1000].map(pt => (
                <button
                  key={pt}
                  onClick={() => {
                    setWalletValue(pt.toString());
                    setWalletSuccessMsg("");
                  }}
                  className="bg-white/5 hover:bg-white/10 text-slate-300 font-mono text-[10px] py-1 rounded-lg border border-white/5 cursor-pointer text-center"
                >
                  +${pt}
                </button>
              ))}
            </div>

            {/* Status alerts */}
            {walletSuccessMsg && (
              <div className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-2 rounded-xl text-center font-bold">
                {walletSuccessMsg}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowWalletModal(false);
                  setWalletSuccessMsg("");
                }}
                className="flex-1 py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-xs font-bold text-slate-400 cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={handleConfirmWalletTransaction}
                className={`flex-1 py-2 rounded-xl text-xs font-black cursor-pointer text-center transition-all ${
                  walletAction === "DEPOSIT"
                    ? "bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-md shadow-emerald-500/10"
                    : "bg-rose-650 hover:bg-rose-700 text-slate-100"
                }`}
              >
                Confirm {walletAction === "DEPOSIT" ? "Deposit" : "Withdraw"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Crowning Champion Fullscreen modal overlay */}
      {showWinnerCelebration && (
        <div className="fixed inset-0 bg-[#070b11]/95 backdrop-blur-md flex flex-col items-center justify-center p-6 z-[120] animate-fade-in text-center select-none">
          <div className="bg-[#121b26] border border-amber-500/40 rounded-3xl p-8 max-w-sm shadow-2xl relative space-y-6">
            
            {/* Close Button to inspect matches */}
            <button
              type="button"
              onClick={() => setShowWinnerCelebration(false)}
              className="absolute top-4 right-4 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white h-8 w-8 rounded-full flex flex-col items-center justify-center cursor-pointer text-xs border border-white/5 transition-colors"
              title="Close and inspect slip results"
            >
              ✕
            </button>

            <div>
              <span className="text-6xl block mt-1 animate-bounce">🏆</span>
              <h1 className="text-base font-black tracking-widest text-[#f5a623] uppercase mt-4">
                CHAMPIONSHIP CROWNED!
              </h1>
            </div>

            {(() => {
              const champion = getChampionshipWinnerTeamName();
              return (
                <div className="bg-black/30 border border-white/5 rounded-2xl p-4">
                  <TeamCrest team={champion.crest} size={64} className="mx-auto block" />
                  <h2 className="text-sm font-bold text-slate-100 mt-2 truncate">
                    {champion.name}
                  </h2>
                  <p className="text-[10px] text-slate-400 font-mono uppercase mt-1">
                    {gameMode === "LEAGUE" ? "League Title Winner" : "Tournament Cup Champions"}
                  </p>
                </div>
              );
            })()}

            <div className="space-y-3 pt-2">
              <div className="text-left">
                <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest block">
                  Next Season Setup Trajectory
                </span>
                <p className="text-[10px] text-slate-400 leading-tight mt-1">
                  Would you like to continue with your accumulated manager records (balance & analytics) or start a completely fresh season?
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                {/* Carry Over */}
                <button
                  onClick={() => handleResetAndGenerate(true)}
                  className="bg-emerald-500/10 hover:bg-emerald-500 hover:text-slate-950 text-emerald-400 border border-emerald-500/25 rounded-2xl p-3 text-left font-sans flex flex-col justify-between h-[105px] transition-all hover:scale-[1.02] cursor-pointer"
                >
                  <span className="text-xs font-black uppercase tracking-wider block leading-snug">Continue<br />Records</span>
                  <span className="text-[8.5px] font-mono opacity-80 leading-snug">Preserves balance (${userProfile?.balance.toFixed(0)}) & analytics sheets.</span>
                </button>

                {/* Fresh Start */}
                <button
                  onClick={() => handleResetAndGenerate(false)}
                  className="bg-white/3 hover:bg-white/10 hover:text-white text-slate-300 border border-white/10 rounded-2xl p-3 text-left font-sans flex flex-col justify-between h-[105px] transition-all hover:scale-[1.02] cursor-pointer"
                >
                  <span className="text-xs font-black uppercase tracking-wider block leading-snug">Fresh<br />Start</span>
                  <span className="text-[8.5px] font-mono opacity-80 leading-snug">Resets budget to $1,000 and clears all history.</span>
                </button>
              </div>
            </div>

            <button
              onClick={() => setShowWinnerCelebration(false)}
              className="w-full py-2 border border-slate-500/20 hover:border-slate-500/40 text-slate-400 hover:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Close & Inspect Last Bets
            </button>
          </div>
        </div>
      )}

      {/* GLOBAL HIGH-FIDELITY HOVER/TAP PREVIEW PORTAL MODAL */}
      {globalEntity && (() => {
        const foundPlayer = globalEntity.type === "player"
          ? teams.flatMap(t => t.players).find(p => p.id === globalEntity.id)
          : null;
        const foundPlayerTeam = foundPlayer
          ? teams.find(t => t.id === foundPlayer.teamId)
          : null;
        const foundTeam = globalEntity.type === "team"
          ? teams.find(t => t.id === globalEntity.id)
          : null;

        if (globalEntity.type === "player" && !foundPlayer) return null;
        if (globalEntity.type === "team" && !foundTeam) return null;

        return (
          <div
            onClick={() => setGlobalEntity(null)}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fade-in overflow-y-auto cursor-pointer"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative glass-panel-heavy border border-white/10 rounded-3xl p-6 max-w-sm w-full mx-auto my-auto shadow-2xl space-y-6 flex flex-col items-center select-none text-center cursor-default"
            >
              
              {/* Close Button */}
              <button
                onClick={() => setGlobalEntity(null)}
                className="absolute top-4 right-4 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white h-9 w-9 rounded-full flex items-center justify-center cursor-pointer text-xs transition-all border border-white/5"
              >
                ✕
              </button>

              {foundPlayer && (
                <div className="w-full flex flex-col items-center space-y-4">
                  {/* Player FUT-Card Inspired Title */}
                  <div className="flex flex-col items-center">
                    <div className="h-11 w-11 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-center text-xl mb-1 shadow-md animate-pulse">
                      🏃
                    </div>
                    <p className="text-[10px] font-mono tracking-widest text-[#10b981] font-extrabold uppercase">
                      CHAMPIONSHIP PLAYER PORTRAIT
                    </p>
                    <h3 className="text-lg font-black text-slate-100 tracking-tight leading-tight mt-1 truncate max-w-[240px]">
                      {foundPlayer.name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1.5 justify-center flex-wrap">
                      <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[9px] font-mono text-[#10b981] font-bold">
                        {foundPlayer.position}
                      </span>
                      {foundPlayerTeam && (
                        <>
                          <span className="text-slate-600">•</span>
                          <span className="text-slate-300 font-bold text-xs flex items-center gap-1">
                            <TeamCrest team={foundPlayerTeam} size={16} />
                            {foundPlayerTeam.name}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Selector Tabs */}
                  <div className="w-full grid grid-cols-2 border-b border-white/5 text-xs font-bold leading-none select-none">
                    <button
                      type="button"
                      onClick={() => setGlobalPlayerTab("stats")}
                      className={`py-2 border-b-2 text-center transition-all cursor-pointer font-bold ${
                        globalPlayerTab === "stats"
                          ? "border-emerald-500 text-emerald-400 font-black"
                          : "border-transparent text-slate-400 hover:text-white font-medium"
                      }`}
                    >
                      SEASON STATS
                    </button>
                    <button
                      type="button"
                      onClick={() => setGlobalPlayerTab("qualities")}
                      className={`py-2 border-b-2 text-center transition-all cursor-pointer ${
                        globalPlayerTab === "qualities"
                          ? "border-emerald-500 text-emerald-400 font-black"
                          : "border-transparent text-slate-400 hover:text-white font-medium"
                      }`}
                    >
                      TECHNICAL QUALITIES
                    </button>
                  </div>

                  {/* Render content */}
                  {globalPlayerTab === "stats" ? (
                    <div className="w-full space-y-3 animate-fade-in block">
                      {/* Overall badge */}
                      <div className="h-16 w-16 mx-auto rounded-full border border-emerald-500/20 bg-emerald-500/5 shadow-[0_0_15px_rgba(16,185,129,0.12)] flex flex-col items-center justify-center">
                        <span className="text-slate-500 font-mono text-[7px] font-bold uppercase leading-none">OVR</span>
                        <span className="text-xl font-black font-mono text-[#10b981] leading-none mt-0.5">
                          {foundPlayer.rating}
                        </span>
                      </div>

                      {/* Performance stats grid */}
                      <div className="w-full bg-black/40 border border-white/5 rounded-xl p-3 grid grid-cols-4 gap-2 text-center text-xs font-mono text-slate-350">
                        <div>
                          <span className="font-black text-slate-205 block">{foundPlayer.matchesPlayed}</span>
                          <span className="text-[8px] text-slate-500 font-bold uppercase block mt-0.5">Played</span>
                        </div>
                        <div>
                          <span className="font-black text-emerald-400 block">{foundPlayer.goals}</span>
                          <span className="text-[8px] text-slate-500 font-bold uppercase block mt-0.5">Goals</span>
                        </div>
                        <div>
                          <span className="font-black text-slate-205 block">
                            {foundPlayer.position === "GK" ? (foundPlayer.saves || 0) : (foundPlayer.assists || 0)}
                          </span>
                          <span className="text-[8px] text-slate-500 font-bold uppercase block mt-0.5">
                            {foundPlayer.position === "GK" ? "Saves" : "Assists"}
                          </span>
                        </div>
                        <div>
                          <span className="font-black text-slate-205 block text-[10px] whitespace-nowrap">
                            🟨{foundPlayer.yellowCards || 0} 🟥{foundPlayer.redCards || 0}
                          </span>
                          <span className="text-[8px] text-slate-500 font-bold uppercase block mt-0.5">Cards</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full space-y-3 bg-black/20 p-4 rounded-2xl border border-white/5 animate-fade-in text-left block">
                      <p className="text-[9px] font-mono tracking-widest text-slate-550 font-black uppercase text-center border-b border-white/5 pb-1.5 mb-2">
                        TECHNICAL CHARACTERISTICS GAUGES
                      </p>
                      {foundPlayer.abilities ? (
                        Object.entries(foundPlayer.abilities).map(([abilKey, abilVal]) => {
                          const value = abilVal as number;
                          const color = value >= 85 ? "bg-emerald-500" : value >= 75 ? "bg-yellow-500" : "bg-sky-500";
                          const label = abilKey.toUpperCase();
                          return (
                            <div key={abilKey} className="space-y-0.5">
                              <div className="flex justify-between text-[10px] font-mono text-slate-300 leading-none">
                                <span className="font-bold uppercase tracking-wider">{label}</span>
                                <span className="font-extrabold text-slate-105">{value}</span>
                              </div>
                              <div className="h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5 relative">
                                <div
                                  className={`h-full ${color} rounded-full transition-all duration-300`}
                                  style={{ width: `${value}%` }}
                                ></div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-xs font-mono text-slate-550 text-center py-2">
                          No specific abilities declared for player.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {foundTeam && (
                <div className="w-full flex flex-col items-center space-y-4">
                  {/* Team Profile Header */}
                  <div className="flex flex-col items-center">
                    <TeamCrest team={foundTeam} size={56} className="mb-1" />
                    <p className="text-[10px] font-mono tracking-widest text-emerald-400 font-extrabold uppercase mt-1">
                      CHAMPIONSHIP CLUB DOSSIER
                    </p>
                    <h3 className="text-lg font-black text-slate-100 tracking-tight leading-tight mt-1.5 truncate max-w-[240px]">
                      {foundTeam.name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[10px] text-slate-400 font-mono uppercase font-bold tracking-widest">
                        RATING: {foundTeam.rating.toFixed(1)} Stars
                      </span>
                    </div>
                  </div>

                  {/* Team Color chips */}
                  <div className="flex items-center gap-2 select-none">
                    <span className="text-[9px] text-slate-500 uppercase font-mono font-bold">Colors:</span>
                    <div className="h-4 w-4 rounded-full border border-white/20" style={{ backgroundColor: foundTeam.primaryColor }} title="Primary Color"></div>
                    <div className="h-4 w-4 rounded-full border border-white/20" style={{ backgroundColor: foundTeam.secondaryColor }} title="Secondary Color"></div>
                  </div>

                  {/* Stats Summary Grid */}
                  <div className="w-full bg-black/40 border border-white/5 rounded-xl p-3 grid grid-cols-4 gap-2 text-center text-xs">
                    <div>
                      <span className="text-xs font-black text-slate-200 font-mono block">
                        {foundTeam.wonMatches}
                      </span>
                      <span className="text-[9px] text-emerald-450 font-mono font-bold uppercase block mt-0.5">
                        Won
                      </span>
                    </div>
                    <div>
                      <span className="text-xs font-black text-slate-200 font-mono block">
                        {foundTeam.drawnMatches || 0}
                      </span>
                      <span className="text-[9px] text-slate-500 font-mono font-bold uppercase block mt-0.5">
                        Drawn
                      </span>
                    </div>
                    <div>
                      <span className="text-xs font-black text-slate-200 font-mono block">
                        {foundTeam.lostMatches}
                      </span>
                      <span className="text-[9px] text-rose-400 font-mono font-bold uppercase block mt-0.5">
                        Lost
                      </span>
                    </div>
                    <div>
                      <span className="text-xs font-black text-slate-200 font-mono block">
                        {foundTeam.goalsScored}
                      </span>
                      <span className="text-[9px] text-sky-450 font-mono font-bold uppercase block mt-0.5">
                        Goals
                      </span>
                    </div>
                  </div>

                  {expandGlobalEntity ? (
                    <div className="w-full max-h-[180px] overflow-y-auto space-y-2 bg-black/20 p-2.5 rounded-2xl border border-white/5 text-left no-scrollbar">
                      <p className="text-[10px] font-mono tracking-widest text-slate-505 font-black uppercase text-center border-b border-white/5 pb-1 select-none">
                        ACTIVE CLUB SQUAD LISTING ({foundTeam.players.length})
                      </p>
                      <div className="space-y-1 text-[11px] font-mono">
                        {foundTeam.players.map(p => (
                          <div 
                            key={p.id}
                            onClick={() => {
                              // Switch context to player in popover!
                              setGlobalEntity({ type: "player", id: p.id });
                              setExpandGlobalEntity(false);
                            }}
                            className="flex justify-between items-center py-1.5 px-2 hover:bg-white/5 border border-transparent hover:border-white/5 rounded-lg transition-all cursor-pointer"
                          >
                            <span className="font-semibold text-slate-300 truncate block max-w-[150px]">
                              {p.name}
                            </span>
                            <div className="flex gap-2 items-center">
                              <span className="text-[8px] bg-slate-800 text-slate-400 font-bold px-1 rounded uppercase">
                                {p.position}
                              </span>
                              <span className="font-extrabold text-emerald-450">
                                {p.rating}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setExpandGlobalEntity(true)}
                      className="w-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold font-sans text-xs py-2 px-4 rounded-xl border border-emerald-500/20 transition-all cursor-pointer flex items-center justify-center gap-1 hover:scale-[1.01]"
                    >
                      👥 EXPAND FULL CLUB ROSTER & RATINGS
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setGlobalEntity(null);
                      setActiveTab("teams");
                    }}
                    className="w-full bg-white/5 hover:bg-white/10 text-slate-300 font-medium font-sans text-xs py-1.5 px-4 rounded-xl border border-white/5 transition-all cursor-pointer hover:scale-[1.01]"
                  >
                    🏟️ OPEN DIRECTLY IN FULL SQUAD COMPARATOR
                  </button>
                </div>
              )}

              <button
                onClick={() => setGlobalEntity(null)}
                className="w-full bg-emerald-500 text-slate-950 font-black font-sans text-xs py-2 px-4 rounded-xl hover:scale-105 active:scale-100 transition-all cursor-pointer mt-2"
              >
                Close Preview
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
