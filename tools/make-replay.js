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

await writeFile(path.join(root, "app/replay.json"), JSON.stringify({
  note: "Every real play of NFL Week 6 (ESPN) with ontopgun's real Sleeper league.",
  user: "ontopgun",
  leagues: [{
    league: { league_id: league.league_id, name: league.name, roster_positions: league.roster_positions }, scoring, info: describeLeague(league), opponentName: "marcelolopezm2010", weight: 1,
    mine: matchups.find((m) => m.roster_id === 1).starters.map(starter),
    theirs: matchups.find((m) => m.roster_id === 7).starters.map(starter),
  }],
  players, games, plays,
}));
console.log(`wrote app/replay.json: ${games.length} games, ${plays.length} plays, ${players.length} players`);
