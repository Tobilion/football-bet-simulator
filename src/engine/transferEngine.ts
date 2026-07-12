import { Team, Player, TransferListing, Profile, ClubOwnership } from "../types";

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

// Target size of the open transfer window and how it splits across positions.
const WINDOW_TARGET = 16;
const POSITION_QUOTA: Record<string, number> = { GK: 2, DEF: 5, MID: 5, ATT: 4 };

/** Builds a position-balanced set of `count`-ish listings from the pool. */
function pickBalancedListings(
  pool: { player: Player; team: Team }[],
  quota: Record<string, number>,
  roundIndex: number,
  teams: Team[],
): TransferListing[] {
  const byPos: Record<string, { player: Player; team: Team }[]> = { GK: [], DEF: [], MID: [], ATT: [] };
  pool.forEach((p) => { (byPos[p.player.position] ??= []).push(p); });
  Object.values(byPos).forEach((arr) => arr.sort(() => Math.random() - 0.5));

  const chosen: { player: Player; team: Team }[] = [];
  Object.entries(quota).forEach(([pos, n]) => {
    chosen.push(...(byPos[pos] ?? []).slice(0, n));
  });
  // Backfill from any leftover players if a position was short, to hit the target.
  if (chosen.length < WINDOW_TARGET) {
    const chosenIds = new Set(chosen.map((c) => c.player.id));
    const leftover = pool.filter((p) => !chosenIds.has(p.player.id)).sort(() => Math.random() - 0.5);
    chosen.push(...leftover.slice(0, WINDOW_TARGET - chosen.length));
  }

  return chosen.map(({ player, team }) => {
    const value = calculatePlayerValue(player, team);
    return {
      id: uid(),
      playerId: player.id,
      fromTeamId: team.id,
      askingPrice: Math.round(value * (0.85 + Math.random() * 0.3)),
      listedAtRound: roundIndex,
      expiresAtRound: roundIndex + 2,
      status: "OPEN" as const,
      bids: generateAIBids(team, value, teams),
    };
  });
}

/** Listable players: AI teams only (not the user's club), fit, and not already listed. */
function buildTransferPool(
  teams: Team[],
  excludePlayerIds: Set<string>,
): { player: Player; team: Team }[] {
  const pool: { player: Player; team: Team }[] = [];
  for (const team of teams) {
    if (team.ownership) continue; // skip user-owned club (incl. already-bought players)
    for (const player of team.players) {
      if (player.injured) continue;
      if (excludePlayerIds.has(player.id)) continue;
      pool.push({ player, team });
    }
  }
  return pool;
}

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

  const openListings = active.filter((l) => l.status === "OPEN");
  const needed = Math.max(0, WINDOW_TARGET - openListings.length);
  if (needed === 0) return active;

  // Per-position shortfall relative to the quota, so top-ups stay balanced.
  const openByPos: Record<string, number> = { GK: 0, DEF: 0, MID: 0, ATT: 0 };
  const posOfPlayer = (id: string) => {
    for (const t of teams) { const p = t.players.find((pl) => pl.id === id); if (p) return p.position; }
    return null;
  };
  openListings.forEach((l) => { const pos = posOfPlayer(l.playerId); if (pos) openByPos[pos]++; });
  const shortfall: Record<string, number> = {};
  Object.entries(POSITION_QUOTA).forEach(([pos, q]) => { shortfall[pos] = Math.max(0, q - (openByPos[pos] ?? 0)); });

  const listedIds = new Set(openListings.map((l) => l.playerId));
  const pool = buildTransferPool(teams, listedIds);
  if (pool.length === 0) return active;

  const newListings = pickBalancedListings(pool, shortfall, roundIndex, teams);
  return [...active, ...newListings];
}

/**
 * Produces a brand-new window on demand (the "Refresh list" action). Current
 * open listings the user hasn't bid on are cleared and replaced with a fresh,
 * position-balanced set. Players the user has already bought (now on the owned
 * club) are naturally excluded, and any listing with an active user bid is kept.
 */
