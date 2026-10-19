// Play-by-play reading, scoring against Sleeper's official points, the replay, and live mode.
// Run with: npm test

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { analyzePlay, headline, finalRuling, parseSummary } from "../src/plays.js";
import { createTracker } from "../src/tracker.js";
import { createReplay } from "../src/replay.js";
import { createLive } from "../src/live.js";
import { makeFetchJson } from "../src/net.js";
import { fixtureLoader } from "../src/fixtures.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const json = (f) => JSON.parse(readFileSync(path.join(root, f), "utf8"));
const play = (text, extra = {}) => ({ text, type: "Rush", offense: "DAL", homeTeam: "GB", awayTeam: "DAL", start: { distance: 10, yardsToGoal: 60 }, statYardage: 0, ...extra });
const statsOf = (a) => Object.fromEntries(a.stats.map((s) => [`${s.name}:${s.key}`, s.value]));

test("reads a catch, with formation notes in front", () => {
  const a = analyzePlay(play("(Shotgun) B.Fisher reported in as eligible.  D.Prescott pass short left to J.Williams pushed ob at DAL 43 for 16 yards (X.McKinney).", { type: "Pass Reception" }));
  assert.equal(a.kind, "catch");
  assert.equal(a.player, "J.Williams");
  assert.equal(headline(a), "16-yd catch");
  const s = statsOf(a);
  assert.equal(s["J.Williams:rec"], 1);
  assert.equal(s["J.Williams:rec_yd"], 16);
  assert.equal(s["D.Prescott:pass_yd"], 16);
});

test("touchdowns, extra points and two-point tries", () => {
  const a = analyzePlay(play("(Shotgun) M.Penix pass short left to K.Pitts for 10 yards, TOUCHDOWN. TWO-POINT CONVERSION ATTEMPT. M.Penix pass to Z.Branch is complete. ATTEMPT SUCCEEDS.", { type: "Passing Touchdown", offense: "ATL" }));
  const s = statsOf(a);
  assert.equal(headline(a), "10-yd catch TD");
  assert.equal(s["K.Pitts:rec_td"], 1);
  assert.equal(s["M.Penix:pass_2pt"], 1);
  assert.equal(s["Z.Branch:rec_2pt"], 1);
  const b = analyzePlay(play("K.Walker up the middle for 33 yards, TOUCHDOWN. H.Butker extra point is No Good, Wide Left.", { type: "Rushing Touchdown", offense: "KC" }));
  assert.equal(statsOf(b)["H.Butker:xpmiss"], 1);
});

test("the full-name scoring style", () => {
  const a = analyzePlay(play("Tommy Tremble 19 Yd pass from Bryce Young (Ryan Fitzgerald PAT failed)", { type: "Passing Touchdown", offense: "CAR" }));
  const s = statsOf(a);
  assert.equal(s["Bryce Young:pass_td"], 1);
  assert.equal(s["Tommy Tremble:rec_yd"], 19);
  assert.equal(s["Ryan Fitzgerald:xpmiss"], 1);
});

test("replay reviews count only the final ruling", () => {
  const raw = "(Shotgun) D.Maye pass short left to A.Brown to NYJ 33 for 9 yards (J.Brownlee).New York Jets challenged the pass completion ruling, and the play was REVERSED.(Shotgun) D.Maye pass incomplete short left to A.Brown.";
  assert.match(finalRuling(raw), /^\(Shotgun\) D\.Maye pass incomplete/);
  assert.equal(analyzePlay(play(raw, { type: "Pass Incompletion", offense: "NE" })).kind, "incomplete");
});

test("plays wiped out by penalties don't count; a holding call keeps yards up to the foul", () => {
  const wiped = analyzePlay(play("J.Cook left tackle to LV 30 for 1 yard (H.Masses).PENALTY on BUF-S.Bell, Illegal Shift, 5 yards, enforced at LV 31 - No Play.", { type: "Penalty", offense: "BUF" }));
  assert.equal(wiped.stats.length, 0);
  const spot = analyzePlay(play("P.Mahomes pass short right to X.Worthy to LAC 34 for 33 yards (T.Dye).PENALTY on KC-T.Kelce, Illegal Block Above the Waist, 10 yards, enforced at KC 48.", { type: "Pass Reception", offense: "KC", start: { distance: 10, yardsToGoal: 67 } }));
  assert.equal(statsOf(spot)["X.Worthy:rec_yd"], 15);
});

