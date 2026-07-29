import { useEffect } from "react";
import { BetBuilderSelection } from "../types";
import { ROUND_LABELS } from "../data/tournament";
import { useProfile } from "../hooks/useProfile";
import { useSimulation } from "../hooks/useSimulation";
import { useBetting } from "../hooks/useBetting";
import { buildHandleAdvanceRound } from "../hooks/useRoundAdvance";
import { useTransferMarket } from "../hooks/useTransferMarket";
import { useChallenges } from "../hooks/useChallenges";
import { useGame } from "../context/GameContext";
import { useUI } from "../context/UIContext";

import { Header } from "./Header";
import { generateTransferListings } from "../engine/transferEngine";
import { BettingSlip } from "./BettingSlip";
import { LiveMatches } from "./LiveMatches";
import { FootysimMatchViewer } from "./FootysimMatchViewer";
import { FixturesOdds } from "./FixturesOdds";
import { MyBets } from "./MyBets";
import { TeamsList } from "./TeamsList";
import { Analytics } from "./Analytics";
import { TournamentBracket } from "./TournamentBracket";
import { Leaderboard } from "./Leaderboard";
import { LeagueStandings } from "./LeagueStandings";
import { CasinoSuite } from "./CasinoSuite";
import { VIPStore } from "./VIPStore";
import { ClubManager } from "./ClubManager";
import { SocialFeed } from "./SocialFeed";
import { TransferMarket } from "./TransferMarket";
import { BetBuilder } from "./BetBuilder";
import { Challenges } from "./Challenges";
import { CareerStats } from "./CareerStats";
import { WalletModal } from "./modals/WalletModal";
import { WinnerCelebrationModal } from "./modals/WinnerCelebrationModal";
import { OwnerRevenueModal } from "./modals/OwnerRevenueModal";
import { GlobalEntityPreviewModal } from "./modals/GlobalEntityPreviewModal";
import { MatchHighlightsModal } from "./modals/MatchHighlightsModal";
import { ToastContainer } from "./ui/Toast";

