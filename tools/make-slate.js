// Builds app/slate.json for the simulated-Sunday demo: the real Week 6 schedule, each team's
// real top players (with Boom Rate and red-zone share from real stats), and ontopgun's real matchup.
//   node tools/make-slate.js

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { byPlayerId } from "../src/sleeper.js";
import { fantasyPoints } from "../src/scoring.js";
import { buildProfiles } from "../src/profiles.js";
import { parseScoreboard } from "../src/espn.js";
import { fixtureName } from "../src/net.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const fx = async (url) => JSON.parse(await readFile(path.join(root, "fixtures", fixtureName(url)), "utf8"));
const POS = "season_type=regular&position[]=QB&position[]=RB&position[]=WR&position[]=TE&position[]=K&position[]=DEF";
const LEAGUE = "1384804048019927040";

const league = (await fx("https://api.sleeper.app/v1/user/1384803681437753344/leagues/nfl/2026"))[0];
const scoring = league.scoring_settings;
const proj = byPlayerId(await fx(`https://api.sleeper.app/projections/nfl/2026/6?${POS}`));
const pastWeeks = [];
for (let w = 1; w <= 5; w++) {
  pastWeeks.push({ projections: byPlayerId(await fx(`https://api.sleeper.app/projections/nfl/2026/${w}?${POS}`)), stats: byPlayerId(await fx(`https://api.sleeper.app/stats/nfl/2026/${w}?${POS}`)) });
}
const profile = buildProfiles({ pastWeeks, scoring });

const games = parseScoreboard(JSON.parse(await readFile(path.join(root, "fixtures/espn-frames/3.json"), "utf8")))
  .map((g) => ({ id: g.id, home: g.home, away: g.away, kickoff: g.kickoff, favorite: g.favorite, spread: g.spread, overUnder: g.overUnder }))
  .sort((a, b) => a.kickoff.localeCompare(b.kickoff));

const player = (id, row) => {
  const pos = row.player?.position;
  const p = profile(id, pos, row.team);
  return {
    id, pos, team: row.team,
    name: pos === "DEF" ? `${row.team} D/ST` : `${row.player.first_name} ${row.player.last_name}`,
    short: pos === "DEF" ? row.team : `${row.player.first_name[0]}.${row.player.last_name}`,
    projected: Math.round(fantasyPoints(row.stats, scoring) * 10) / 10,
    rush: row.stats.rush_att ?? 0, targets: row.stats.rec_tgt ?? 0,
    profile: { rzShare: p.rzShare, boomRate: p.boomRate, booms: p.booms, games: p.games, spread: p.spread },
  };
};

// Each team's depth chart for the simulator: who runs, who catches, who kicks.
const teams = {};
for (const [id, row] of proj) {
  const pos = row.player?.position;
  if (!row.team || !pos || !(row.stats?.gp > 0 || pos === "DEF")) continue;
  (teams[row.team] ??= []).push(player(id, row));
}
const pick = (list, pos, n, key) => list.filter((p) => p.pos === pos).sort((a, b) => b[key] - a[key]).slice(0, n);
const depth = {};
for (const [team, list] of Object.entries(teams)) {
  depth[team] = {
    QB: pick(list, "QB", 1, "projected"), RB: pick(list, "RB", 2, "rush"),
    WR: pick(list, "WR", 3, "targets"), TE: pick(list, "TE", 1, "targets"), K: pick(list, "K", 1, "projected"),
  };
}

const matchups = JSON.parse(await readFile(path.join(root, "fixtures", fixtureName(`https://api.sleeper.app/v1/league/${LEAGUE}/matchups/6`)), "utf8"));
const side = (m) => m.starters.map((id) => {
  const row = proj.get(id) ?? { team: id, player: { position: "DEF" }, stats: {} };
  const p = player(id, row);
  // Make sure every fantasy starter is on his team's depth chart, so he gets the ball in the sim.
  const d = depth[p.team];
  if (d && d[p.pos] && !d[p.pos].some((x) => x.id === id)) d[p.pos].push(p);
  return p;
});

await writeFile(path.join(root, "app/slate.json"), JSON.stringify({
  note: "Real Week 6 schedule, players and projections. Plays are simulated.",
  league: { league_id: league.league_id, name: league.name, scoring_settings: scoring },
  info: { format: "PPR" }, opponentName: "marcelolopezm2010",
  mine: side(matchups.find((m) => m.roster_id === 1)), theirs: side(matchups.find((m) => m.roster_id === 7)),
  games, depth,
}));
console.log(`wrote app/slate.json: ${games.length} games, ${Object.keys(depth).length} teams`);
