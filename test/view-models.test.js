// Pure view helpers: which tabs show and go in which column, the order of the game rail, the replay controls,
// the Zone's filters and whose play a card is.
// Run with: npm test

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { columnsFor, railOrder, ALL_GAMES, RAIL_MAX, visibleTabs, nearTabs, SPEEDS, nextSpeed, clockPill, FEED_FILTERS, feedFilter, cardOwner } from "../src/view-models.js";
import { createReplay } from "../src/replay.js";
import { createTracker } from "../src/tracker.js";
import { rankGames, DIALS } from "../src/model.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(readFileSync(path.join(root, "app/replay.json"), "utf8"));

// ---------- columnsFor (plan B1.8) ----------

test("columnsFor: the five cases from the plan", () => {
  assert.deepEqual(columnsFor(3, ["zone", "matchup", "games"], "matchup"), ["zone", "matchup", "games"]);
  assert.deepEqual(columnsFor(3, ["zone", "matchup", "games", "league"], "league"), ["zone", "league", "games"]);
  assert.deepEqual(columnsFor(3, ["zone", "games"], "matchup"), ["zone", "games"]);
  assert.deepEqual(columnsFor(2, ["zone", "matchup", "games"], "games"), ["zone", "games"]);
  assert.deepEqual(columnsFor(2, ["zone", "matchup", "games"], "zone"), ["zone", "matchup"]);
});

test("columnsFor: defaults and fallbacks", () => {
  assert.deepEqual(columnsFor(3, ["zone", "games"], undefined), ["zone", "games"]);
  assert.deepEqual(columnsFor(3, ["zone", "matchup", "games"], "games"), ["zone", "matchup", "games"]); // Games already has column 3
  assert.deepEqual(columnsFor(3, ["zone", "matchup", "games", "league"], "nope"), ["zone", "matchup", "games"]);
  assert.deepEqual(columnsFor(2, ["zone", "matchup", "games"], undefined), ["zone", "matchup"]);
  assert.deepEqual(columnsFor(2, ["zone", "games"], "matchup"), ["zone", "games"]); // fantasy off
  assert.deepEqual(columnsFor(2, ["zone", "matchup", "games", "league"], "league"), ["zone", "league"]);
  assert.equal(columnsFor(3, ["zone"], "matchup"), null);
});

// ---------- railOrder (plan B1.4) ----------

const g = (id, state, kickoff, watch = 0) => ({ game: { id, state, kickoff }, watch });
const T = (h, m = 0) => new Date(Date.UTC(2026, 9, 18, h, m)).toISOString(); // hours past 23 roll into Monday

test("railOrder: live games by watch, then the next 2 kickoffs, then All games", () => {
  const ranked = [g("a", "in", T(17), 40), g("b", "in", T(17), 90), g("c", "pre", T(20, 25)), g("d", "pre", T(20, 5)), g("e", "pre", T(24, 20)), g("f", "post", T(13, 30))];
  assert.deepEqual(railOrder(ranked), ["b", "a", "d", "c", ALL_GAMES]);
});

test("railOrder: nothing live means upcoming games, then the 3 most recent finals", () => {
  const ranked = [g("p1", "post", T(13, 30)), g("p2", "post", T(17)), g("p3", "post", T(17)), g("p4", "post", T(20, 5)), g("n1", "pre", T(24, 20)), g("n2", "pre", T(20, 25))];
  assert.deepEqual(railOrder(ranked), ["n2", "n1", "p4", "p2", "p3", ALL_GAMES]);
});

test("railOrder: never more than 10 chips, finals still fit when nothing is live", () => {
  const live = Array.from({ length: 12 }, (_, i) => g(`l${i}`, "in", T(17), 100 - i));
  const a = railOrder(live);
  assert.equal(a.length, RAIL_MAX);
  assert.equal(a.at(-1), ALL_GAMES);
  const quiet = [...Array.from({ length: 11 }, (_, i) => g(`n${i}`, "pre", T(17, i))), g("p", "post", T(13, 30))];
  const b = railOrder(quiet);
  assert.equal(b.length, RAIL_MAX);
  assert.deepEqual(b.slice(-2), ["p", ALL_GAMES]);
  assert.deepEqual(railOrder([]), [ALL_GAMES]);
});

