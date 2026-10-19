// Scores every rostered player from ESPN play-by-play and compares with Sleeper's official points.
//   node tools/check-scoring.js
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTracker } from "../src/tracker.js";
import { fixtureName } from "../src/net.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = async (f) => JSON.parse(await readFile(path.join(root, f), "utf8"));
const POS = "season_type=regular&position[]=QB&position[]=RB&position[]=WR&position[]=TE&position[]=K&position[]=DEF";

export async function loadWeek6() {
  const league = (await read(`fixtures/${fixtureName("https://api.sleeper.app/v1/user/1384803681437753344/leagues/nfl/2026")}`))[0];
  const proj = await read(`fixtures/${fixtureName(`https://api.sleeper.app/projections/nfl/2026/6?${POS}`)}`);
  const players = proj.filter((r) => r.player && r.team && r.player.position !== "DEF")
    .map((r) => ({ id: r.player_id, first: r.player.first_name, last: r.player.last_name, team: r.team, pos: r.player.position }));
  const games = [];
  for (const f of (await readdir(path.join(root, "fixtures/week6"))).filter((f) => f.startsWith("game-"))) games.push(await read(`fixtures/week6/${f}`));
  return { league, proj, players, games };
}

const { league, players, games } = await loadWeek6();
const official = await read("fixtures/week6/sleeper-points.json");
const tracker = createTracker({ leagues: [], players, games: games.map(({ plays, ...g }) => g) });
for (const g of games) tracker.addPlays(g.id, g.plays, { silent: true });
const mine = tracker.pointsById(league.scoring_settings);

const finals = new Set(games.filter((g) => g.state === "post").flatMap((g) => [g.home, g.away]));
const byId = new Map(players.map((p) => [p.id, p]));
let n = 0, exact = 0, close = 0, errSum = 0;
const misses = [];
for (const [id, pts] of Object.entries(official)) {
  const p = byId.get(id);
  const team = p?.team ?? id; // defenses use the team code as their id
  if (!finals.has(team)) continue;
  const got = mine[id] ?? 0;
  const err = Math.abs(got - pts);
  n++; errSum += err;
  if (err < 0.05) exact++; else if (err <= 1) close++;
  if (err >= 0.05) misses.push({ who: p ? `${p.first} ${p.last} ${p.pos} ${team}` : `${id} D/ST`, sleeper: pts, ours: Math.round(got * 100) / 100 });
}
console.log(`${n} players in finished games: ${exact} exact, ${close} within 1 point, average miss ${(errSum / n).toFixed(2)} pts`);
misses.sort((a, b) => Math.abs(b.sleeper - b.ours) - Math.abs(a.sleeper - a.ours));
for (const m of misses) console.log(`  ${m.who.padEnd(32)} sleeper ${String(m.sleeper).padStart(6)}  ours ${String(m.ours).padStart(6)}`);
