import { useState, useRef, useEffect } from "react";
import { Team, Fixture, Profile, MatchEvent } from "../types";
import { simulateMatchTick, simulateFullMatchInstantly } from "../engine/matchEngine";
import { getKeysForMode } from "../utils/storage";
import { addToast } from "../hooks/useToast";

interface UseSimulationDeps {
  teams: Team[];
  userProfile: Profile | null;
  gameMode: "TOURNAMENT" | "LEAGUE" | null;
  activeSlot: number;
  fixtures: Fixture[];
  setFixtures: React.Dispatch<React.SetStateAction<Fixture[]>>;
  setActiveTab: (tab: string) => void;
}

export function useSimulation(deps: UseSimulationDeps) {
  const { teams, userProfile, gameMode, activeSlot, fixtures, setFixtures, setActiveTab } = deps;

  const [isSimulating, setIsSimulating] = useState(false);
  const [ticks, setTicks] = useState(0);
  const simTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Keep a ref of the latest committed fixtures so the interval callback and
  // handlers can compute updates OUTSIDE of setState updaters. Running the
  // random match engine inside an updater is impure: React StrictMode
  // double-invokes updaters, producing phantom goal toasts and localStorage
  // writes for simulations that were discarded.
  const fixturesRef = useRef<Fixture[]>(fixtures);
  useEffect(() => {
    fixturesRef.current = fixtures;
  }, [fixtures]);

  const saveFixtures = (list: Fixture[]) => {
    if (gameMode) {
      localStorage.setItem(
        getKeysForMode(gameMode, activeSlot).fixtures,
        JSON.stringify(list),
      );
    }
  };

  const fireGoalToasts = (prevEvents: MatchEvent[], nextEvents: MatchEvent[]) => {
    nextEvents.slice(prevEvents.length).forEach((ev) => {
      if (ev.type === "GOAL") {
        const scorer = teams
          .flatMap((t) => (t.players ?? []).map((p) => ({ name: p.name, teamName: t.shortName, id: p.id })))
          .find((p) => p.id === ev.playerId);
        addToast({
          type: "goal",
          title: "⚽ GOAL!",
          message: scorer ? `${scorer.name} scores for ${scorer.teamName}!` : "Goal scored!",
          duration: 5000,
        });
      }
    });
  };

  const commit = (updatedList: Fixture[]) => {
    fixturesRef.current = updatedList;
    setFixtures(updatedList);
    saveFixtures(updatedList);
  };

  const advanceWatchedByOneTick = (watchedId: string): "advanced" | "stopped" => {
    const prevFixtures = fixturesRef.current;
    const watchedFix = prevFixtures.find((f) => f.id === watchedId);
    if (!watchedFix || watchedFix.status === "FT") return "stopped";

    const nextTick = watchedFix.elapsedTicks + 1;
    if (nextTick > 20) return "stopped";

    const teamMap = new Map<string, Team>(teams.map((t) => [t.id, t]));
    let isNowFT = false;
    const updatedList = prevFixtures.map((f) => {
      if (f.id === watchedId && (f.status === "SCHEDULED" || f.status === "LIVE")) {
        const hTeam = teamMap.get(f.homeTeamId)!;
        const aTeam = teamMap.get(f.awayTeamId)!;
        const simmed = simulateMatchTick(f, hTeam, aTeam, nextTick);
        if (simmed.status === "FT") isNowFT = true;
        return simmed;
      }
      return f;
    });

    const newWatched = updatedList.find((f) => f.id === watchedId);
    fireGoalToasts(watchedFix.events ?? [], newWatched?.events ?? []);

    commit(updatedList);
    setTicks(nextTick);
    return isNowFT ? "stopped" : "advanced";
  };

  const handleStartSimulation = (speedMs: number, watchedId: string) => {
    if (!userProfile) return;
    setIsSimulating(true);
    setActiveTab("live");

    // If already at halftime tick, mark as resume
    const watchedFixCheck = fixturesRef.current.find((f) => f.id === watchedId);
    if (watchedFixCheck && watchedFixCheck.elapsedTicks === 7) {
      sessionStorage.setItem(`ht_resume_${watchedId}`, "true");
    }

    if (simTimerRef.current) clearInterval(simTimerRef.current);

    const tickOnce = () => {
      const watchedFix = fixturesRef.current.find((f) => f.id === watchedId);
      if (!watchedFix || watchedFix.status === "FT") {
        setIsSimulating(false);
        if (simTimerRef.current) clearInterval(simTimerRef.current);
        return;
      }

      const htResumeKey = `ht_resume_${watchedId}`;
      // Respect the user's "Pause at half-time" preference (default on). When
      // off, the match runs straight through to full time without halting at HT.
      const pauseAtHalftime = localStorage.getItem("fs_pause_at_halftime") !== "false";
      if (pauseAtHalftime && watchedFix.elapsedTicks === 7 && sessionStorage.getItem(htResumeKey) !== "true") {
        setIsSimulating(false);
        if (simTimerRef.current) clearInterval(simTimerRef.current);
        window.dispatchEvent(
          new CustomEvent("halftime-pause", { detail: { matchId: watchedId } }),
        );
        return;
      }

      const result = advanceWatchedByOneTick(watchedId);
      if (result === "stopped") {
        setIsSimulating(false);
        if (simTimerRef.current) clearInterval(simTimerRef.current);
      }
    };
    tickOnce(); // advance immediately so the match visibly starts
    simTimerRef.current = setInterval(tickOnce, speedMs);
  };

  const handlePauseSimulation = () => {
    setIsSimulating(false);
    if (simTimerRef.current) clearInterval(simTimerRef.current);
  };

  const handleSimulateTick = (watchedId: string) => {
    if (!userProfile || isSimulating) return;
    const watchedFix = fixturesRef.current.find((f) => f.id === watchedId);
    if (!watchedFix || watchedFix.status === "FT") return;
    if (watchedFix.elapsedTicks === 7) {
      sessionStorage.setItem(`ht_resume_${watchedId}`, "true");
    }
    advanceWatchedByOneTick(watchedId);
  };

  const simulateRoundInstantly = (skipId?: string) => {
    if (!userProfile) return;
    const teamMap = new Map<string, Team>(teams.map((t) => [t.id, t]));
    const updatedList = fixturesRef.current.map((f) => {
      if (
        f.roundIndex === userProfile.currentRoundIndex &&
        (skipId === undefined || f.id !== skipId) &&
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
    commit(updatedList);
  };

  const handleSimulateRemainingInstant = (watchedId: string) => {
    if (isSimulating) return;
    simulateRoundInstantly(watchedId);
  };

  const handleSimulateInstant = () => {
    if (isSimulating) return;
    simulateRoundInstantly();
    setTicks(15);
  };

  return {
    isSimulating,
    setIsSimulating,
    ticks,
    setTicks,
    simTimerRef,
    handleStartSimulation,
    handlePauseSimulation,
    handleSimulateTick,
    handleSimulateRemainingInstant,
    handleSimulateInstant,
  };
}
