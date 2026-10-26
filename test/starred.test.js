import test from "node:test";
import assert from "node:assert/strict";
import { toggleStar, isStarredCard, starAlerts, MAX_STARS } from "../src/starred.js";

test("starred: toggle on and off, never more than 30", () => {
  assert.deepEqual(toggleStar([], "CeeDee Lamb"), ["CeeDee Lamb"]);
  assert.deepEqual(toggleStar(["CeeDee Lamb"], "CeeDee Lamb"), []);
  const many = Array.from({ length: MAX_STARS }, (_, i) => `P ${i}`);
  assert.equal(toggleStar(many, "New Guy").length, MAX_STARS);
});

test("starred: matches by the play's player or anyone it scored for; banners only for TDs and turnovers", () => {
  const set = new Set(["CeeDee Lamb"]);
  const td = { id: "1", gameId: "g", name: "CeeDee Lamb", label: "34-yd catch TD", td: true, impacts: [] };
  const run = { id: "2", gameId: "g", name: "Javonte Williams", label: "4-yd rush", impacts: [{ name: "CeeDee Lamb" }] };
  assert.ok(isStarredCard(td, set) && isStarredCard(run, set));
  assert.deepEqual(starAlerts([td, run], set).map((a) => a.text), ["★ Lamb 34-yd catch TD"]);
  assert.deepEqual(starAlerts([td], set, { skip: ["g"] }), []);
});
