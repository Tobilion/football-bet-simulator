import { Team, Player, Position } from "../types";
import { generatePlayerAge, generateEmptySeasonStats } from "../utils/playerUtils";

// Names pool per nationality to generate high-fidelity players
const playerNamesByRegion: { [key: string]: { first: string[]; last: string[] } } = {
  ENG: {
    first: ["Harry", "John", "Jack", "Marcus", "Declan", "Luke", "Trent", "Jude", "Phil", "Mason", "Kyle", "Bukayo", "Ollie", "Harvey", "Cole", "Conor", "Jordan", "Kieran", "James", "Aaron"],
    last: ["Stones", "Walker", "Rice", "Pickford", "Shaw", "Grealish", "Rashford", "Bellingham", "Foden", "Saka", "Palmer", "Watkins", "Gallagher", "Trippier", "White", "Ramsdale", "Pope", "Madueke", "Bowen", "Gordon"]
  },
  ESP: {
    first: ["Alvaro", "Rodri", "Unai", "Dani", "Gavi", "Pedri", "Nico", "Ferran", "Lamine", "Pau", "Aymeric", "Alejandro", "Martin", "Jose", "Alex", "David", "Marc", "Iago", "Mikel", "Koke"],
    last: ["Morata", "Hernandez", "Simon", "Carvajal", "Gavi", "Pedri", "Williams", "Torres", "Yamal", "Cubarsi", "Laporte", "Balde", "Zubimendi", "Merino", "Grimaldo", "Raya", "Cucurella", "Aspas", "Oyarzabal", "Resurreccion"]
  },
  GER: {
    first: ["Manuel", "Thomas", "Leroy", "Serge", "Leon", "Joshua", "Kai", "Jamal", "Florian", "Maximilian", "Jonathan", "Antonio", "Emre", "Waldemar", "Nico", "Robin", "Benjamin", "Julian", "Kevin", "Oliver"],
    last: ["Neuer", "Muller", "Sane", "Gnabry", "Goretzka", "Kimmich", "Havertz", "Musiala", "Wirtz", "Mittelstadt", "Tah", "Rudiger", "Can", "Anton", "Schlotterbeck", "Koch", "Henrichs", "Brandt", "Funn", "Baumann"]
  },
  ITA: {
    first: ["Gianluigi", "Alessandro", "Federico", "Nicolo", "Gianluca", "Lorenzo", "Matteo", "Davide", "Andrea", "Giovanni", "Francesco", "Cristiano", "Manuel", "Manuel", "Samuele", "Giacomo", "Moise", "Ciro", "Stephan", "Destiny"],
    last: ["Donnarumma", "Bastoni", "Chiesa", "Barella", "Scamacca", "Pellegrini", "Darmian", "Frattesi", "Cambiaso", "Di Lorenzo", "Acerbi", "Mancini", "Locatelli", "Dimarco", "Ricci", "Raspadori", "Kean", "Immobile", "El Shaarawy", "Udogie"]
  },
  FRA: {
    first: ["Kylian", "Antoine", "Ousmane", "Warren", "Eduardo", "Aurelien", "Theo", "William", "Dayot", "Ibrahima", "Jules", "Mike", "Adrien", "Marcus", "Randal", "Christopher", "Kingsley", "Youssouf", "Lucas", "Wesley"],
    last: ["Mbappe", "Griezmann", "Dembele", "Zaire-Emery", "Camavinga", "Tchouameni", "Hernandez", "Saliba", "Upamecano", "Konate", "Kounde", "Maignan", "Rabiot", "Thuram", "Kolo-Muani", "Nkunku", "Coman", "Fofana", "Digne", "Fofana"]
  },
  INTL: {
    first: ["Robert", "Luka", "Erling", "Mohamed", "Kevin", "Alisson", "Bruno", "Son", "Viktor", "Luuk", "Santiago", "Mattia", "Angel", "Ederson", "Lautaro", "Dušan", "Rafael", "Ademola", "Takefusa", "Eberechi"],
    last: ["Lewandowski", "Modric", "Haaland", "Salah", "De Bruyne", "Becker", "Fernandes", "Heung-min", "Gyokeres", "de Jong", "Gimenez", "Zaccagni", "Di Maria", "Moraes", "Martinez", "Vlahovic", "Leao", "Lookman", "Kubo", "Eze"]
  }
};

