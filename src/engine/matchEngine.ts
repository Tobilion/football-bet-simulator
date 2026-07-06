import { Fixture, Team, Player, MatchOdds, MatchEvent, MatchStats, Position } from "../types";
import { processFouls } from "./foulCardEngine";
import { getWeatherModifiers } from "./weatherEngine";

// Helper to calculate team average rating based on players (base, no modifiers)
export function calculateTeamRating(team: Team): number {
  if (team.players.length === 0) return 75;
  const sum = team.players.reduce((acc, p) => acc + p.rating, 0);
  return Math.round(sum / team.players.length);
}

// Fatigue + morale adjusted effective rating for in-match strength
function calculateEffectiveTeamRating(team: Team): number {
  if (team.players.length === 0) return 75;
  const sum = team.players.reduce((acc, p) => {
    // Fatigue above 50 degrades effective rating (max -10 at fatigue 100)
    const fatiguePenalty = Math.max(0, ((p.fatigue || 0) - 50) * 0.2);
    return acc + Math.max(50, p.rating - fatiguePenalty);
  }, 0);
  const baseAvg = sum / team.players.length;
  // Morale centered at 60: +/-6 pts max effect
  const moraleBonus = ((team.morale ?? 60) - 60) * 0.1;
  return Math.round(baseAvg + moraleBonus);
}

export interface LineupStrength { overall: number; attack: number; defense: number; gk: number; }

// The best available XI: the owner's chosen starters if valid, otherwise the top 11 by
// rating (guaranteeing a keeper). This is what actually plays — bench players no longer
// dilute a club's strength, so your starting-XI and transfer choices matter.
export function getStartingXI(team: Team): Player[] {
  const own = team.ownership;
  const isHealthy = (p: Player) => !p.injured && (p.injuredRounds || 0) === 0 && (p.injuryRecoveryMatches || 0) === 0;

  if (own?.starterIds && own.starterIds.length === 11) {
    const xi = own.starterIds
      .map(id => team.players.find(p => p.id === id))
      .filter((p): p is Player => !!p && isHealthy(p));
    
    if (xi.length === 11) return xi;

    // Fill missing positions with best healthy bench players
    const starterIdsSet = new Set(xi.map(p => p.id));
    const healthyBench = team.players
      .filter(p => isHealthy(p) && !starterIdsSet.has(p.id))
      .sort((a, b) => b.rating - a.rating);
    
    const filled = [...xi, ...healthyBench].slice(0, 11);
    
    // Ensure we have a healthy GK
    if (!filled.some(p => p.position === "GK")) {
      const healthyGk = team.players
        .filter(p => p.position === "GK" && isHealthy(p))
        .sort((a, b) => b.rating - a.rating)[0];
      if (healthyGk) {
        // Swap out the lowest-rated non-GK starter
        const nonGk = filled.filter(p => p.position !== "GK").sort((a, b) => a.rating - b.rating);
        if (nonGk.length > 0) {
          const toReplaceId = nonGk[0].id;
          return filled.map(p => p.id === toReplaceId ? healthyGk : p);
        }
      }
    }
    return filled;
  }

  // Default: Get top healthy goalkeeper + top healthy outfield players
  const healthyGk = team.players
    .filter(p => p.position === "GK" && isHealthy(p))
    .sort((a, b) => b.rating - a.rating)[0];

  const healthyOutfield = team.players
    .filter(p => p.id !== healthyGk?.id && isHealthy(p))
    .sort((a, b) => b.rating - a.rating)
    .slice(0, healthyGk ? 10 : 11);

  return healthyGk ? [healthyGk, ...healthyOutfield] : healthyOutfield;
}

// Position-weighted attack / defense / keeper strength from the starting XI, adjusted for
// fatigue, morale and (for user-owned clubs) mentality / pressing / training facilities.
export function lineupStrength(team: Team): LineupStrength {
  const xi = getStartingXI(team);
  if (xi.length === 0) return { overall: 60, attack: 60, defense: 60, gk: 60 };
  const eff = (p: Player) => Math.max(40, p.rating - Math.max(0, ((p.fatigue || 0) - 50) * 0.2));
  const avg = (arr: Player[], fallback: number) =>
    arr.length ? arr.reduce((sum, p) => sum + eff(p), 0) / arr.length : fallback;
  const gkP = xi.find(p => p.position === "GK");
  const defs = xi.filter(p => p.position === "DEF");
  const mids = xi.filter(p => p.position === "MID");
  const atts = xi.filter(p => p.position === "ATT");
  const overall = xi.reduce((sum, p) => sum + eff(p), 0) / xi.length;
  let attack = avg(atts, overall) * 0.65 + avg(mids, overall) * 0.35;
  let defense = avg(defs, overall) * 0.65 + avg(mids, overall) * 0.35;
  let gk = gkP ? eff(gkP) : overall - 3;
  const moraleBonus = (((team.morale ?? 60) - 60) * 0.1);
  attack += moraleBonus; defense += moraleBonus;
  let overallAdj = overall + moraleBonus;
  const own = team.ownership;
  if (own) {
    if (own.mentality === "Ultra Attack") { attack += 6; defense -= 6; }
    else if (own.mentality === "Attacking") { attack += 3; defense -= 3; }
    else if (own.mentality === "Defensive") { attack -= 3; defense += 4; }
    if (own.pressingStyle === "Gegenpressing") { attack += 2; defense -= 1; }
    else if (own.pressingStyle === "High Press") { attack += 1; }
    else if (own.pressingStyle === "Low Press") { defense += 2; attack -= 1; }
    const trainBonus = Math.max(0, (own.trainingFacilityLevel - 1)) * 0.6;
    attack += trainBonus; defense += trainBonus; overallAdj += trainBonus;
  }
  return { overall: overallAdj, attack, defense, gk };
}

