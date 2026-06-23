import { Team, Player, Fixture, FixtureStatus, MatchStats, WeatherCondition } from "../types";
import { getInitialTeams } from "./teams";
import { generateMatchOdds } from "../engine/matchEngine";
import { developPlayer } from "../utils/playerUtils";
import { selectMatchWeather } from "../engine/weatherEngine";

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

export function generateRandomWeather(isDerby = false): WeatherCondition {
  return selectMatchWeather(isDerby);
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
    const weather = generateRandomWeather();
    
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
      elapsedTicks: 0,
      weather
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
    const weather = generateRandomWeather();

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
      elapsedTicks: 0,
      weather
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

    // Handle Morale
    let nextMorale = t.morale || 60;
    if (isWin) nextMorale = Math.min(100, nextMorale + Math.floor(Math.random() * 6) + 4); // +4 to +9
    else if (isLoss) nextMorale = Math.max(0, nextMorale - Math.floor(Math.random() * 6) - 4); // -4 to -9
    else if (isDraw) nextMorale = Math.max(0, Math.min(100, nextMorale + Math.floor(Math.random() * 5) - 2)); // -2 to +2

    // Track players updates
    const nextPlayers = t.players.map(p => {
      const pStats = { ...p };
      
      // If previously suspended or injured, decrement their downtime and they sit this match out
      if (p.suspendedRounds && p.suspendedRounds > 0) {
        pStats.suspendedRounds = p.suspendedRounds - 1;
        pStats.fatigue = Math.max(0, (pStats.fatigue || 0) - 20); // Recovers if suspended
      } else if (p.injuryRecoveryMatches && p.injuryRecoveryMatches > 0) {
        pStats.injuryRecoveryMatches = p.injuryRecoveryMatches - 1;
        if (pStats.injuryRecoveryMatches === 0) pStats.injured = false;
        pStats.fatigue = Math.max(0, (pStats.fatigue || 0) - 30); // Recovers heavily if injured
      } else if (p.injuredRounds && p.injuredRounds > 0) {
        // legacy compatibility
        pStats.injuredRounds = p.injuredRounds - 1;
      } else {
        // Active and played
        pStats.matchesPlayed += 1;
        pStats.seasonStats.matchesPlayed += 1;
        
        // Increase fatigue
        pStats.fatigue = Math.min(100, (pStats.fatigue || 0) + Math.floor(Math.random() * 10) + 5); 
      }

      // Base recovery for all players between matchdays
      pStats.fatigue = Math.max(0, (pStats.fatigue || 0) - 5);

      // 1. Accumulate Goals and Assists inside events
      completedFixture.events.forEach(ev => {
        if (ev.type === "GOAL") {
          if (ev.playerId === p.id) {
            pStats.goals += 1;
            pStats.seasonStats.goalsScored += 1;
          }
          if (ev.assistantPlayerId === p.id) {
            pStats.assists += 1;
            pStats.seasonStats.assists += 1;
          }
        } else if (ev.type === "SAVE" && ev.playerId === p.id) {
          pStats.saves += 1;
        } else if (ev.type === "YELLOW_CARD" && ev.playerId === p.id) {
          pStats.yellowCards += 1;
          pStats.seasonStats.yellowCards += 1;
        } else if (ev.type === "RED_CARD" && ev.playerId === p.id) {
          pStats.redCards += 1;
          pStats.seasonStats.redCards += 1;
          pStats.suspendedRounds = 1; // Suspended for next round
        } else if (ev.type === "COMMENTARY" && ev.commentary && ev.commentary.includes("INJURY SUB") && ev.playerId === p.id) {
          pStats.injured = true;
          pStats.injuryRecoveryMatches = Math.floor(Math.random() * 3) + 1; // 1 to 3 matches
        }
      });

      // 2. GK Clean sheet accounting (if conceded 0 goals)
      if (p.position === "GK" && goalsConcededInMatch === 0) {
        pStats.seasonStats.cleanSheets += 1;
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
      morale: nextMorale,
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
      const weather = generateRandomWeather();
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
        elapsedTicks: 0,
        weather
      });
    }
    
    // Rotate roster: fix first element, rotate others
    const last = rotation.pop()!;
    rotation.splice(1, 0, last);
  }
  
  return { teams, fixtures };
}

