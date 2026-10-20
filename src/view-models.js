// Pure helpers that turn engine data into what a screen shows. No DOM here, so they run in tests
// (and later, unchanged, in the phone app).

import { shortReason, shortName, rzTag } from "./model.js";
import { statText } from "./insights.js";

export const ALL_GAMES = "all"; // the "All games ›" chip at the end of the game rail
export const RAIL_MAX = 10; // chips in the rail, counting "All games ›"

// A kickoff time we can't read sorts last among upcoming games and oldest among finals.
const kickoffMs = (x, unknown) => { const t = Date.parse(x.game.kickoff); return Number.isFinite(t) ? t : unknown; };

// Which games the rail shows, in order, as game ids ending with ALL_GAMES:
//   live games, most watchable first, then the next 2 to kick off;
//   with nothing live: the next games to kick off, then the 3 most recent finals.
// `ranked` is rankGames() output. The rail only applies a new order when the user asks (↻) or jumps.
export function railOrder(ranked) {
  const room = RAIL_MAX - 1;
  const live = ranked.filter((x) => x.game.state === "in").sort((a, b) => b.watch - a.watch);
  const next = ranked.filter((x) => x.game.state === "pre").sort((a, b) => kickoffMs(a, Infinity) - kickoffMs(b, Infinity));
  let list;
  if (live.length) list = [...live, ...next.slice(0, 2)];
  else {
    const finals = ranked.filter((x) => x.game.state === "post").sort((a, b) => kickoffMs(b, -Infinity) - kickoffMs(a, -Infinity)).slice(0, 3);
    list = [...next.slice(0, room - finals.length), ...finals];
  }
  return [...list.slice(0, room).map((x) => x.game.id), ALL_GAMES];
}

// Which tab goes in which column on a wide screen. `cols` is how many fit (2 or 3), `tabIds` the visible
// tabs in order, `pick` the viewer's choice for column 2. Returns tab ids, one per column, or null for
// "no columns" (fewer than 2 tabs).
//   2 columns: Zone + pick (any tab but Zone; default Matchup, or Games when fantasy is off)
//   3 columns: Zone + pick (Matchup or League; default Matchup) + Games; without either, 2 columns Zone + Games
export function columnsFor(cols, tabIds, pick) {
  const n = Math.min(cols, tabIds.length);
  if (n < 2) return null;
  const has = (id) => tabIds.includes(id);
  if (n >= 3) {
    const middle = ["matchup", "league"].includes(pick) && has(pick) ? pick : ["matchup", "league"].find(has);
    if (middle && has("games")) return ["zone", middle, "games"];
    if (has("games")) return ["zone", "games"];
  }
  const second = pick !== "zone" && has(pick) ? pick
    : has("matchup") ? "matchup" : has("games") ? "games" : tabIds.find((id) => id !== "zone");
  return ["zone", second];
}

// ---------- Shell: tabs, speed, clock, feed filters ----------

// Which tabs show, in order. `tabs` is the app's TABS config: { id, fantasy?, needs?(data) }.
export const visibleTabs = (tabs, { fantasyOn = true, data } = {}) =>
  tabs.filter((t) => (!t.fantasy || fantasyOn) && t.needs?.(data) !== false);

// Pages that get live updates now: every column on a wide screen, otherwise the open tab and its neighbours
// (the ones a swipe can reveal). The rest catch up when they come into reach.
export function nearTabs(tabIds, active, cols) {
  if (cols) return tabIds.filter((id) => cols.includes(id));
  return tabIds.filter((_, k) => Math.abs(k - active) <= 1);
}

// The speed button cycles 1x -> 2x -> 5x -> 20x -> 1x (one tap each).
export const SPEEDS = [1, 2, 5, 20];
export const nextSpeed = (s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length];

// The replay clock on the app bar's pill, Eastern time: "1:40P", "9:30A".
export function clockPill(ms) {
  const t = new Date(ms).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });
  return t.replace(/\s*([AP])M$/i, "$1");
}