// 1. Odds Generator for Fixture
export function generateMatchOdds(homeTeam: Team, awayTeam: Team): MatchOdds {
  const homeAvg = lineupStrength(homeTeam).overall;
  const awayAvg = lineupStrength(awayTeam).overall;

  // Home advantage addition. Subtract a baseline so rating gaps translate into a
  // realistically wide power ratio (a great side is a heavy favorite, not a coin flip).
  const homePower = Math.max(1, (homeAvg + 3) - 30);
  const awayPower = Math.max(1, awayAvg - 30);
  
  const totalPower = homePower + awayPower;
  
  // Raw Win/Draw/Loss probabilities
  const homeWinProbRaw = homePower / totalPower; // e.g. 82 / 160 = 0.51
  // Draw probability is higher for closely matched teams, lower for giants vs underdogs
  const difference = Math.abs(homePower - awayPower);
  const drawProbRaw = Math.max(0.12, 0.28 - (difference / 100));
  const awayWinProbRaw = 1.0 - homeWinProbRaw - drawProbRaw;
  
  // Apply bookmaker vig/margin (e.g., 8%) for authentic odds
  const margin = 1.08;
  const homeWinOdds = Math.max(1.05, Math.round((1.0 / (homeWinProbRaw * margin)) * 100) / 100);
  const drawOdds = Math.max(1.50, Math.round((1.0 / (drawProbRaw * margin)) * 100) / 100);
  const awayWinOdds = Math.max(1.05, Math.round((1.0 / (awayWinProbRaw * margin)) * 100) / 100);

  // Generate Exact Scores
  const commonScores = [
    { score: "1-0", freq: 0.12 }, { score: "2-0", freq: 0.08 }, { score: "2-1", freq: 0.10 },
    { score: "3-0", freq: 0.05 }, { score: "3-1", freq: 0.06 }, { score: "3-2", freq: 0.03 },
    { score: "0-0", freq: 0.07 }, { score: "1-1", freq: 0.11 }, { score: "2-2", freq: 0.04 },
    { score: "0-1", freq: 0.09 }, { score: "0-2", freq: 0.06 }, { score: "1-2", freq: 0.08 },
    { score: "0-3", freq: 0.03 }, { score: "1-3", freq: 0.04 }, { score: "2-3", freq: 0.02 }
  ];

  const exactScores = commonScores.map(cs => {
    const parts = cs.score.split("-");
    const hScore = parseInt(parts[0]);
    const aScore = parseInt(parts[1]);
    
    // Scale standard frequency based on team ratios
    let probabilityModifier = 1.0;
    if (hScore > aScore) {
      probabilityModifier *= (homePower / awayPower);
    } else if (aScore > hScore) {
      probabilityModifier *= (awayPower / homePower);
    } else {
      // Draw scores
      probabilityModifier *= (1.0 - Math.abs(homePower - awayPower) / 50.0);
    }
    
    const adjustedFreq = Math.max(0.005, cs.freq * probabilityModifier);
    const odds = Math.max(4.50, Math.round((1.0 / (adjustedFreq * margin)) * 100) / 100);
    
    return { score: cs.score, odds };
  });

  // Goalscorer Odds (Select players from both teams)
  const goalscorers: MatchOdds["goalscorers"] = [];
  
  // Extract all outfield players
  const processGoalscorersForTeam = (team: Team, isHome: boolean) => {
    const multiplier = isHome ? (homePower / awayPower) : (awayPower / homePower);
    
    team.players.forEach(p => {
      if (p.position === "GK") return; // GKs rarely score!
      
      let baseOdds = 15.0;
      if (p.position === "ATT") {
        baseOdds = 2.5; // Strikers score often
      } else if (p.position === "MID") {
        baseOdds = 5.0; // Midfielders
      } else if (p.position === "DEF") {
        baseOdds = 10.0; // Defenders
      }
      
      // Fine tune by player rating
      const ratingFactor = (100 - p.rating) / 10; // Better rating -> lower factor -> lower odds
      let finalOdds = baseOdds * ratingFactor * (1.0 / multiplier);
      
      // Ensure lower bounds
      finalOdds = Math.max(1.50, Math.round(finalOdds * 100) / 100);
      
      goalscorers.push({
        playerId: p.id,
        name: p.name,
        position: p.position,
        odds: finalOdds
      });
    });
  };

  processGoalscorersForTeam(homeTeam, true);
  processGoalscorersForTeam(awayTeam, false);

  // Sort goalscorers so lowest odds (most likely) come first
  goalscorers.sort((a, b) => a.odds - b.odds);

  // Expanded markets
  const homeOrDrawRaw = homeWinProbRaw + drawProbRaw;
  const homeOrAwayRaw = homeWinProbRaw + awayWinProbRaw;
  const drawOrAwayRaw = drawProbRaw + awayWinProbRaw;

  const bttsYesRaw = Math.min(0.8, Math.max(0.3, 0.5 + (0.01 * (homePower + awayPower - 120))));
  const bttsNoRaw = 1.0 - bttsYesRaw;

  // Derive Over/Under (using dummy approximations based on total Power)
  const averageTotalGoals = (homePower + awayPower) / 50; // just an arbitrary base measure
  
  // Create realistic looking lines
  const overUnderRaw = (line: number) => {
    const diff = averageTotalGoals - line;
    // Base 0.5 prob logic:
    const overProb = Math.max(0.05, Math.min(0.95, 0.5 + diff * 0.2));
    const underProb = 1.0 - overProb;
    return {
      over: Math.max(1.01, Math.round((1 / (overProb * margin)) * 100) / 100),
      under: Math.max(1.01, Math.round((1 / (underProb * margin)) * 100) / 100)
    }
  }

  // Double chance
  const doubleChance = {
    homeOrDraw: Math.max(1.01, Math.round((1 / (homeOrDrawRaw * margin)) * 100) / 100),
    homeOrAway: Math.max(1.01, Math.round((1 / (homeOrAwayRaw * margin)) * 100) / 100),
    drawOrAway: Math.max(1.01, Math.round((1 / (drawOrAwayRaw * margin)) * 100) / 100),
  };

  const bothTeamsToScore = {
    yes: Math.max(1.05, Math.round((1 / (bttsYesRaw * margin)) * 100) / 100),
    no: Math.max(1.05, Math.round((1 / (bttsNoRaw * margin)) * 100) / 100)
  };

  const overUnder = {
    over0_5: overUnderRaw(0.5).over, under0_5: overUnderRaw(0.5).under,
    over1_5: overUnderRaw(1.5).over, under1_5: overUnderRaw(1.5).under,
    over2_5: overUnderRaw(2.5).over, under2_5: overUnderRaw(2.5).under,
    over3_5: overUnderRaw(3.5).over, under3_5: overUnderRaw(3.5).under,
    over4_5: overUnderRaw(4.5).over, under4_5: overUnderRaw(4.5).under,
  };

  const cornersBaseLines = [7.5, 8.5, 9.5, 10.5, 11.5];
  const overUnderCorners = cornersBaseLines.map((line) => {
    const diffLine = line - 9.5;
    const overProb = Math.max(0.05, Math.min(0.95, 0.6 - diffLine * 0.15));
    const underProb = 1.0 - overProb;
    return {
      line,
      over: Math.max(1.01, Math.round((1 / (overProb * margin)) * 100) / 100),
      under: Math.max(1.01, Math.round((1 / (underProb * margin)) * 100) / 100)
    };
  });

  const cardsBaseLines = [2.5, 3.5, 4.5, 5.5];
  const overUnderCards = cardsBaseLines.map((line) => {
    const diffLine = line - 3.5;
    const overProb = Math.max(0.05, Math.min(0.95, 0.45 - diffLine * 0.15));
    const underProb = 1.0 - overProb;
    return {
      line,
      over: Math.max(1.01, Math.round((1 / (overProb * margin)) * 100) / 100),
      under: Math.max(1.01, Math.round((1 / (underProb * margin)) * 100) / 100)
    };
  });

  const savesBaseLines = [4.5, 5.5, 6.5, 7.5, 8.5];
  const overUnderSaves = savesBaseLines.map((line) => {
    const diffLine = line - 6.5;
    const overProb = Math.max(0.05, Math.min(0.95, 0.5 - diffLine * 0.12));
    const underProb = 1.0 - overProb;
    return {
      line,
      over: Math.max(1.01, Math.round((1 / (overProb * margin)) * 100) / 100),
      under: Math.max(1.01, Math.round((1 / (underProb * margin)) * 100) / 100)
    };
  });

  return {
    homeWin: homeWinOdds,
    draw: drawOdds,
    awayWin: awayWinOdds,
    exactScores,
    goalscorers: goalscorers.slice(0, 16), // Top 16 likely goalscorers for compact odds displays
    doubleChance,
    bothTeamsToScore,
    overUnder,
    overUnderCorners,
    overUnderCards,
    overUnderSaves
  };
}

