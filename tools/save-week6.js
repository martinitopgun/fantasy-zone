// Converts raw ESPN game summaries into the slim per-game files kept in fixtures/week6/.
//   node tools/save-week6.js <dir with raw summary json files>
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseSummary } from "../src/plays.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = process.argv[2];
for (const f of (await readdir(dir)).filter((f) => f.endsWith(".json"))) {
  const game = parseSummary(JSON.parse(await readFile(path.join(dir, f), "utf8")));
  await writeFile(path.join(root, "fixtures/week6", `game-${game.id}.json`), JSON.stringify(game));
  console.log(game.id, `${game.away} @ ${game.home}`, game.state, `${game.plays.length} plays`);
}
