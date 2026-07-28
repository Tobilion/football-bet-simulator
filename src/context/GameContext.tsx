import { createContext, useContext, useState, useCallback, useRef, ReactNode, useEffect } from "react";
import { Team, Fixture, Profile, Tipster, BetTicket, TransferListing, ClubOwnership, PurchasedItem, CareerProfile, MOTMResult } from "../types";
import {
  getKeysForMode, persistStateToCache, isSaveCompatible, loadProfile, loadTeams, loadFixtures, loadTipsters, loadTipsterTickets, signSave,
} from "../utils/storage";
import { initializeNewTournament, initializeNewLeague, generateNextRoundFixtures } from "../data/tournament";
import { generateTipsterBetsForRound, INITIAL_TIPSTERS } from "../data/tipsters";
import { generateTransferListings, applyUserWinsToOwnedTeam } from "../engine/transferEngine";
import type { FootysimMatch } from "../engine/footysimBridge";

interface GameContextValue {
  teams: Team[];
  setTeams: React.Dispatch<React.SetStateAction<Team[]>>;
  fixtures: Fixture[];
  setFixtures: React.Dispatch<React.SetStateAction<Fixture[]>>;
  tipsters: Tipster[];
  setTipsters: React.Dispatch<React.SetStateAction<Tipster[]>>;
  tipsterTickets: { [id: string]: BetTicket };
  setTipsterTickets: React.Dispatch<React.SetStateAction<{ [id: string]: BetTicket }>>;
  gameMode: "TOURNAMENT" | "LEAGUE" | null;
  setGameMode: React.Dispatch<React.SetStateAction<"TOURNAMENT" | "LEAGUE" | null>>;
  activeSlot: number;
  handleResetAndGenerate: (keepRecords?: boolean) => void;
  handleStartNewCampaign: (username: string, startingBalance: number, mode: "TOURNAMENT" | "LEAGUE", slot: number) => void;
  exitToMenu: () => void;
  handleResumeCampaign: (mode: "TOURNAMENT" | "LEAGUE", slot: number) => void;
  handleDeleteSave: (mode: "TOURNAMENT" | "LEAGUE", slot: number) => void;
  applyFootysimResult: (fixtureId: string, m: FootysimMatch) => void;
  getChampion: () => { name: string; crest: Team };
}