// 2. Commentary Databases
const goalCommentaries = [
  "unbelievable strike from thirty yards out! Bullets straight into the top crossbar corner!",
  "is clinical! Connects with a lovely curved pass and slots it under the keeper.",
  "scores! A powerful header from the corner kick that leaves the defense frozen.",
  "slams it home on the rebound after a brilliant initial save!",
  "displays magic, dribbles past two defenders and chips the goalkeeper beautifully!",
  "fires a spectacular volley into the roof of the net! Absolute stadium erupter!",
  "rolls it calmly into the bottom corner. Cool as you like under pressure."
];

const saveCommentaries = [
  "makes a breathtaking fingertip save to tip the ball over the crossbar!",
  "dives down low to deny a certain goal. Excellent reflexes!",
  "stands tall and blocks the powerful strike with a strong hand!",
  "reads the play perfectly, coming out to smother the close-range shot.",
  "leaps across his line and intercepts the curling effort. What a keeper!",
  "catches the ball securely under challenge. Safe hands."
];

const missCommentaries = [
  "unleashes a shot but it flies inches wide of the left upright.",
  "smashes it against the crossbar! Oh, what bad luck!",
  "drags the shot wide from an excellent scoring position.",
  "tries a long-range effort but it sails harmlessly over the stands.",
  "strikes it well but a defender gets a block in to divert it away.",
  "completely miskicks the ball, sending it wide of the keeper."
];

