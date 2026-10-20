// Free Picks (plan M7). Run with: npm test

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createReplay } from "../src/replay.js";
import { createPicks } from "../src/picks.js";

const data = JSON.parse(readFileSync(new URL("../app/replay.json", import.meta.url), "utf8"));
const et = (t) => new Date(t).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });

// From 1 PM at a given speed, answering every pick with `answer`.
function run({ speed = 5, until = Infinity, picks = createPicks(), answer = (p) => (p.kind === "drive" ? "td" : "yes") } = {}) {
  const r = createReplay(data, { startAt: Date.parse("2026-10-18T16:57:00Z") });
  while (!r.done && r.time < until) {
    picks.step({ cards: r.advance(1000, speed), snap: r.tracker.snapshot(), now: r.time, speed });
    for (const p of picks.open()) picks.choose(p.id, answer(p));
  }
  return picks;
}

test("picks: the red-zone drives behind Swift's and Taylor's TDs are offered and graded TD", () => {
  const list = run().list();
  const drive = (game, at) => list.find((p) => p.kind === "drive" && p.game === game && et(p.at) === at);
  assert.equal(drive("CHI @ ATL", "1:23 PM").answer, "td"); // Swift 4-yd TD at 1:27
  assert.equal(drive("CHI @ ATL", "2:17 PM").answer, "td"); // Swift 2-yd TD at 2:20
  assert.equal(drive("TEN @ IND", "3:39 PM").answer, "td"); // Taylor TD at 3:42
  assert.ok(list.filter((p) => p.kind === "drive").every((p) => ["td", "fg", "none", undefined].includes(p.answer)));
});

test("picks: Walker's projection pick is graded from his points; nothing is offered above 5x", () => {
  const walker = run().list().find((p) => p.kind === "player" && /Walker/.test(p.q));
  assert.equal(walker.state, "right"); // he scored more than his line
  const fast = run({ speed: 20, until: Date.parse("2026-10-18T19:00:00Z") });
  assert.equal(fast.list().length, 0);
});

test("picks: the score and finished picks survive a reload, and aren't offered twice", () => {
  let saved = null;
  const first = run({ picks: createPicks({ onSave: (s) => { saved = JSON.parse(JSON.stringify(s)); } }), until: Date.parse("2026-10-18T18:30:00Z") });
  const before = first.score();
  assert.ok(before.played > 0);
  const again = createPicks({ saved });
  assert.deepEqual(again.score(), before);
  run({ picks: again, until: Date.parse("2026-10-18T18:30:00Z") });
  assert.deepEqual(again.score(), before); // same moments, already answered
});

// Every string a person can read: string and template literals in the views and the text-making modules.
test("no gambling language anywhere in the UI", () => {
  const BAD = /\b(money|odds|prizes?|bets?|betting|wager|over\/under|spread|parlay|sportsbook|favorite)\b/i;
  const files = [
    ...readdirSync(new URL("../app/views/", import.meta.url)).map((f) => `../app/views/${f}`),
    "../app/index.html", "../app/app.js", "../app/ui/banner.js",
    "../src/picks.js", "../src/story.js", "../src/alerts.js", "../src/insights.js", "../src/view-models.js",
  ];
  const hits = [];
  for (const f of files) {
    const src = readFileSync(new URL(f, import.meta.url), "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/<!--[\s\S]*?-->/g, "");
    const strings = f.endsWith(".html") ? src.replace(/<style>[\s\S]*?<\/style>/g, "").split(/<[^>]+>/) : [...src.matchAll(/"([^"\n]*)"|'([^'\n]*)'|`([^`]*)`/g)].map((m) => (m[1] ?? m[2] ?? m[3]).replace(/\$\{[^}]*\}/g, " "));
    for (const s of strings) if (BAD.test(s)) hits.push(`${f}: ${s.trim().slice(0, 80)}`);
  }
  assert.deepEqual(hits, []);
});