// The Zone's filter chips.
export const FEED_FILTERS = [["mine", "My matchup"], ["all", "All"], ["big", "Big"]];
// With fantasy off there's no "My matchup"; "Close games" keeps plays from games within 8 points at the time.
export const FEED_FILTERS_OFF = [["all", "All"], ["big", "Big"], ["close", "Close games"]];
export const feedFilters = (fantasyOn) => (fantasyOn ? FEED_FILTERS : FEED_FILTERS_OFF);
export function feedFilter(kind) {
  if (kind === "mine") return (c) => c.impacts.length > 0;
  if (kind === "big") return (c) => c.big === true;
  if (kind === "close") return (c) => c.kind !== "marker" && Math.abs(c.homeScore - c.awayScore) <= 8;
  return () => true;
}

// Whose play a card is, for its coloured left bar: "me" (yellow), "opponent" (purple) or "" (nobody's).
// The side with more points moved wins; a tie goes to you.
export function cardOwner(c) {
  const sum = (o) => (c.impacts ?? []).filter((i) => i.owner === o).reduce((s, i) => s + Math.abs(i.delta), 0);
  const me = sum("me"), opp = sum("opponent");
  return me || opp ? (me >= opp ? "me" : "opponent") : "";
}

// ---------- Game rail and Games grid (plan B1.4, B1.10 b) ----------


const ETZ = "America/New_York";
const etDay = (ms) => new Date(ms).toLocaleDateString("en-CA", { timeZone: ETZ });

// "Q2 12:42", "End Q1", "Half", "OT 3:12" for a game in progress.
export function gameClock(g) {
  const ot = g.period > 4;
  const sec = Math.max(0, g.clockSec ?? 0);
  if (sec === 0 && !ot) return g.period === 2 ? "Half" : `End Q${g.period}`;
  const t = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
  return ot ? `OT ${t}` : `Q${g.period} ${t}`;
}

// Kickoff in Eastern time: "4:05 PM" on the same day as `now`, "Mon 8:15 PM" on another day.
export function kickoffShort(g, now) {
  const t = Date.parse(g.kickoff);
  if (!Number.isFinite(t)) return "Later";
  const time = new Date(t).toLocaleTimeString("en-US", { timeZone: ETZ, hour: "numeric", minute: "2-digit" });
  return now != null && etDay(t) === etDay(now) ? time : `${new Date(t).toLocaleDateString("en-US", { timeZone: ETZ, weekday: "short" })} ${time}`;
}

// The "hot" flag on chips and tiles: a live game where your matchup's players are threatening to score,
// or close to it late (rankGames' live situation of 2 or more).
export const isHot = (r) => r.game.state === "in" && r.live >= 2;

const stateText = (g, now) => (g.state === "pre" ? kickoffShort(g, now) : g.state === "post" ? "Final" : gameClock(g));
const QUARTER = ["", "1st quarter", "2nd quarter", "3rd quarter", "4th quarter"];
const stateLong = (g, now) => (g.state === "pre" ? `kicks off ${kickoffShort(g, now)}` : g.state === "post" ? "final"
  : g.period > 4 ? `overtime ${gameClock(g).slice(3)}` : (g.clockSec ?? 0) <= 0 ? (g.period === 2 ? "halftime" : `end of the ${QUARTER[g.period]}`)
  : `${QUARTER[g.period]} ${gameClock(g).slice(3)}`);

// Starters from your matchup in a game, yours first: [{ owner: "me" | "opponent", name }].
export function startersIn(gameId, matchups) {
  const out = [];
  for (const m of matchups ?? []) for (const p of [...m.mine, ...m.theirs]) if (p.game?.id === gameId) out.push({ owner: p.owner, name: p.name });
  return out.sort((a, b) => (a.owner === "me" ? 0 : 1) - (b.owner === "me" ? 0 : 1));
}

