import { Fixture } from "../types";

export type FormResult = "W" | "D" | "L";

/**
 * Returns the last N completed results for a team, most recent last.
 */
export function getTeamForm(
  teamId: string,
  fixtures: Fixture[],
  n = 5,
): FormResult[] {
  const completed = fixtures
    .filter(
      (f) =>
        f.status === "FT" &&
        (f.homeTeamId === teamId || f.awayTeamId === teamId),
    )
    .sort((a, b) => a.roundIndex - b.roundIndex);

  const last = completed.slice(-n);

  return last.map((f) => {
    const isHome = f.homeTeamId === teamId;
    const gs = isHome ? Math.floor(f.homeScore) : Math.floor(f.awayScore);
    const gc = isHome ? Math.floor(f.awayScore) : Math.floor(f.homeScore);
    if (gs > gc) return "W";
    if (gs < gc) return "L";
    return "D";
  });
}

/**
 * Head-to-head record between two teams across all completed fixtures.
 */
export function getHeadToHead(
  homeId: string,
  awayId: string,
  fixtures: Fixture[],
): {
  played: number;
  homeWins: number;
  draws: number;
  awayWins: number;
  lastMeeting: { scoreline: string; roundIndex: number } | null;
} {
  const meetings = fixtures
    .filter(
      (f) =>
        f.status === "FT" &&
        ((f.homeTeamId === homeId && f.awayTeamId === awayId) ||
          (f.homeTeamId === awayId && f.awayTeamId === homeId)),
    )
    .sort((a, b) => a.roundIndex - b.roundIndex);

  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;

  for (const f of meetings) {
    const normalHome = f.homeTeamId === homeId;
    const hs = normalHome ? Math.floor(f.homeScore) : Math.floor(f.awayScore);
    const as_ = normalHome ? Math.floor(f.awayScore) : Math.floor(f.homeScore);
    if (hs > as_) homeWins++;
    else if (hs < as_) awayWins++;
    else draws++;
  }

  let lastMeeting: { scoreline: string; roundIndex: number } | null = null;
  if (meetings.length > 0) {
    const last = meetings[meetings.length - 1];
    const normalHome = last.homeTeamId === homeId;
    const hs = normalHome
      ? Math.floor(last.homeScore)
      : Math.floor(last.awayScore);
    const as_ = normalHome
      ? Math.floor(last.awayScore)
      : Math.floor(last.homeScore);
    lastMeeting = { scoreline: `${hs}-${as_}`, roundIndex: last.roundIndex };
  }

  return { played: meetings.length, homeWins, draws, awayWins, lastMeeting };
}

/**
 * Average goals scored and conceded by a team over their last N completed matches.
 */
export function getTeamGoalAvg(
  teamId: string,
  fixtures: Fixture[],
  n = 5,
): { scored: number; conceded: number } {
  const completed = fixtures
    .filter(
      (f) =>
        f.status === "FT" &&
        (f.homeTeamId === teamId || f.awayTeamId === teamId),
    )
    .sort((a, b) => a.roundIndex - b.roundIndex)
    .slice(-n);

  if (completed.length === 0) return { scored: 0, conceded: 0 };

  let totalScored = 0;
  let totalConceded = 0;
  for (const f of completed) {
    const isHome = f.homeTeamId === teamId;
    totalScored += isHome ? Math.floor(f.homeScore) : Math.floor(f.awayScore);
    totalConceded += isHome
      ? Math.floor(f.awayScore)
      : Math.floor(f.homeScore);
  }

  return {
    scored: Math.round((totalScored / completed.length) * 10) / 10,
    conceded: Math.round((totalConceded / completed.length) * 10) / 10,
  };
}