const cardCommentaries = [
  "arrives late with a reckless challenge. Yellow card yellow-marked.",
  "pulls down the attacker to halt a dangerous counter-attack. A tactical yellow.",
  "engages in a heated argument with the referee, resulting in a yellow card.",
  "commits an incredibly dangerous two-footed tackle! RED CARD! Absolute disaster!",
  "commits a professional foul as the last man. Direct RED CARD! He is walking off!",
  "slips into a cynical tackle and receives a caution."
];

const foulCommentaries = [
  "trips the opponent in midfield. Free kick awarded.",
  "pushes of the defender in the box. Foul called.",
  "goes in a bit too strong in a 50/50 challenge. Play is stopped.",
  "slips and caught the opponent's ankle. Warning from the referee."
];

// 3. Lineup & Substitutions Engine (11 starters, 2 bench players)
export function getTeamActivePlayers(
  team: Team,
  events: any[]
): { onField: Player[]; bench: Player[]; redCards: Player[]; injured: Player[] } {
  // Filter out pre-match suspended or injured players (all injury fields)
  const availablePlayers = team.players.filter(
    p => !(p.suspendedRounds && p.suspendedRounds > 0)
      && !(p.injuredRounds && p.injuredRounds > 0)
      && !(p.injured && (p.injuryRecoveryMatches || 0) > 0)
  );

  // GK is always starter (we should have 1)
  const gkStarters = availablePlayers.filter(p => p.position === "GK");
  const defStarters = availablePlayers.filter(p => p.position === "DEF");
  const midPlayers = availablePlayers.filter(p => p.position === "MID");
  const attPlayers = availablePlayers.filter(p => p.position === "ATT");

  // Keep first 3 MIDs and 3 ATTs as starters to make 11 starters. Rest are bench.
  const midStarters = midPlayers.slice(0, 3);
  const midBench = midPlayers.slice(3);

  const attStarters = attPlayers.slice(0, 3);
  const attBench = attPlayers.slice(3);

  const onField = [
    ...gkStarters,
    ...defStarters,
    ...midStarters,
    ...attStarters
  ];

  const bench = [
    ...midBench,
    ...attBench
  ];

  const activeOnField = [...onField];
  const activeBench = [...bench];
  const redCards: Player[] = [];
  const injured: Player[] = [];

  events.forEach(ev => {
    if (ev.type === "RED_CARD" && ev.teamId === team.id) {
      const idx = activeOnField.findIndex(p => p.id === ev.playerId);
      if (idx !== -1) {
        const [removed] = activeOnField.splice(idx, 1);
        redCards.push(removed);
      }
    } else if (ev.type === "COMMENTARY" && ev.commentary && ev.commentary.includes("INJURY SUB") && ev.teamId === team.id) {
      const pIdx = activeOnField.findIndex(p => p.id === ev.playerId);
      const sIdx = activeBench.findIndex(p => p.id === ev.assistantPlayerId);
      if (pIdx !== -1 && sIdx !== -1) {
        const [injuredP] = activeOnField.splice(pIdx, 1);
        const [subP] = activeBench.splice(sIdx, 1);
        activeOnField.push(subP);
        injured.push(injuredP);
      }
    }
  });

  return { onField: activeOnField, bench: activeBench, redCards, injured };
}

