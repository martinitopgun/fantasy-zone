// Sleeper's free public API. No login: a username is enough to find every league.

const V1 = "https://api.sleeper.app/v1";
const POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"];
const positionQuery = POSITIONS.map((p) => `position[]=${p}`).join("&");

export function sleeper(fetchJson) {
  return {
    state: () => fetchJson(`${V1}/state/nfl`),
    user: (username) => fetchJson(`${V1}/user/${encodeURIComponent(username)}`),
    leagues: (userId, season) => fetchJson(`${V1}/user/${userId}/leagues/nfl/${season}`),
    rosters: (leagueId) => fetchJson(`${V1}/league/${leagueId}/rosters`),
    users: (leagueId) => fetchJson(`${V1}/league/${leagueId}/users`),
    matchups: (leagueId, week) => fetchJson(`${V1}/league/${leagueId}/matchups/${week}`),
    // Every player's projected stat line for a week (not points: we score them ourselves).
    projections: (season, week) =>
      fetchJson(`https://api.sleeper.app/projections/nfl/${season}/${week}?season_type=regular&${positionQuery}`),
    // Every player's real stat line for a finished week.
    stats: (season, week) =>
      fetchJson(`https://api.sleeper.app/stats/nfl/${season}/${week}?season_type=regular&${positionQuery}`),
  };
}

// Turn Sleeper's list format into { player_id: row } for quick lookups.
export function byPlayerId(rows) {
  const map = new Map();
  for (const row of rows ?? []) map.set(row.player_id, row);
  return map;
}