test("railOrder on the replay: 1:40 PM and the end of saved plays", () => {
  const r = createReplay(data, { startAt: Date.parse("2026-10-18T17:40:00Z") });
  const rank = () => { const s = r.tracker.snapshot(); return rankGames({ games: s.games, matchups: s.matchups, dials: DIALS.fantasyOn }); };
  const name = (id) => data.games.find((x) => x.id === id) ?? null;
  let order = railOrder(rank());
  // 7 live 1 PM games, then ARI@LAR (4:05) and one 4:25 game, then All games.
  assert.equal(order.length, 10);
  assert.ok(order.slice(0, 7).every((id) => name(id).kickoff === "2026-10-18T17:00Z"));
  assert.equal(name(order[7]).away + "@" + name(order[7]).home, "ARI@LAR");
  r.jump(Math.max(...data.plays.map((p) => p.wallclock)));
  order = railOrder(rank());
  // Only DAL@GB is live; Monday's WAS@SF is next.
  assert.deepEqual(order.map((id) => (id === ALL_GAMES ? id : `${name(id).away}@${name(id).home}`)), ["DAL@GB", "WAS@SF", ALL_GAMES]);
});

// ---------- Shell (plan B1.1, B1.10, app bar) ----------

const TABS = [
  { id: "zone" },
  { id: "matchup", fantasy: true },
  { id: "games" },
  { id: "league", fantasy: true, needs: (d) => !!d?.teams },
];
const ids = (list) => list.map((t) => t.id);

test("visibleTabs: fantasy off hides Matchup and League; League waits for league data", () => {
  assert.deepEqual(ids(visibleTabs(TABS, { fantasyOn: true })), ["zone", "matchup", "games"]);
  assert.deepEqual(ids(visibleTabs(TABS, { fantasyOn: true, data: { teams: [1] } })), ["zone", "matchup", "games", "league"]);
  assert.deepEqual(ids(visibleTabs(TABS, { fantasyOn: false, data: { teams: [1] } })), ["zone", "games"]);
});

test("nearTabs: the open tab and its neighbours, or every column", () => {
  const t = ["zone", "matchup", "games"];
  assert.deepEqual(nearTabs(t, 0, null), ["zone", "matchup"]);
  assert.deepEqual(nearTabs(t, 1, null), ["zone", "matchup", "games"]);
  assert.deepEqual(nearTabs(t, 2, null), ["matchup", "games"]);
  assert.deepEqual(nearTabs(t, 0, ["zone", "games"]), ["zone", "games"]);
  assert.deepEqual(nearTabs(["zone", "games"], 1, null), ["zone", "games"]);
});

test("speed: one tap goes 1x -> 2x -> 5x -> 20x -> 1x", () => {
  assert.deepEqual(SPEEDS, [1, 2, 5, 20]);
  const seen = [1];
  for (let i = 0; i < 4; i++) seen.push(nextSpeed(seen.at(-1)));
  assert.deepEqual(seen, [1, 2, 5, 20, 1]);
  assert.equal(nextSpeed(0), 1); // an old saved "paused" speed starts over at 1x
  assert.equal(nextSpeed(3), 1);
});

test("clockPill: Eastern time, short", () => {
  assert.equal(clockPill(Date.parse("2026-10-18T17:40:00Z")), "1:40P");
  assert.equal(clockPill(Date.parse("2026-10-18T16:57:30Z")), "12:57P");
  assert.equal(clockPill(Date.parse("2026-10-18T13:30:00Z")), "9:30A");
  assert.equal(clockPill(Date.parse("2026-10-19T02:54:00Z")), "10:54P");
});

// The whole day, one play at a time, as tools/moments.js plays it (its numbers: 2398 cards, 173 My matchup, 190 Big).
const day = createTracker({ leagues: data.leagues, players: data.players, games: data.games });
let taylor140 = null;
for (const p of [...data.plays].sort((a, b) => a.wallclock - b.wallclock)) {
  for (const c of day.addPlays(p.gameId, [p])) if (!taylor140 && c.gameName === "TEN @ IND" && /Taylor/.test(c.name) && /^38-yd catch/.test(c.label)) taylor140 = c;
}

