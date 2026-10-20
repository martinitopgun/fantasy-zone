// What-if (plan M9). Run with: npm test

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createReplay } from "../src/replay.js";
import { winChance } from "../src/model.js";
import { applyWhatIf, whatIfMoves } from "../src/whatif.js";

const data = JSON.parse(readFileSync(new URL("../app/replay.json", import.meta.url), "utf8"));

test("what-if: +TD on Kittle at 1:40 PM lowers your win chance by exactly what winChance says; reset restores it", () => {
  const r = createReplay(data, { startAt: Date.parse("2026-10-18T17:40:00Z") });
  const m = r.tracker.snapshot().matchups[0];
  const kittle = m.theirs.find((p) => /Kittle/.test(p.name));
  const td = whatIfMoves(kittle, m.league.scoring ?? data.leagues[0].scoring).find((x) => x.key === "td");
  assert.equal(td.points, 6);
  const edits = new Map([[`opponent:${kittle.id}`, { add: td.points }]]);
  const out = applyWhatIf(m, edits);
  const spread = Math.sqrt([...m.mine, ...m.theirs].reduce((s, p) => s + p.remainingSpread ** 2, 0));
  assert.ok(Math.abs(out.winProb - winChance(m.myFinal - (m.oppFinal + 6), spread)) < 1e-12);
  assert.ok(out.winProb < m.winProb);
  edits.clear();
  assert.equal(applyWhatIf(m, edits).winProb, m.winProb); // exactly
});

test("what-if: '0 from here' takes away his points still to come and his share of the spread", () => {
  const r = createReplay(data, { startAt: Date.parse("2026-10-18T17:40:00Z") });
  const m = r.tracker.snapshot().matchups[0];
  const walker = m.mine.find((p) => /Walker/.test(p.name));
  const out = applyWhatIf(m, new Map([[`me:${walker.id}`, { zero: true }]]));
  assert.ok(Math.abs(out.myFinal - (m.myFinal - walker.remaining)) < 1e-9);
  assert.ok(out.winProb < m.winProb);
});