const rawTeamsData = [
  { id: "1", name: "Real Madrid", shortName: "RMA", rating: 5.0, primaryColor: "#F3F3F3", secondaryColor: "#C19A6B", region: "ESP", superstar: { name: "Kylian Mbappé", position: "ATT" as Position, rating: 97 } },
  { id: "2", name: "Manchester City", shortName: "MCI", rating: 5.0, primaryColor: "#6CABDD", secondaryColor: "#1C2C5B", region: "ENG", superstar: { name: "Erling Haaland", position: "ATT" as Position, rating: 97 } },
  { id: "3", name: "Bayern Munich", shortName: "FCB", rating: 4.8, primaryColor: "#DC052D", secondaryColor: "#FFFFFF", region: "GER", superstar: { name: "Harry Kane", position: "ATT" as Position, rating: 95 } },
  { id: "4", name: "Paris Saint-Germain", shortName: "PSG", rating: 4.7, primaryColor: "#0052B4", secondaryColor: "#E30613", region: "FRA", superstar: { name: "Ousmane Dembélé", position: "ATT" as Position, rating: 91 } },
  { id: "5", name: "Arsenal", shortName: "ARS", rating: 4.8, primaryColor: "#EF0107", secondaryColor: "#FFFFFF", region: "ENG", superstar: { name: "Bukayo Saka", position: "ATT" as Position, rating: 94 } },
  { id: "6", name: "Liverpool", shortName: "LIV", rating: 4.8, primaryColor: "#C8102E", secondaryColor: "#F5EB61", region: "ENG", superstar: { name: "Mohamed Salah", position: "ATT" as Position, rating: 94 } },
  { id: "7", name: "Barcelona", shortName: "BAR", rating: 4.7, primaryColor: "#004D98", secondaryColor: "#A50044", region: "ESP", superstar: { name: "Robert Lewandowski", position: "ATT" as Position, rating: 93 } },
  { id: "8", name: "Inter Milan", shortName: "INT", rating: 4.7, primaryColor: "#008FD7", secondaryColor: "#111111", region: "ITA", superstar: { name: "Lautaro Martínez", position: "ATT" as Position, rating: 93 } },
  { id: "9", name: "Bayer Leverkusen", shortName: "LEV", rating: 4.6, primaryColor: "#E32219", secondaryColor: "#000000", region: "GER", superstar: { name: "Florian Wirtz", position: "MID" as Position, rating: 92 } },
  { id: "10", name: "Borussia Dortmund", shortName: "BVB", rating: 4.5, primaryColor: "#FDE100", secondaryColor: "#111111", region: "GER", superstar: { name: "Serhou Guirassy", position: "ATT" as Position, rating: 88 } },
  { id: "11", name: "Atletico Madrid", shortName: "ATM", rating: 4.5, primaryColor: "#CB3524", secondaryColor: "#FFFFFF", region: "ESP", superstar: { name: "Antoine Griezmann", position: "ATT" as Position, rating: 90 } },
  { id: "12", name: "Juventus", shortName: "JUV", rating: 4.5, primaryColor: "#FFFFFF", secondaryColor: "#000000", region: "ITA", superstar: { name: "Dušan Vlahović", position: "ATT" as Position, rating: 89 } },
  { id: "13", name: "AC Milan", shortName: "ACM", rating: 4.5, primaryColor: "#E32221", secondaryColor: "#111111", region: "ITA", superstar: { name: "Rafael Leão", position: "ATT" as Position, rating: 90 } },
  { id: "14", name: "Aston Villa", shortName: "AVL", rating: 4.4, primaryColor: "#95BFE5", secondaryColor: "#6c1D45", region: "ENG", superstar: { name: "Ollie Watkins", position: "ATT" as Position, rating: 88 } },
  { id: "15", name: "Newcastle United", shortName: "NEW", rating: 4.4, primaryColor: "#111111", secondaryColor: "#FFFFFF", region: "ENG", superstar: { name: "Alexander Isak", position: "ATT" as Position, rating: 90 } },
  { id: "16", name: "Manchester United", shortName: "MUN", rating: 4.4, primaryColor: "#DA291C", secondaryColor: "#111111", region: "ENG", superstar: { name: "Bruno Fernandes", position: "MID" as Position, rating: 91 } },
  { id: "17", name: "Chelsea", shortName: "CHE", rating: 4.5, primaryColor: "#034694", secondaryColor: "#FFFFFF", region: "ENG", superstar: { name: "Cole Palmer", position: "MID" as Position, rating: 92 } },
  { id: "18", name: "Tottenham Hotspur", shortName: "TOT", rating: 4.4, primaryColor: "#FFFFFF", secondaryColor: "#132257", region: "ENG", superstar: { name: "Heung-min Son", position: "ATT" as Position, rating: 90 } },
  { id: "19", name: "Napoli", shortName: "NAP", rating: 4.4, primaryColor: "#12A0D7", secondaryColor: "#FFFFFF", region: "ITA", superstar: { name: "Khvicha Kvaratskhelia", position: "ATT" as Position, rating: 90 } },
  { id: "20", name: "Sporting CP", shortName: "SCP", rating: 4.3, primaryColor: "#00805C", secondaryColor: "#FFFFFF", region: "INTL", superstar: { name: "Viktor Gyökeres", position: "ATT" as Position, rating: 91 } },
  { id: "21", name: "Brighton", shortName: "BHA", rating: 4.3, primaryColor: "#0057B8", secondaryColor: "#FFFFFF", region: "ENG", superstar: { name: "Kaoru Mitoma", position: "ATT" as Position, rating: 87 } },
  { id: "22", name: "West Ham United", shortName: "WHU", rating: 4.2, primaryColor: "#7A263A", secondaryColor: "#1BB1E7", region: "ENG", superstar: { name: "Jarrod Bowen", position: "ATT" as Position, rating: 86 } },
  { id: "23", name: "AS Roma", shortName: "ROM", rating: 4.3, primaryColor: "#8E1F2F", secondaryColor: "#F0A814", region: "ITA", superstar: { name: "Paulo Dybala", position: "ATT" as Position, rating: 89 } },
  { id: "24", name: "SS Lazio", shortName: "LAZ", rating: 4.2, primaryColor: "#87D3F8", secondaryColor: "#102F54", region: "ITA", superstar: { name: "Mattia Zaccagni", position: "ATT" as Position, rating: 85 } },
  { id: "25", name: "Benfica", shortName: "SLB", rating: 4.3, primaryColor: "#E32219", secondaryColor: "#FFFFFF", region: "INTL", superstar: { name: "Ángel Di María", position: "MID" as Position, rating: 87 } },
  { id: "26", name: "FC Porto", shortName: "FCP", rating: 4.3, primaryColor: "#005CA9", secondaryColor: "#FFFFFF", region: "INTL", superstar: { name: "Galeno", position: "ATT" as Position, rating: 86 } },
  { id: "27", name: "Feyenoord", shortName: "FEY", rating: 4.1, primaryColor: "#DA2128", secondaryColor: "#111111", region: "INTL", superstar: { name: "Santiago Giménez", position: "ATT" as Position, rating: 85 } },
  { id: "28", name: "PSV Eindhoven", shortName: "PSV", rating: 4.2, primaryColor: "#E3001B", secondaryColor: "#FFFFFF", region: "INTL", superstar: { name: "Luuk de Jong", position: "ATT" as Position, rating: 85 } },
  { id: "29", name: "Real Sociedad", shortName: "RSO", rating: 4.2, primaryColor: "#005CA9", secondaryColor: "#FFFFFF", region: "ESP", superstar: { name: "Takefusa Kubo", position: "ATT" as Position, rating: 87 } },
  { id: "30", name: "Atalanta", shortName: "ATA", rating: 4.3, primaryColor: "#0375B4", secondaryColor: "#111111", region: "ITA", superstar: { name: "Ademola Lookman", position: "ATT" as Position, rating: 89 } },
  { id: "31", name: "AFC Bournemouth", shortName: "BOU", rating: 4.0, primaryColor: "#CC0000", secondaryColor: "#111111", region: "ENG", superstar: { name: "Antoine Semenyo", position: "ATT" as Position, rating: 83 } },
  { id: "32", name: "Crystal Palace", shortName: "CRY", rating: 4.1, primaryColor: "#004B93", secondaryColor: "#DA1A32", region: "ENG", superstar: { name: "Eberechi Eze", position: "MID" as Position, rating: 86 } },
  // ─── Division 2 (lower league clubs eligible for promotion) ───────────────
  { id: "33", name: "Stoke City", shortName: "STK", rating: 3.2, primaryColor: "#E03A3E", secondaryColor: "#1B3668", region: "ENG", superstar: { name: "Tom Ince", position: "ATT" as Position, rating: 76 } },
  { id: "34", name: "Coventry City", shortName: "COV", rating: 3.3, primaryColor: "#87CEEB", secondaryColor: "#1E90FF", region: "ENG", superstar: { name: "Callum O'Hare", position: "MID" as Position, rating: 77 } },
  { id: "35", name: "Leeds United", shortName: "LEE", rating: 3.5, primaryColor: "#FFFFFF", secondaryColor: "#1D428A", region: "ENG", superstar: { name: "Crysencio Summerville", position: "ATT" as Position, rating: 80 } },
  { id: "36", name: "Sunderland", shortName: "SUN", rating: 3.1, primaryColor: "#EB172B", secondaryColor: "#111111", region: "ENG", superstar: { name: "Ellis Simms", position: "ATT" as Position, rating: 75 } },
  { id: "37", name: "Swansea City", shortName: "SWA", rating: 3.0, primaryColor: "#FFFFFF", secondaryColor: "#111111", region: "ENG", superstar: { name: "Jerry Yates", position: "MID" as Position, rating: 74 } },
  { id: "38", name: "Millwall", shortName: "MIL", rating: 3.0, primaryColor: "#001D5E", secondaryColor: "#FFFFFF", region: "ENG", superstar: { name: "Zian Flemming", position: "MID" as Position, rating: 75 } },
  { id: "39", name: "Watford", shortName: "WAT", rating: 3.2, primaryColor: "#FBEE23", secondaryColor: "#ED2127", region: "ENG", superstar: { name: "Vakoun Bayo", position: "ATT" as Position, rating: 77 } },
  { id: "40", name: "Preston North End", shortName: "PNE", rating: 3.0, primaryColor: "#FFFFFF", secondaryColor: "#1E48A2", region: "ENG", superstar: { name: "Emil Riis", position: "ATT" as Position, rating: 74 } },
  { id: "41", name: "Middlesbrough", shortName: "MBR", rating: 3.3, primaryColor: "#EE3124", secondaryColor: "#111111", region: "ENG", superstar: { name: "Emmanuel Latte Lath", position: "ATT" as Position, rating: 78 } },
  { id: "42", name: "Sheffield Wednesday", shortName: "SHW", rating: 3.1, primaryColor: "#0066CC", secondaryColor: "#FFFFFF", region: "ENG", superstar: { name: "Josh Windass", position: "ATT" as Position, rating: 75 } },
  { id: "43", name: "Cardiff City", shortName: "CAR", rating: 2.9, primaryColor: "#0070B5", secondaryColor: "#FFFFFF", region: "ENG", superstar: { name: "Callum Robinson", position: "ATT" as Position, rating: 73 } },
  { id: "44", name: "Hull City", shortName: "HUL", rating: 3.0, primaryColor: "#F5971D", secondaryColor: "#111111", region: "ENG", superstar: { name: "Oscar Estupinan", position: "ATT" as Position, rating: 74 } },
  { id: "45", name: "Queens Park Rangers", shortName: "QPR", rating: 2.9, primaryColor: "#005CAB", secondaryColor: "#FFFFFF", region: "ENG", superstar: { name: "Lyndon Dykes", position: "ATT" as Position, rating: 73 } },
  { id: "46", name: "Plymouth Argyle", shortName: "PLY", rating: 2.8, primaryColor: "#007B5E", secondaryColor: "#FFFFFF", region: "ENG", superstar: { name: "Morgan Whittaker", position: "MID" as Position, rating: 72 } },
  { id: "47", name: "Oxford United", shortName: "OXF", rating: 2.8, primaryColor: "#F4C400", secondaryColor: "#0B2C6A", region: "ENG", superstar: { name: "Siriki Dembele", position: "ATT" as Position, rating: 71 } },
  { id: "48", name: "Bristol City", shortName: "BSC", rating: 2.9, primaryColor: "#CC0000", secondaryColor: "#FFFFFF", region: "ENG", superstar: { name: "Tommy Conway", position: "ATT" as Position, rating: 73 } },
];