test("feed filters: My matchup / All / Big on the full day", () => {
  assert.deepEqual(FEED_FILTERS.map(([k]) => k), ["mine", "all", "big"]);
  const feed = day.feed();
  assert.equal(feed.filter(feedFilter("all")).length, 2398);
  assert.equal(feed.filter(feedFilter("mine")).length, 173);
  assert.equal(feed.filter(feedFilter("big")).length, 190);
  assert.ok(feed.filter(feedFilter("mine")).every((c) => c.kind !== "marker"));
  assert.equal(feedFilter("nonsense")(feed[0]), true); // anything unknown shows everything
});

test("cards: Taylor's 38-yd catch at 1:40 PM is the opponent's, with its down and distance", () => {
  assert.ok(taylor140, "the card exists");
  assert.equal(taylor140.situation, "2nd & 6 at IND 34");
  assert.equal(`${taylor140.away} ${taylor140.awayScore}-${taylor140.homeScore} ${taylor140.home} · Q${taylor140.period} ${taylor140.clock}`, "TEN 0-0 IND · Q2 14:34");
  assert.equal(cardOwner(taylor140), "opponent");
  assert.equal(cardOwner({ impacts: [] }), "");
  assert.equal(cardOwner({ impacts: [{ owner: "me", delta: -0.5 }, { owner: "opponent", delta: 0.5 }] }), "me"); // a tie goes to you
  assert.equal(cardOwner({ impacts: [{ owner: "me", delta: 1 }, { owner: "opponent", delta: 6 }] }), "opponent");
});

// ---------- Game rail chips and the Games grid (plan B1.4, B1.10 b, M1 steps 4-5) ----------

import { shortReason, SHORT_MAX } from "../src/model.js";
import { chipVM, tileVM, gameClock, kickoffShort, railMerge, topChanged, gamesOrder, segmentCounts, isHot } from "../src/view-models.js";

const at = (iso) => {
  const r = createReplay(data, { startAt: Date.parse(iso) });
  const s = r.tracker.snapshot();
  return { r, snap: s, ranked: rankGames({ games: s.games, matchups: s.matchups, dials: DIALS.fantasyOn }) };
};
const byName = (ranked, name) => ranked.find((x) => `${x.game.away}@${x.game.home}` === name);

test("shortReason: last name + RZ, the game's own reason, or nothing; never over 14 characters", () => {
  const p = (name, roleWhy = null, pos = "RB", nflTeam = "CHI") => ({ name, roleWhy, pos, nflTeam });
  assert.equal(shortReason({ involved: [p("D'Andre Swift", "red zone, gets 40% of CHI's red-zone looks")] }), "Swift RZ");
  assert.equal(shortReason({ involved: [p("D'Andre Swift", "goal line, gets 40% of CHI's red-zone looks")] }), "Swift RZ");
  assert.equal(shortReason({ involved: [p("Caleb Williams", "CHI at the goal line", "QB")] }), "Williams RZ");
  assert.equal(shortReason({ involved: [p("D'Andre Swift")] }), "Swift");
  assert.equal(shortReason({ involved: [p("Marvin Harrison Jr.")] }), "Harrison");
  assert.equal(shortReason({ involved: [p("LAR D/ST", null, "DEF", "LAR")] }), "LAR defense");
  assert.equal(shortReason({ involved: [p("Marquez Valdes-Scantling", "red zone, gets 9% of KC's red-zone looks")] }), "Valdes-Sca… RZ"); // 14 characters
  assert.equal(shortReason({ involved: [], gameWhy: "close game, TEN threatening (2nd & 6 at IND 34)" }), "TEN RZ");
  assert.equal(shortReason({ involved: [], gameWhy: "close game, crunch time" }), "crunch time");
  assert.equal(shortReason({ involved: [], gameWhy: "close game" }), "close game");
  assert.equal(shortReason({ involved: [], gameWhy: null }), "");
});

