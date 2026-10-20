// Heads-up banners (plan M4). Run with: npm test

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createReplay } from "../src/replay.js";
import { createAlerts } from "../src/alerts.js";

const data = JSON.parse(readFileSync(new URL("../app/replay.json", import.meta.url), "utf8"));
const et = (t) => new Date(t).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });

// Run the day from just before 1 PM at 5x, one real second at a time, like the app does.
function run({ skip = [] } = {}) {
  const r = createReplay(data, { startAt: Date.parse("2026-10-18T16:57:00Z") });
  const a = createAlerts(); a.prime(r.tracker.snapshot());
  const out = [];
  while (!r.done) {
    const cards = r.advance(1000, 5);
    for (const x of a.take(cards, r.tracker.snapshot(), { skip })) out.push({ ...x, at: et(cards.find((c) => c.id === x.cardId).wallclock) });
  }
  return out;
}

test("alerts: the plan's banners at 1:27 and 1:40 PM, in the right colours", () => {
  const all = run();
  const swift = all.find((x) => x.at === "1:27 PM");
  assert.equal(swift.text, "Swift 4-yd rush TD · Win 41%→48%");
  assert.equal(swift.owner, "me");
  const taylor = all.find((x) => x.at === "1:40 PM");
  assert.equal(taylor.text, "Taylor 38-yd catch · Win 49%→43%");
  assert.equal(taylor.owner, "opponent");
});

test("alerts: no lead-change banner from the 4:05/4:25 kickoff D/ST bonuses; nothing for a skipped game", () => {
  const all = run();
  assert.ok(!all.some((x) => x.kind === "lead" && /^4:(0|1|2|3)/.test(x.at)));
  const chiAtl = data.games.find((g) => g.away === "CHI" && g.home === "ATL").id;
  assert.ok(!run({ skip: [chiAtl] }).some((x) => x.at === "1:27 PM"));
});

test("alerts: a lead change on a normal play is called, biggest alert first", () => {
  const a = createAlerts();
  a.prime({ matchups: [{ myNow: 50, oppNow: 52 }] });
  const card = (id, delta, extra = {}) => ({ id, gameId: "g", wallclock: 1, kind: "rush", name: "Jo Runner", label: "8-yd rush", impacts: [{ owner: "me", delta }], wp: [{ before: 0.48, after: 0.5 }], ...extra });
  const out = a.take([card("a", 3)], { matchups: [{ myNow: 53, oppNow: 52 }] });
  assert.equal(out.length, 1);
  assert.equal(out[0].kind, "lead");
  assert.equal(out[0].text, "You took the lead · Win 48%→50%");
  assert.deepEqual(a.take([card("k", 0, { kind: "kickoff", impacts: [] })], { matchups: [{ myNow: 53, oppNow: 56 }] }), []); // kickoff: never
});
