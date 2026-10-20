// Fantasy Zone app: the shell (app bar, tabs you swipe between, or columns on a wide screen), the two data
// sources, and the update loop.
//   live    when served by server.js (npm start): Sleeper + ESPN play-by-play every 10 seconds
//   replay  anywhere else: every real play of NFL Week 6, at the speed it happened or faster (replay.json)
// Nothing on screen switches by itself: live data only changes what's inside the pages. Tabs, games,
// columns and scroll positions change only when you tap or swipe.

import { rankGames, DIALS } from "./src/model.js";
import { createReplay, windows } from "./src/replay.js";
import { columnsFor, visibleTabs, nearTabs, nextSpeed, SPEEDS } from "./src/view-models.js";
import { createPager } from "./ui/pager.js";
import { H, createSheet, createLayers } from "./ui/layers.js";
import { createAppbar } from "./views/appbar.js";
import { clockSheetHTML, refreshClockSheet, liveSheetHTML, findSheetHTML, findResultsHTML, playerSheetHTML, playSheetHTML, settingsSheetHTML, setupHTML } from "./views/sheets.js";
import { createZoneView } from "./views/zone.js";
import { createMatchupView } from "./views/matchup.js";
import { createGamesView } from "./views/games.js";
import { createGameLayer } from "./views/game.js";
import { createRail } from "./ui/rail.js";
import { buildIndex, search } from "./src/search.js";
import { cardHTML } from "./views/cards.js";

const POLL_MS = 10_000;
const TICK_MS = 250;
const REPLAY_START = Date.parse("2026-10-18T16:57:00Z"); // just before the 1 PM ET kickoffs