test("shortReason on the replay: every game, every 5 minutes, fits and uses no abbreviation but RZ", () => {
  const r = createReplay(data, { startAt: Date.parse("2026-10-18T16:57:00Z") });
  const teams = new Set(data.games.flatMap((g) => [g.home, g.away]));
  let n = 0;
  for (let t = Date.parse("2026-10-18T16:57:00Z"); t <= Date.parse("2026-10-19T03:00:00Z"); t += 5 * 60_000) {
    r.jump(t);
    const s = r.tracker.snapshot();
    for (const x of rankGames({ games: s.games, matchups: s.matchups, dials: DIALS.fantasyOn })) {
      const why = shortReason(x);
      assert.ok(why.length <= SHORT_MAX, why);
      for (const w of why.split(" ")) if (/^[A-Z]{2,}$/.test(w)) assert.ok(w === "RZ" || teams.has(w), `${why}: ${w}`);
      n += why ? 1 : 0;
    }
  }
  assert.ok(n > 500, "most live games have a reason");
});

test("gameClock and kickoffShort", () => {
  assert.equal(gameClock({ period: 2, clockSec: 754 }), "Q2 12:34");
  assert.equal(gameClock({ period: 1, clockSec: 0 }), "End Q1");
  assert.equal(gameClock({ period: 2, clockSec: 0 }), "Half");
  assert.equal(gameClock({ period: 5, clockSec: 192 }), "OT 3:12");
  const sun = Date.parse("2026-10-18T19:42:00Z");
  assert.equal(kickoffShort({ kickoff: "2026-10-18T20:05Z" }, sun), "4:05 PM");
  assert.equal(kickoffShort({ kickoff: "2026-10-20T00:15Z" }, sun), "Mon 8:15 PM");
});

test("chips at 1:40 PM: the sketch's TEN 0-0 IND with two purple dots, a 4:05 PM chip, and Final", () => {
  const { r, snap, ranked } = at("2026-10-18T17:40:30Z");
  const vm = (name) => chipVM(byName(ranked, name), { matchups: snap.matchups, now: r.time });
  const ten = vm("TEN@IND");
  assert.deepEqual([ten.awayScore, ten.homeScore, ten.time, ten.why], [0, 0, "Q2 14:34", "Taylor"]);
  assert.deepEqual(ten.dots, ["opponent", "opponent"]);
  assert.match(ten.label, /^TEN 0, IND 0, 2nd quarter 14:34, their Jonathan Taylor and Josh Downs/);
  const bal = vm("BAL@CLE");
  assert.deepEqual([bal.time, bal.why, bal.dots.join()], ["End Q1", "Flowers", "me"]);
  const ari = vm("ARI@LAR");
  assert.deepEqual([ari.awayScore, ari.time], [null, "4:05 PM"]);
  const hou = vm("HOU@JAX");
  assert.deepEqual([hou.time, hou.why, hou.hot], ["Final", "", false]);
  for (const x of ranked) assert.ok(chipVM(x, { matchups: snap.matchups, now: r.time }).why.length <= 14);
});

test("Games at 3:42 PM: 14 = 7 live + 5 next + 2 final; TEN@IND then PIT@TB; stake bars all theirs / all yours", () => {
  const { r, ranked } = at("2026-10-18T19:42:30Z");
  assert.deepEqual(segmentCounts(ranked), { all: 14, live: 7, next: 5, final: 2 });
  const order = gamesOrder(ranked, { seg: "all", sort: "matters" }).map((id) => ranked.find((x) => x.game.id === id));
  const names = order.map((x) => `${x.game.away}@${x.game.home}`);
  assert.deepEqual(names.slice(0, 2), ["TEN@IND", "PIT@TB"]);
  assert.deepEqual(order.map((x) => x.game.state), [...Array(7).fill("in"), ...Array(5).fill("pre"), "post", "post"]);
  assert.equal(gamesOrder(ranked, { seg: "live" }).length, 7);
  assert.equal(gamesOrder(ranked, { seg: "next" }).length, 5);
  assert.equal(gamesOrder(ranked, { seg: "final" }).length, 2);
  const ko = gamesOrder(ranked, { sort: "kickoff" }).map((id) => ranked.find((x) => x.game.id === id).game);
  assert.equal(`${ko[0].away}@${ko[0].home}`, "SEA@DEN");
  assert.equal(`${ko.at(-1).away}@${ko.at(-1).home}`, "WAS@SF");
  const ten = tileVM(byName(ranked, "TEN@IND"), { now: r.time }), pit = tileVM(byName(ranked, "PIT@TB"), { now: r.time });
  assert.equal(ten.mineShare, 0);
  assert.equal(pit.mineShare, 1);
  assert.deepEqual(ten.players.map((p) => `${p.owner}:${p.name}`), ["opponent:Taylor RZ", "opponent:Downs RZ"]);
  assert.equal(ten.meta, "Q4 5:32");
  assert.ok(isHot(byName(ranked, "TEN@IND")) && ten.hot);
  for (const x of ranked) {
    const t = tileVM(x, { now: r.time });
    if (t.mineShare == null) assert.equal(t.mineStake + t.theirStake, 0);
    else { assert.ok(t.mineShare >= 0 && t.mineShare <= 1); assert.ok(Math.abs(t.mineStake / (t.mineStake + t.theirStake) + t.theirStake / (t.mineStake + t.theirStake) - 1) < 1e-9); }
  }
});