test("matches Sleeper's official points for 118 of 120 players in finished Week 6 games", () => {
  const league = json("fixtures/api_sleeper_app_v1_user_1384803681437753344_leagues_nfl_2026.json")[0];
  const proj = json("fixtures/api_sleeper_app_projections_nfl_2026_6_season_type_regular_position_QB_position_RB_position_WR_position_TE_position_K_position_DEF.json");
  const players = proj.filter((r) => r.player && r.team && r.player.position !== "DEF").map((r) => ({ id: r.player_id, first: r.player.first_name, last: r.player.last_name, team: r.team, pos: r.player.position }));
  const games = readdirSync(path.join(root, "fixtures/week6")).filter((f) => f.startsWith("game-")).map((f) => json(`fixtures/week6/${f}`));
  const tracker = createTracker({ leagues: [], players, games: games.map(({ plays, ...g }) => g) });
  for (const g of games) tracker.addPlays(g.id, g.plays, { silent: true });
  const ours = tracker.pointsById(league.scoring_settings);
  const official = json("fixtures/week6/sleeper-points.json");
  const finals = new Set(games.filter((g) => g.state === "post").flatMap((g) => [g.home, g.away]));
  const team = new Map(players.map((p) => [p.id, p.team]));
  let n = 0, exact = 0, worst = 0;
  for (const [id, pts] of Object.entries(official)) {
    if (!finals.has(team.get(id) ?? id)) continue;
    const err = Math.abs((ours[id] ?? 0) - pts);
    n++; if (err < 0.05) exact++; worst = Math.max(worst, err);
  }
  assert.equal(n, 120);
  assert.ok(exact >= 118, `${exact} exact`);
  assert.ok(worst < 0.5, `worst miss ${worst}`);
});

test("replay: plays arrive in time order, and a kickoff isn't a fake fantasy swing", () => {
  const data = json("app/replay.json");
  const r = createReplay(data, { startAt: Date.parse("2026-10-18T20:02:00Z") });
  const cards = [];
  for (let i = 0; i < 60; i++) cards.push(...r.advance(60_000, 1));
  assert.ok(cards.length > 100);
  for (let i = 1; i < cards.length; i++) assert.ok(cards[i].wallclock >= cards[i - 1].wallclock);
  const kickoff = cards.find((c) => c.gameName === "ARI @ LAR");
  assert.equal(kickoff.impacts.length, 0);
  assert.ok(Math.abs(kickoff.wp[0].after - kickoff.wp[0].before) < 0.01);
  assert.ok(cards.some((c) => c.impacts.some((i) => i.owner === "opponent" && i.name === "Kyren Williams")));
});

test("live mode reads ESPN's full play-by-play and matches Sleeper mid-game", async () => {
  const SUMMARY = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=";
  const overrides = { [`${SUMMARY}401873007`]: json("fixtures/week6/raw-summary-401873007.json") };
  for (const g of json("app/replay.json").games) if (g.id !== "401873007") overrides[SUMMARY + g.id] = { header: { competitions: [{ id: g.id, competitors: [], status: { type: { state: "post" } } }] } };
  const live = await createLive(makeFetchJson({ load: fixtureLoader(path.join(root, "fixtures"), overrides) }), { username: "ontopgun" });
  const cards = await live.poll();
  assert.ok(cards.length > 100 && cards.every((c) => c.silent), "first load is quiet");
  const m = live.tracker.snapshot().matchups[0];
  assert.equal(m.mine.find((p) => p.name === "Javonte Williams").current.toFixed(1), "12.5"); // Sleeper had 12.5 at that moment
  assert.equal(m.mine.find((p) => p.name === "Matthew Golden").current.toFixed(1), "17.1");
  assert.equal((await live.poll()).length, 0, "the same plays are never added twice");
});

test("parses a raw ESPN summary", () => {
  const g = parseSummary(json("fixtures/week6/raw-summary-401873007.json"));
  assert.equal(`${g.away} @ ${g.home}`, "DAL @ GB");
  assert.ok(g.plays.length > 100);
  assert.equal(new Set(g.plays.map((p) => p.id)).size, g.plays.length);
});
