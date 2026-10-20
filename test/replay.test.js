// The Week 6 replay: quarter markers, jump windows, and the tracker's bookkeeping.
// Numbers come from tools/moments.js (run it to see where they come from).
// Run with: npm test

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createTracker } from "../src/tracker.js";
import { createReplay, windows } from "../src/replay.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(readFileSync(path.join(root, "app/replay.json"), "utf8"));
const plays = [...data.plays].sort((a, b) => a.wallclock - b.wallclock);
const REPLAY_START = Date.parse("2026-10-18T16:57:00Z"); // same as app.js
const ARI_LAR = "401873004", BAD_MARKER = "401873004888"; // "End of Half", period 2, text "END QUARTER 1"
const move = (w) => Math.abs(w.after - w.before);

// The whole day, one play at a time, noting a few things on the way.
const tracker = createTracker({ leagues: data.leagues, players: data.players, games: data.games });
const afterBadMarker = {};
const versions = [];
const markerMoves = []; // every marker play: the game's period and clock just before and just after it
for (const p of plays) {
  const before = { period: tracker.game(p.gameId).period, clockSec: tracker.game(p.gameId).clockSec };
  tracker.addPlays(p.gameId, [p]);
  versions.push(tracker.version());
  const g = tracker.game(p.gameId);
  if (/End Period|End of Half|End of Game|End of Regulation|Two-minute/i.test(p.type)) markerMoves.push({ p, before, after: { period: g.period, clockSec: g.clockSec, state: g.state } });
  if (p.id === BAD_MARKER) Object.assign(afterBadMarker, { period: g.period, clockSec: g.clockSec });
}
const feed = tracker.feed();

test("a mis-tagged quarter end doesn't turn the 1st quarter into halftime", () => {
  assert.equal(afterBadMarker.period, 1);
  assert.equal(afterBadMarker.clockSec, 0);
  // No fake 59% -> 74% jump: nothing between 4:36 and 4:40 PM ET moves your win chance by 2 points.
  const lo = Date.parse("2026-10-18T20:36:00Z"), hi = Date.parse("2026-10-18T20:40:00Z");
  const near = feed.filter((c) => c.wallclock >= lo && c.wallclock <= hi);
  assert.ok(near.length > 10);
  for (const c of near) assert.ok(c.wp.every((w) => move(w) < 0.02), `${c.gameName} ${c.text} moves win chance`);
  assert.ok(!feed.some((c) => c.id === BAD_MARKER), "an end of the 1st quarter gets no card");
});

test("marker cards: only halftime and finals, never big, no win move", () => {
  const markers = feed.filter((c) => c.kind === "marker");
  assert.equal(markers.length, 25); // 13 halftimes + 12 finals
  for (const c of markers) {
    assert.match(c.text, /END QUARTER 2|END GAME/);
    assert.equal(c.big, false);
    assert.equal(c.gameSwing, 0);
    assert.equal(c.gameWpBefore, c.gameWpAfter);
    assert.ok(c.wp.every((w) => w.before === w.after));
  }
  // End of Game still finishes the game; the overtime one too.
  for (const g of tracker.snapshot().games.filter((x) => x.id !== "401873007" && x.id !== "401873008")) assert.equal(g.state, "post", g.name);
});

test("quarter ends and two-minute warnings never move the clock or the period", () => {
  assert.equal(markerMoves.length, 80); // 26 two-minute warnings, 40 quarter ends, 2 ends of regulation, 12 finals
  for (const { p, before, after } of markerMoves) {
    const q = /END QUARTER (\d)/.exec(p.text);
    if (/End of Game/i.test(p.type)) assert.equal(after.state, "post", p.id);
    else if (q) assert.deepEqual([after.period, after.clockSec], [Number(q[1]), 0], p.id); // the text wins over the tag
    else assert.deepEqual(after.period === before.period && after.clockSec === before.clockSec, true, `${p.id} ${p.type}`);
    if (q) assert.ok(before.period === Number(q[1]), `${p.id}: the quarter that ended is the one being played`);
  }
});

test("the day still adds up the same", () => {
  const m = tracker.snapshot().matchups[0];
  assert.equal(m.myNow.toFixed(1), "123.5");
  assert.equal(m.oppNow.toFixed(1), "83.5");
  assert.equal(feed.length, 2398);
  assert.equal(feed.filter((c) => c.impacts.length).length, 173);
  assert.equal(feed.filter((c) => c.big).length, 190);
});

test("jump windows: 9:30 AM, 1 PM, 4:05 PM and 8:20 PM", () => {
  const w = windows(data);
  assert.deepEqual(w.map((x) => x.label), ["9:30 AM", "1 PM", "4:05 PM", "8:20 PM"]);
  assert.deepEqual(w.map((x) => x.games.length), [1, 7, 3, 1]); // 4:25 joins 4:05
  assert.equal(w[1].at, REPLAY_START); // 3 minutes before kickoff
  const ids = w.flatMap((x) => x.games);
  assert.ok(!ids.includes("401872995"), "Thursday's SEA@DEN is left out");
  assert.ok(!ids.includes("401873008"), "Monday's WAS@SF has no plays yet");
  assert.deepEqual(windows(data, { from: REPLAY_START - 6 * 3600_000 }), w); // what app.js asks for
  assert.equal(windows(data, { from: -Infinity })[0].label, "8:15 PM"); // `from` lets Thursday back in
});

test("version goes up with every play and every real scoreboard change", () => {
  for (let i = 1; i < versions.length; i++) assert.equal(versions[i], versions[i - 1] + 1);
  const v = tracker.version();
  tracker.addPlays(plays[0].gameId, [plays[0]]);
  assert.equal(tracker.version(), v, "a play seen before changes nothing");
  tracker.updateGame("401873008", { state: "pre" });
  assert.equal(tracker.version(), v, "same value, no change");
  tracker.updateGame("401873008", { clockSec: 899 });
  assert.equal(tracker.version(), v + 1);
  tracker.updateGame("401873008", { clockSec: 900 });
});

test("cards carry the game's win chance before and after", () => {
  const byId = new Map(plays.map((p) => [p.id, p]));
  const cards = feed.filter((c) => c.kind !== "marker" && c.gameWpBefore != null);
  assert.ok(cards.length > 2000);
  for (const c of cards) {
    assert.equal(c.gameWpAfter, byId.get(c.id).homeWinProb ?? c.gameWpBefore);
    assert.ok(Math.abs(c.gameSwing - Math.abs(c.gameWpAfter - c.gameWpBefore)) < 1e-9);
  }
});

test("pointsById agrees with the matchup", () => {
  const m = tracker.snapshot().matchups[0];
  const pts = tracker.pointsById(data.leagues[0].scoring);
  for (const p of [...m.mine, ...m.theirs]) {
    const id = p.pos === "DEF" ? p.nflTeam : p.id;
    assert.ok(Math.abs((pts[id] ?? 0) - p.current) < 1e-9, p.name);
  }
});

test("jumping the replay to a window gives the same day as playing it through", () => {
  const r = createReplay(data, { startAt: REPLAY_START });
  const w = windows(data);
  r.jump(w[2].at);
  r.jump(w[3].at);
  r.jump(plays.at(-1).wallclock);
  const a = r.tracker.snapshot().matchups[0], b = tracker.snapshot().matchups[0];
  assert.equal(a.myNow.toFixed(1), b.myNow.toFixed(1));
  assert.equal(a.oppNow.toFixed(1), b.oppNow.toFixed(1));
  assert.equal(r.tracker.game(ARI_LAR).state, "post");
});
