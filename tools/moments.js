// Prints the replay's test moments (plan section B4) straight from the tracker, so the numbers in tests
// and in the plan never come from memory.   node tools/moments.js [path/to/replay.json]
// Plays go in one at a time in the order they happened, exactly as the replay feeds them.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTracker } from "../src/tracker.js";
import { windows } from "../src/replay.js";
import { rankGames, DIALS } from "../src/model.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(readFileSync(process.argv[2] ?? path.join(root, "app/replay.json"), "utf8"));
const plays = [...data.plays].sort((a, b) => a.wallclock - b.wallclock);
const tracker = createTracker({ leagues: data.leagues, players: data.players, games: data.games });

const ET = { timeZone: "America/New_York" };
const et = (ms) => new Date(ms).toLocaleTimeString("en-US", { ...ET, hour: "numeric", minute: "2-digit" });
const pct = (x) => `${Math.round(x * 100)}%`;
const n1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
const signed = (x) => `${x >= 0 ? "+" : ""}${n1(x)}`;
const move = (c) => c.wp[0].after - c.wp[0].before;
const ONE_PM = Date.parse("2026-10-18T17:00:00Z");

// The plays the plan talks about, found by game, player and headline.
const WANTED = [
  { game: "CHI @ ATL", who: /Swift/, label: /^4-yd rush TD/ },
  { game: "TEN @ IND", who: /Taylor/, label: /^38-yd catch/, sketch: "1:40 PM, after Taylor's 38-yd catch" },
  { game: "CHI @ ATL", who: /Swift/, label: /^2-yd rush TD/ },
  { game: "BAL @ CLE", who: /Flowers/, label: /^31-yd catch/ },
  { game: "TEN @ IND", who: /Taylor/, label: /^4-yd rush TD/, sketch: "3:42 PM, after Taylor's 4-yd TD" },
  { game: "ARI @ LAR", who: /Brissett/, turnover: true },
  { game: "LAC @ KC", who: /Walker/, label: /^33-yd rush TD/ },
  { game: "LAC @ KC", who: /Walker/, label: /^2-yd rush TD/ },
];
const matches = (q, c) => c.gameName === q.game && q.who.test(c.name) && (!q.label || q.label.test(c.label)) && (!q.turnover || c.turnover);

const found = new Map(); // query -> card
const sketches = [];
const leadChanges = [];
const firstCardOfGame = new Set();
let low = null, biggest = null, biggestMarker = null, lead = null, ariLarPeriod = null;

for (const p of plays) {
  for (const c of tracker.addPlays(p.gameId, [p])) {
    const m = tracker.snapshot().matchups[0];
    const opener = !firstCardOfGame.has(c.gameId);
    firstCardOfGame.add(c.gameId);
    if (c.kind === "marker") {
      if (!biggestMarker || Math.abs(move(c)) > Math.abs(move(biggestMarker))) biggestMarker = c;
      continue;
    }
    if (c.wallclock >= ONE_PM && (!low || m.winProb < low.wp)) low = { wp: m.winProb, card: c };
    if (!biggest || Math.abs(move(c)) > Math.abs(move(biggest))) biggest = c;
    const now = m.myNow > m.oppNow ? "you" : m.myNow < m.oppNow ? "opp" : lead;
    if (lead && now !== lead) leadChanges.push({ card: c, to: now, score: `${n1(m.myNow)}–${n1(m.oppNow)}`, opener });
    lead = now;
    for (const q of WANTED) if (!found.has(q) && matches(q, c)) {
      found.set(q, c);
      if (q.sketch) sketches.push({ title: q.sketch, ...sketch() });
    }
  }
  if (p.id === "401873004888") ariLarPeriod = tracker.game(p.gameId).period;
}