export function refreshTransferListings(
  teams: Team[],
  roundIndex: number,
  existingListings: TransferListing[],
  protectedListingIds: Set<string> = new Set(),
): TransferListing[] {
  const kept = existingListings.map((l) =>
    l.status === "OPEN" && !protectedListingIds.has(l.id)
      ? { ...l, status: "EXPIRED" as const }
      : l,
  );
  const stillOpen = kept.filter((l) => l.status === "OPEN");
  const listedIds = new Set(stillOpen.map((l) => l.playerId));
  const pool = buildTransferPool(teams, listedIds);
  if (pool.length === 0) return kept;

  const remainingQuota: Record<string, number> = { ...POSITION_QUOTA };
  const newListings = pickBalancedListings(pool, remainingQuota, roundIndex, teams);
  return [...kept, ...newListings];
}

/** AI clubs make initial bids. Bidders are REAL rival clubs so the player actually moves
 *  to a real squad on sale (previously used fake "ai-bidder-N" ids and the player vanished). */
function generateAIBids(
  listedTeam: Team,
  value: number,
  teams: Team[],
): TransferListing["bids"] {
  const buyers = teams.filter((t) => t.id !== listedTeam.id && !t.ownership);
  if (buyers.length === 0) return [];
  const numBidders = Math.min(buyers.length, Math.floor(Math.random() * 2) + 1);
  const chosen = [...buyers].sort(() => Math.random() - 0.5).slice(0, numBidders);
  return chosen.map((b) => ({
    bidderId: b.id,
    amount: Math.round(value * (0.75 + Math.random() * 0.35)),
  }));
}

/** Slot a new signing into the owner's XI: fill an empty slot, or bump the weakest
 *  same-position starter (else the weakest starter) if the signing is an upgrade. */
function integrateSigningIntoXI(ownership: ClubOwnership, signing: Player, squad: Player[]): ClubOwnership {
  const starters = ownership.starterIds ?? [];
  if (starters.includes(signing.id)) return ownership;
  if (starters.length < 11) return { ...ownership, starterIds: [...starters, signing.id] };
  const starterPlayers = starters
    .map((id) => squad.find((p) => p.id === id))
    .filter((p): p is Player => !!p);
  if (starterPlayers.length === 0) return ownership;
  const samePos = starterPlayers.filter((p) => p.position === signing.position);
  const pool = samePos.length > 0 ? samePos : starterPlayers;
  const weakest = pool.reduce((min, p) => (p.rating < min.rating ? p : min), pool[0]);
  if (signing.rating > weakest.rating) {
    return { ...ownership, starterIds: starters.map((id) => (id === weakest.id ? signing.id : id)) };
  }
  return ownership;
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
  userBids: { listingId: string; amount: number }[],
): ResolveResult {
  const toasts: string[] = [];

  const resolvedListings = listings.map((listing) => {
    if (listing.status !== "OPEN") return listing;

    // Merge user bid if applicable
    const allBids = [...listing.bids];
    const uBid = userBids.find((b) => b.listingId === listing.id);
    if (uBid) {
      allBids.push({ bidderId: "USER", amount: uBid.amount });
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
  ownedTeamId?: string,
): Team[] {
  let updatedTeams = teams.map((t) => ({ ...t, players: [...t.players] }));

  for (const listing of resolvedListings) {
    if (listing.status !== "SOLD" || !listing.highestBidder || !listing.finalPrice) continue;

    const sourceTeam = updatedTeams.find((t) => t.id === listing.fromTeamId);
    if (!sourceTeam) continue;

    const player = sourceTeam.players.find((p) => p.id === listing.playerId);
    if (!player) continue;

    // Resolve the destination: the user's owned club for USER wins, otherwise the
    // real rival club that placed the winning bid.
    const destId = listing.highestBidder === "USER" ? ownedTeamId : listing.highestBidder;
    const destTeam = destId ? updatedTeams.find((t) => t.id === destId) : undefined;

    // If we can't resolve a real destination (or it's the same club), leave the player
    // where they are — never silently delete a player from the game.
    if (!destTeam || destTeam.id === listing.fromTeamId) continue;

    const moved: Player = { ...player, teamId: destTeam.id };
    updatedTeams = updatedTeams.map((t) => {
      if (t.id === listing.fromTeamId) {
        return { ...t, players: t.players.filter((p) => p.id !== listing.playerId) };
      }
      if (t.id === destTeam.id) {
        const players = [...t.players, moved];
        const ownership = t.ownership ? integrateSigningIntoXI(t.ownership, moved, players) : t.ownership;
        return { ...t, players, ownership };
      }
      return t;
    });
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