// One chip in the game rail. `r` is a rankGames() row, `matchups` the snapshot's, `now` the clock (ms).
export function chipVM(r, { matchups, now } = {}) {
  const g = r.game, pre = g.state === "pre";
  const players = startersIn(g.id, matchups);
  const why = g.state === "post" ? "" : shortReason(r);
  const time = stateText(g, now);
  const who = (o, w) => { const n = players.filter((p) => p.owner === o).map((p) => p.name); return n.length ? `, ${w} ${n.join(" and ")}` : ""; };
  return {
    id: g.id, state: g.state, hot: isHot(r),
    away: g.away, home: g.home, awayScore: pre ? null : g.awayScore, homeScore: pre ? null : g.homeScore,
    dots: players.map((p) => p.owner),
    time, why,
    label: `${g.away}${pre ? "" : ` ${g.awayScore}`}, ${g.home}${pre ? "" : ` ${g.homeScore}`}, ${stateLong(g, now)}${who("me", "your")}${who("opponent", "their")}${isHot(r) ? ", hot" : ""}. Opens the game.`,
  };
}

// One tile in the Games grid: the chip's facts plus the state line, who's at stake, the game's reason and the
// stake bar (how much of what's still to come in this game is yours vs your opponent's).
export function tileVM(r, { now } = {}) {
  const g = r.game;
  const stake = (o) => (r.involved ?? []).filter((p) => p.owner === o).reduce((s, p) => s + (p.stake ?? 0), 0);
  const mineStake = stake("me"), theirStake = stake("opponent"), total = mineStake + theirStake;
  return {
    id: g.id, state: g.state, hot: isHot(r),
    away: g.away, home: g.home, awayScore: g.state === "pre" ? null : g.awayScore, homeScore: g.state === "pre" ? null : g.homeScore,
    meta: g.state === "pre" ? `Kickoff ${kickoffShort(g, now)}` : g.state === "post" ? "Final" : `${gameClock(g)}${g.downText ? ` · ${g.downText}` : ""}`,
    // who's at stake here, most first ("Taylor RZ"), and the game's own reason; `reason` is the long version
    players: (r.involved ?? []).map((p) => ({ owner: p.owner, name: shortName(p) + rzTag(p) })),
    why: r.gameWhy ?? "",
    reason: r.reason,
    mineStake, theirStake,
    mineShare: total > 0 ? mineStake / total : null, // null: nothing at stake for either side
  };
}

// ---- Frozen order (R5): lists never re-order while you look; they only append, and show ↻ when stale ----

// Is the top of the list out of date? The first game is a different one, or a game moved into (or out of) the
// first `n`. Two games swapping places lower in the top `n` doesn't count, so ↻ doesn't blink at every play.
export function topChanged(shown, fresh, n = 3) {
  const a = shown.slice(0, n), b = fresh.slice(0, n);
  return a[0] !== b[0] || a.length !== b.length || b.some((id) => !a.includes(id));
}

// The rail's games after an update, keeping the order on screen. `shown` = game ids in the rail now,
// `fresh` = railOrder() (ALL_GAMES is ignored). Games that newly qualify join at the end. With no room, the
// lowest-ranked chip of a game that isn't live is dropped (lower than the newcomer, and never one `keep(id)`
// protects, e.g. under the user's finger); with nothing to drop, the newcomer waits for the next re-sort.
export function railMerge(shown, fresh, { stateOf = () => "in", keep = () => false, max = RAIL_MAX - 1 } = {}) {
  const want = fresh.filter((id) => id !== ALL_GAMES);
  const rank = new Map(want.map((id, i) => [id, i]));
  const out = shown.filter((id) => id !== ALL_GAMES);
  for (const id of want) {
    if (out.includes(id)) continue;
    if (out.length >= max) {
      let drop = -1;
      out.forEach((x, i) => {
        if (stateOf(x) === "in" || keep(x)) return;
        const rx = rank.get(x) ?? Infinity;
        if (rx <= rank.get(id)) return; // ranked above the newcomer: it stays
        if (drop < 0 || rx >= (rank.get(out[drop]) ?? Infinity)) drop = i;
      });
      if (drop < 0) continue;
      out.splice(drop, 1);
    }
    out.push(id);
  }
  return out;
}

