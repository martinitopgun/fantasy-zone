// Sunday Story (plan M5). Run with: npm test

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createReplay } from "../src/replay.js";
import { storyCards, biggestSwing } from "../src/story.js";

const data = JSON.parse(readFileSync(new URL("../app/replay.json", import.meta.url), "utf8"));

test("biggestSwing: the non-marker card with the largest win move", () => {
  const history = [{ t: 0, wp: 0.5, cardId: null }, { t: 1, wp: 0.2, cardId: "m" }, { t: 2, wp: 0.3, cardId: "a" }, { t: 3, wp: 0.12, cardId: "b" }];
  const feed = [{ id: "m", kind: "marker" }, { id: "a", kind: "rush" }, { id: "b", kind: "catch" }];
  assert.equal(biggestSwing(history, feed).cardId, "b"); // "m" moved more, but it's a halftime marker
});

test("storyCards at the end of saved plays: 6 cards, Walker's TD, ends with Monday", () => {
  const r = createReplay(data, { startAt: Date.parse("2026-10-18T16:57:00Z") });
  r.jump(Date.parse("2026-10-19T04:00:00Z"));
  const m = r.tracker.snapshot().matchups[0];
  const s = storyCards({ m, history: r.tracker.history(m.league.league_id), feed: r.tracker.feed() });
  assert.equal(s.title, "Story so far");
  assert.equal(s.cards.length, 6);
  assert.deepEqual(s.cards.map((c) => c.kind), ["score", "low", "swing", "mvp", "top", "close"]);
  assert.equal(s.cards[0].big, "123.5 – 83.5");
  assert.equal(s.cards[2].big, "Walker 33-yd rush TD");
  assert.match(s.cards[5].lines.at(-1), /Monday: Daniels \+ Pineiro vs Kittle$/);
});