export default function Dashboard() {
  const {
    teams, setTeams, fixtures, setFixtures,
    tipsters, setTipsters, tipsterTickets, setTipsterTickets,
    gameMode, activeSlot,
    handleResetAndGenerate, handleStartNewCampaign, exitToMenu,
    handleResumeCampaign, handleDeleteSave, applyFootysimResult, getChampion,
  } = useGame();

  const {
    activeTab, setActiveTab,
    collapsedSlip, setCollapsedSlip,
    showWalletModal, setShowWalletModal,
    showWinnerCelebration, setShowWinnerCelebration,
    ownerRevenueReport, setOwnerRevenueReport,
    globalEntity, setGlobalEntity,
    showHighlightsFixture, setShowHighlightsFixture,
    betBuilderFixtureId, setBetBuilderFixtureId,
    footysim2DId, setFootysim2DId,
    selectedFixtureId, setSelectedFixtureId,
    footysimSessionSeed, setFootysimSessionSeed,
    careerProfile,
  } = useUI();

  const profileHook = useProfile({ gameMode, activeSlot, teams, setTeams, fixtures, tipsters, tipsterTickets });
  const { userProfile, setUserProfile, persist } = profileHook;

  const transferMarketHook = useTransferMarket({ userProfile, setUserProfile, persist, teams });
  const { transferListings, setTransferListings, userBids, setUserBids, transferToast, handlePlaceUserBid, handleWithdrawBid, handleRefreshListings, showTransferToast } = transferMarketHook;

  const simHook = useSimulation({ teams, userProfile, gameMode, activeSlot, fixtures, setFixtures, setActiveTab });
  const { isSimulating, ticks, setTicks, setIsSimulating } = simHook;

  const challengesHook = useChallenges({ userProfile, setUserProfile, persist });

  const bettingHook = useBetting({ userProfile, setUserProfile, fixtures, teams, tipsters, tipsterTickets, gameMode, activeSlot, setCollapsedSlip });
  const { selectedBets, setSelectedBets } = bettingHook;

  const handleAdvanceRound = buildHandleAdvanceRound({
    gameMode, activeSlot, userProfile, teams, fixtures, tipsters, tipsterTickets,
    isSimulating, transferListings, userBids,
    setUserProfile, setTeams, setFixtures, setTipsters, setTipsterTickets,
    setSelectedBets, setTicks, setActiveTab,
    setShowWinnerCelebration, setOwnerRevenueReport,
    setTransferListings, setUserBids,
    onTransferToast: showTransferToast,
  });

  // ─── Effects ──────────────────────────────────────────────────────
  useEffect(() => { bettingHook.settleFinishedTickets(); }, [fixtures]);

  useEffect(() => {
    const handleOpenEntity = (e: Event) => {
      const ev = e as CustomEvent<{ type: "team" | "player"; id: string }>;
      if (ev.detail) setGlobalEntity(ev.detail);
    };
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setGlobalEntity(null); };
    window.addEventListener("open-global-entity", handleOpenEntity);
    window.addEventListener("keydown", handleKeyDown);
    return () => { window.removeEventListener("open-global-entity", handleOpenEntity); window.removeEventListener("keydown", handleKeyDown); };
  }, []);

  useEffect(() => {
    const handleOpenHighlights = (e: Event) => {
      const ev = e as CustomEvent<{ fixtureId: string }>;
      if (!ev.detail) return;
      const fx = fixtures.find((f) => f.id === ev.detail.fixtureId);
      if (fx) setShowHighlightsFixture(fx);
    };
    window.addEventListener("open-highlights", handleOpenHighlights);
    return () => window.removeEventListener("open-highlights", handleOpenHighlights);
  }, [fixtures]);

  useEffect(() => {
    if (!userProfile || fixtures.length === 0) return;
    const roundFixtures = fixtures.filter((f) => f.roundIndex === userProfile.currentRoundIndex);
    if (roundFixtures.length === 0) return;
    const isValid = roundFixtures.some((f) => f.id === selectedFixtureId);
    if (!isValid) {
      const first = roundFixtures.find((f) => f.status !== "FT") || roundFixtures[0];
      setSelectedFixtureId(first.id);
    }
  }, [userProfile?.currentRoundIndex, fixtures, selectedFixtureId]);

  useEffect(() => {
    if (!userProfile) return;
    const last = userProfile.bankrollHistory?.[userProfile.bankrollHistory.length - 1];
    if (!last || Math.abs(last.balance - userProfile.balance) > 0.01) {
      setUserProfile((prev) => {
        if (!prev) return prev;
        return { ...prev, bankrollHistory: [...(prev.bankrollHistory || []), { timestamp: Date.now(), balance: prev.balance, detail: "Update" }] };
      });
    }
  }, [userProfile?.balance]);

  useEffect(() => {
    if (!gameMode || !userProfile) return;
    const newListings = generateTransferListings(teams, userProfile.currentRoundIndex, transferListings);
    if (newListings) setTransferListings(newListings);
  }, [userProfile?.currentRoundIndex, teams]);

  const champion = getChampion();
  const currentRoundLabel = gameMode === "LEAGUE"
    ? `Matchday ${(userProfile?.currentRoundIndex ?? 0) + 1}`
    : ROUND_LABELS[userProfile?.currentRoundIndex || 0] || `Round ${(userProfile?.currentRoundIndex ?? 0) + 1}`;

  const handleBBPlace = async (sels: BetBuilderSelection[], stake: number, odds: number) => {
    if (!betBuilderFixtureId) return;
    const ok = await bettingHook.handlePlaceBetBuilder(betBuilderFixtureId, sels, stake, odds);
    if (ok) setBetBuilderFixtureId(null);
  };

  const hideSlip = ["casino", "store", "feed", "myclub", "transfers"].includes(activeTab);

  if (!userProfile) return null;

  return (
    <div id="app" className="h-screen w-screen bg-gradient-to-br from-[#0b0e14] via-[#05070a] to-[#121620] text-slate-100 flex flex-col overflow-hidden font-sans animate-fade-in">
      <Header
        activeTab={activeTab} setActiveTab={setActiveTab}
        username={userProfile.username} balance={userProfile.balance}
        addFunds={() => setShowWalletModal(true)}
        resetTournament={handleResetAndGenerate}
        currentRoundLabel={currentRoundLabel}
        gameMode={gameMode} exitToMenu={exitToMenu}
        hasOwnedClub={!!userProfile.ownedTeamId}
      />

      <div id="workspace-split" className="flex flex-1 min-h-0 overflow-hidden relative">
        <main className="flex-1 min-h-0 flex flex-col overflow-hidden bg-transparent">
          {activeTab === "live" && (
            <LiveMatches
              fixtures={fixtures} teams={teams}
              roundIndex={userProfile.currentRoundIndex}
              currentRoundLabel={currentRoundLabel}
              isSimulating={isSimulating}
              onStartSimulation={simHook.handleStartSimulation}
              onPauseSimulation={simHook.handlePauseSimulation}
              onSimulateTick={simHook.handleSimulateTick}
              onSimulateInstant={simHook.handleSimulateInstant}
              onSimulateRemainingInstant={simHook.handleSimulateRemainingInstant}
              onAdvanceRound={handleAdvanceRound} ticks={ticks}
              selectedFixtureId={selectedFixtureId} setSelectedFixtureId={setSelectedFixtureId}
              selectedBets={selectedBets}
              onAddBetSelection={bettingHook.handleAddBetSelection}
              onRemoveSelection={bettingHook.handleRemoveSelection}
              ownedTeamId={userProfile.ownedTeamId}
              onWatch2D={setFootysim2DId}
            />
          )}
          {activeTab === "fixtures" && (
            <FixturesOdds
              fixtures={fixtures} teams={teams}
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
              tickets={userProfile.tickets} fixtures={fixtures} teams={teams}
              balance={userProfile.balance}
              onCashOut={bettingHook.handleCashOut}
              betBuilderTickets={userProfile.betBuilderTickets || []}
              challengesSlot={<Challenges challenges={challengesHook.activeChallenges} currentRoundIndex={userProfile.currentRoundIndex} onClaim={challengesHook.handleClaimChallenge} onDismiss={challengesHook.handleDismissChallenge} />}
            />
          )}
          {activeTab === "teams" && <TeamsList teams={teams} fixtures={fixtures} />}
          {activeTab === "analytics" && <Analytics teams={teams} fixtures={fixtures} userProfile={userProfile} />}
          {activeTab === "tournament" && (
            gameMode === "LEAGUE"
              ? <LeagueStandings teams={teams} fixtures={fixtures} currentRoundIndex={userProfile.currentRoundIndex} />
              : <TournamentBracket fixtures={fixtures} teams={teams} />
          )}
          {activeTab === "career" && <CareerStats career={careerProfile} liveProfile={userProfile} gameMode={gameMode} />}
          {activeTab === "leaderboard" && (
            <Leaderboard tipsters={tipsters} userBalance={userProfile.balance} username={userProfile.username} tickets={userProfile.tickets} />
          )}
          {activeTab === "casino" && (
            <CasinoSuite balance={userProfile.balance} onUpdateBalance={profileHook.handleUpdateBalanceCasino} username={userProfile.username} />
          )}
          {activeTab === "store" && (
            <VIPStore
              balance={userProfile.balance} purchasedItems={userProfile.purchasedItems || []}
              onPurchase={profileHook.handlePurchaseVIPItem} onLiquidate={profileHook.handleLiquidateVIPItem}
              teams={teams} ownedTeamId={userProfile.ownedTeamId} ownedTeamIds={userProfile.ownedTeamIds}
              onRenameStadium={profileHook.handleRenameStadium} onBoostRatings={profileHook.handleBoostClubRatings}
            />
          )}
          {activeTab === "myclub" && userProfile.ownedTeamId && (
            <ClubManager
              ownedTeamId={userProfile.ownedTeamId} ownedTeamIds={userProfile.ownedTeamIds}
              teams={teams} balance={userProfile.balance}
              onUpdateOwnership={profileHook.handleUpdateClubOwnership} onUpgradeFacility={profileHook.handleUpgradeFacility}
              onUpdateBalance={(delta) => { if (userProfile) { const next = { ...userProfile, balance: Math.max(0, (userProfile.balance ?? 0) + delta) }; setUserProfile(next); persist(next); }}}
            />
          )}
          {activeTab === "transfers" && userProfile.ownedTeamId && (
            <TransferMarket
              listings={transferListings} teams={teams}
              ownedTeamId={userProfile.ownedTeamId} ownedTeamIds={userProfile.ownedTeamIds}
              currentRoundIndex={userProfile.currentRoundIndex}
              balance={userProfile.balance} userBids={userBids}
              onPlaceBid={handlePlaceUserBid} onWithdrawBid={handleWithdrawBid}
              onRefresh={() => handleRefreshListings(teams, userProfile.currentRoundIndex)}
            />
          )}
          {activeTab === "feed" && <SocialFeed fixtures={fixtures} teams={teams} roundLabel={currentRoundLabel} />}
        </main>

        {!hideSlip && (
          <BettingSlip
            selections={selectedBets} fixtures={fixtures} teams={teams}
            currentRoundIndex={userProfile.currentRoundIndex}
            onRemoveSelection={bettingHook.handleRemoveSelection}
            onClearAll={bettingHook.handleClearAllSelections}
            balance={userProfile.balance} onPlaceBet={bettingHook.handlePlaceBet}
            collapsed={collapsedSlip} setCollapsed={setCollapsedSlip}
            onAddSelections={bettingHook.handleAddMultipleSelections}
          />
        )}
      </div>

      {transferToast && showTransferToast && <div className="fixed bottom-4 left-4 z-50 bg-slate-800 text-xs px-3 py-2 rounded-xl border border-white/10">{transferToast}</div>}
      {showWalletModal && <WalletModal balance={userProfile.balance} onConfirmTransaction={profileHook.handleConfirmWalletTransaction} onClose={() => setShowWalletModal(false)} />}
      {showWinnerCelebration && <WinnerCelebrationModal gameMode={gameMode} balance={userProfile.balance} championName={champion.name} championCrest={champion.crest} onClose={() => setShowWinnerCelebration(false)} onResetRound={handleResetAndGenerate} />}
      {ownerRevenueReport && <OwnerRevenueModal teamName={ownerRevenueReport.teamName} revenue={ownerRevenueReport.revenue} fixtures={ownerRevenueReport.fixtures} onClose={() => setOwnerRevenueReport(null)} />}
      {globalEntity && <GlobalEntityPreviewModal globalEntity={globalEntity} teams={teams} onClose={() => setGlobalEntity(null)} onChangeEntity={(e) => setGlobalEntity(e)} onNavigateToTeams={() => { setGlobalEntity(null); setActiveTab("teams"); }} />}
      {betBuilderFixtureId && (() => { const bb = fixtures.find(f => f.id === betBuilderFixtureId); return bb ? <BetBuilder fixture={bb} teams={teams} balance={userProfile.balance} onPlace={handleBBPlace} onClose={() => setBetBuilderFixtureId(null)} /> : null; })()}
      {showHighlightsFixture && <MatchHighlightsModal fixture={showHighlightsFixture} teams={teams} onClose={() => setShowHighlightsFixture(null)} />}
      {footysim2DId && (() => {
        const fx = fixtures.find(f => f.id === footysim2DId);
        if (!fx) return null;
        const home = teams.find(t => t.id === fx.homeTeamId);
        const away = teams.find(t => t.id === fx.awayTeamId);
        if (!home || !away) return null;
        return (
          <FootysimMatchViewer
            homeTeam={home} awayTeam={away}
            seed={((fx.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) + userProfile.currentRoundIndex * 31) ^ footysimSessionSeed) >>> 0}
            knockout={gameMode === "TOURNAMENT"}
            onClose={() => setFootysim2DId(null)}
            onApply={(m) => { applyFootysimResult(fx.id, m); setFootysimSessionSeed(Math.floor(Math.random() * 1e9)); }}
          />
        );
      })()}
      <ToastContainer />
    </div>
  );
}