test("topChanged: a new first game, or a game entering the top 3; not two swapping below the top", () => {
  assert.equal(topChanged(["a", "b", "c", "d"], ["a", "b", "c", "e"]), false);
  assert.equal(topChanged(["a", "b", "c"], ["a", "c", "b"]), false);
  assert.equal(topChanged(["a", "b", "c"], ["b", "a", "c"]), true);
  assert.equal(topChanged(["a", "b", "c"], ["a", "b", "d"]), true);
  assert.equal(topChanged(["a", "b"], ["a", "b", "c"]), true);
  assert.equal(topChanged([], []), false);
});

test("railMerge: keeps the order, appends newcomers, drops only upcoming or final chips ranked below them", () => {
  const st = { l1: "in", l2: "in", p1: "pre", p2: "pre", f1: "post", n1: "in" };
  const stateOf = (id) => st[id];
  assert.deepEqual(railMerge(["l1", "l2"], ["l2", "l1", ALL_GAMES], { stateOf }), ["l1", "l2"]); // a new order alone changes nothing
  assert.deepEqual(railMerge(["l1", "l2"], ["n1", "l2", "l1", ALL_GAMES], { stateOf }), ["l1", "l2", "n1"]); // newcomers join at the end
  assert.deepEqual(railMerge(["l1", "f1", "p1"], ["n1", "l1", "p1"], { stateOf, max: 3 }), ["l1", "p1", "n1"]); // a final no longer listed makes room
  assert.deepEqual(railMerge(["l1", "f1", "p1"], ["n1", "l1", "p1"], { stateOf, max: 3, keep: (id) => id === "f1" }), ["l1", "f1", "n1"]); // not the one under your finger
  assert.deepEqual(railMerge(["l1", "l2"], ["n1", "l1", "l2"], { stateOf, max: 2 }), ["l1", "l2"]); // never a live game: n1 waits for ↻
  assert.deepEqual(railMerge(["p1", "p2"], ["p1", "p2", "n1"], { stateOf: () => "pre", max: 2 }), ["p1", "p2"]); // newcomer ranked lowest: nothing to do
});

test("rail on the replay, 12:57 PM to 8:30 PM: only appends, never over 10 chips, never drops a live game", () => {
  const r = createReplay(data, { startAt: Date.parse("2026-10-18T16:57:00Z") });
  const rank = () => { const s = r.tracker.snapshot(); return rankGames({ games: s.games, matchups: s.matchups, dials: DIALS.fantasyOn }); };
  let shown = railOrder(rank()).filter((id) => id !== ALL_GAMES), appended = 0, stale = 0, steps = 0;
  for (let t = Date.parse("2026-10-18T16:57:30Z"); t <= Date.parse("2026-10-19T00:30:00Z"); t += 30_000) {
    r.jump(t);
    const ranked = rank(), state = new Map(ranked.map((x) => [x.game.id, x.game.state]));
    const fresh = railOrder(ranked);
    const next = railMerge(shown, fresh, { stateOf: (id) => state.get(id) });
    const kept = shown.filter((id) => next.includes(id));
    assert.deepEqual(next.slice(0, kept.length), kept, "chips that stay keep their order");
    for (const id of shown) if (!next.includes(id)) assert.notEqual(state.get(id), "in", "a live game is never dropped");
    assert.ok(next.length <= RAIL_MAX - 1);
    for (const x of ranked) if (x.game.state === "in" && next.length < RAIL_MAX - 1) assert.ok(next.includes(x.game.id), "every live game is in the rail when there's room");
    appended += next.filter((id) => !shown.includes(id)).length;
    stale += topChanged(next, fresh.filter((id) => id !== ALL_GAMES)) ? 1 : 0;
    steps++;
    shown = next;
  }
  assert.ok(appended >= 4, "4 PM and night games joined at the end");
  assert.ok(stale > 0 && stale < steps, "↻ shows only some of the time");
});

