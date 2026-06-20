export type Position = "GK" | "DEF" | "MID" | "ATT";

export interface PlayerAbilities {
  pace?: number;
  shooting?: number;
  passing?: number;
  dribbling?: number;
  defending?: number;
  physical?: number;
  
  diving?: number;
  handling?: number;
  kicking?: number;
  reflexes?: number;
  speed?: number;
  positioning?: number;
}

export interface Player {
  id: string;
  name: string;
  teamId: string;
  position: Position;
  rating: number; // 50 - 99
  goals: number;
  assists: number;
  saves: number;
  yellowCards: number;
  redCards: number;
  matchesPlayed: number;
  abilities?: PlayerAbilities;
  injuredRounds?: number;
  suspendedRounds?: number;
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
  rating: number; // 1 to 5 (stars or 60 to 95 average)
  primaryColor: string;
  secondaryColor: string;
  players: Player[];
  wonMatches: number;
  drawnMatches: number;
  lostMatches: number;
  goalsScored: number;
  goalsConceded: number;
}

export type FixtureStatus = "SCHEDULED" | "LIVE" | "FT";

export type MarketType =
  | "MATCH_WINNER"
  | "DOUBLE_CHANCE"
  | "OVER_UNDER_GOALS"
  | "BOTH_TEAMS_TO_SCORE"
  | "EXACT_SCORE"
  | "ANYTIME_GOALSCORER"
  | "OVER_UNDER_CORNERS"
  | "OVER_UNDER_CARDS"
  | "OVER_UNDER_SAVES";

export interface MatchStats {
  home: {
    shots: number;
    shotsOnTarget: number;
    passes: number;
    fouls: number;
    corners: number;
    saves: number;
    yellowCards: number;
    redCards: number;
  };
  away: {
    shots: number;
    shotsOnTarget: number;
    passes: number;
    fouls: number;
    corners: number;
    saves: number;
    yellowCards: number;
    redCards: number;
  };
}

export interface MatchEvent {
  minute: number;
  type: "GOAL" | "ASSIST" | "SAVE" | "YELLOW_CARD" | "RED_CARD" | "FOUL" | "MISS" | "KICKOFF" | "HALF_TIME" | "FULL_TIME" | "COMMENTARY";
  teamId?: string;
  playerId?: string;
  playerName?: string;
  assistantPlayerId?: string;
  assistantPlayerName?: string;
  commentary: string;
}

export interface GoalscorerOdds {
  playerId: string;
  name: string;
  position: Position;
  odds: number;
}

export interface MatchOdds {
  homeWin: number;
  draw: number;
  awayWin: number;
  exactScores: { score: string; odds: number }[];
  goalscorers: GoalscorerOdds[];
  doubleChance?: {
    homeOrDraw: number;
    homeOrAway: number;
    drawOrAway: number;
  };
  bothTeamsToScore?: {
    yes: number;
    no: number;
  };
  overUnder?: {
    over0_5: number;
    under0_5: number;
    over1_5: number;
    under1_5: number;
    over2_5: number;
    under2_5: number;
    over3_5: number;
    under3_5: number;
    over4_5: number;
    under4_5: number;
  };
  overUnderCorners?: {
    over: number;
    under: number;
    line: number;
  };
  overUnderCards?: {
    over: number;
    under: number;
    line: number;
  };
  overUnderSaves?: {
    over: number;
    under: number;
    line: number;
  };
}

export interface Fixture {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  roundIndex: number; // 0 = R32, 1 = R16, 2 = QF, 3 = SF, 4 = Final
  status: FixtureStatus;
  homeScore: number;
  awayScore: number;
  stats: MatchStats;
  events: MatchEvent[];
  odds: MatchOdds;
  currentMinute: number;
  elapsedTicks: number; // For tick-by-tick monitoring
  penaltyScore?: string; // e.g. "4-3" or "5-4" or null when shootout is decided
}

export interface BetSelection {
  fixtureId: string;
  marketType: MarketType;
  selectionId: string; // "HOME" | "DRAW" | "AWAY" | exact score (e.g., "2-1") | playerId
  odds: number;
  details: string; // e.g., "Aston Villa Win", "Exact Score: 2-1", "Haaland Anytime"
  marketName: string; // e.g., "Match Winner", "Correct Score", "Anytime Goalscorer"
}

export interface BetTicket {
  id: string;
  type: "SINGLE" | "ACCUMULATOR";
  selections: BetSelection[];
  totalOdds: number;
  stake: number;
  potentialPayout: number;
  status: "PENDING" | "WON" | "LOST" | "VOID";
  timestamp: number;
  // For single mode: maps selection key (fixtureId-marketType-selectionId) to individual stake
  selectionStakes?: { [selId: string]: number };
}

export interface Profile {
  username: string;
  balance: number;
  netProfit: number;
  tickets: BetTicket[];
  currentRoundIndex: number;
  createdTime: number;
}

export interface Tipster {
  id: string;
  name: string;
  avatar: string; // emoji
  bio: string;
  balance: number;
  accuracy: number; // percentage
  betsWon: number;
  betsTotal: number;
  riskProfile: "SAFE" | "BALANCED" | "AGGRESSIVE";
  recentTips: string[];
}