const $ = (sel) => document.querySelector(sel);
const store = {
  get(k, d) { try { const v = localStorage.getItem(`fz:${k}`); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(`fz:${k}`, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};

const ui = {
  mode: null, hasServer: false,
  // where you are
  tab: null, tabIds: [], pages: {}, scroll: {}, cols: null, pick: store.get("pick", null), fantasyOn: true,
  // replay controls and the Zone filter
  filter: store.get("filter", "mine"),
  speed: SPEEDS.includes(store.get("speed", 1)) ? store.get("speed", 1) : 1, paused: false,
  username: store.get("username", null),
  // data
  tracker: null, replay: null, replayData: null, live: null, error: null, updatedAt: 0, connecting: false,
  // the update pipeline (plan B1.10)
  seen: -1, dirty: false, pending: [], missed: {}, stale: new Set(),
  lastWp: new Map(), wpDelta: new Map(),
  wantGame: null,
  // what's open on top (plan B1.5): ui.stack / ui.depth are kept by ui/layers.js
  gameOrder: [], // the games ‹ › step through, frozen when a game opens
};

// ---------- Shell ----------

const shell = $("#shell"), tabbar = $("#tabbar"), pagerEl = $("#pager"), main = $("#main"), boot = $("#boot"), layerEl = $("#layer");
const appbar = createAppbar({ el: $("#appbar"), ui });
// Layers and sheets share one stack with Back-button steps. Forward (to a layer's step) reopens it from the address.
const layers = createLayers({ ui, onForward: (hash, st) => (st?.sheet ? SHEETS[st.sheet] && openSheet(st.sheet) : route(hash, { smooth: false })) });
const sheet = createSheet({ sheet: $("#sheet"), backdrop: $("#backdrop"), others: () => [$("#appbar"), $("#pinbar"), $("#rail"), tabbar, main, layerEl], onDismiss: () => closeSheet() });
const gameLayer = createGameLayer({ el: layerEl, ui, order: () => ui.gameOrder });
// The game chips between the app bar and the tabs. Their order only changes on a jump, Live/Replay or ↻.
const rail = createRail({ el: $("#rail"), getCtx: () => (ui.tracker ? lazyCtx() : null), current: () => gameLayer.id, now: () => ui.replay?.time ?? Date.now() });
const views = {
  zone: createZoneView({ ui, store }),
  matchup: createMatchupView({ ui }),
  games: createGamesView({ ui, store, getCtx: () => lazyCtx() }),
};

// The tabs, in order. Later: League (needs league data). The same list becomes the phone app's tabs.
const TABS = [
  { id: "zone", label: "Zone", view: views.zone },
  { id: "matchup", label: "Matchup", view: views.matchup, fantasy: true },
  { id: "games", label: "Games", view: views.games },
];
const tabOf = (id) => TABS.find((t) => t.id === id);
let mainPager = null;

// Snapshot and ranking, worked out once per update and only if something asks for them.
function lazyCtx() {
  let snap, ranked;
  return {
    get snap() { return (snap ??= ui.tracker.snapshot()); },
    get ranked() { return (ranked ??= rankGames({ games: this.snap.games, matchups: this.snap.matchups, dials: ui.fantasyOn ? DIALS.fantasyOn : DIALS.fantasyOff })); },
  };
}

// Build (or rebuild) the tab bar and pages from the visible tabs (plan B1.1). Pages of hidden tabs are kept,
// so they come back with their scroll spot.
function buildTabs() {
  const tabs = visibleTabs(TABS, { fantasyOn: ui.fantasyOn });
  const ids = tabs.map((t) => t.id);
  if (mainPager && ids.join() === ui.tabIds.join()) return;
  const before = ui.tabIds;

  for (const b of tabbar.querySelectorAll('[role="tab"]')) b.remove();
  const ink = tabbar.querySelector(".ink");
  const buttons = tabs.map((t) => {
    const b = document.createElement("button");
    b.type = "button"; b.id = `tab-${t.id}`; b.textContent = t.label;
    b.setAttribute("role", "tab"); b.setAttribute("aria-controls", `page-${t.id}`); b.setAttribute("aria-selected", "false");
    b.tabIndex = -1;
    tabbar.insertBefore(b, ink);
    return b;
  });

  for (const t of TABS) if (!ids.includes(t.id)) ui.pages[t.id]?.remove();
  const pages = tabs.map((t) => {
    let pg = ui.pages[t.id];
    if (!pg) {
      pg = document.createElement("section");
      pg.className = "page"; pg.id = `page-${t.id}`;
      pg.setAttribute("role", "tabpanel"); pg.setAttribute("aria-labelledby", `tab-${t.id}`);
      ui.pages[t.id] = pg;
      watchPage(pg, t.id);
      t.view.mount(pg);
      if (ui.tracker) t.view.reset(lazyCtx());
    } else if (!before.includes(t.id)) ui.stale.add(t.id); // back from hidden: catch up when in reach
    pagerEl.appendChild(pg);
    return pg;
  });
  ui.tabIds = ids;
  restorePageScroll();

  mainPager?.destroy();
  mainPager = createPager({ tabbar, pager: pagerEl, tabs: buttons, pages, onSettle, onReselect });
  const keep = ids.includes(ui.tab) ? ui.tab : "zone";
  if (ui.tab && keep !== ui.tab) setHash("zone");
  mainPager.start(ids.indexOf(keep));
  layoutColumns();
}

// ---------- Scroll memory (plan B1.7) ----------
// Each page remembers what was at its top: the first card or tile showing and how far down it sat (or just
// "the very top"). It's written after you stop scrolling, never right after a resize (whose squeezed scroll
// positions would overwrite it), and put back whenever a page changes size, gets a column, or comes back.
const KEYED = "[data-id], .tile[data-game]";
const shown = (pg) => pg?.isConnected && pg.getClientRects().length > 0;
const headBottom = (pg) => pg.getBoundingClientRect().top + (pg.querySelector(".page-head")?.offsetHeight ?? 0);

function recordScroll(id) {
  const pg = ui.pages[id];
  if (!shown(pg) || performance.now() - (pg._resizedAt ?? 0) < 250) return;
  if (pg.scrollTop < 24) { ui.scroll[id] = { top: 0 }; return; }
  const base = headBottom(pg);
  for (const el of pg.querySelectorAll(KEYED)) {
    const r = el.getBoundingClientRect();
    if (r.bottom <= base) continue;
    const key = el.dataset.id ? `[data-id="${CSS.escape(el.dataset.id)}"]` : `[data-game="${CSS.escape(el.dataset.game)}"]`;
    ui.scroll[id] = { top: pg.scrollTop, key, offset: r.top - base };
    return;
  }
  ui.scroll[id] = { top: pg.scrollTop };
}

function restoreScroll(id) {
  const pg = ui.pages[id], m = ui.scroll[id];
  if (!m || !shown(pg)) return;
  const el = m.key && pg.querySelector(m.key);
  const want = el ? pg.scrollTop + (el.getBoundingClientRect().top - headBottom(pg)) - m.offset : m.top;
  if (Math.abs(pg.scrollTop - want) >= 1) pg.scrollTop = want;
}
function restorePageScroll() { for (const id of ui.tabIds) restoreScroll(id); }

const pageRO = new ResizeObserver((entries) => {
  for (const e of entries) { e.target._resizedAt = performance.now(); restoreScroll(e.target.dataset.tab); }
});
function watchPage(pg, id) {
  pg.dataset.tab = id;
  pageRO.observe(pg);
  pg.addEventListener("scroll", () => { clearTimeout(pg._st); pg._st = setTimeout(() => recordScroll(id), 120); }, { passive: true });
}

// Tabs replace the address (#zone, #matchup, #games), so Back never steps through tabs. While something is open
// on top, the address belongs to it and is left alone.
function setHash(id) { if (!ui.stack.length) H.replace(`#${id}`); }

// A page became the current tab (swipe, tap, key, or start).
function onSettle(i, { swipe } = {}) {
  const id = ui.tabIds[i];
  const changed = id !== ui.tab;
  ui.tab = id;
  setHash(id);
  if (swipe && changed) $("#announce").textContent = `${tabOf(id).label} tab`;
  const ctx = ui.tracker ? lazyCtx() : null;
  if (changed && ctx) tabOf(id).view.activate?.(ctx); // e.g. Games re-sorts when you arrive
  catchUp(ctx);
}

function onReselect(i) {
  const pg = ui.pages[ui.tabIds[i]];
  pg?.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}

// Pages that just came into reach get what they missed.
function catchUp(ctx = ui.tracker ? lazyCtx() : null) {
  if (!ctx || !mainPager) return;
  for (const id of nearTabs(ui.tabIds, mainPager.active, ui.cols)) {
    if (!ui.stale.has(id)) continue;
    ui.stale.delete(id);
    const missed = ui.missed[id] ?? [];
    delete ui.missed[id];
    tabOf(id).view.update(ctx, missed);
  }
}

// Show a tab: swipe the pager there, or on a wide screen make sure it has a column.
function selectTab(id, { focus = false, smooth = true } = {}) {
  if (!ui.tabIds.includes(id)) return;
  if (ui.cols && !ui.cols.includes(id)) { ui.pick = id; store.set("pick", id); layoutColumns(); }
  mainPager.go(ui.tabIds.indexOf(id), smooth);
  if (focus) (ui.cols ? ui.pages[id].querySelector(".coltitle") : tabbar.querySelector(`#tab-${id}`))?.focus({ preventScroll: true });
}

// ---------- Wide screens: columns (plan B1.8) ----------

const mq2 = matchMedia("(min-width: 900px)"), mq3 = matchMedia("(min-width: 1200px)");

function layoutColumns() {
  const want = mq3.matches ? 3 : mq2.matches ? 2 : 1;
  const prev = ui.cols;
  ui.cols = want > 1 ? columnsFor(want, ui.tabIds, ui.pick) : null;
  shell.classList.toggle("dash", !!ui.cols);
  shell.style.setProperty("--cols", String(ui.cols?.length ?? 1));
  for (const id of ui.tabIds) {
    const pg = ui.pages[id], c = ui.cols?.indexOf(id) ?? -1;
    if (c >= 0) pg.dataset.col = String(c + 1); else delete pg.dataset.col;
    pg.setAttribute("role", ui.cols ? "region" : "tabpanel");
    pg.setAttribute("aria-labelledby", ui.cols ? `col-${id}` : `tab-${id}`);
  }
  renderColumnHeads();
  mainPager.setEnabled(!ui.cols);
  if (!ui.cols && prev) mainPager.go(Math.max(0, ui.tabIds.indexOf(ui.tab)), false);
  restorePageScroll();
  placeLayer();
  // A tab that just got a column counts as arriving there (Games re-sorts), then everything in view catches up.
  if (ui.tracker && ui.cols) {
    const ctx = lazyCtx();
    for (const id of ui.cols) if (!prev?.includes(id)) tabOf(id).view.activate?.(ctx);
    catchUp(ctx);
  }
}

// Column 2 gets a picker when more than one tab can go there.
function renderColumnHeads() {
  const choices = !ui.cols ? [] : ui.cols.length === 3 ? ui.tabIds.filter((id) => ["matchup", "league"].includes(id)) : ui.tabIds.filter((id) => id !== "zone");
  for (const id of ui.tabIds) {
    const slot = ui.pages[id].querySelector(".colpick-slot");
    if (!slot) continue;
    const html = ui.cols && ui.cols[1] === id && choices.length > 1
      ? `<span class="seg colpick" role="group" aria-label="Show in this column">${choices.map((c) => `<button type="button" data-pick="${c}" aria-pressed="${c === id}">${tabOf(c).label}</button>`).join("")}</span>`
      : "";
    if (slot._h !== html) slot.innerHTML = slot._h = html;
  }
}

mq2.addEventListener("change", layoutColumns);
mq3.addEventListener("change", layoutColumns);

// ---------- Layers and sheets (plan B1.5) ----------

// The games ‹ › step through: the live ones in the order the game chips show, frozen while the game is open.
// The open game goes first when it isn't live (a final from the Games grid), so ‹ › still lead somewhere.
function freezeOrder(ctx, id) {
  const live = new Set(ctx.snap.games.filter((g) => g.state === "in").map((g) => g.id));
  const fromRail = rail.order.filter((g) => live.has(g));
  for (const r of ctx.ranked) if (live.has(r.game.id) && !fromRail.includes(r.game.id)) fromRail.push(r.game.id);
  return fromRail.includes(id) ? fromRail : [id, ...fromRail];
}

// Open a game on top (a play card, a game chip or tile, a link). With a game already open, switch to the new
// one in place: same Back step (H.replace), same ‹ › order. Returns false when there's no such game.
function openGame(id) {
  if (!ui.tracker) return false;
  const ctx = lazyCtx();
  if (!ctx.snap.games.some((g) => g.id === id)) return false;
  if (layers.top()?.kind === "sheet") { layers.back(() => openGame(id)); return true; } // a sheet goes first
  if (gameLayer.id) {
    if (id === gameLayer.id) return true;
    if (!ui.gameOrder.includes(id)) ui.gameOrder = freezeOrder(ctx, id);
    gameLayer.open(id, ctx);
    H.replace(`#game/${id}`);
    rail.markCurrent();
    return true;
  }
  ui.gameOrder = freezeOrder(ctx, id);
  const opener = document.activeElement;
  layers.open({
    kind: "game",
    show() {
      gameLayer.open(id, ctx);
      layerEl.classList.remove("opening"); void layerEl.offsetWidth; layerEl.classList.add("opening");
      placeLayer();
      rail.markCurrent();
      layerEl.querySelector(".back")?.focus({ preventScroll: true });
    },
    hide() {
      gameLayer.close();
      placeLayer();
      rail.markCurrent();
      setHash(ui.tab); // matters only when the layer had no Back step of its own
      const back = opener && opener !== document.body && opener.isConnected && !opener.closest("[inert]") && opener.getClientRects().length ? opener
        : ui.cols ? ui.pages[ui.cols.at(-1)]?.querySelector(".coltitle") : tabbar.querySelector('[aria-selected="true"]');
      back?.focus({ preventScroll: true });
    },
  }, `#game/${id}`);
  return true;
}

// ‹ › in the game's head, and the [ ] keys.
function stepGame(dir) {
  const to = layerEl.querySelector(`[data-step="${dir}"]`)?.dataset.to;
  if (to) openGame(to);
}

// Close the game (‹, ×, Esc): through Back when it has a Back step, so the browser's Back stays in step.
function closeGame() { if (gameLayer.id && layers.top()?.kind === "game") layers.back(); }

function openSheet(kind) {
  if (kind === "clock" && !ui.replay) return;
  const html = SHEETS[kind]();
  const entry = { kind: "sheet", state: { sheet: kind }, show: () => { sheet.open(kind, html); if (kind === "find") document.getElementById("find-q")?.focus(); }, hide: () => sheet.close() };
  if (layers.top()?.kind === "sheet") layers.swapTop(entry); else layers.open(entry);
}
// Find: results as you type; a player opens his plays, a game opens the game.
function findIndex() {
  const snap = ui.tracker.snapshot();
  const lineups = snap.matchups.flatMap((m) => [...m.mine, ...m.theirs]).map((p) => ({ id: p.id, name: p.name, pos: p.pos, team: p.nflTeam, owner: p.owner }));
  return buildIndex({ lineups, cards: ui.tracker.feed(), games: snap.games });
}
document.addEventListener("input", (e) => {
  if (e.target.id !== "find-q" || !ui.tracker) return;
  ui.findResults = search(findIndex(), e.target.value);
  const list = document.querySelector("[data-find-results]");
  if (list) list.innerHTML = findResultsHTML(ui.findResults, e.target.value);
});
const playerCards = (p) => ui.tracker.feed().filter((c) => c.kind !== "marker" && (p.id ? c.impacts.some((i) => i.id === p.id) || c.name === p.name : c.name === p.name));
function openPlay(id) { ui.playId = id; openSheet("play"); }
function closeSheet(then) { if (layers.top()?.kind === "sheet") layers.back(then); else then?.(); }

// On a phone the layer covers the tabs and pages; on a wide screen only the last column.
function placeLayer() {
  const open = !!gameLayer.id;
  tabbar.inert = open && !ui.cols;
  main.inert = open && !ui.cols;
  if (ui.cols) for (const id of ui.cols) ui.pages[id].inert = open && id === ui.cols.at(-1);
}

// ---------- Update loop (plan B1.10) ----------

// Every replay tick (250 ms) or live poll (10 s).
function tick(cards) {
  appbar.renderTransport();
  if (sheet.kind === "clock" && ui.replay) refreshClockSheet(sheet.body, ui);
  if (!ui.tracker) return;
  const v = ui.tracker.version();
  if (v !== ui.seen) {
    ui.seen = v;
    ui.pending.push(...cards.filter((c) => !c.silent));
    ui.dirty = true;
  }
  if (!ui.dirty || mainPager.state.swiping || gameLayer.swiping || document.hidden) return; // never write mid-swipe
  flush();
}

function flush() {
  ui.dirty = false;
  if (!ui.tracker) return;
  const ctx = lazyCtx();
  trackWp(ctx.snap);
  appbar.update(ctx);
  rail.update(ctx);
  const near = new Set(nearTabs(ui.tabIds, mainPager.active, ui.cols));
  for (const id of ui.tabIds) {
    if (near.has(id) && !ui.stale.has(id)) tabOf(id).view.update(ctx, ui.pending);
    else { (ui.missed[id] ??= []).push(...ui.pending); ui.stale.add(id); }
  }
  catchUp(ctx);
  if (gameLayer.id) gameLayer.update(ctx, ui.pending);
  ui.pending = [];
}

// Win chance before the last move, for the ▲▼ next to it.
function trackWp(snap) {
  for (const m of snap.matchups) {
    const id = m.league.league_id, prev = ui.lastWp.get(id);
    if (prev != null && Math.abs(m.winProb - prev) >= 0.005) ui.wpDelta.set(id, m.winProb - prev);
    if (prev == null || Math.abs(m.winProb - prev) >= 0.005) ui.lastWp.set(id, m.winProb);
  }
}

// New data from scratch (replay start or jump, live connected): every page starts over.
function resetAll() {
  ui.seen = ui.tracker.version(); ui.dirty = false;
  ui.pending = []; ui.missed = {}; ui.stale.clear();
  ui.lastWp.clear(); ui.wpDelta.clear();
  const ctx = lazyCtx();
  trackWp(ctx.snap);
  appbar.update(ctx);
  rail.reset(ctx);
  for (const t of TABS) if (ui.pages[t.id]) t.view.reset(ctx);
  if (!gameLayer.reset(ctx)) layers.closeAll(); // the open game keeps its place, with fresh plays
  placeLayer();
  appbar.renderTransport();
  if (ui.wantGame) {
    const id = ui.wantGame; ui.wantGame = null;
    if (!openGame(id)) views.zone.note("That game isn't in this replay.");
  }
}

document.addEventListener("visibilitychange", () => { if (!document.hidden && ui.dirty) flush(); });

// ---------- Data sources ----------

function stop() { clearInterval(ui.timer); ui.timer = null; }

function showBoot(html) { boot.innerHTML = html; boot.hidden = false; shell.classList.add("booting"); }
function hideBoot() { boot.hidden = true; boot.innerHTML = ""; shell.classList.remove("booting"); }

async function startReplay() {
  if (ui.stack.length) return layers.closeAll(() => startReplay());
  stop();
  ui.mode = "replay"; ui.live = null; ui.error = null;
  if (!ui.replayData) {
    showBoot(`<p class="empty">Loading the replay…</p>`);
    try { ui.replayData = await (await fetch("replay.json")).json(); }
    catch (e) { showBoot(`<p class="empty">Couldn't load the replay: ${e.message}</p>`); return; }
  }
  ui.replay = createReplay(ui.replayData, { startAt: REPLAY_START });
  ui.tracker = ui.replay.tracker;
  hideBoot();
  resetAll();
  let last = performance.now();
  ui.timer = setInterval(() => {
    const now = performance.now();
    const dt = now - last;
    last = now;
    tick(ui.paused || ui.replay.done ? [] : ui.replay.advance(dt, ui.speed)); // the clock stops at the last saved play
  }, TICK_MS);
}

async function startLive() {
  if (ui.stack.length) return layers.closeAll(() => startLive());
  stop();
  ui.mode = "live"; ui.tracker = null; ui.replay = null; ui.error = null; ui.updatedAt = 0; ui.connecting = true;
  appbar.clear(); appbar.renderTransport(); rail.clear();
  showBoot(`<p class="empty">Connecting to Sleeper and ESPN…</p>`);
  try {
    const [{ makeFetchJson }, { createLive }] = await Promise.all([import("./src/net.js"), import("./src/live.js")]);
    const fetchJson = makeFetchJson({ rewrite: (u) => u.replace("https://api.sleeper.app", "/proxy/sleeper").replace("https://site.api.espn.com", "/proxy/espn") });
    ui.live = await createLive(fetchJson, { username: ui.username });
    await ui.live.poll(); // what already happened today, quietly
    ui.tracker = ui.live.tracker;
    ui.updatedAt = Date.now();
  } catch (e) {
    ui.error = e.message; ui.connecting = false;
    if (/No Sleeper user/.test(e.message)) { ui.username = null; store.set("username", null); }
    return showSetup();
  }
  ui.error = null; ui.connecting = false;
  hideBoot();
  resetAll();
  ui.timer = setInterval(async () => {
    try {
      const cards = await ui.live.poll();
      ui.error = null; ui.updatedAt = Date.now();
      tick(cards);
    } catch (e) { ui.error = e.message; appbar.renderTransport(); }
  }, POLL_MS);
}

// Live mode needs a Sleeper username first.
function showSetup() {
  if (ui.stack.length) return layers.closeAll(() => showSetup());
  stop();
  ui.mode = "live"; ui.tracker = null;
  appbar.clear(); appbar.renderTransport(); rail.clear();
  showBoot(setupHTML({ error: ui.error, username: ui.username }));
  $("#setup").addEventListener("submit", (e) => {
    e.preventDefault();
    ui.username = $("#username").value.trim();
    store.set("username", ui.username);
    startLive();
  });
}

function jump(at) {
  closeSheet();
  ui.replay.jump(at);
  ui.tracker = ui.replay.tracker;
  resetAll();
}

// ---------- Controls ----------

const SHEETS = {
  clock: () => clockSheetHTML({ ui, wins: windows(ui.replayData, { from: REPLAY_START - 6 * 3600_000 }) }),
  live: () => liveSheetHTML({ ui }),
  find: () => findSheetHTML(),
  play: () => playSheetHTML(ui.tracker?.feed().find((c) => c.id === ui.playId)),
  player: () => (ui.findPick ? playerSheetHTML(ui.findPick, playerCards(ui.findPick), cardHTML) : ""),
  settings: () => settingsSheetHTML(),
};

function setSpeed(s) { ui.speed = s; ui.paused = false; store.set("speed", s); tick([]); }

document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-find],[data-game],[data-sheet],[data-act],[data-speed],[data-jump],[data-mode],[data-pick],[data-close],[data-step],#scorebug");
  if (!t) return;
  if (t.id === "scorebug") { // your matchup, one tap from anywhere: whatever is open closes first, in one Back step
    return layers.closeAll(() => { if (ui.tabIds.includes("matchup")) selectTab("matchup", { focus: true }); });
  }
  if (t.dataset.close === "layer") return closeGame();
  if (t.dataset.step) return stepGame(Number(t.dataset.step));
  if (t.dataset.find) { ui.findPick = ui.findResults?.[Number(t.dataset.find)]; return ui.findPick && openSheet("player"); }
  if (t.matches("article.play") && !ui.cols) return openPlay(t.dataset.id); // phones: the play's details first
  if (t.dataset.game) return openGame(t.dataset.game); // a game chip, a tile, a play card on a wide screen
  if (t.dataset.sheet) {
    if (t.dataset.sheet === "clock" && !ui.replay) return;
    return openSheet(t.dataset.sheet);
  }
  if (t.dataset.speed) return setSpeed(Number(t.dataset.speed));
  if (t.dataset.jump) return jump(Number(t.dataset.jump));
  if (t.dataset.pick) { ui.pick = t.dataset.pick; store.set("pick", ui.pick); layoutColumns(); return selectTab(ui.pick); }
  if (t.dataset.mode === "replay") return layers.closeAll(() => startReplay());
  if (t.dataset.mode === "live") return layers.closeAll(() => (ui.username ? startLive() : showSetup()));
  switch (t.dataset.act) {
    case "pause": ui.paused = !ui.paused; return tick([]);
    case "speed": return setSpeed(nextSpeed(ui.speed));
    case "open-games": return layers.closeAll(() => selectTab("games", { focus: true })); // "All games ›"
    case "change-user": return layers.closeAll(() => { ui.error = null; showSetup(); });
    case "fantasy-on": ui.fantasyOn = true; buildTabs(); views.zone.note(null); return selectTab("matchup");
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { // closes the top sheet or layer
    if (ui.stack.length) { e.preventDefault(); layers.back(); }
    return;
  }
  if ((e.key === "Enter" || e.key === " ") && e.target.matches?.("article.play[data-game]")) { e.preventDefault(); return ui.cols ? openGame(e.target.dataset.game) : openPlay(e.target.dataset.id); }
  const typing = e.target.closest?.("input, textarea, select, [contenteditable]");
  if (typing || sheet.kind || e.metaKey || e.ctrlKey || e.altKey) return;
  if ((e.key === "[" || e.key === "]") && layers.top()?.kind === "game") return stepGame(e.key === "[" ? -1 : 1); // previous / next game
  if (/^[1-4]$/.test(e.key)) {
    const id = ui.tabIds[Number(e.key) - 1];
    if (!id) return;
    // A game covers the tabs (phone) or the last column: close it first when the tab would be under it.
    const covered = gameLayer.id && (!ui.cols || id === ui.cols.at(-1) || !ui.cols.includes(id));
    if (covered) return layers.closeAll(() => selectTab(id, { focus: true }));
    selectTab(id, { focus: true });
  }
});

// A link straight to a tab (#zone, #matchup, #games) or a game (#game/<id>).
function route(hash, { smooth = true } = {}) {
  const h = String(hash ?? "").replace(/^#/, "");
  const game = /^game\/([^/]+)/.exec(h);
  if (game) {
    if (ui.tracker) { if (!openGame(game[1])) views.zone.note("That game isn't in this replay."); }
    else ui.wantGame = game[1];
    return;
  }
  if (ui.tabIds.includes(h)) return selectTab(h, { smooth });
  if (h === "matchup" && !ui.fantasyOn) {
    selectTab("zone", { smooth });
    views.zone.note(`Matchup is hidden because fantasy is off · <button type="button" data-act="fantasy-on">Turn on</button>`);
  } else if (h === "league") {
    selectTab("zone", { smooth });
    views.zone.note("League isn't set up yet.");
  }
}
addEventListener("hashchange", () => route(location.hash));

// Live and replay status ticks over once a second even when no plays arrive (the "Live 4s" counter).
setInterval(() => appbar.renderTransport(), 1000);

// For checks from the browser console (plan M1 (i)): ui.fantasyOn = false; buildTabs()
// and M1 (d): H.ok = false makes layers open without a Back step.
Object.assign(globalThis, { ui, buildTabs, selectTab, H, layers });

// ---------- Start ----------

const startHash = location.hash;
buildTabs();
route(startHash, { smooth: false });
try { history.replaceState({ fz: 1, depth: 0 }, "", `#${ui.tab}`); } catch { /* history unavailable */ }

ui.hasServer = await fetch("/proxy/ping").then((r) => r.ok).catch(() => false);
if (ui.hasServer) {
  if (ui.username) startLive(); else showSetup();
} else {
  startReplay();
}