function sketch() {
  const snap = tracker.snapshot(), m = snap.matchups[0];
  const rem = (list) => list.reduce((s, x) => s + x.remaining, 0);
  const myRem = rem(m.mine), oppRem = rem(m.theirs);
  const close = 1 - Math.abs(2 * m.winProb - 1), volume = Math.min(1, (myRem + oppRem) / 40);
  const top = tracker.feed().filter((c) => c.impacts.length).slice(0, 3)
    .map((c) => `${c.name} ${c.label} (${c.situation ?? "-"}, ${c.impacts.map((i) => signed(i.delta)).join(" ")}${Math.abs(move(c)) >= 0.005 ? `, ${pct(c.wp[0].before)}→${pct(c.wp[0].after)}` : ""})`);
  const onField = [...m.mine, ...m.theirs].filter((x) => x.game?.state === "in" && x.game.offense === x.nflTeam && ["QB", "RB", "WR", "TE"].includes(x.pos))
    .map((x) => `${x.owner === "me" ? "Y" : "P"} ${x.name}`);
  const states = { in: 0, pre: 0, post: 0 };
  for (const g of snap.games) states[g.state]++;
  const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const ranked = rankGames({ games: snap.games, matchups: snap.matchups, dials: DIALS.fantasyOn }).slice(0, 2)
    .map((x) => `${x.game.away}@${x.game.home} ${x.game.awayScore}-${x.game.homeScore} Q${x.game.period} ${clock(x.game.clockSec)} (${x.involved.map((p) => `${p.owner === "me" ? "Y" : "P"} ${p.name}`).join(", ")})`);
  return {
    score: `${n1(m.myNow)}–${n1(m.oppNow)}`, win: `${(m.winProb * 100).toFixed(1)}% (shown ${pct(m.winProb)})`,
    other: [
      `top My-matchup cards: ${top.join("; ")}`,
      `on the field: ${onField.join(", ") || "nobody"}`,
      `sweat ${Math.round(100 * close * (0.4 + 0.6 * volume))}; need ${n1(Math.max(0, m.oppNow + oppRem - m.myNow))}; your ${m.mine.filter((x) => x.game?.state !== "post").length} left expected ${n1(myRem)}`,
      `games ${states.in} live / ${states.pre} next / ${states.post} final`,
      `top tiles: ${ranked.join("; ")}`,
    ],
  };
}

const row = (cells) => console.log(`| ${cells.join(" | ")} |`);
const points = (c) => c.impacts.map((i) => `${signed(i.delta)} ${i.owner === "me" ? "you" : "opp"}${i.pos === "DEF" ? " D/ST" : ""}`).join(", ") || "—";
const win = (c) => `${pct(c.wp[0].before)}→${pct(c.wp[0].after)}`;
const title = (c) => `${c.name || c.offense || ""} ${c.label}`.trim();

const feed = tracker.feed();
console.log(`# Replay moments (${data.plays.length} plays, ${data.games.length} games)\n`);
console.log(`- Feed: ${feed.length} cards, ${feed.filter((c) => c.impacts.length).length} My matchup, ${feed.filter((c) => c.big).length} Big, ${feed.filter((c) => c.kind === "marker").length} markers (${feed.filter((c) => c.kind === "marker" && c.big).length} big)`);
console.log(`- Jump windows: ${windows(data).map((w) => `${w.label} (${w.games.length} game${w.games.length === 1 ? "" : "s"})`).join(", ")}`);
console.log(`- ARI@LAR period after play 401873004888 ("End of Half" / END QUARTER 1): ${ariLarPeriod}`);
const window437 = feed.filter((c) => c.wallclock >= Date.parse("2026-10-18T20:36:00Z") && c.wallclock < Date.parse("2026-10-18T20:40:00Z"));
console.log(`- Cards 4:36–4:40 PM: ${window437.length}, biggest win move ${Math.max(...window437.map((c) => Math.abs(move(c)))).toFixed(3)}`);
console.log(`- Biggest marker win move: ${biggestMarker ? Math.abs(move(biggestMarker)).toFixed(3) : "none"}\n`);

row(["ET", "Game", "Play", "Points", "Your win"]);
row(["---", "---", "---", "---", "---"]);
const lines = [];
if (low) lines.push({ t: low.card.wallclock, cells: [low.card.gameName, title(low.card), "—", `low point ${pct(low.wp)}`] });
for (const [q, c] of found) lines.push({ t: c.wallclock, cells: [c.gameName, `${title(c)}${c.situation ? ` (${c.situation})` : ""}${c === biggest ? " [biggest real swing]" : ""}`, points(c), win(c)] });
if (!found.has(WANTED.find((q) => q.who.test("Walker"))) && biggest) lines.push({ t: biggest.wallclock, cells: [biggest.gameName, `${title(biggest)} [biggest real swing]`, points(biggest), win(biggest)] });
for (const l of leadChanges) lines.push({ t: l.card.wallclock, cells: [l.card.gameName, title(l.card), `lead → ${l.to} ${l.score}`, l.opener ? "first play of the game: D/ST starting bonus, not an alert" : win(l.card)] });
for (const l of lines.sort((a, b) => a.t - b.t)) row([et(l.t), ...l.cells]);
const end = tracker.snapshot().matchups[0];
row([et(plays.at(-1).wallclock), "—", "End of saved plays", `${n1(end.myNow)}–${n1(end.oppNow)}`, pct(end.winProb)]);

console.log("\n## Sketch moments\n");
for (const s of sketches) {
  console.log(`### ${s.title}\n- score ${s.score}, win ${s.win}`);
  for (const o of s.other) console.log(`- ${o}`);
  console.log("");
}