// 6. Apply end-of-season relegation / promotion to team division flags
export function applyRelegationPromotion(
  teams: Team[],
  seasonFixtures: Fixture[]
): Team[] {
  const seenIds = new Set(seasonFixtures.flatMap(f => [f.homeTeamId, f.awayTeamId]));
  const points: Record<string, number> = {};
  const gd: Record<string, number> = {};
  seenIds.forEach(id => { points[id] = 0; gd[id] = 0; });

  seasonFixtures.forEach(f => {
    if (f.status !== "FT") return;
    const h = Math.floor(f.homeScore);
    const a = Math.floor(f.awayScore);
    if (h > a) { points[f.homeTeamId] = (points[f.homeTeamId] || 0) + 3; }
    else if (a > h) { points[f.awayTeamId] = (points[f.awayTeamId] || 0) + 3; }
    else {
      points[f.homeTeamId] = (points[f.homeTeamId] || 0) + 1;
      points[f.awayTeamId] = (points[f.awayTeamId] || 0) + 1;
    }
    gd[f.homeTeamId] = (gd[f.homeTeamId] || 0) + (h - a);
    gd[f.awayTeamId] = (gd[f.awayTeamId] || 0) + (a - h);
  });

  const seasonTeamsSorted = [...seenIds]
    .map(id => ({ id, pts: points[id] ?? 0, gd: gd[id] ?? 0 }))
    .sort((a, b) => b.pts - a.pts || b.gd - a.gd);

  const relegatedIds = new Set(seasonTeamsSorted.slice(-3).map(t => t.id));
  const promotedIds = new Set(seasonTeamsSorted.slice(0, 3).map(t => t.id));

  const div2Pool = teams.filter(t => (t.division ?? 1) === 2 && !seenIds.has(t.id));
  const shuffledDiv2 = [...div2Pool].sort(() => Math.random() - 0.5);
  const incomingIds = new Set(shuffledDiv2.slice(0, 3).map(t => t.id));

  return teams.map(t => {
    if (relegatedIds.has(t.id)) return { ...t, division: 2 as const };
    if (incomingIds.has(t.id)) return { ...t, division: 1 as const };
    if (promotedIds.has(t.id) && (t.division ?? 1) === 2) return { ...t, division: 1 as const };
    return t;
  });
}

// 7. Start a new league season using updated division flags
export function initializeNewLeagueSeason(allTeams: Team[]): { teams: Team[]; fixtures: Fixture[] } {
  const div1Teams = allTeams.filter(t => (t.division ?? 1) === 1);
  const shuffled = [...div1Teams].sort(() => Math.random() - 0.5);
  const freshTeams: Team[] = shuffled.slice(0, 16).map(t => ({
    ...t,
    wonMatches: 0,
    drawnMatches: 0,
    lostMatches: 0,
    goalsScored: 0,
    goalsConceded: 0,
    morale: 65,
    players: t.players.map(p => {
      const developed = developPlayer(p);
      return {
        ...developed,
        fatigue: Math.max(0, (p.fatigue || 0) - 40),
        injuryRecoveryMatches: 0,
        injured: false,
        suspendedRounds: 0,
        injuredRounds: 0,
      };
    }),
  }));

  const fixtures: Fixture[] = [];
  const n = freshTeams.length;
  const rotation = [...freshTeams];

  for (let round = 0; round < n - 1; round++) {
    for (let i = 0; i < n / 2; i++) {
      const home = rotation[i];
      const away = rotation[n - 1 - i];
      const finalHome = (round + i) % 2 === 0 ? home : away;
      const finalAway = (round + i) % 2 === 0 ? away : home;
      const odds = generateMatchOdds(finalHome, finalAway);
      const weather = generateRandomWeather();
      fixtures.push({
        id: `ls-r${round}-f${i}`,
        homeTeamId: finalHome.id,
        awayTeamId: finalAway.id,
        roundIndex: round,
        status: "SCHEDULED",
        homeScore: 0,
        awayScore: 0,
        stats: createEmptyStats(),
        events: [],
        odds,
        currentMinute: 0,
        elapsedTicks: 0,
        weather,
      });
    }
    const last = rotation.pop()!;
    rotation.splice(1, 0, last);
  }

  return { teams: freshTeams, fixtures };
}