// ---------- Matchup lineup (plan B2, M1 step 6 and done-when g) ----------

import { lineupVM, slotLabels, lineupNames, playerStatus, MARKS } from "../src/view-models.js";

const lineupAt = (iso) => {
  const r = createReplay(data, { startAt: Date.parse(iso) });
  const m = r.tracker.snapshot().matchups[0];
  return { r, m, vm: lineupVM(m, { now: r.time, statLine: (p) => r.tracker.statLine(p.id, p.pos) }) };
};
const END = new Date(Math.max(...data.plays.map((p) => p.wallclock))).toISOString();

test("slotLabels: the league's starting slots without the bench, or each player's own position", () => {
  const ten = Array.from({ length: 10 }, (_, i) => ({ pos: ["QB", "RB", "RB", "WR", "WR", "TE", "RB", "WR", "K", "DEF"][i] }));
  const league = ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "FLEX", "K", "DEF", "BN", "BN", "BN", "BN", "BN", "BN"];
  assert.deepEqual(slotLabels(league, ten), ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "FLEX", "K", "DEF"]);
  assert.deepEqual(slotLabels(undefined, ten), ["QB", "RB", "RB", "WR", "WR", "TE", "RB", "WR", "K", "DEF"]);
  assert.deepEqual(slotLabels(["QB", "SUPER_FLEX", "BN"], [{ pos: "QB" }, { pos: "QB" }]), ["QB", "SFLX"]);
  assert.deepEqual(slotLabels(["QB", "RB", "BN"], [{ pos: "QB" }, { pos: "WR" }, { pos: "TE" }]), ["QB", "WR", "TE"]); // wrong length: positions
});

test("lineupNames: last names, an initial when two share one, D/ST for a defense", () => {
  const ps = [{ name: "Kyren Williams", pos: "RB" }, { name: "Javonte Williams", pos: "RB" }, { name: "Marvin Harrison Jr.", pos: "WR" }, { name: "KC D/ST", pos: "DEF", nflTeam: "KC" }];
  assert.deepEqual([...lineupNames(ps).values()], ["K. Williams", "J. Williams", "Harrison", "KC D/ST"]);
});

test("playerStatus: yet to play, playing, has the ball (a defense: on the field), final, no game", () => {
  const g = { state: "in", offense: "CHI" };
  assert.equal(playerStatus({ pos: "RB", nflTeam: "CHI", game: g }), "ball");
  assert.equal(playerStatus({ pos: "RB", nflTeam: "ATL", game: g }), "in");
  assert.equal(playerStatus({ pos: "DEF", nflTeam: "ATL", game: g }), "ball");
  assert.equal(playerStatus({ pos: "DEF", nflTeam: "CHI", game: g }), "in");
  assert.equal(playerStatus({ pos: "WR", nflTeam: "CHI", game: { state: "pre" } }), "pre");
  assert.equal(playerStatus({ pos: "WR", nflTeam: "CHI", game: { state: "post" } }), "post");
  assert.equal(playerStatus({ pos: "WR", nflTeam: "CHI", game: null }), "none");
  assert.deepEqual(MARKS, { pre: "○", in: "●", ball: "◉", post: "✓", none: "–" });
});

