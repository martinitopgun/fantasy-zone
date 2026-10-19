// Run with: npm test
// The first group runs on the real saved Sleeper + ESPN data in fixtures/.
// The second group uses small made-up game situations to check the model behaves sensibly.

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { makeFetchJson } from "../src/net.js";
import { syncEverything } from "../src/sync.js";
import { fantasyPoints, describeLeague } from "../src/scoring.js";
import { parseScoreboard } from "../src/espn.js";
import { rankGames, roleFactor, gameScore, winChance, detectBigPlays, DIALS } from "../src/model.js";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
const load = (name) => JSON.parse(readFileSync(path.join(fixtures, name), "utf8"));
const LEAGUE = "1372713082211569664";

// ---------- Real data ----------

test("syncs a real Sleeper user end to end from just a username", async () => {
  const data = await syncEverything(makeFetchJson({ fixturesDir: fixtures }), { username: "feiyingx", leagueIds: [LEAGUE] });
  assert.equal(data.week, 6);
  assert.equal(data.matchups.length, 1);
  const m = data.matchups[0];
  assert.equal(m.info.format, "PPR");
  assert.equal(m.opponentName, "jorgebaralt");
  assert.equal(Math.round(m.myNow * 100), 7078); // matches Sleeper's own 70.78
  assert.equal(Math.round(m.oppNow * 100), 11944); // matches Sleeper's own 119.44
});

test("detects every league's scoring format automatically", () => {
  const leagues = load("api_sleeper_app_v1_user_667279356739584_leagues_nfl_2026.json");
  const formats = new Set(leagues.map((l) => describeLeague(l).format));
  assert.ok(formats.has("PPR") && formats.has("Standard") && formats.has("Custom (0.75 per catch)"));
  const dynasty = leagues.find((l) => l.name === "Dynasty Warriors");
  assert.match(describeLeague(dynasty).label, /6-pt passing TDs · Dynasty/);
});

test("our scoring matches Sleeper's points on real stat lines", () => {
  const league = load("api_sleeper_app_v1_user_667279356739584_leagues_nfl_2026.json").find((l) => l.league_id === LEAGUE);
  const rows = load("api_sleeper_app_stats_nfl_2026_5_season_type_regular_position_QB_position_RB_position_WR_position_TE_position_K_position_DEF.json")
    .filter((r) => r.player && typeof r.stats.pts_ppr === "number" && r.player.position !== "K");
  const off = rows.filter((r) => Math.abs(fantasyPoints(r.stats, league.scoring_settings) - r.stats.pts_ppr) > 0.05);
  assert.ok(rows.length > 300);
  assert.equal(off.length, 0);
});

test("reads live ESPN situations, including who has the ball and yards to the goal", () => {
  const games = parseScoreboard(load("site_api_espn_com_apis_site_v2_sports_football_nfl_scoreboard.json"));
  const gb = games.find((g) => g.home === "GB");
  assert.equal(gb.state, "in");
  assert.equal(gb.offense, "DAL"); // possession comes from the last play right after a kickoff
  assert.equal(gb.yardsToGoal, 73); // "1st & 10 at DAL 27": Dallas at its own 27
  assert.ok(gb.homeWinProb > 0.5);
  const sf = games.find((g) => g.home === "SF");
  assert.equal(sf.away, "WAS"); // ESPN says WSH, Sleeper says WAS
  assert.equal(sf.favorite, "SF");
});

// ---------- Made-up situations ----------

const liveGame = (over = {}) => ({
  id: "g1", name: "AAA @ BBB", home: "BBB", away: "AAA", homeScore: 14, awayScore: 10, state: "in",
  period: 3, clockSec: 400, offense: "BBB", yardsToGoal: 2, downText: "1st & Goal at AAA 2", homeWinProb: 0.6, ...over,
});
const player = (over) => ({
  name: "X", pos: "RB", nflTeam: "BBB", owner: "me", remaining: 8, boomFactor: 1.2,
  profile: { rzShare: 0.1, spread: 7 }, ...over,
});

test("two RBs at the goal line: the one who gets the goal-line work matters more", () => {
  const game = liveGame();
  const lead = roleFactor(player({ profile: { rzShare: 0.65 } }), game);
  const backup = roleFactor(player({ profile: { rzShare: 0.2 } }), game);
  assert.ok(lead.factor > backup.factor * 1.5, `${lead.factor} vs ${backup.factor}`);
});

test("an opponent's player counts as much as your own", () => {
  const game = liveGame();
  const matchup = (owner) => ({
    league: { name: "L", league_id: "1" }, weight: 1, myFinal: 100, oppFinal: 100,
    mine: owner === "me" ? [player({ game, owner })] : [], theirs: owner === "opponent" ? [player({ game, owner })] : [],
  });
  const [mine] = rankGames({ games: [game], matchups: [matchup("me")] });
  const [theirs] = rankGames({ games: [game], matchups: [matchup("opponent")] });
  assert.equal(Math.round(mine.watch), Math.round(theirs.watch));
});

test("a game matters less when your matchup is already decided", () => {
  const game = liveGame();
  const m = (gap) => ({ league: { name: "L", league_id: "1" }, weight: 1, myFinal: 100 + gap, oppFinal: 100, mine: [player({ game })], theirs: [] });
  const [close] = rankGames({ games: [game], matchups: [m(3)] });
  const [blowout] = rankGames({ games: [game], matchups: [m(60)] });
  assert.ok(close.fantasy > 3 * blowout.fantasy);
});

test("game score with fantasy off: close + late + red zone beats a blowout", () => {
  const thriller = gameScore(liveGame({ period: 4, clockSec: 90, homeWinProb: 0.52 }));
  const blowout = gameScore(liveGame({ period: 2, homeWinProb: 0.97, yardsToGoal: 70 }));
  assert.ok(thriller.score > 80 && blowout.score < 5);
  const [r] = rankGames({ games: [liveGame()], matchups: [], dials: DIALS.fantasyOff });
  assert.ok(r.watch > 0, "works with no fantasy leagues at all");
});

test("win chance behaves like a bell curve", () => {
  assert.ok(Math.abs(winChance(0, 10) - 0.5) < 0.001);
  assert.ok(winChance(10, 10) > 0.83 && winChance(10, 10) < 0.85);
  assert.equal(winChance(-5, 0), 0);
});

test("big-play pop-ups fire for touchdowns and turnovers, not routine plays", () => {
  const before = [liveGame({ lastPlay: "J.Doe run for 3 yards" })];
  const td = detectBigPlays(before, [liveGame({ homeScore: 21, lastPlay: "J.Doe 2 yard rush TOUCHDOWN" })]);
  const pick = detectBigPlays(before, [liveGame({ lastPlay: "pass INTERCEPTED by R.Roe" })]);
  const boring = detectBigPlays(before, [liveGame({ lastPlay: "J.Doe run for 4 yards" })]);
  assert.equal(td[0].kind, "touchdown");
  assert.equal(pick[0].kind, "turnover");
  assert.equal(boring.length, 0);
});
