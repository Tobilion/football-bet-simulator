import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";
import { Fixture, CareerProfile } from "../types";
import { loadCareerProfile } from "../utils/careerUtils";

interface OwnerRevenueReport {
  revenue: number;
  fixtures: { fixtureId: string; baseIncome: number; bonus: number; result: "WIN" | "DRAW" | "LOSS"; scoreline: string }[];
  teamName: string;
}

interface GlobalEntity {
  type: "team" | "player";
  id: string;
}

interface UIContextValue {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  collapsedSlip: boolean;
  setCollapsedSlip: React.Dispatch<React.SetStateAction<boolean>>;
  showWalletModal: boolean;
  setShowWalletModal: React.Dispatch<React.SetStateAction<boolean>>;
  showWinnerCelebration: boolean;
  setShowWinnerCelebration: React.Dispatch<React.SetStateAction<boolean>>;
  ownerRevenueReport: OwnerRevenueReport | null;
  setOwnerRevenueReport: React.Dispatch<React.SetStateAction<OwnerRevenueReport | null>>;
  globalEntity: GlobalEntity | null;
  setGlobalEntity: React.Dispatch<React.SetStateAction<GlobalEntity | null>>;
  showHighlightsFixture: Fixture | null;
  setShowHighlightsFixture: React.Dispatch<React.SetStateAction<Fixture | null>>;
  betBuilderFixtureId: string | null;
  setBetBuilderFixtureId: React.Dispatch<React.SetStateAction<string | null>>;
  footysim2DId: string | null;
  setFootysim2DId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedFixtureId: string;
  setSelectedFixtureId: React.Dispatch<React.SetStateAction<string>>;
  booting: boolean;
  gateEntered: boolean;
  setGateEntered: React.Dispatch<React.SetStateAction<boolean>>;
  footysimSessionSeed: number;
  setFootysimSessionSeed: React.Dispatch<React.SetStateAction<number>>;
  careerProfile: CareerProfile;
  setCareerProfile: React.Dispatch<React.SetStateAction<CareerProfile>>;
}

const UIContext = createContext<UIContextValue | null>(null);

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUI must be used inside UIProvider");
  return ctx;
}

export function UIProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<string>("fixtures");
  const [collapsedSlip, setCollapsedSlip] = useState<boolean>(false);
  const [showWalletModal, setShowWalletModal] = useState<boolean>(false);
  const [showWinnerCelebration, setShowWinnerCelebration] = useState<boolean>(false);
  const [ownerRevenueReport, setOwnerRevenueReport] = useState<OwnerRevenueReport | null>(null);
  const [globalEntity, setGlobalEntity] = useState<GlobalEntity | null>(null);
  const [showHighlightsFixture, setShowHighlightsFixture] = useState<Fixture | null>(null);
  const [betBuilderFixtureId, setBetBuilderFixtureId] = useState<string | null>(null);
  const [footysim2DId, setFootysim2DId] = useState<string | null>(null);
  const [selectedFixtureId, setSelectedFixtureId] = useState<string>(
    () => localStorage.getItem("lastSelectedFixtureId") ?? "",
  );
  const [booting, setBooting] = useState<boolean>(true);
  const [gateEntered, setGateEntered] = useState<boolean>(false);
  const [footysimSessionSeed, setFootysimSessionSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const [careerProfile, setCareerProfile] = useState<CareerProfile>(() => loadCareerProfile());

  useEffect(() => {
    const t = setTimeout(() => setBooting(false), 900);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    localStorage.setItem("lastSelectedFixtureId", selectedFixtureId);
  }, [selectedFixtureId]);

  useEffect(() => {
    if (showWinnerCelebration) {
      setCareerProfile(loadCareerProfile());
    }
  }, [showWinnerCelebration]);

  const handleSetActiveTab = useCallback((tab: string) => setActiveTab(tab), []);

  const value: UIContextValue = {
    activeTab, setActiveTab: handleSetActiveTab,
    collapsedSlip, setCollapsedSlip,
    showWalletModal, setShowWalletModal,
    showWinnerCelebration, setShowWinnerCelebration,
    ownerRevenueReport, setOwnerRevenueReport,
    globalEntity, setGlobalEntity,
    showHighlightsFixture, setShowHighlightsFixture,
    betBuilderFixtureId, setBetBuilderFixtureId,
    footysim2DId, setFootysim2DId,
    selectedFixtureId, setSelectedFixtureId,
    booting, gateEntered, setGateEntered,
    footysimSessionSeed, setFootysimSessionSeed,
    careerProfile, setCareerProfile,
  };

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}