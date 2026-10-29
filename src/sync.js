// The automatic chain: Sleeper username -> leagues -> my team + this week's opponent
// -> projections + past weeks -> live ESPN games -> the model.

import { sleeper, byPlayerId } from "./sleeper.js";
import { espn } from "./espn.js";
import { describeLeague, fantasyPoints } from "./scoring.js";
import { buildProfiles } from "./profiles.js";
import { buildMatchupView } from "./model.js";

const HISTORY_WEEKS = 5;

export async function syncEverything(fetchJson, { username, leagueIds = null, weights = {} }) {
  const api = sleeper(fetchJson);
  const user = await api.user(username);
  if (!user) throw new Error(`No Sleeper user called "${username}"`);
  const state = await api.state();
  const season = state.league_season ?? state.season;
  const week = state.week;

  const allLeagues = (await api.leagues(user.user_id, season)) ?? [];
  const leagues = allLeagues.filter((l) => l.status === "in_season" && (!leagueIds || leagueIds.includes(l.league_id)));

  const pastWeekNums = [];
  for (let w = Math.max(1, week - HISTORY_WEEKS); w < week; w++) pastWeekNums.push(w);

  const [projRows, games, ...past] = await Promise.all([
    api.projections(season, week),
    espn(fetchJson).scoreboard(),
    ...pastWeekNums.flatMap((w) => [api.projections(season, w), api.stats(season, w)]),
  ]);
  const projections = byPlayerId(projRows);
  const pastWeeks = pastWeekNums.map((_, i) => ({ projections: byPlayerId(past[2 * i]), stats: byPlayerId(past[2 * i + 1]) }));
  const gamesByTeam = new Map();
  for (const g of games) { gamesByTeam.set(g.home, g); gamesByTeam.set(g.away, g); }

  const profileCache = new Map(); // leagues with identical scoring share one set of profiles
  const matchups = [];
  const skipped = [];

  for (const league of leagues) {
    const info = describeLeague(league);
    const [rosters, members, weekMatchups] = await Promise.all([api.rosters(league.league_id), api.users(league.league_id), api.matchups(league.league_id, week)]);
    const myRoster = rosters.find((r) => r.owner_id === user.user_id || r.co_owners?.includes(user.user_id));
    const me = weekMatchups?.find((m) => m.roster_id === myRoster?.roster_id);
    const opponent = me?.matchup_id != null ? weekMatchups.find((m) => m.matchup_id === me.matchup_id && m.roster_id !== me.roster_id) : null;
    if (!me || !opponent) {
      skipped.push({ league, info, reason: info.type === "Guillotine" ? "guillotine league (no head-to-head opponent yet)" : "no matchup this week" });
      continue;
    }
    const key = JSON.stringify(league.scoring_settings);
    if (!profileCache.has(key)) profileCache.set(key, buildProfiles({ pastWeeks, scoring: league.scoring_settings }));
    const oppOwner = rosters.find((r) => r.roster_id === opponent.roster_id)?.owner_id;
    const oppUser = members.find((u) => u.user_id === oppOwner);
    // The whole league this week, for the League tab: every team's starters, the pairings and the records so far.
    const prof = profileCache.get(key), scoring = league.scoring_settings;
    const starterOf = (id) => {
      const row = projections.get(id);
      const pos = row?.player?.position ?? (/^[A-Z]{2,3}$/.test(id) ? "DEF" : "?");
      const team = row?.team ?? (pos === "DEF" ? id : null);
      return { id, pos, team, name: pos === "DEF" ? `${id} D/ST` : row?.player ? `${row.player.first_name} ${row.player.last_name}` : `Player ${id}`, projected: fantasyPoints(row?.stats, scoring), profile: prof(id, pos, team) };
    };
    const names = new Map(members.map((u) => [u.user_id, u.display_name]));
    const teams = rosters.map((r) => ({
      roster_id: r.roster_id, owner: names.get(r.owner_id) ?? `Team ${r.roster_id}`, me: r.roster_id === myRoster.roster_id,
      starters: (weekMatchups.find((m) => m.roster_id === r.roster_id)?.starters ?? []).filter((id) => id && id !== "0").map(starterOf),
    }));
    const groups = new Map();
    for (const m of weekMatchups) if (m.matchup_id != null) groups.set(m.matchup_id, [...(groups.get(m.matchup_id) ?? []), m.roster_id]);
    const records = Object.fromEntries(rosters.map((r) => [r.roster_id, { w: r.settings?.wins ?? 0, l: r.settings?.losses ?? 0, t: r.settings?.ties ?? 0, pf: (r.settings?.fpts ?? 0) + (r.settings?.fpts_decimal ?? 0) / 100 }]));
    matchups.push({
      teams, pairings: [...groups.values()].filter((g) => g.length === 2), records,
      ...buildMatchupView({
        league, scoring: league.scoring_settings, me, opponent, projections, gamesByTeam,
        profile: profileCache.get(key), weight: weights[league.league_id] ?? 1,
      }),
      info,
      opponentName: oppUser?.metadata?.team_name || oppUser?.display_name || "Opponent",
    });
  }

  return { user, season, week, games, matchups, skipped, totalLeagues: allLeagues.length, projections };
}
