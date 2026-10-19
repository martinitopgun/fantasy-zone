#!/usr/bin/env node
// Test the brain from a terminal:
//   node src/cli.js <sleeper-username>                 live data
//   node src/cli.js <sleeper-username> --offline       saved data in fixtures/
//   options: --league <id> (repeatable)  --fantasy-off  --players

import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeFetchJson } from "./net.js";
import { syncEverything } from "./sync.js";
import { rankGames, DIALS } from "./model.js";

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const leagueIds = args.flatMap((a, i) => (args[i - 1] === "--league" ? [a] : []));
const username = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--league");
if (!username) {
  console.log("Usage: node src/cli.js <sleeper-username> [--offline] [--league <id>] [--fantasy-off] [--players]");
  process.exit(1);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const fetchJson = makeFetchJson({ fixturesDir: flag("--offline") ? path.join(here, "..", "fixtures") : null });
const pct = (x) => (x > 0.99 && x < 1 ? ">99%" : x < 0.01 && x > 0 ? "<1%" : `${Math.round(x * 100)}%`);
const n1 = (x) => x.toFixed(1);

const data = await syncEverything(fetchJson, { username, leagueIds: leagueIds.length ? leagueIds : null });
console.log(`\n✅ Synced ${data.user.display_name} · ${data.season} week ${data.week} · ${data.totalLeagues} leagues found, ${data.matchups.length} with a matchup this week`);

console.log("\n━━ YOUR MATCHUPS (auto-detected scoring) ━━");
for (const m of data.matchups) {
  console.log(`\n${m.league.name}  [${m.info.label}]`);
  console.log(`  You ${n1(m.myNow)}  vs  ${m.opponentName} ${n1(m.oppNow)}`);
  console.log(`  Projected final ${n1(m.myFinal)} – ${n1(m.oppFinal)}  →  win chance ${pct(m.winProb)}`);
  if (flag("--players")) {
    for (const p of [...m.mine, ...m.theirs]) {
      const who = p.owner === "me" ? "🟡" : "🟣";
      const st = p.game ? (p.game.state === "post" ? "done" : p.game.state === "in" ? "LIVE" : "later") : "bye";
      console.log(`   ${who} ${p.pos.padEnd(3)} ${p.name.padEnd(24)} ${p.nflTeam ?? "--"} ${st.padEnd(5)} now ${n1(p.current).padStart(5)}  left ${n1(p.remaining).padStart(5)}  boom ${n1(p.boomFactor)} (${p.profile.booms}/${p.profile.games} games)  RZ ${pct(p.profile.rzShare)}`);
    }
  }
}
for (const s of data.skipped) console.log(`\n(skipped ${s.league.name}: ${s.reason})`);

const dials = flag("--fantasy-off") ? DIALS.fantasyOff : DIALS.fantasyOn;
const ranked = rankGames({ games: data.games, matchups: data.matchups, dials }).filter((r) => r.game.state !== "post");
console.log(`\n━━ WHAT TO WATCH (${flag("--fantasy-off") ? "fantasy OFF" : "fantasy ON"}) ━━`);
ranked.forEach((r, i) => {
  const g = r.game;
  const status = g.state === "in" ? `Q${g.period} ${Math.floor(g.clockSec / 60)}:${String(g.clockSec % 60).padStart(2, "0")} · ${g.awayScore}-${g.homeScore}${g.downText ? ` · ${g.downText}` : ""}` : `kickoff ${new Date(g.kickoff).toUTCString().slice(0, 22)} UTC`;
  console.log(`\n${i === 0 ? "★ BIG SCREEN" : `#${i + 1}`}  ${g.name}  — Watch Score ${Math.round(r.watch)}  (fantasy ${Math.round(r.fantasy)}, game ${Math.round(r.gameScore)})`);
  console.log(`   ${status}`);
  console.log(`   why: ${r.reason}`);
});
console.log();
