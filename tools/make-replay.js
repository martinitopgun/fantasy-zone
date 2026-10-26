// Builds app/replay.json: every real play of Week 6 (ESPN), ontopgun's real league and lineups (Sleeper),
// and each player's projection and profile, so the app can replay the whole Sunday at real speed.
//   node tools/make-replay.js
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { byPlayerId } from "../src/sleeper.js";
import { fantasyPoints, describeLeague } from "../src/scoring.js";
import { buildProfiles } from "../src/profiles.js";
import { parseScoreboard } from "../src/espn.js";
import { fixtureName } from "../src/net.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = async (f) => JSON.parse(await readFile(path.join(root, f), "utf8"));
const fx = (url) => read(`fixtures/${fixtureName(url)}`);
const POS = "season_type=regular&position[]=QB&position[]=RB&position[]=WR&position[]=TE&position[]=K&position[]=DEF";
const LEAGUE = "1384804048019927040";

const league = (await fx("https://api.sleeper.app/v1/user/1384803681437753344/leagues/nfl/2026"))[0];
const scoring = league.scoring_settings;
const projRows = await fx(`https://api.sleeper.app/projections/nfl/2026/6?${POS}`);
const proj = byPlayerId(projRows);
const pastWeeks = [];
for (let w = 1; w <= 5; w++) pastWeeks.push({ projections: byPlayerId(await fx(`https://api.sleeper.app/projections/nfl/2026/${w}?${POS}`)), stats: byPlayerId(await fx(`https://api.sleeper.app/stats/nfl/2026/${w}?${POS}`)) });
const profile = buildProfiles({ pastWeeks, scoring });

// Every game on the schedule, with odds from ESPN where the game file has them.
const files = {};
for (const f of (await readdir(path.join(root, "fixtures/week6"))).filter((f) => f.startsWith("game-"))) {
  const g = await read(`fixtures/week6/${f}`);
  files[g.id] = g;
}
const schedule = parseScoreboard(await read(`fixtures/${fixtureName("https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard")}`));
const games = schedule.map((g) => {
  const f = files[g.id];
  return { id: g.id, home: g.home, away: g.away, kickoff: g.kickoff, favorite: f?.favorite ?? g.favorite, spread: f?.spread ?? g.spread, overUnder: f?.overUnder ?? g.overUnder };
});

const starter = (id) => {
  const row = proj.get(id);
  const pos = row?.player?.position ?? "DEF";
  const team = row?.team ?? id;
  const p = profile(id, pos, team);
  return {
    id, pos, team,
    name: pos === "DEF" ? `${team} D/ST` : `${row.player.first_name} ${row.player.last_name}`,
    projected: Math.round(fantasyPoints(row?.stats, scoring) * 10) / 10,
    profile: { rzShare: p.rzShare, boomRate: p.boomRate, booms: p.booms, games: p.games, spread: p.spread },
    boomFactor: 1 + p.boomRate,
  };
};
const matchups = await read(`fixtures/${fixtureName(`https://api.sleeper.app/v1/league/${LEAGUE}/matchups/6`)}`);
const players = projRows.filter((r) => r.player && r.team && r.player.position !== "DEF")
  .map((r) => ({ id: r.player_id, first: r.player.first_name, last: r.player.last_name, team: r.team, pos: r.player.position }));

const plays = Object.values(files).flatMap((g) => g.plays).sort((a, b) => a.wallclock - b.wallclock);

// The whole league for the League tab (fixtures/league, saved once from Sleeper): every team's Week 6 starters,
// the 5 pairings, weeks 1-5 results for the standings, and the latest moves. Display names only (team names
// can be anything).
const lf = (f) => read(`fixtures/league/${f}.json`);
const users = new Map((await lf("users")).map((u) => [u.user_id, u.display_name]));
const rosters = await lf("rosters");
const week6 = await lf("matchups_6");
// Your matchup keeps the lineups saved on Sunday (the league file was saved later, after a Monday kicker swap).
const sundayStarters = (rid) => (matchups.find((m) => m.roster_id === rid) ?? week6.find((m) => m.roster_id === rid)).starters;
const teams = rosters.map((r) => ({
  roster_id: r.roster_id, owner: users.get(r.owner_id) ?? `Team ${r.roster_id}`, me: users.get(r.owner_id) === "ontopgun",
  starters: sundayStarters(r.roster_id).map(starter),
}));
const pairings = Object.values(Object.groupBy(week6, (m) => m.matchup_id)).map((ms) => ms.map((m) => m.roster_id));
const results = [];
for (let w = 1; w <= 5; w++) results.push({ week: w, rows: (await lf(`matchups_${w}`)).map((m) => ({ roster_id: m.roster_id, matchup_id: m.matchup_id, points: m.points })) });
const nameOf = (id) => { const r = proj.get(id); return /^[A-Z]{2,3}$/.test(id) ? `${id} D/ST` : r?.player ? `${r.player.first_name} ${r.player.last_name}` : `Player ${id}`; };
const moves = [];
for (const w of [5, 6]) {
  for (const t of await lf(`transactions_${w}`)) {
    if (t.status !== "complete" || !["trade", "waiver", "free_agent"].includes(t.type)) continue;
    const list = (o) => Object.entries(o ?? {}).map(([id, rid]) => ({ id, name: nameOf(id), roster_id: rid }));
    moves.push({ t: t.created, type: t.type, roster_ids: t.roster_ids, adds: list(t.adds), drops: list(t.drops), bid: t.settings?.waiver_bid ?? null });
  }
}
moves.sort((a, b) => b.t - a.t);

// Every player's Week 6 projection (only the stats a league can score) and profile, so the app can rebuild
// this replay for anyone's Sleeper league.
const keys = new Set(Object.keys(scoring));
const projStats = {}, profiles = {};
for (const r of projRows) {
  if (!r.player || !r.stats) continue;
  const pos = r.player.position;
  if ((r.stats.pts_ppr ?? 0) < 0.5 && pos !== "DEF") continue;
  const st = {};
  for (const [k, v] of Object.entries(r.stats)) if (keys.has(k) && v) st[k] = Math.round(v * 100) / 100;
  projStats[r.player_id] = st;
  const p = profile(r.player_id, pos ?? "DEF", r.team ?? r.player_id);
  profiles[r.player_id] = [pos ?? "DEF", r.team ?? r.player_id, Math.round(p.spread * 10) / 10, Math.round(p.boomRate * 100) / 100, Math.round(p.rzShare * 100) / 100, p.booms, p.games];
}

await writeFile(path.join(root, "app/replay.json"), JSON.stringify({
  projStats, profiles,
  note: "Every real play of NFL Week 6 (ESPN) with ontopgun's real Sleeper league.",
  user: "ontopgun",
  leagues: [{
    league: { league_id: league.league_id, name: league.name, roster_positions: league.roster_positions }, scoring, info: describeLeague(league), opponentName: "marcelolopezm2010", weight: 1,
    mine: matchups.find((m) => m.roster_id === 1).starters.map(starter),
    theirs: matchups.find((m) => m.roster_id === 7).starters.map(starter),
    teams, pairings, results, moves, savedAt: "2026-10-20",
  }],
  players, games, plays,
}));
console.log(`wrote app/replay.json: ${games.length} games, ${plays.length} plays, ${players.length} players`);
