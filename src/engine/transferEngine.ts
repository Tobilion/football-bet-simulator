import { Team, Player, TransferListing, Profile } from "../types";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function uid() {
  return `tr-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

/** Age-based value multiplier. Peak at 24-28. */
function ageFactor(age: number): number {
  if (age < 18) return 0.65;
  if (age < 21) return 0.80;
  if (age < 24) return 0.92;
  if (age <= 28) return 1.0;
  if (age <= 31) return 0.88;
  if (age <= 34) return 0.72;
  return 0.55;
}

/** Morale boost: teams with morale > 70 have slightly higher value players */
function moraleFactor(morale: number): number {
  return 0.9 + (morale / 100) * 0.2;
}

/** Base value from overall rating + season performance */
export function calculatePlayerValue(player: Player, team: Team): number {
  const overall = player.abilities?.passing
    ? Math.round(
        (
          (player.abilities.pace ?? 60) +
          (player.abilities.shooting ?? 60) +
          (player.abilities.passing ?? 60) +
          (player.abilities.dribbling ?? 60) +
          (player.abilities.defending ?? 60) +
          (player.abilities.physical ?? 60)
        ) / 6,
      )
    : player.rating;

  const base = overall * 800;
  const goals = (player.seasonStats?.goalsScored ?? player.goals ?? 0);
  const assists = (player.seasonStats?.assists ?? player.assists ?? 0);
  const performanceBonus = goals * 50_000 + assists * 20_000;

  return Math.round(base * ageFactor(player.age) * moraleFactor(team.morale) + performanceBonus);
}

// ──────────────────────────────────────────────
// Generate listings at start of each round
// ──────────────────────────────────────────────

export function generateTransferListings(
  teams: Team[],
  roundIndex: number,
  existingListings: TransferListing[],
): TransferListing[] {
  // Expire old listings
  const active = existingListings.map((l) =>
    l.status === "OPEN" && roundIndex >= l.expiresAtRound
      ? { ...l, status: "EXPIRED" as const }
      : l,
  );

  const openCount = active.filter((l) => l.status === "OPEN").length;
  // Keep 3-6 open listings at any time
  const target = 3 + Math.floor(Math.random() * 4);
  const needed = Math.max(0, target - openCount);
  if (needed === 0) return active;

  // Pool of listable players (AI teams only, not the owned team)
  const pool: { player: Player; team: Team }[] = [];
  for (const team of teams) {
    if (team.ownership) continue; // skip user-owned club
    for (const player of team.players) {
      if (player.injured) continue;
      pool.push({ player, team });
    }
  }

  if (pool.length === 0) return active;

  // Pick random players, no duplicates with existing open listings
  const listedPlayerIds = new Set(
    active.filter((l) => l.status === "OPEN").map((l) => l.playerId),
  );

  const shuffled = pool
    .filter((p) => !listedPlayerIds.has(p.player.id))
    .sort(() => Math.random() - 0.5)
    .slice(0, needed);

  const newListings: TransferListing[] = shuffled.map(({ player, team }) => {
    const value = calculatePlayerValue(player, team);
    return {
      id: uid(),
      playerId: player.id,
      fromTeamId: team.id,
      askingPrice: Math.round(value * (0.85 + Math.random() * 0.3)),
      listedAtRound: roundIndex,
      expiresAtRound: roundIndex + 2,
      status: "OPEN",
      bids: generateAIBids(team, value),
    };
  });

  return [...active, ...newListings];
}

/** AI clubs make initial bids based on team rating */
function generateAIBids(
  listedTeam: Team,
  value: number,
): TransferListing["bids"] {
  // 1-2 AI clubs bid
  const numBidders = Math.floor(Math.random() * 2) + 1;
  const bids: TransferListing["bids"] = [];
  for (let i = 0; i < numBidders; i++) {
    const bidderId = `ai-bidder-${i}`;
    const amount = Math.round(value * (0.75 + Math.random() * 0.35));
    bids.push({ bidderId, amount });
  }
  return bids;
}

// ──────────────────────────────────────────────
// Resolve auctions after round advance
// ──────────────────────────────────────────────

interface ResolveResult {
  resolvedListings: TransferListing[];
  toastMessage: string;
}

export function resolveTransferAuctions(
  listings: TransferListing[],
  teams: Team[],
  userProfile: Profile,
  userBid: { listingId: string; amount: number } | null,
): ResolveResult {
  const toasts: string[] = [];

  const resolvedListings = listings.map((listing) => {
    if (listing.status !== "OPEN") return listing;

    // Merge user bid if applicable
    const allBids = [...listing.bids];
    if (userBid && userBid.listingId === listing.id) {
      allBids.push({ bidderId: "USER", amount: userBid.amount });
    }

    if (allBids.length === 0) {
      return { ...listing, status: "EXPIRED" as const };
    }

    // Highest bid wins
    const winning = allBids.reduce((best, b) =>
      b.amount > best.amount ? b : best,
    );

    const isUserWin = winning.bidderId === "USER";

    // Find player name for toast
    let playerName = "Player";
    for (const team of teams) {
      const p = team.players.find((pl) => pl.id === listing.playerId);
      if (p) { playerName = p.name; break; }
    }

    if (isUserWin) {
      const canAfford = userProfile.balance >= winning.amount;
      if (!canAfford) {
        toasts.push(`Could not sign ${playerName} — insufficient funds.`);
        return { ...listing, status: "EXPIRED" as const };
      }
      toasts.push(`You signed ${playerName} for $${winning.amount.toLocaleString()}!`);
    }

    return {
      ...listing,
      status: "SOLD" as const,
      highestBidder: winning.bidderId,
      finalPrice: winning.amount,
    };
  });

  return {
    resolvedListings,
    toastMessage: toasts.join(" | "),
  };
}

// ──────────────────────────────────────────────
// Apply transfer results — move players between teams
// ──────────────────────────────────────────────

export function applyTransferResultsToTeams(
  teams: Team[],
  resolvedListings: TransferListing[],
): Team[] {
  let updatedTeams = teams.map((t) => ({ ...t, players: [...t.players] }));

  for (const listing of resolvedListings) {
    if (listing.status !== "SOLD" || !listing.highestBidder || !listing.finalPrice) continue;

    const sourceTeam = updatedTeams.find((t) => t.id === listing.fromTeamId);
    if (!sourceTeam) continue;

    const player = sourceTeam.players.find((p) => p.id === listing.playerId);
    if (!player) continue;

    const destinationTeamId =
      listing.highestBidder === "USER"
        ? null // will be the user's owned team — handled below
        : `ai-dest-${listing.highestBidder}`; // conceptual AI dest, mapped below

    // For AI-to-AI transfers, just remove from source (no team to add to)
    // For user wins, move to user's ownedTeamId
    if (listing.highestBidder === "USER") {
      // Remove from source
      updatedTeams = updatedTeams.map((t) =>
        t.id === listing.fromTeamId
          ? { ...t, players: t.players.filter((p) => p.id !== listing.playerId) }
          : t,
      );
      // We'll need ownedTeamId — return as-is here; App.tsx injects it
      // Store the player in a placeholder via the listing metadata — handled by useTransferMarket
    } else {
      // AI-to-AI: remove from source team only (no effect on user)
      updatedTeams = updatedTeams.map((t) =>
        t.id === listing.fromTeamId
          ? { ...t, players: t.players.filter((p) => p.id !== listing.playerId) }
          : t,
      );
    }

    void destinationTeamId; // suppress unused var warning
  }

  return updatedTeams;
}

/**
 * Move won players into user's owned team.
 * Called after resolveTransferAuctions when the user won one or more listings.
 */
export function applyUserWinsToOwnedTeam(
  teams: Team[],
  resolvedListings: TransferListing[],
  ownedTeamId: string,
): Team[] {
  let updatedTeams = teams.map((t) => ({ ...t, players: [...t.players] }));

  for (const listing of resolvedListings) {
    if (listing.status !== "SOLD" || listing.highestBidder !== "USER") continue;

    // Find the player from source team (it was already removed by applyTransferResultsToTeams)
    // We need the original teams to find the player, but here we reconstruct from listing
    // This function should be called BEFORE applyTransferResultsToTeams removes from source
    const sourceTeam = teams.find((t) => t.id === listing.fromTeamId);
    if (!sourceTeam) continue;
    const player = sourceTeam.players.find((p) => p.id === listing.playerId);
    if (!player) continue;

    // Add player to owned team
    const updatedPlayer = { ...player, teamId: ownedTeamId };
    updatedTeams = updatedTeams.map((t) =>
      t.id === ownedTeamId
        ? { ...t, players: [...t.players, updatedPlayer] }
        : t.id === listing.fromTeamId
        ? { ...t, players: t.players.filter((p) => p.id !== listing.playerId) }
        : t,
    );
  }

  return updatedTeams;
}
