// League tab (plan M6). Run with: npm test

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createReplay } from "../src/replay.js";
import { liveMatchups, standings } from "../src/league.js";

const read = (f) => JSON.parse(readFileSync(new URL(`../${f}`, import.meta.url), "utf8"));
const data = read("app/replay.json");
const L = data.leagues[0];

test("board: every team's starters in finished games match Sleeper's saved points (within 0.5)", () => {
  const r = createReplay(data, { startAt: Date.parse("2026-10-19T04:00:00Z") });
  const pts = r.tracker.pointsById(L.scoring);
  const final = new Set(r.tracker.snapshot().games.filter((g) => g.state === "post").flatMap((g) => [g.home, g.away]));
  for (const m of read("fixtures/league/matchups_6.json")) {
    const team = L.teams.find((t) => t.roster_id === m.roster_id);
    let ours = 0, theirs = 0;
    m.starters.forEach((id, i) => {
      const p = team.starters.find((s) => s.id === id);
      if (!p || !final.has(p.team)) return; // DAL@GB and WAS@SF weren't over when the plays were saved (or a Monday swap)
      ours += pts[id] ?? 0; theirs += m.starters_points[i];
    });
    assert.ok(Math.abs(ours - theirs) <= 0.5, `${team.owner}: ours ${ours.toFixed(2)} vs Sleeper ${theirs.toFixed(2)}`);
  }
});

test("standings: weeks 1-5 match Sleeper's records (cross-check only, never shown)", () => {
  const rosters = read("fixtures/league/rosters.json");
  const games = rosters.map((r) => r.settings.wins + r.settings.losses + (r.settings.ties ?? 0));
  const ours = new Map(standings(L.results, L.teams).map((s) => [s.roster_id, s]));
  if (games.every((g) => g === 5)) {
    for (const r of rosters) {
      const s = ours.get(r.roster_id);
      assert.deepEqual([s.w, s.l], [r.settings.wins, r.settings.losses], `roster ${r.roster_id}`);
    }
  } else if (games.every((g) => g === 6)) {
    assert.fail("Sleeper had already counted Week 6 when the league was saved: compare with weeks 1-5 plus matchups_6");
  } else {
    assert.fail(`rosters disagree on games played (${games.join(", ")}), saved ${L.savedAt}`);
  }
});

test("liveMatchups: 5 pairings, yours first", () => {
  const r = createReplay(data, { startAt: Date.parse("2026-10-19T04:00:00Z") });
  const lm = liveMatchups(r.tracker.board(L.teams, L.scoring), L.pairings, L.teams);
  assert.equal(lm.length, 5);
  assert.equal(lm[0].a.owner, "ontopgun");
  assert.equal(lm[0].a.now.toFixed(1), "123.5");
  assert.equal(lm[0].b.now.toFixed(1), "83.5");
});
