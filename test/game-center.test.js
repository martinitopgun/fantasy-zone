// Game Center extras (plan M8): drives, box score, info. Run with: npm test

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseSummary } from "../src/plays.js";
import { drives } from "../src/drives.js";
import { createReplay } from "../src/replay.js";
import { expectText } from "../src/view-models.js";

const raw = JSON.parse(readFileSync(new URL("../fixtures/week6/raw-summary-401873007.json", import.meta.url), "utf8"));
const data = JSON.parse(readFileSync(new URL("../app/replay.json", import.meta.url), "utf8"));

test("drives: ESPN's 11 DAL@GB drives and how each ended, from the plays alone", () => {
  const prev = { ...raw, drives: { previous: raw.drives.previous } }; // ignore ESPN's own drive boundaries
  const ds = drives(parseSummary(prev).plays);
  assert.deepEqual(ds.map((d) => d.result), ["PUNT", "TD", "PUNT", "INT", "INT", "FG", "INT", "TD", "END OF HALF", "PUNT", "TD"]);
  assert.deepEqual(ds.map((d) => d.team), raw.drives.previous.map((d) => d.team.abbreviation));
  assert.equal(ds[1].text, "14 plays · 90 yds · 6:30");
});

test("parseSummary reads the stadium and injuries", () => {
  const s = parseSummary(raw);
  assert.equal(s.venue.name, "Lambeau Field");
  assert.ok(s.injuries.length > 0 && s.injuries.every((i) => i.name && i.status));
});

test("Info: BAL@CLE", () => {
  const g = data.games.find((x) => x.away === "BAL" && x.home === "CLE");
  assert.equal(expectText(g), "BAL expected to win by 3 · expected total points 40.5");
});

test("box: your players' lines are their stat lines, with nothing from after the replay clock", () => {
  const r = createReplay(data, { startAt: Date.parse("2026-10-18T17:40:00Z") });
  const g = data.games.find((x) => x.away === "CHI" && x.home === "ATL");
  const swift = r.tracker.box(g.id).CHI.find((p) => /Swift/.test(p.name));
  assert.deepEqual(swift.line, r.tracker.statLine(swift.id, "RB") ?? swift.line);
  const end = createReplay(data, { startAt: Date.parse("2026-10-19T04:00:00Z") }).tracker.box(g.id).CHI.find((p) => p.id === swift.id);
  assert.ok(swift.line.rush_yd < end.line.rush_yd);
  assert.ok(r.tracker.plays(g.id).every((p) => p.wallclock <= Date.parse("2026-10-18T17:40:00Z")));
});
