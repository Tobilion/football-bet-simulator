import { Team, Player, Fixture, FixtureStatus, MatchStats } from "../types";
import { getInitialTeams } from "./teams";
import { generateMatchOdds } from "../engine/matchEngine";

// Utility to shuffle an array
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  }
  return arr;
}

export function createEmptyStats(): MatchStats {
  return {
    home: { shots: 0, shotsOnTarget: 0, passes: 0, fouls: 0, corners: 0, saves: 0, yellowCards: 0, redCards: 0 },
    away: { shots: 0, shotsOnTarget: 0, passes: 0, fouls: 0, corners: 0, saves: 0, yellowCards: 0, redCards: 0 }
  };
}

// 1. Initialize Tournament
export function initializeNewTournament(): { teams: Team[]; fixtures: Fixture[] } {
  const teams = getInitialTeams();
  const shuffledTeams = shuffleArray([...teams]);
  
  const fixtures: Fixture[] = [];
  
  // Round of 32 (16 fixtures)
  for (let i = 0; i < 16; i++) {
    const home = shuffledTeams[i * 2];
    const away = shuffledTeams[i * 2 + 1];
    
    // Odds
    const odds = generateMatchOdds(home, away);
    
    fixtures.push({
      id: `r0-f${i}`,
      homeTeamId: home.id,
      awayTeamId: away.id,
      roundIndex: 0, // Round of 32
      status: "SCHEDULED",
      homeScore: 0,
      awayScore: 0,
      stats: createEmptyStats(),
      events: [],
      odds,
      currentMinute: 0,
      elapsedTicks: 0
    });
  }

  return { teams, fixtures };
}

// 2. Generate Next Round
export function generateNextRoundFixtures(
  currentFixtures: Fixture[],
  teams: Team[],
  nextRoundIndex: number // 1 = R16, 2 = QF, 3 = SF, 4 = Final
): Fixture[] {
  // Filter fixtures of the completed preceding round
  const completedPrev = currentFixtures.filter(f => f.roundIndex === nextRoundIndex - 1 && f.status === "FT");
  
  if (completedPrev.length === 0) {
    return [];
  }

  const teamMap = new Map(teams.map(t => [t.id, t]));
  const winners: string[] = [];

  // Extract winning team IDs in sequence of fixtures
  completedPrev.forEach(f => {
    if (f.homeScore > f.awayScore) {
      winners.push(f.homeTeamId);
    } else {
      winners.push(f.awayTeamId);
    }
  });

  const nextFixtures: Fixture[] = [];
  const matchesCount = winners.length / 2; // e.g. 16 winners -> 8 matches for R16

  for (let i = 0; i < matchesCount; i++) {
    const homeId = winners[i * 2];
    const awayId = winners[i * 2 + 1];
    const homeTeam = teamMap.get(homeId)!;
    const awayTeam = teamMap.get(awayId)!;
    
    const odds = generateMatchOdds(homeTeam, awayTeam);

    nextFixtures.push({
      id: `r${nextRoundIndex}-f${i}`,
      homeTeamId: homeId,
      awayTeamId: awayId,
      roundIndex: nextRoundIndex,
      status: "SCHEDULED",
      homeScore: 0,
      awayScore: 0,
      stats: createEmptyStats(),
      events: [],
      odds,
      currentMinute: 0,
      elapsedTicks: 0
    });
  }

  return nextFixtures;
}

