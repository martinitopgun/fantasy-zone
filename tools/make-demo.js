// Builds app/demo.json: the engine's output for ontopgun's league, once per saved ESPN snapshot
// from Sunday night of Week 6. The app replays these frames when it can't reach live data.
//   node tools/make-demo.js

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeFetchJson } from "../src/net.js";
import { fixtureLoader } from "../src/fixtures.js";
import { syncEverything } from "../src/sync.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";

const frames = [];
for (const n of [1, 2, 3]) {
  const espnFrame = JSON.parse(await readFile(path.join(root, "fixtures/espn-frames", `${n}.json`), "utf8"));
  const fetchJson = makeFetchJson({ load: fixtureLoader(path.join(root, "fixtures"), { [SCOREBOARD]: espnFrame }) });
  const data = await syncEverything(fetchJson, { username: "ontopgun" });
  frames.push({
    games: data.games,
    matchups: data.matchups.map((m) => ({
      league: { league_id: m.league.league_id, name: m.league.name },
      info: m.info, opponentName: m.opponentName, weight: m.weight,
      myNow: m.myNow, oppNow: m.oppNow, myFinal: m.myFinal, oppFinal: m.oppFinal, spread: m.spread, winProb: m.winProb,
      mine: m.mine.map(slim), theirs: m.theirs.map(slim),
    })),
  });
}

function slim(p) {
  const { game, profile, ...rest } = p;
  return { ...rest, gameId: game?.id ?? null, profile: { rzShare: profile.rzShare, boomRate: profile.boomRate, booms: profile.booms, games: profile.games, spread: profile.spread } };
}

await writeFile(path.join(root, "app/demo.json"), JSON.stringify({ user: "ontopgun", season: "2026", week: 6, frames }));
console.log(`wrote app/demo.json with ${frames.length} frames`);
