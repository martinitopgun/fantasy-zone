// Find: the plan's search cases, run on the real Week 6 replay.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createReplay } from "../src/replay.js";
import { buildIndex, search } from "../src/search.js";

const data = JSON.parse(readFileSync(new URL("../app/replay.json", import.meta.url)));
const r = createReplay(data, { startAt: Date.parse("2026-10-18T16:57:00Z") });
r.jump(Date.parse("2026-10-19T03:00:00Z"));
const snap = r.tracker.snapshot();
const lineups = snap.matchups.flatMap((m) => [...m.mine, ...m.theirs]).map((p) => ({ id: p.id, name: p.name, pos: p.pos, team: p.nflTeam, owner: p.owner }));
const index = buildIndex({ lineups, cards: r.tracker.feed(), games: snap.games });
const first = (q) => search(index, q)[0];

test("Find: the plan's cases", () => {
  assert.equal(first("swi").name, "D'Andre Swift");
  assert.equal(first("dandre").name, "D'Andre Swift");
  assert.equal(search(index, "ind").find((e) => e.kind === "game").label, "TEN @ IND");
  assert.equal(first("colts").label, "TEN @ IND");
  const kc = search(index, "kc").map((e) => e.label ?? e.name);
  assert.ok(kc.includes("LAC @ KC") && kc.includes("KC D/ST"), kc.join());
  assert.deepEqual(search(index, ""), []);
  assert.equal(search(index, "zzzz").length, 0);
});

test("Find: other players named in plays come after both lineups", () => {
  const res = search(index, "williams");
  assert.ok(res.length >= 2);
  const ranks = res.map((e) => (e.kind === "player" ? 0 : e.kind === "name" ? 1 : 2));
  assert.deepEqual(ranks, [...ranks].sort());
});