// The Games grid: which games each chip shows, with counts, and the two sort orders.
export const GAME_SEGMENTS = [["all", "All"], ["live", "Live"], ["next", "Next"], ["final", "Final"]];
const SEG_STATE = { live: "in", next: "pre", final: "post" };
export const GAME_SORTS = [["matters", "Matters to me"], ["kickoff", "Kickoff"]];

export function segmentCounts(ranked) {
  const n = { all: ranked.length, live: 0, next: 0, final: 0 };
  for (const r of ranked) for (const [k, s] of Object.entries(SEG_STATE)) if (r.game.state === s) n[k]++;
  return n;
}

// Game ids for a segment, in a sort order:
//   matters  live games by how much they matter (watch score), then upcoming ones the same way (earlier
//            kickoff first on a tie), then finals, most recent first
//   kickoff  start time, earliest first (games kicking off together: by the visiting team, so it never reshuffles)
export function gamesOrder(ranked, { seg = "all", sort = "matters" } = {}) {
  const STATE = { in: 0, pre: 1, post: 2 };
  const list = ranked.filter((r) => !SEG_STATE[seg] || r.game.state === SEG_STATE[seg]);
  const ko = (r) => kickoffMs(r, Infinity);
  const cmp = sort === "kickoff"
    ? (a, b) => ko(a) - ko(b) || String(a.game.away).localeCompare(String(b.game.away))
    : (a, b) => STATE[a.game.state] - STATE[b.game.state]
      || (a.game.state === "post" ? kickoffMs(b, -Infinity) - kickoffMs(a, -Infinity) : b.watch - a.watch || ko(a) - ko(b));
  return list.slice().sort(cmp).map((r) => r.game.id);
}

// ---------- Matchup: the lineup face-off (plan B2, M1 step 6) ----------

// The league's starting slots, in lineup order ("QB", "RB", ..., "FLEX", "K", "DEF"), from Sleeper's
// roster_positions without the bench. Missing (or the wrong length): each starter's own position.
const NOT_STARTING = new Set(["BN", "IR", "TAXI", "RES"]);
const SLOT_LABEL = { SUPER_FLEX: "SFLX", REC_FLEX: "FLEX", WRRB_FLEX: "FLEX", WRTE_FLEX: "FLEX", IDP_FLEX: "IDP" };
export function slotLabels(rosterPositions, starters) {
  const slots = (rosterPositions ?? []).filter((s) => !NOT_STARTING.has(s)).map((s) => SLOT_LABEL[s] ?? s);
  return starters.map((p, i) => (slots.length === starters.length ? slots[i] : p?.pos ?? slots[i] ?? ""));
}

// Short names for the lineup rows: last names ("Swift"), with a first initial when two starters share one
// ("K. Williams" vs "J. Williams"), and "KC D/ST" for a defense.
export function lineupNames(players) {
  const last = (p) => {
    const words = String(p.name ?? "").trim().split(/\s+/).filter(Boolean);
    while (words.length > 1 && /^(jr|sr|ii|iii|iv|v)\.?$/i.test(words.at(-1))) words.pop();
    return words.at(-1) ?? "";
  };
  const count = new Map();
  for (const p of players) if (p.pos !== "DEF") count.set(last(p), (count.get(last(p)) ?? 0) + 1);
  return new Map(players.map((p) => [p, p.pos === "DEF" ? `${p.nflTeam ?? p.team ?? ""} D/ST`.trim()
    : count.get(last(p)) > 1 ? `${String(p.name).trim()[0]}. ${last(p)}` : last(p)]));
}