// Helper to seed random details deterministically or pseudo-randomly
function generateDeterministicSquad(teamId: string, region: string, rating: number, superstar: { name: string; position: Position; rating: number }): Player[] {
  const players: Player[] = [];
  const startId = parseInt(teamId) * 100;
  const teamNum = isNaN(parseInt(teamId)) ? 1 : parseInt(teamId);
  const regionKey = (region && playerNamesByRegion[region]) ? region : "ENG";
  const pool = playerNamesByRegion[regionKey];
  
  // 1 Goalkeeper (GK)
  const gkSeed = (teamNum * 17 + 1) % pool.first.length;
  const gkLastSeed = (teamNum * 23 + 1 * 7 + 11) % pool.last.length;
  const gkFirst = pool.first[gkSeed] || "Keeper";
  const gkLast = pool.last[gkLastSeed] || "Safe";
  const gkName = `${gkFirst} ${gkLast} (GK)`;
  const gkRating = Math.max(70, Math.min(Math.round(rating * 18 + 5 + (teamNum % 5)), 98));
  
  const gkAbils = {
    diving: Math.max(60, Math.min(99, Math.round(gkRating + (teamNum % 2) - 1))),
    handling: Math.max(60, Math.min(99, Math.round(gkRating - 2))),
    kicking: Math.max(55, Math.min(99, Math.round(gkRating - (teamNum % 4) - 3))),
    reflexes: Math.max(65, Math.min(99, Math.round(gkRating + (teamNum % 3) + 2))),
    speed: Math.max(40, Math.min(95, Math.round(gkRating - 15 - (teamNum % 10)))),
    positioning: Math.max(60, Math.min(99, Math.round(gkRating + 1)))
  };

  players.push({
    id: `${startId}-1`,
    name: gkName,
    teamId,
    position: "GK",
    rating: gkRating,
    age: generatePlayerAge("GK"),
    fatigue: 0,
    injured: false,
    injuryRecoveryMatches: 0,
    seasonStats: generateEmptySeasonStats(),
    goals: 0,
    assists: 0,
    saves: 0,
    yellowCards: 0,
    redCards: 0,
    matchesPlayed: 0,
    abilities: gkAbils
  });

  // 4 Defenders (DEF)
  for (let i = 2; i <= 5; i++) {
    const fSeed = (teamNum * 17 + i * 3) % pool.first.length;
    const lSeed = (teamNum * 23 + i * 7 + 11) % pool.last.length;
    const defFirst = pool.first[fSeed] || "Defender";
    const defLast = pool.last[lSeed] || "Wall";
    const defName = `${defFirst} ${defLast}`;
    const defRating = Math.max(68, Math.min(Math.round(rating * 17 + 3 + (fSeed % 8)), 95));

    const defAbils = {
      pace: Math.max(50, Math.min(99, Math.round(defRating - 8 + (fSeed % 5)))),
      shooting: Math.max(30, Math.min(85, Math.round(defRating - 25 + (fSeed % 10)))),
      passing: Math.max(55, Math.min(95, Math.round(defRating - 5 + (fSeed % 4)))),
      dribbling: Math.max(50, Math.min(92, Math.round(defRating - 10 + (fSeed % 3)))),
      defending: Math.max(70, Math.min(99, Math.round(defRating + 4))),
      physical: Math.max(65, Math.min(99, Math.round(defRating + 2 + (fSeed % 3))))
    };

    players.push({
      id: `${startId}-${i}`,
      name: defName,
      teamId,
      position: "DEF",
      rating: defRating,
      age: generatePlayerAge("DEF"),
      fatigue: 0,
      injured: false,
      injuryRecoveryMatches: 0,
      seasonStats: generateEmptySeasonStats(),
      goals: 0,
      assists: 0,
      saves: 0,
      yellowCards: 0,
      redCards: 0,
      matchesPlayed: 0,
      abilities: defAbils
    });
  }

  // 4 Midfielders (MID)
  for (let i = 6; i <= 9; i++) {
    if (superstar.position === "MID" && i === 6) {
      const superRating = superstar.rating;
      const superAbils = {
        pace: Math.max(65, Math.min(99, Math.round(superRating - 3))),
        shooting: Math.max(65, Math.min(99, Math.round(superRating - 5))),
        passing: Math.max(75, Math.min(99, Math.round(superRating + 3))),
        dribbling: Math.max(75, Math.min(99, Math.round(superRating + 2))),
        defending: Math.max(50, Math.min(95, Math.round(superRating - 10))),
        physical: Math.max(60, Math.min(95, Math.round(superRating - 4)))
      };

      players.push({
        id: `${startId}-${i}`,
        name: superstar.name,
        teamId,
        position: "MID",
        rating: superRating,
        age: generatePlayerAge("MID"),
        fatigue: 0,
        injured: false,
        injuryRecoveryMatches: 0,
        seasonStats: generateEmptySeasonStats(),
        goals: 0,
        assists: 0,
        saves: 0,
        yellowCards: 0,
        redCards: 0,
        matchesPlayed: 0,
        abilities: superAbils
      });
      continue;
    }

    const fSeed = (teamNum * 17 + i * 3) % pool.first.length;
    const lSeed = (teamNum * 23 + i * 7 + 11) % pool.last.length;
    const midFirst = pool.first[fSeed] || "Midfielder";
    const midLast = pool.last[lSeed] || "Sparks";
    const midName = `${midFirst} ${midLast}`;
    const midRating = Math.max(68, Math.min(Math.round(rating * 17.5 + 4 + (fSeed % 6)), 94));

    const midAbils = {
      pace: Math.max(55, Math.min(99, Math.round(midRating - 4 + (fSeed % 5)))),
      shooting: Math.max(50, Math.min(95, Math.round(midRating - 8 + (fSeed % 6)))),
      passing: Math.max(65, Math.min(99, Math.round(midRating + 4 + (fSeed % 3)))),
      dribbling: Math.max(65, Math.min(99, Math.round(midRating + 3))),
      defending: Math.max(40, Math.min(80, Math.round(midRating - 12 + (fSeed % 5)))),
      physical: Math.max(55, Math.min(92, Math.round(midRating - 3 + (fSeed % 4))))
    };

    players.push({
      id: `${startId}-${i}`,
      name: midName,
      teamId,
      position: "MID",
      rating: midRating,
      age: generatePlayerAge("MID"),
      fatigue: 0,
      injured: false,
      injuryRecoveryMatches: 0,
      seasonStats: generateEmptySeasonStats(),
      goals: 0,
      assists: 0,
      saves: 0,
      yellowCards: 0,
      redCards: 0,
      matchesPlayed: 0,
      abilities: midAbils
    });
  }

  // 3 Attackers (ATT)
  for (let i = 19; i <= 21; i++) {
    if (i === 19 && superstar.position === "ATT") {
      players.push({
        id: `${startId}-${i}`,
        name: superstar.name,
        teamId,
        position: "ATT",
        rating: superstar.rating,
        age: generatePlayerAge("ATT"),
        fatigue: 0,
        injured: false,
        injuryRecoveryMatches: 0,
        seasonStats: generateEmptySeasonStats(),
        goals: 0,
        assists: 0,
        saves: 0,
        yellowCards: 0,
        redCards: 0,
        matchesPlayed: 0,
        abilities: {
          pace: Math.min(99, superstar.rating + 2),
          shooting: Math.min(99, superstar.rating + 3),
          passing: Math.max(60, superstar.rating - 5),
          dribbling: Math.min(99, superstar.rating + 1),
          defending: Math.max(20, superstar.rating - 35),
          physical: Math.max(55, superstar.rating - 5)
        }
      });
      continue;
    }

    const fSeed = (teamNum * 17 + i * 3) % pool.first.length;
    const lSeed = (teamNum * 23 + i * 7 + 11) % pool.last.length;
    const attFirst = pool.first[fSeed] || "Attacker";
    const attLast = pool.last[lSeed] || "Striker";
    const attName = `${attFirst} ${attLast}`;
    const attRating = Math.max(68, Math.min(Math.round(rating * 17 + 2 + (fSeed % 7)), 94));

    const attAbils = {
      pace: Math.max(68, Math.min(99, Math.round(attRating + 3))),
      shooting: Math.max(65, Math.min(99, Math.round(attRating + 4))),
      passing: Math.max(55, Math.min(92, Math.round(attRating - 5 + (fSeed % 4)))),
      dribbling: Math.max(65, Math.min(99, Math.round(attRating + 2))),
      defending: Math.max(20, Math.min(65, Math.round(attRating - 30))),
      physical: Math.max(55, Math.min(95, Math.round(attRating - 2 + (fSeed % 3))))
    };

    players.push({
      id: `${startId}-${i}`,
      name: attName,
      teamId,
      position: "ATT",
      rating: attRating,
      age: generatePlayerAge("ATT"),
      fatigue: 0,
      injured: false,
      injuryRecoveryMatches: 0,
      seasonStats: generateEmptySeasonStats(),
      goals: 0,
      assists: 0,
      saves: 0,
      yellowCards: 0,
      redCards: 0,
      matchesPlayed: 0,
      abilities: attAbils
    });
  }

  return players;
}

export const DIV1_IDS = new Set(["1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","17","18","19","20","21","22","23","24","25","26","27","28","29","30","31","32"]);
export const DIV2_IDS = new Set(["33","34","35","36","37","38","39","40","41","42","43","44","45","46","47","48"]);

export function getInitialTeams(): Team[] {
  return rawTeamsData.map(rt => {
    const div: 1 | 2 = DIV1_IDS.has(rt.id) ? 1 : 2;
    return {
      id: rt.id,
      name: rt.name,
      shortName: rt.shortName,
      rating: rt.rating,
      primaryColor: rt.primaryColor,
      secondaryColor: rt.secondaryColor,
      players: generateDeterministicSquad(rt.id, rt.region, rt.rating, rt.superstar),
      wonMatches: 0,
      drawnMatches: 0,
      lostMatches: 0,
      goalsScored: 0,
      goalsConceded: 0,
      morale: 60,
      rivalClubIds: [],
      division: div,
    };
  });
}