test("lineup at the end of saved plays: 10 vs 10 with FLEX, 123.5 vs 83.5, Monday's three yet to play", () => {
  const { vm } = lineupAt(END);
  assert.equal(vm.rows.length, 10);
  assert.deepEqual(vm.rows.map((r) => r.slot), ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "FLEX", "K", "DEF"]);
  assert.ok(vm.rows.every((r) => r.mine && r.theirs));
  assert.equal(vm.myNow.toFixed(1), "123.5");
  assert.equal(vm.oppNow.toFixed(1), "83.5");
  const sides = vm.rows.flatMap((r) => [r.mine, r.theirs]);
  const monday = sides.filter((s) => s.status === "pre").map((s) => `${s.name}: ${s.mark} ${s.note}`);
  assert.deepEqual(monday, ["Daniels: ○ MON 8:15 PM · yet to play", "Kittle: ○ MON 8:15 PM · yet to play", "Pineiro: ○ MON 8:15 PM · yet to play"]);
  // the rows' points add up to the totals
  assert.equal(vm.rows.reduce((s, r) => s + r.mine.points, 0).toFixed(1), "123.5");
  assert.equal(vm.rows.reduce((s, r) => s + r.theirs.points, 0).toFixed(1), "83.5");
  const by = (name) => sides.find((s) => s.name === name);
  assert.equal(by("Swift").note, "16 car 44 yds, 4 rec 26 yds, 2 TD");
  assert.equal(by("Swift").mark, "✓");
  assert.equal(by("KC D/ST").note, "4 sacks, 1 INT, 1 fumble rec, 6 pts allowed");
  assert.equal(by("Aubrey").note, "1 XP"); // DAL@GB still going
  assert.equal(by("Aubrey").mark, "●");
  assert.deepEqual([by("K. Williams").pos, by("J. Williams").pos], ["RB", "RB"]); // two Williamses, told apart
  assert.match(by("Daniels").label, /^Your QB Jayden Daniels: 0\.0 points, yet to play, kicks off Mon 8:15 PM, expected about [\d.]+ more\.$/);
});

test("lineup at 3:42 PM matches the sketch in Part A", () => {
  const { vm } = lineupAt("2026-10-18T19:42:30Z");
  const row = (i) => `${vm.rows[i].slot} ${vm.rows[i].mine.name} ${vm.rows[i].mine.points.toFixed(1)} ${vm.rows[i].mine.mark} | ${vm.rows[i].theirs.mark} ${vm.rows[i].theirs.points.toFixed(1)} ${vm.rows[i].theirs.name}`;
  assert.equal(row(0), "QB Daniels 0.0 ○ | ○ 0.0 Allen");
  assert.match(row(1), /^RB Swift 22\.7 [●◉] \| ○ 0\.0 K\. Williams$/);
  assert.equal(row(2), "RB Marks 10.1 ✓ | ◉ 21.1 Taylor");
  assert.equal(row(3), "WR Golden 0.0 ○ | ✓ 6.4 Waddle");
  assert.equal(vm.rows[0].mine.note, "MON 8:15 PM · yet to play");
  assert.equal(vm.rows[0].theirs.note, "4:25 PM · yet to play"); // same day: no weekday
});

test("onFieldVM: only skill players whose team has the ball in a live game, yours first", async () => {
  const { onFieldVM } = await import("../src/view-models.js");
  const g = (state, offense, red = false) => ({ id: "g1", state, offense, isRedZone: red });
  const m = {
    mine: [
      { id: "1", name: "D'Andre Swift", pos: "RB", owner: "me", nflTeam: "CHI", game: g("in", "CHI", true) },
      { id: "2", name: "Kicker Guy", pos: "K", owner: "me", nflTeam: "CHI", game: g("in", "CHI") },
      { id: "3", name: "Done Guy", pos: "WR", owner: "me", nflTeam: "KC", game: g("post", null) },
    ],
    theirs: [
      { id: "4", name: "Bijan Robinson", pos: "RB", owner: "opponent", nflTeam: "ATL", game: g("in", "CHI") },
      { id: "5", name: "Other Guy", pos: "TE", owner: "opponent", nflTeam: "SF", game: g("in", "SF") },
    ],
  };
  assert.deepEqual(onFieldVM(m).map((p) => [p.id, p.red]), [["1", true], ["5", false]]);
  assert.deepEqual(onFieldVM(null), []);
});
