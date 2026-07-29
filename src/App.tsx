import { useState, useEffect } from "react";
import { SplashGate } from "./components/SplashGate";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { OnboardingOverlay } from "./components/OnboardingOverlay";
import { ToastContainer } from "./components/ui/Toast";
import Dashboard from "./components/Dashboard";
import { GameProvider, useGame } from "./context/GameContext";
import { UIProvider, useUI } from "./context/UIContext";

export default function App() {
  return (
    <GameProvider>
      <UIProvider>
        <AppContent />
      </UIProvider>
    </GameProvider>
  );
}

function AppContent() {
  const { gameMode, handleStartNewCampaign, handleResumeCampaign, handleDeleteSave } = useGame();
  const { booting, gateEntered, setGateEntered } = useUI();

  const [showOnboarding] = useState(() => localStorage.getItem("cubet_onboarded") !== "true");

  const savedTournaments = [0, 1, 2].map((i) => {
    try { return !!localStorage.getItem(`fs_profile_v3_tournament_slot${i + 1}`); } catch { return false; }
  });
  const savedLeagues = [0, 1, 2].map((i) => {
    try { return !!localStorage.getItem(`fs_profile_v3_league_slot${i + 1}`); } catch { return false; }
  });

  if (booting) {
    return (
      <div className="min-h-screen bg-[#05070a] flex flex-col items-center justify-center gap-5">
        <div className="text-3xl font-black tracking-widest text-emerald-400">MATCHDAY EXCHANGE</div>
        <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full w-3/4 bg-emerald-400 rounded-full animate-pulse" />
        </div>
        <div className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">Loading matchday...</div>
      </div>
    );
  }

  if (!gateEntered) return <SplashGate onEnter={() => setGateEntered(true)} />;

  if (!gameMode) {
    return (
      <>
        {showOnboarding && <OnboardingOverlay onEnter={() => {}} />}
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

  return <Dashboard />;
}