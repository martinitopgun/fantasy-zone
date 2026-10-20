// Matchup explained in words. For now: the stat line on each lineup row (plan B2, M1 step 6).
// Run with: npm test

import test from "node:test";
import assert from "node:assert/strict";
import { statText } from "../src/insights.js";

test("statText: the plan's kicker and defense lines", () => {
  assert.equal(statText({ fgm: 2, fgm_30_39: 1, fgm_40_49: 1, xpm: 3 }, "K"), "2/2 FG, 3 XP");
  assert.equal(statText({ sack: 2, int: 1, pts_allow: 17, yds_allow: 301 }, "DEF"), "2 sacks, 1 INT, 17 pts allowed");
});

test("statText: misses, one of a kind, and nothing yet", () => {
  assert.equal(statText({ fgm: 1, fgmiss: 1, xpm: 2, xpmiss: 1 }, "K"), "1/2 FG, 2/3 XP");
  assert.equal(statText({ sack: 1, fum_rec: 1, def_td: 1, safe: 1, pts_allow: 0 }, "DEF"), "1 sack, 1 fumble rec, 1 TD, 1 safety, 0 pts allowed");
  assert.equal(statText({}, "DEF"), ""); // before kickoff there's no points-allowed line yet
  assert.equal(statText(null, "RB"), "");
  assert.equal(statText({}, "K"), "");
});

test("statText: passers, runners and catchers", () => {
  assert.equal(statText({ pass_att: 27, pass_cmp: 18, pass_yd: 245, pass_td: 2, pass_int: 1, rush_att: 4, rush_yd: 21 }, "QB"), "18/27 245 yds, 2 TD, 1 INT, 4 car 21 yds");
  assert.equal(statText({ rush_att: 15, rush_yd: 97, rush_td: 1, rec: 3, rec_tgt: 4, rec_yd: 18, rec_td: 1 }, "RB"), "15 car 97 yds, 3 rec 18 yds, 2 TD");
  assert.equal(statText({ rec: 6, rec_tgt: 9, rec_yd: 88, rec_td: 1, rush_att: 1, rush_yd: 1 }, "WR"), "6 rec 88 yds, 1 car 1 yd, 1 TD");
  assert.equal(statText({ rec_tgt: 2 }, "TE"), "0 rec 0 yds"); // targeted, no catch yet
  assert.equal(statText({ rush_att: 3, rush_yd: -2, fum: 1, fum_lost: 1 }, "RB"), "3 car -2 yds, 1 fum lost");
});