// 4. Match Tick Simulation
export function simulateMatchTick(
  fixture: Fixture,
  homeTeam: Team,
  awayTeam: Team,
  currentTick: number // Current simulated tick (usually 1 to 15 ticks representing sections of 90m)
): Fixture {
  // DEEP COPY to prevent state ref leaks and double rendering / double goal log glitches!
  const updatedFixture: Fixture = {
    ...fixture,
    events: [...fixture.events],
    stats: {
      home: { ...fixture.stats.home },
      away: { ...fixture.stats.away }
    }
  };

  const homeLU = lineupStrength(homeTeam);
  const awayLU = lineupStrength(awayTeam);
  const homeAvg = homeLU.overall;
  const awayAvg = awayLU.overall;

  // Total ticks = 15. Each tick is 6 minutes of play. Extra Time is ticks 16-20.
  const tickDuration = 6;
  const matchMinute = currentTick <= 15
    ? Math.min(90, currentTick * tickDuration)
    : Math.min(120, 90 + (currentTick - 15) * 6);
  updatedFixture.currentMinute = matchMinute;
  updatedFixture.elapsedTicks = currentTick;

  // Set match status to LIVE when simulation begins or is in progress
  if (currentTick >= 1 && currentTick < 15) {
    updatedFixture.status = "LIVE";
  } else if (currentTick >= 16 && currentTick < 20) {
    updatedFixture.status = "LIVE";
  }

  // Ensure weather modifiers are initialized
  if (!updatedFixture.weatherModifiers) {
    updatedFixture.weatherModifiers = getWeatherModifiers(updatedFixture.weather || "Clear Sky");
  }

  // Handle Match kickoff & intervals
  if (currentTick === 1) {
    const hasKickoff = updatedFixture.events.some(ev => ev.type === "KICKOFF");
    if (!hasKickoff) {
      updatedFixture.events.push({
        minute: 1,
        type: "KICKOFF",
        commentary: `Kick-off! The match between ${homeTeam.name} and ${awayTeam.name} is underway under ${updatedFixture.weather} conditions.`
      });
    }
  }

  // Compute active squads using our real-time lineup and sub engine
  let homeActive = getTeamActivePlayers(homeTeam, updatedFixture.events);
  let awayActive = getTeamActivePlayers(awayTeam, updatedFixture.events);

  // Run foul processor independently (22% per tick logic is handled inside)
  processFouls(updatedFixture, "away", awayTeam, awayActive.onField, matchMinute, updatedFixture.weatherModifiers);
  processFouls(updatedFixture, "home", homeTeam, homeActive.onField, matchMinute, updatedFixture.weatherModifiers);

  // Dynamic random injury chance (1.5% chance per tick to get a realistic injury and sub)
  if (Math.random() < 0.015) {
    const isHomeInjured = Math.random() < 0.5;
    const injuredT = isHomeInjured ? homeTeam : awayTeam;
    const activeRoster = isHomeInjured ? homeActive : awayActive;
    const outfieldOnField = activeRoster.onField.filter(p => p.position !== "GK");

    if (outfieldOnField.length > 0 && activeRoster.bench.length > 0) {
      const injuredPlayer = outfieldOnField[Math.floor(Math.random() * outfieldOnField.length)];
      const subPlayer = activeRoster.bench[Math.floor(Math.random() * activeRoster.bench.length)];

      updatedFixture.events.push({
        minute: matchMinute,
        type: "COMMENTARY",
        teamId: injuredT.id,
        playerId: injuredPlayer.id,
        assistantPlayerId: subPlayer.id,
        commentary: `🚑 INJURY SUB! ${injuredPlayer.name} stretchered off due to injury. Replaced by ${subPlayer.name}.`
      });

      // Recalculate lineups for remainder of the tick
      if (isHomeInjured) {
        homeActive = getTeamActivePlayers(homeTeam, updatedFixture.events);
      } else {
        awayActive = getTeamActivePlayers(awayTeam, updatedFixture.events);
      }
    }
  }

  // Event generation probability (~45% chance of an event in normal, ~30% in ET)
  let eventChance = currentTick <= 15 ? 0.45 : 0.30;
  
  if (updatedFixture.weather === "Blizzard") {
    eventChance -= 0.15; // less events -> depresses scores
  } else if (updatedFixture.weather === "Heatwave" && matchMinute > 75) {
    eventChance += 0.25; // extremely tired defenses -> more late events
  }

  const isEvent = Math.random() < eventChance;

  if (isEvent) {
    // Determine which team initiates the action based on strength + home advantage with red card handicaps!
    // Real red card handicap: reduce average strength by 4 for each red carded player!
    const homeRedCardPenalty = homeActive.redCards.length * 4;
    const awayRedCardPenalty = awayActive.redCards.length * 4;

    const homeAdvantage = 3;
    // Widen the possession/territory split so the better side dominates the ball.
    const homeStrength = Math.max(1, (homeAvg + homeAdvantage - homeRedCardPenalty) - 30);
    const awayStrength = Math.max(1, (awayAvg - awayRedCardPenalty) - 30);
    const attackProb = homeStrength / (homeStrength + awayStrength);

    const isHomeAttack = Math.random() < attackProb;
    const attackingTeam = isHomeAttack ? homeTeam : awayTeam;
    const defendingTeam = isHomeAttack ? awayTeam : homeTeam;
    const attackingSide = isHomeAttack ? "home" : "away";
    const defendingSide = isHomeAttack ? "away" : "home";
    const attackingActive = isHomeAttack ? homeActive : awayActive;
    const defendingActive = isHomeAttack ? awayActive : homeActive;

    // Dynamic finish quality: attacker's attack vs defender's defense + keeper.
    // A strong attack against a weak defence converts far more of its chances.
    const atkLU = isHomeAttack ? homeLU : awayLU;
    const defLU = isHomeAttack ? awayLU : homeLU;
    const defComposite = defLU.defense * 0.6 + defLU.gk * 0.4;
    const goalThreshold = Math.max(0.10, Math.min(0.70,
      0.40 * Math.pow(atkLU.attack / Math.max(30, defComposite), 1.15)));
    const saveShare = defComposite / (defComposite + atkLU.attack);
    // Fold the dynamic conversion into the existing 0..0.78 "chance" window.
    const gBound = 0.78 * goalThreshold;
    const sBound = gBound + (0.78 - gBound) * saveShare;

    // Randomize the nature of the action
    let actionRand = Math.random();
    
    if (updatedFixture.weather === "Heavy Rain") {
      // Heavy rain increases the odds of a foul (which is at the upper end of the random scale)
      actionRand = Math.min(1.0, actionRand + 0.20);
    } else if (updatedFixture.weather === "Blizzard") {
      actionRand = Math.min(1.0, actionRand + 0.15); // Blizzard shifts away from goals somewhat too
    }

    if (actionRand < gBound) {
      // ⚽ GOAL SCORING CHANCE SUCCESS
      const outfieldPlayers = attackingActive.onField.filter(p => p.position !== "GK");
      
      if (outfieldPlayers.length > 0) {
        const attackPlayers = outfieldPlayers.filter(p => p.position === "ATT");
        const midPlayers = outfieldPlayers.filter(p => p.position === "MID");
        
        let scorer: Player;
        const scorerRand = Math.random();
        if (scorerRand < 0.60 && attackPlayers.length > 0) {
          scorer = attackPlayers[Math.floor(Math.random() * attackPlayers.length)];
        } else if (scorerRand < 0.90 && midPlayers.length > 0) {
          scorer = midPlayers[Math.floor(Math.random() * midPlayers.length)];
        } else {
          scorer = outfieldPlayers[Math.floor(Math.random() * outfieldPlayers.length)];
        }

        // Check if there is an assistant (70% chance)
        let assistPlayer: Player | undefined;
        const hasAssist = Math.random() < 0.70;
        if (hasAssist) {
          const potentialAssistants = outfieldPlayers.filter(p => p.id !== scorer.id);
          if (potentialAssistants.length > 0) {
            assistPlayer = potentialAssistants[Math.floor(Math.random() * potentialAssistants.length)];
          }
        }

        // Increment team goals
        if (attackingSide === "home") {
          updatedFixture.homeScore += 1;
        } else {
          updatedFixture.awayScore += 1;
        }

        updatedFixture.stats[attackingSide].shots += 1;
        updatedFixture.stats[attackingSide].shotsOnTarget += 1;

        const commTemplate = goalCommentaries[Math.floor(Math.random() * goalCommentaries.length)];
        const goalCommentary = assistPlayer
          ? `⚽ GOAL! ${attackingTeam.name} scores! ${scorer.name} slots it home. Assist by ${assistPlayer.name}.`
          : `⚽ GOAL! ${attackingTeam.name} scores! ${scorer.name} ${commTemplate}`;

        updatedFixture.events.push({
          minute: matchMinute,
          type: "GOAL",
          teamId: attackingTeam.id,
          playerId: scorer.id,
          playerName: scorer.name,
          assistantPlayerId: assistPlayer?.id,
          assistantPlayerName: assistPlayer?.name,
          commentary: goalCommentary
        });
      }

    } else if (actionRand < sBound) {
      // 🧤 SHOT SAVED BY KEEPER
      // Find goalkeeper on field
      const defenderGK = defendingActive.onField.find(p => p.position === "GK") || defendingTeam.players.find(p => p.position === "GK") || defendingTeam.players[0];
      
      updatedFixture.stats[attackingSide].shots += 1;
      updatedFixture.stats[attackingSide].shotsOnTarget += 1;
      updatedFixture.stats[defendingSide].saves += 1;

      const commentaryTemplate = saveCommentaries[Math.floor(Math.random() * saveCommentaries.length)];
      updatedFixture.events.push({
        minute: matchMinute,
        type: "SAVE",
        teamId: defendingTeam.id,
        playerId: defenderGK.id,
        playerName: defenderGK.name,
        commentary: `🧤 Great Save! ${defenderGK.name} ${commentaryTemplate} to stop a shot from the opposite side.`
      });

    } else if (actionRand < 0.78) {
      // 🎯 SHOT MISSED
      updatedFixture.stats[attackingSide].shots += 1;
      
      const outfieldPlayers = attackingActive.onField.filter(p => p.position !== "GK");
      if (outfieldPlayers.length > 0) {
        const shooter = outfieldPlayers[Math.floor(Math.random() * outfieldPlayers.length)];
        const commentaryTemplate = missCommentaries[Math.floor(Math.random() * missCommentaries.length)];

        updatedFixture.events.push({
          minute: matchMinute,
          type: "MISS",
          commentary: `🎯 Close! ${shooter.name} ${commentaryTemplate}`
        });
      }

    } else if (actionRand < 0.90) {
      // Passes & Corners increase
      updatedFixture.stats.home.passes += Math.floor(Math.random() * 25) + 15;
      updatedFixture.stats.away.passes += Math.floor(Math.random() * 25) + 15;
      
      // Corner award
      updatedFixture.stats[attackingSide].corners += 1;
      updatedFixture.events.push({
        minute: matchMinute,
        type: "COMMENTARY",
        commentary: `🚩 Corner kick for ${attackingTeam.name}. The cross comes flying into the box but is headed away by defenders.`
      });
    } else {
      updatedFixture.stats.home.passes += Math.floor(Math.random() * 15) + 5;
      updatedFixture.stats.away.passes += Math.floor(Math.random() * 15) + 5;
    }
  } else {
    // Passive minutes - increment statistics passes
    updatedFixture.stats.home.passes += Math.floor(Math.random() * 20) + 10;
    updatedFixture.stats.away.passes += Math.floor(Math.random() * 20) + 10;
  }

  // --- SHIFT IN-PLAY ODDS EVERY TICK BASED ON SCORELINE ---
  if (currentTick >= 1 && currentTick <= 15) {
    const diff = updatedFixture.homeScore - updatedFixture.awayScore;
    let homeShift = 1.0;
    let awayShift = 1.0;
    let drawShift = 1.0;

    // Remaining match time fraction (1.0 = full time remaining, 0.0 = match ended)
    const timeRemaining = Math.max(0, 90 - matchMinute) / 90;

    // A difference of 1 goal
    if (diff === 1) {
      homeShift = 0.5 + timeRemaining * 0.4;
      awayShift = 3.0 - timeRemaining * 1.5;
      drawShift = 2.0 - timeRemaining * 0.8;
    } else if (diff === -1) {
      homeShift = 3.0 - timeRemaining * 1.5;
      awayShift = 0.5 + timeRemaining * 0.4;
      drawShift = 2.0 - timeRemaining * 0.8;
    } else if (diff === 2) {
      homeShift = 0.15 + timeRemaining * 0.2;
      awayShift = 8.0 - timeRemaining * 3.0;
      drawShift = 4.0 - timeRemaining * 1.5;
    } else if (diff === -2) {
      homeShift = 8.0 - timeRemaining * 3.0;
      awayShift = 0.15 + timeRemaining * 0.2;
      drawShift = 4.0 - timeRemaining * 1.5;
    } else if (diff >= 3) {
      homeShift = 0.01;
      awayShift = 50.0;
      drawShift = 20.0;
    } else if (diff <= -3) {
      homeShift = 50.0;
      awayShift = 0.01;
      drawShift = 20.0;
    } else { // diff === 0
      homeShift = 1.0 + (1.0 - timeRemaining) * 0.5;
      awayShift = 1.0 + (1.0 - timeRemaining) * 0.5;
      drawShift = Math.max(0.01, 1.0 - (1.0 - timeRemaining) * 0.8);
    }

    updatedFixture.odds.homeWin = Math.max(1.01, Math.round((updatedFixture.odds.homeWin * homeShift) * 100) / 100);
    updatedFixture.odds.awayWin = Math.max(1.01, Math.round((updatedFixture.odds.awayWin * awayShift) * 100) / 100);
    updatedFixture.odds.draw = Math.max(1.01, Math.round((updatedFixture.odds.draw * drawShift) * 100) / 100);

    // If one side is 4+ goals up, only suspend the LOSING team's win odds.
    // The leading team's win odds remain available (they're very short but not suspended).
    if (diff >= 4) {
      // Away cannot realistically win from 4 down
      updatedFixture.odds.awayWin = NaN;
      updatedFixture.odds.draw = NaN;
    } else if (diff <= -4) {
      // Home cannot realistically win from 4 down
      updatedFixture.odds.homeWin = NaN;
      updatedFixture.odds.draw = NaN;
    }
  }

  // Half time Check
  if (currentTick === 7) {
    updatedFixture.events.push({
      minute: 45,
      type: "HALF_TIME",
      commentary: `⏸️ HALF TIME! Score is ${homeTeam.name} ${updatedFixture.homeScore} - ${updatedFixture.awayScore} ${awayTeam.name}. Teams exit to the dressing rooms.`
    });
  }

  // Full time check for 90m
  if (currentTick === 15) {
    updatedFixture.events.push({
      minute: 90,
      type: "FULL_TIME",
      commentary: `🏁 FULL TIME! Score is ${homeTeam.name} ${updatedFixture.homeScore} - ${updatedFixture.awayScore} ${awayTeam.name}.`
    });

    const isLeague = fixture.id.startsWith("l"); // matches both "l-" and "ls-" league fixtures
    if (!isLeague && updatedFixture.homeScore === updatedFixture.awayScore) {
      updatedFixture.events.push({
        minute: 90,
        type: "COMMENTARY",
        commentary: `⏱️ EXTRA TIME! The teams are inseparable after 90 minutes. We are playing 30 minutes of Extra Time (AET)!`
      });
      updatedFixture.status = "LIVE";
    } else {
      updatedFixture.status = "FT";
    }
  }

  // Extra Time half time check
  if (currentTick === 18) {
    updatedFixture.events.push({
      minute: 105,
      type: "COMMENTARY",
      commentary: `⏸️ EXTRA TIME HALF TIME! Score is ${homeTeam.name} ${updatedFixture.homeScore} - ${updatedFixture.awayScore} ${awayTeam.name}. A brief 1-minute breather before swapping halves.`
    });
  }

  // Extra Time full-time check (120')
  if (currentTick === 20) {
    updatedFixture.events.push({
      minute: 120,
      type: "COMMENTARY",
      commentary: `🏁 EXTRA TIME FULL TIME! Final Score (AET): ${homeTeam.name} ${updatedFixture.homeScore} - ${updatedFixture.awayScore} ${awayTeam.name}.`
    });

    if (updatedFixture.homeScore === updatedFixture.awayScore) {
      simulatePenaltyShootout(updatedFixture, homeTeam, awayTeam);
    } else {
      updatedFixture.status = "FT";
    }
  }

  return updatedFixture;
}