// 3. Update Player Analytics & Standings
export function updateRostersAndStatsAfterFixture(
  teams: Team[],
  completedFixture: Fixture
): Team[] {
  const homeId = completedFixture.homeTeamId;
  const awayId = completedFixture.awayTeamId;

  const rawHomeScore = completedFixture.homeScore;
  const rawAwayScore = completedFixture.awayScore;

  // Floor the score because shootout winner gets an extra 0.1
  const hGoalsNum = Math.floor(rawHomeScore);
  const aGoalsNum = Math.floor(rawAwayScore);

  const stats = completedFixture.stats;

  return teams.map(t => {
    const isHome = t.id === homeId;
    const isAway = t.id === awayId;
    
    if (!isHome && !isAway) return t; // not involved
    
    const isWin = isHome ? (rawHomeScore > rawAwayScore) : (rawAwayScore > rawHomeScore);
    const isLoss = isHome ? (rawHomeScore < rawAwayScore) : (rawAwayScore < rawHomeScore);
    const isDraw = rawHomeScore === rawAwayScore;
    
    const goalsScoredInMatch = isHome ? hGoalsNum : aGoalsNum;
    const goalsConcededInMatch = isHome ? aGoalsNum : hGoalsNum;
    
    // Update team metrics
    let nextWon = t.wonMatches;
    let nextLost = t.lostMatches;
    let nextDrawn = t.drawnMatches; // for KO we don't draw, but in general stats tracking

    if (isWin) nextWon += 1;
    else if (isLoss) nextLost += 1;
    else if (isDraw) nextDrawn += 1;

    // Track players updates
    const nextPlayers = t.players.map(p => {
      const pStats = { ...p };
      
      // If previously suspended or injured, decrement their downtime and they sit this match out
      if (p.suspendedRounds && p.suspendedRounds > 0) {
        pStats.suspendedRounds = p.suspendedRounds - 1;
      } else if (p.injuredRounds && p.injuredRounds > 0) {
        pStats.injuredRounds = p.injuredRounds - 1;
      } else {
        // Active and played
        pStats.matchesPlayed += 1;
      }

      // 1. Accumulate Goals and Assists inside events
      completedFixture.events.forEach(ev => {
        if (ev.type === "GOAL") {
          if (ev.playerId === p.id) {
            pStats.goals += 1;
          }
          if (ev.assistantPlayerId === p.id) {
            pStats.assists += 1;
          }
        } else if (ev.type === "SAVE" && ev.playerId === p.id) {
          pStats.saves += 1;
        } else if (ev.type === "YELLOW_CARD" && ev.playerId === p.id) {
          pStats.yellowCards += 1;
        } else if (ev.type === "RED_CARD" && ev.playerId === p.id) {
          pStats.redCards += 1;
          pStats.suspendedRounds = 1; // Suspended for next round
        } else if (ev.type === "COMMENTARY" && ev.commentary && ev.commentary.includes("INJURY SUB") && ev.playerId === p.id) {
          pStats.injuredRounds = 1; // Injured for next round
        }
      });

      // 2. GK Clean sheet accounting (if conceded 0 goals)
      if (p.position === "GK" && goalsConcededInMatch === 0) {
        // We can track clean sheets inside the GK objects using custom criteria or saves
        // Clean sheets are dynamic goals-conceded tracker
      }

      return pStats;
    });

    return {
      ...t,
      wonMatches: nextWon,
      lostMatches: nextLost,
      drawnMatches: nextDrawn,
      goalsScored: t.goalsScored + goalsScoredInMatch,
      goalsConceded: t.goalsConceded + goalsConcededInMatch,
      players: nextPlayers
    };
  });
}

// 4. Retrieve Round Labels
export const ROUND_LABELS = [
  "Round of 32 (Ro32)",
  "Round of 16 (Ro16)",
  "Quarterfinals (QF)",
  "Semifinals (SF)",
  "Grand Final (Final)"
];

export const ROUND_SHORT_LABELS = [
  "Ro32",
  "Ro16",
  "QF",
  "SF",
  "Final"
];

// 5. Initialize 16-Team Round-Robin League
export function initializeNewLeague(): { teams: Team[]; fixtures: Fixture[] } {
  const allTeams = getInitialTeams();
  // Shuffle list of 32 teams, then take the first 16 to keep it highly varied and dynamic!
  const shuffledTeamsList = [...allTeams].sort(() => Math.random() - 0.5);
  const teams = shuffledTeamsList.slice(0, 16);
  
  const fixtures: Fixture[] = [];
  const n = teams.length; // 16 teams
  
  // Construct a standard, optimized round-robin table (using the circle method)
  const rotation = [...teams];
  
  for (let round = 0; round < n - 1; round++) { // 15 Matchdays
    for (let i = 0; i < n / 2; i++) {
      const home = rotation[i];
      const away = rotation[n - 1 - i];
      
      // Alternate home and away designation to avoid consecutive matches
      const finalHome = (round + i) % 2 === 0 ? home : away;
      const finalAway = (round + i) % 2 === 0 ? away : home;
      
      const odds = generateMatchOdds(finalHome, finalAway);
      fixtures.push({
        id: `l-r${round}-f${i}`,
        homeTeamId: finalHome.id,
        awayTeamId: finalAway.id,
        roundIndex: round, // Matchday index (0 to 14)
        status: "SCHEDULED",
        homeScore: 0,
        awayScore: 0,
        stats: createEmptyStats(),
        events: [],
        odds,
        currentMinute: 0,
        elapsedTicks: 0
      });
    }
    
    // Rotate roster: fix first element, rotate others
    const last = rotation.pop()!;
    rotation.splice(1, 0, last);
  }
  
  return { teams, fixtures };
}
