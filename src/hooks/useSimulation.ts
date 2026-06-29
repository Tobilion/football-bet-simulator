import { useState, useRef } from "react";
import { Team, Fixture, Profile } from "../types";
import { simulateMatchTick, simulateFullMatchInstantly } from "../engine/matchEngine";
import { getKeysForMode } from "../utils/storage";
import { addToast } from "../hooks/useToast";

interface UseSimulationDeps {
  teams: Team[];
  userProfile: Profile | null;
  gameMode: "TOURNAMENT" | "LEAGUE" | null;
  activeSlot: number;
  setFixtures: React.Dispatch<React.SetStateAction<Fixture[]>>;
  setActiveTab: (tab: string) => void;
}

export function useSimulation(deps: UseSimulationDeps) {
  const { teams, userProfile, gameMode, activeSlot, setFixtures, setActiveTab } = deps;

  const [isSimulating, setIsSimulating] = useState(false);
  const [ticks, setTicks] = useState(0);
  const simTimerRef = useRef<NodeJS.Timeout | null>(null);

  const saveFixtures = (list: Fixture[]) => {
    if (gameMode) {
      localStorage.setItem(
        getKeysForMode(gameMode, activeSlot).fixtures,
        JSON.stringify(list),
      );
    }
  };

  const handleStartSimulation = (speedMs: number, watchedId: string) => {
    if (!userProfile) return;
    setIsSimulating(true);
    setActiveTab("live");

    // If already at halftime tick, mark as resume
    setFixtures((prevFixtures) => {
      const watchedFixCheck = prevFixtures.find((f) => f.id === watchedId);
      if (watchedFixCheck && watchedFixCheck.elapsedTicks === 7) {
        sessionStorage.setItem(`ht_resume_${watchedId}`, "true");
      }
      return prevFixtures;
    });

    if (simTimerRef.current) clearInterval(simTimerRef.current);

    simTimerRef.current = setInterval(() => {
      setFixtures((prevFixtures) => {
        const teamMap = new Map<string, Team>(teams.map((t) => [t.id, t]));
        const watchedFix = prevFixtures.find((f) => f.id === watchedId);

        if (!watchedFix || watchedFix.status === "FT") {
          setIsSimulating(false);
          if (simTimerRef.current) clearInterval(simTimerRef.current);
          return prevFixtures;
        }

        const htResumeKey = `ht_resume_${watchedId}`;
        if (
          watchedFix.elapsedTicks === 7 &&
          sessionStorage.getItem(htResumeKey) !== "true"
        ) {
          setIsSimulating(false);
          if (simTimerRef.current) clearInterval(simTimerRef.current);
          window.dispatchEvent(
            new CustomEvent("halftime-pause", { detail: { matchId: watchedId } }),
          );
          return prevFixtures;
        }

        const nextTick = watchedFix.elapsedTicks + 1;
        if (nextTick > 20) {
          setIsSimulating(false);
          if (simTimerRef.current) clearInterval(simTimerRef.current);
          return prevFixtures;
        }

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

        // Fire goal toasts for new events
        const newWatched = updatedList.find((f) => f.id === watchedId);
        (newWatched?.events ?? []).slice(watchedFix.events?.length ?? 0).forEach((ev) => {
          if (ev.type === "GOAL") {
            const scorer = teams.flatMap((t) => (t.players ?? []).map((p) => ({ name: p.name, teamName: t.shortName, id: p.id }))).find((p) => p.id === ev.playerId);
            addToast({ type: "goal", title: "⚽ GOAL!", message: scorer ? `${scorer.name} scores for ${scorer.teamName}!` : "Goal scored!", duration: 5000 });
          }
        });

        saveFixtures(updatedList);

        if (isNowFT) {
          setIsSimulating(false);
          if (simTimerRef.current) clearInterval(simTimerRef.current);
        }
        setTicks(nextTick);
        return updatedList;
      });
    }, speedMs);
  };

  const handlePauseSimulation = () => {
    setIsSimulating(false);
    if (simTimerRef.current) clearInterval(simTimerRef.current);
  };

  const handleSimulateTick = (watchedId: string) => {
    if (!userProfile || isSimulating) return;
    setFixtures((prevFixtures) => {
      const watchedFix = prevFixtures.find((f) => f.id === watchedId);
      if (!watchedFix || watchedFix.status === "FT") return prevFixtures;

      if (watchedFix.elapsedTicks === 7) {
        sessionStorage.setItem(`ht_resume_${watchedId}`, "true");
      }

      const nextTick = watchedFix.elapsedTicks + 1;
      if (nextTick > 20) return prevFixtures;

      const teamMap = new Map<string, Team>(teams.map((t) => [t.id, t]));
      const updatedList = prevFixtures.map((f) => {
        if (f.id === watchedId && (f.status === "SCHEDULED" || f.status === "LIVE")) {
          const hTeam = teamMap.get(f.homeTeamId)!;
          const aTeam = teamMap.get(f.awayTeamId)!;
          return simulateMatchTick(f, hTeam, aTeam, nextTick);
        }
        return f;
      });

      // Fire goal toasts for new events
      const tickNewWatched = updatedList.find((f) => f.id === watchedId);
      (tickNewWatched?.events ?? []).slice(watchedFix.events?.length ?? 0).forEach((ev) => {
        if (ev.type === "GOAL") {
          const scorer = teams.flatMap((t) => (t.players ?? []).map((p) => ({ name: p.name, teamName: t.shortName, id: p.id }))).find((p) => p.id === ev.playerId);
          addToast({ type: "goal", title: "⚽ GOAL!", message: scorer ? `${scorer.name} scores for ${scorer.teamName}!` : "Goal scored!", duration: 5000 });
        }
      });

      saveFixtures(updatedList);
      setTicks(nextTick);
      return updatedList;
    });
  };

  const handleSimulateRemainingInstant = (watchedId: string) => {
    if (!userProfile || isSimulating) return;
    setFixtures((prevFixtures) => {
      const teamMap = new Map<string, Team>(teams.map((t) => [t.id, t]));
      const updatedList = prevFixtures.map((f) => {
        if (
          f.roundIndex === userProfile.currentRoundIndex &&
          f.id !== watchedId &&
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
      saveFixtures(updatedList);
      return updatedList;
    });
  };

  const handleSimulateInstant = () => {
    if (!userProfile || isSimulating) return;
    setFixtures((prevFixtures) => {
      const teamMap = new Map<string, Team>(teams.map((t) => [t.id, t]));
      const updatedList = prevFixtures.map((f) => {
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
      saveFixtures(updatedList);
      setTicks(15);
      return updatedList;
    });
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