// 5. Penalty Shootout Simulator (for KO Draws)
function simulatePenaltyShootout(fixture: Fixture, homeTeam: Team, awayTeam: Team) {
  fixture.events.push({
    minute: 120,
    type: "COMMENTARY",
    commentary: "🤝 DRAW after Extra Time! We go into a dramatic Penalty Shootout to determine who progresses!"
  });

  let hWins = false;
  let pIndex = 0;
  const homePenalties: boolean[] = [];
  const awayPenalties: boolean[] = [];

  const homeKeeper = homeTeam.players.find(p => p.position === "GK") || homeTeam.players[0];
  const awayKeeper = awayTeam.players.find(p => p.position === "GK") || awayTeam.players[0];

  const homeShooters = homeTeam.players.filter(p => p.position !== "GK");
  const awayShooters = awayTeam.players.filter(p => p.position !== "GK");

  // Keep taking penalties until there's a winner (minimum 5 rounds, then sudden death)
  while (true) {
    pIndex++;
    
    // Home team penalty
    const homeShooter = homeShooters[(pIndex - 1) % homeShooters.length];
    const homeScored = Math.random() < (0.75 + (homeShooter.rating - homeKeeper.rating) / 150);
    homePenalties.push(homeScored);

    fixture.events.push({
      minute: 120,
      type: "COMMENTARY",
      commentary: homeScored
        ? `⚽ Pen ${pIndex} (${homeTeam.shortName}): ${homeShooter.name} steps up... SCORED! Calms his nerves and roofs it past the keeper.`
        : `❌ Pen ${pIndex} (${homeTeam.shortName}): ${homeShooter.name} steps up... SAVED! ${awayKeeper.name} guesses correctly and blocks the shot!`
    });

    // Away team penalty
    const awayShooter = awayShooters[(pIndex - 1) % awayShooters.length];
    const awayScored = Math.random() < (0.75 + (awayShooter.rating - awayKeeper.rating) / 150);
    awayPenalties.push(awayScored);

    fixture.events.push({
      minute: 120,
      type: "COMMENTARY",
      commentary: awayScored
        ? `⚽ Pen ${pIndex} (${awayTeam.shortName}): ${awayShooter.name} steps up... SCORED! Sent the keeper the wrong way.`
        : `❌ Pen ${pIndex} (${awayTeam.shortName}): ${awayShooter.name} steps up... MISSED! Hits the outside of the post!`
    });

    // Calculate penalty scores
    const hScoredCount = homePenalties.filter(Boolean).length;
    const aScoredCount = awayPenalties.filter(Boolean).length;

    // Standard 5 pen evaluation, or sudden death after 5
    if (pIndex >= 5) {
      if (hScoredCount !== aScoredCount) {
        hWins = hScoredCount > aScoredCount;
        fixture.events.push({
          minute: 120,
          type: "COMMENTARY",
          commentary: `🏆 SHOOTOUT FINISHED! ${hWins ? homeTeam.name : awayTeam.name} wins the penalty shootout ${hScoredCount} - ${aScoredCount}!`
        });
        break;
      }
    }
    
    // Quick early terminate if mathematical impossibility
    if (pIndex < 5) {
      const hRemainingPr = 5 - homePenalties.length;
      const aRemainingPr = 5 - awayPenalties.length;
      
      if (hScoredCount > aScoredCount + aRemainingPr) {
        hWins = true;
        fixture.events.push({
          minute: 120,
          type: "COMMENTARY",
          commentary: `🏆 SHOOTOUT FINISHED! ${homeTeam.name} wins ${hScoredCount} - ${aScoredCount} on penalties before completion because they cannot be caught!`
        });
        break;
      }
      if (aScoredCount > hScoredCount + hRemainingPr) {
        hWins = false;
        fixture.events.push({
          minute: 120,
          type: "COMMENTARY",
          commentary: `🏆 SHOOTOUT FINISHED! ${awayTeam.name} wins ${aScoredCount} - ${hScoredCount} on penalties before completion!`
        });
        break;
      }
    }

    if (pIndex > 15) { // Insurance against infinite loop
      hWins = Math.random() > 0.5;
      break;
    }
  }

  // Calculate and store penalty winner and score
  const hPens = homePenalties.filter(Boolean).length;
  const aPens = awayPenalties.filter(Boolean).length;
  fixture.penaltyScore = `${hPens}-${aPens}`;

  if (hWins) {
    fixture.homeScore += 0.1; // Small decimal allows tracking of pen wins programmatically: home wins
  } else {
    fixture.awayScore += 0.1; // Away wins on pens
  }
  
  fixture.status = "FT";
}

// 6. Instantly Simulate Full Match
export function simulateFullMatchInstantly(fixture: Fixture, homeTeam: Team, awayTeam: Team): Fixture {
  let simulated = { ...fixture };
  const startTick = fixture.elapsedTicks + 1;
  for (let tick = startTick; tick <= 15; tick++) {
    simulated = simulateMatchTick(simulated, homeTeam, awayTeam, tick);
  }
  // If match went to Extra Time (remains LIVE), run ET as well!
  if (simulated.status === "LIVE") {
    const etStart = Math.max(16, simulated.elapsedTicks + 1);
    for (let tick = etStart; tick <= 20; tick++) {
      simulated = simulateMatchTick(simulated, homeTeam, awayTeam, tick);
    }
  }
  simulated.status = "FT";
  return simulated;
}