const GameContext = createContext<GameContextValue | null>(null);

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used inside GameProvider");
  return ctx;
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [gameMode, setGameMode] = useState<"TOURNAMENT" | "LEAGUE" | null>(null);
  const [activeSlot, setActiveSlot] = useState<number>(
    () => parseInt(localStorage.getItem("fs_selected_game_slot") || "1"),
  );
  const [teams, setTeams] = useState<Team[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [tipsters, setTipsters] = useState<Tipster[]>([]);
  const [tipsterTickets, setTipsterTickets] = useState<{ [id: string]: BetTicket }>({});

  // Stable ref for teams (used in callbacks to avoid stale closures / unnecessary recreation)
  const teamsRef = useRef(teams);
  useEffect(() => { teamsRef.current = teams; }, [teams]);

  // ─── Load / initialise game state ──────────────────────────────────
  useEffect(() => {
    if (!gameMode) return;
    localStorage.setItem("fs_selected_game_mode", gameMode);
    const keys = getKeysForMode(gameMode, activeSlot);

    if (isSaveCompatible(keys)) {
      try {
        const parsedProfile = loadProfile(keys);
        const parsedTeams = loadTeams(keys);
        const parsedFixtures = loadFixtures(keys);
        const parsedTipsters = loadTipsters(keys);
        const parsedTickets = loadTipsterTickets(keys);
        if (!parsedProfile || !parsedTeams || !parsedFixtures || !parsedTipsters) {
          handleResetAndGenerate();
          return;
        }
        setTeams(parsedTeams);
        setFixtures(parsedFixtures);
        setTipsters(parsedTipsters);
        setTipsterTickets(parsedTickets ?? {});
      } catch {
        handleResetAndGenerate();
      }
    } else {
      handleResetAndGenerate();
    }
  }, [gameMode]);

  // ─── Transfer listings generation on round change ──────────────────
  // Note: this effect runs in AppContent where userProfile is available

  const handleResetAndGenerate = useCallback((keepRecords = false) => {
    if (!gameMode) return;
    const freshData = gameMode === "TOURNAMENT" ? initializeNewTournament() : initializeNewLeague();
    let { teams: freshTeams, fixtures: freshFixtures } = freshData;

    const currentTeams = teamsRef.current;
    if (keepRecords) {
      freshTeams = freshTeams.map((t) => {
        const old = currentTeams.find((o) => o.id === t.id);
        return old ? { ...t, ownership: old.ownership, seasonHistory: old.seasonHistory } : t;
      });
    }

    const keys = getKeysForMode(gameMode, activeSlot);
    let existingProfile: Profile | null = null;
    let existingTipsters: Tipster[] = INITIAL_TIPSTERS;
    try {
      const rawProfile = localStorage.getItem(keys.profile);
      if (rawProfile) {
        const parsed = JSON.parse(rawProfile);
        existingProfile = parsed?.data ?? parsed;
      }
      const rawTipsters = localStorage.getItem(keys.tipsters);
      if (rawTipsters) {
        const parsed = JSON.parse(rawTipsters);
        existingTipsters = (parsed?.data ?? parsed) ?? INITIAL_TIPSTERS;
      }
    } catch {}
    const base = existingProfile ?? ({} as Profile);
    const profile: Profile = {
      username: base.username ?? "",
      balance: base.balance ?? 0,
      netProfit: base.netProfit ?? 0,
      createdTime: base.createdTime ?? Date.now(),
      tickets: [],
      currentRoundIndex: base.currentRoundIndex ?? 0,
      bankrollHistory: base.bankrollHistory ?? [],
      ownedTeamId: base.ownedTeamId,
      ownedTeamIds: base.ownedTeamIds ?? [],
      purchasedItems: base.purchasedItems ?? [],
      challenges: base.challenges ?? [],
      betBuilderTickets: [],
    };

    const nextTipsterTickets = generateTipsterBetsForRound(existingTipsters, freshFixtures, freshTeams);
    persistStateToCache(gameMode, activeSlot, profile, freshTeams, freshFixtures, existingTipsters, nextTipsterTickets);

    setTeams(freshTeams);
    setFixtures(freshFixtures);
    setTipsters(existingTipsters);
    setTipsterTickets(nextTipsterTickets);
  }, [gameMode, activeSlot]);

  const handleStartNewCampaign = useCallback((
    username: string,
    startingBalance: number,
    mode: "TOURNAMENT" | "LEAGUE",
    slot: number,
  ) => {
    setActiveSlot(slot);
    localStorage.setItem("fs_selected_game_slot", String(slot));
    const fresh = mode === "TOURNAMENT" ? initializeNewTournament() : initializeNewLeague();
    const initialProfile: Profile = {
      username, balance: startingBalance, netProfit: 0, createdTime: Date.now(),
      tickets: [], currentRoundIndex: 0, bankrollHistory: [],
      ownedTeamId: undefined, ownedTeamIds: [], purchasedItems: [],
      challenges: [], betBuilderTickets: [],
    };
    const keys = getKeysForMode(mode, slot);
    localStorage.setItem(`${keys.profile}_schema`, "2");
    localStorage.setItem(keys.profile, JSON.stringify(signSave(initialProfile, keys.profile)));
    localStorage.setItem(keys.teams, JSON.stringify(signSave(fresh.teams, keys.teams)));
    localStorage.setItem(keys.fixtures, JSON.stringify(signSave(fresh.fixtures, keys.fixtures)));
    const tipsterBets = generateTipsterBetsForRound([], fresh.fixtures, fresh.teams);
    localStorage.setItem(keys.tipsters, JSON.stringify(signSave(INITIAL_TIPSTERS, keys.tipsters)));
    localStorage.setItem(keys.tipsterTickets, JSON.stringify(signSave(tipsterBets, keys.tipsterTickets)));
    setGameMode(mode);
    setTeams(fresh.teams);
    setFixtures(fresh.fixtures);
    setTipsters(INITIAL_TIPSTERS);
    setTipsterTickets(tipsterBets);
  }, []);

  const exitToMenu = useCallback(() => {
    localStorage.removeItem("fs_selected_game_mode");
    setGameMode(null);
    setTeams([]);
    setFixtures([]);
    setTipsters([]);
    setTipsterTickets({});
  }, []);

  const handleResumeCampaign = useCallback((mode: "TOURNAMENT" | "LEAGUE", slot: number) => {
    setActiveSlot(slot);
    localStorage.setItem("fs_selected_game_slot", String(slot));
    setGameMode(mode);
  }, []);

  const handleDeleteSave = useCallback((mode: "TOURNAMENT" | "LEAGUE", slot: number) => {
    const keys = getKeysForMode(mode, slot);
    Object.values(keys).forEach((k) => {
      localStorage.removeItem(k);
      localStorage.removeItem(`${k}_schema`);
    });
  }, []);

  const applyFootysimResult = useCallback((fixtureId: string, m: FootysimMatch) => {
    let motm: MOTMResult | undefined;
    const ratings = m.playerRatings;
    if (ratings && Object.keys(ratings).length > 0) {
      let bestPid = "";
      let bestScore = -1;
      for (const [pid, score] of Object.entries(ratings)) {
        if (score > bestScore) { bestScore = score; bestPid = pid; }
      }
      if (bestPid) {
        let playerName = "";
        let playerTeamId = "";
        for (const t of teamsRef.current) {
          const p = t.players.find((pl) => pl.id === bestPid);
          if (p) { playerName = p.name; playerTeamId = t.id; break; }
        }
        motm = {
          playerId: bestPid,
          playerName: playerName || bestPid,
          teamId: playerTeamId,
          score: bestScore,
          reason: `Rating: ${bestScore.toFixed(1)}`,
        };
      }
    }

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
              stats: m.stats,
              events: m.events,
              playerRatings: m.playerRatings,
              motm,
              wentToExtraTime: m.wentToExtraTime,
              ...(m.penaltyScore ? { penaltyScore: m.penaltyScore } : {}),
            }
          : f,
      );
      return next;
    });
  }, []);

  const getChampion = useCallback((): { name: string; crest: Team } => {
    if (gameMode === "LEAGUE") {
      const sorted = [...teams].sort((a, b) => {
        const pa = a.wonMatches * 3 + a.drawnMatches;
        const pb = b.wonMatches * 3 + b.drawnMatches;
        if (pb !== pa) return pb - pa;
        return (b.goalsScored - b.goalsConceded) - (a.goalsScored - a.goalsConceded);
      });
      const champ = sorted[0];
      return { name: champ?.name ?? "Champion", crest: champ ?? teams[0] };
    }
    const finals = fixtures.filter((f) => f.roundIndex === 4 && f.status === "FT");
    if (finals.length > 0) {
      const final = finals[finals.length - 1];
      const winnerId = final.homeScore > final.awayScore ? final.homeTeamId : final.awayTeamId;
      const champ = teams.find((t) => t.id === winnerId);
      return { name: champ?.name ?? "Champion", crest: champ ?? teams[0] };
    }
    return { name: "TBD", crest: teams[0] };
  }, [gameMode, teams, fixtures]);

  const value: GameContextValue = {
    teams, setTeams, fixtures, setFixtures,
    tipsters, setTipsters, tipsterTickets, setTipsterTickets,
    gameMode, setGameMode, activeSlot,
    handleResetAndGenerate, handleStartNewCampaign, exitToMenu,
    handleResumeCampaign, handleDeleteSave, applyFootysimResult, getChampion,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}