// Where a starter's game is, as a mark:
//   ○ yet to play ("MON 8:15 PM · yet to play")   ● playing   ◉ his team has the ball (a defense: is on the field)
//   ✓ his game is over                            – no game this week
export const MARKS = { pre: "○", in: "●", ball: "◉", post: "✓", none: "–" };
export function playerStatus(p, now) {
  const g = p.game;
  if (!g) return "none";
  if (g.state === "pre") return "pre";
  if (g.state === "post") return "post";
  const team = p.nflTeam ?? p.team;
  const ball = g.offense && (p.pos === "DEF" ? g.offense !== team : g.offense === team);
  return ball ? "ball" : "in";
}

// The Matchup tab's lineup: your starters next to your opponent's, slot by slot.
//   m           a snapshot matchup (tracker.snapshot().matchups[i])
//   now         the clock (replay time in a replay), for kickoff days
//   statLine(p) the player's stats so far (tracker.statLine), or nothing
// Returns { rows: [{ slot, mine, theirs }], myNow, oppNow, winProb }, each side
//   { id, name, pos, points, status, mark, note, label } or null.
export function lineupVM(m, { now, statLine = () => null } = {}) {
  const n = Math.max(m.mine.length, m.theirs.length);
  const slotsFrom = m.mine.length >= m.theirs.length ? m.mine : m.theirs;
  const slots = slotLabels(m.league?.roster_positions, Array.from({ length: n }, (_, i) => slotsFrom[i] ?? m.mine[i] ?? m.theirs[i]));
  const names = lineupNames([...m.mine, ...m.theirs]);
  const side = (p, whose) => {
    if (!p) return null;
    const status = playerStatus(p, now);
    const stats = status === "pre" || status === "none" ? "" : statText(statLine(p), p.pos);
    const note = status === "pre" ? `${kickoffShort(p.game, now).toUpperCase()} · yet to play`
      : status === "none" ? "No game"
      : stats || (status === "post" ? "No stats" : "No stats yet");
    const pts = Math.round(p.current * 10) / 10;
    const left = Math.round((p.remaining ?? 0) * 10) / 10;
    const where = { pre: `yet to play, kicks off ${kickoffShort(p.game, now)}`, in: "playing now", ball: p.pos === "DEF" ? "on the field now" : "has the ball", post: "game over", none: "no game this week" }[status];
    return {
      id: p.id, name: names.get(p), pos: p.pos, points: pts, status, mark: MARKS[status], note,
      label: `${whose} ${p.pos === "DEF" ? "D/ST" : p.pos} ${p.name}: ${pts.toFixed(1)} points, ${where}${stats ? `, ${stats}` : ""}${left > 0 ? `, expected about ${left.toFixed(1)} more` : ""}.`,
    };
  };
  return {
    rows: Array.from({ length: n }, (_, i) => ({ slot: slots[i], mine: side(m.mine[i], "Your"), theirs: side(m.theirs[i], "Their") })),
    myNow: m.myNow, oppNow: m.oppNow, winProb: m.winProb,
  };
}

// "On the field now" (Zone's top line): your and your opponent's QB/RB/WR/TE whose team has the ball in a game
// that's on. Yours first. red: his team is inside the 20.
//   onFieldVM(m) -> [{ id, name, pos, owner, gameId, red }]
const ON_FIELD = new Set(["QB", "RB", "WR", "TE"]);
export function onFieldVM(m) {
  if (!m) return [];
  return [...m.mine, ...m.theirs]
    .filter((p) => ON_FIELD.has(p.pos) && p.game?.state === "in" && p.game.offense && p.game.offense === p.nflTeam)
    .map((p) => ({ id: p.id, name: p.name, pos: p.pos, owner: p.owner, gameId: p.game.id, red: !!p.game.isRedZone }));
}
