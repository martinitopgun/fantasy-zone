import test from "node:test";
import assert from "node:assert/strict";
import { checkTrophies } from "../src/trophies.js";

const base = { picks: { right: 0, best: 0, points: 0 }, history: [], counts: { games: 0, story: 0, share: 0, whatif: 0, plays: 0 }, sweatSeen: false };

test("trophies: unlock from picks, comebacks and counts", () => {
  const s = { ...base, picks: { right: 3, best: 3, points: 30 }, history: [{ wp: 0.5 }, { wp: 0.2 }, { wp: 0.8 }], counts: { ...base.counts, games: 5 } };
  assert.deepEqual(checkTrophies(s, {}).sort(), ["comeback", "first-pick", "scout", "streak-3"]);
});

test("trophies: never unlock twice", () => {
  const s = { ...base, picks: { right: 1, best: 1, points: 10 } };
  assert.deepEqual(checkTrophies(s, { "first-pick": 1 }), []);
});
