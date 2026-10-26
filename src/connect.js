// Sign in with a Sleeper username (no password) and rebuild last Sunday's replay for your own leagues.
//   findAccount(fetchJson, username) -> { user, leagues }     (2 calls)
//   syncLeagues(fetchJson, account, leagueIds, { week, onStep }) -> synced leagues (3 calls each)
//   replayLeagues(data, synced, activeId) -> the replay's `leagues`, the active league first
// fetchJson(url) returns parsed JSON (or null on 404).

import { fantasyPoints, describeLeague } from "./scoring.js";

const API = "https://api.sleeper.app/v1";
export const SEASON = "2026";
export const REPLAY_WEEK = 6;

export async function findAccount(fetchJson, username) {
  const user = await fetchJson(`${API}/user/${encodeURIComponent(username.trim().toLowerCase())}`);
  if (!user?.user_id) throw new Error(`No Sleeper user called "${username}". Check the spelling.`);
  const leagues = ((await fetchJson(`${API}/user/${user.user_id}/leagues/nfl/${SEASON}`)) ?? [])
    .filter((l) => l.status === "in_season" || l.status === "complete")
    .map((l) => ({ league_id: l.league_id, name: l.name, total_rosters: l.total_rosters, scoring_settings: l.scoring_settings, roster_positions: l.roster_positions, settings: { type: l.settings?.type } }));
  return { user: { user_id: user.user_id, username: user.username ?? username, display_name: user.display_name ?? username }, leagues };
}

export async function syncLeagues(fetchJson, account, leagueIds, { week = REPLAY_WEEK, onStep = () => {} } = {}) {
  const out = [];
  const list = account.leagues.filter((l) => leagueIds.includes(l.league_id));
  for (const [i, l] of list.entries()) {
    onStep(`Reading ${l.name} (${i + 1} of ${list.length})`);
    const [rosters, users, matchups] = await Promise.all([
      fetchJson(`${API}/league/${l.league_id}/rosters`), fetchJson(`${API}/league/${l.league_id}/users`), fetchJson(`${API}/league/${l.league_id}/matchups/${week}`),
    ]);
    const names = new Map((users ?? []).map((u) => [u.user_id, u.display_name]));
    out.push({
      ...l,
      teams: (rosters ?? []).map((r) => ({
        roster_id: r.roster_id, owner: names.get(r.owner_id) ?? `Team ${r.roster_id}`,
        me: r.owner_id === account.user.user_id || (r.co_owners ?? []).includes(account.user.user_id),
        wins: r.settings?.wins ?? 0, losses: r.settings?.losses ?? 0, ties: r.settings?.ties ?? 0, fpts: (r.settings?.fpts ?? 0) + (r.settings?.fpts_decimal ?? 0) / 100,
      })),
      matchups: (matchups ?? []).map((m) => ({ roster_id: m.roster_id, matchup_id: m.matchup_id, starters: m.starters ?? [], points: m.points ?? 0 })),
    });
  }
  return out;
}

// One starter as the tracker wants him, from the replay's saved projections and profiles.
function starter(data, id, scoring) {
  const pr = data.profiles?.[id];
  const pl = data.players.find((p) => p.id === id);
  const pos = pr?.[0] ?? pl?.pos ?? (/^[A-Z]{2,3}$/.test(id) ? "DEF" : "WR");
  const team = pr?.[1] ?? pl?.team ?? id;
  return {
    id, pos, team,
    name: pos === "DEF" ? `${team} D/ST` : pl ? `${pl.first} ${pl.last}` : `Player ${id}`,
    projected: Math.round(fantasyPoints(data.projStats?.[id] ?? {}, scoring) * 10) / 10,
    profile: { spread: pr?.[2] ?? 6, boomRate: pr?.[3] ?? 0.2, rzShare: pr?.[4] ?? 0, booms: pr?.[5] ?? 0, games: pr?.[6] ?? 0 },
    boomFactor: 1 + (pr?.[3] ?? 0.2),
  };
}

export function replayLeagues(data, synced, activeId) {
  const leagues = [];
  for (const l of synced) {
    const mine = l.teams.find((t) => t.me);
    const myM = l.matchups.find((m) => m.roster_id === mine?.roster_id);
    const oppM = myM && l.matchups.find((m) => m.matchup_id === myM.matchup_id && m.roster_id !== myM.roster_id);
    if (!myM || !oppM) continue; // no head-to-head game that week (bye, guillotine, ...)
    const scoring = l.scoring_settings;
    const startersOf = (rid) => (l.matchups.find((m) => m.roster_id === rid)?.starters ?? []).filter((id) => id && id !== "0");
    const groups = Object.values(Object.groupBy(l.matchups.filter((m) => m.matchup_id != null), (m) => m.matchup_id));
    leagues.push({
      league: { league_id: l.league_id, name: l.name, roster_positions: l.roster_positions },
      scoring, info: describeLeague(l), opponentName: l.teams.find((t) => t.roster_id === oppM.roster_id)?.owner ?? "Opponent", weight: 1,
      mine: startersOf(myM.roster_id).map((id) => starter(data, id, scoring)),
      theirs: startersOf(oppM.roster_id).map((id) => starter(data, id, scoring)),
      teams: l.teams.map((t) => ({ roster_id: t.roster_id, owner: t.owner, me: t.me, starters: startersOf(t.roster_id).map((id) => starter(data, id, scoring)) })),
      pairings: groups.filter((g) => g.length === 2).map((g) => g.map((m) => m.roster_id)),
      records: Object.fromEntries(l.teams.map((t) => {
        // Sleeper's records may already count this week: take it back out so the replay doesn't spoil it.
        const m = l.matchups.find((x) => x.roster_id === t.roster_id), o = m && l.matchups.find((x) => x.matchup_id === m.matchup_id && x.roster_id !== m.roster_id);
        const counted = t.wins + t.losses + t.ties >= REPLAY_WEEK && o && (m.points || o.points);
        const won = counted && m.points > o.points, lost = counted && m.points < o.points;
        return [t.roster_id, { w: t.wins - (won ? 1 : 0), l: t.losses - (lost ? 1 : 0), t: t.ties - (counted && !won && !lost ? 1 : 0), pf: t.fpts - (counted ? m.points : 0) }];
      })),
      results: [], moves: [],
    });
  }
  leagues.sort((a, b) => (b.league.league_id === activeId) - (a.league.league_id === activeId));
  return leagues;
}
