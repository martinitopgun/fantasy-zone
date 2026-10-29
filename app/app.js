// Fantasy Zone app: the shell (app bar, tabs you swipe between, or columns on a wide screen), the live data
// (your Sleeper matchup this week and ESPN's play-by-play, new plays every 10 seconds), and the update loop.
// Nothing on screen switches by itself: live data only changes what's inside the pages. Tabs, games,
// columns and scroll positions change only when you tap or swipe.

import { rankGames, DIALS } from "./src/model.js";
import { columnsFor, visibleTabs, nearTabs, gameClock } from "./src/view-models.js";
import { createPager } from "./ui/pager.js";
import { H, createSheet, createLayers } from "./ui/layers.js";
import { createAppbar } from "./views/appbar.js";
import { liveSheetHTML, findSheetHTML, findResultsHTML, playerSheetHTML, playSheetHTML, settingsSheetHTML, pictureSheetHTML, onboardHTML, starredSheetHTML, trophiesSheetHTML } from "./views/sheets.js";
import { createZoneView } from "./views/zone.js";
import { createMatchupView } from "./views/matchup.js";
import { createGamesView } from "./views/games.js";
import { createLeagueView } from "./views/league.js";
import { createGameLayer } from "./views/game.js";
import { createRail } from "./ui/rail.js";
import { buildIndex, search } from "./src/search.js";
import { cardHTML, esc } from "./views/cards.js";
import { createAlerts, WP_ALERT } from "./src/alerts.js";
import { createBanner } from "./ui/banner.js";
import { createStory } from "./views/story.js";
import { createMulti } from "./views/multi.js";
import { storyCards } from "./src/story.js";
import { createPicks } from "./src/picks.js";
import { findAccount } from "./src/connect.js";
import { makeFetchJson } from "./src/net.js";
import { toggleStar, starAlerts, isStarredCard } from "./src/starred.js";
import { TROPHIES, checkTrophies } from "./src/trophies.js";
import { sweat } from "./src/insights.js";

const POLL_MS = 10_000;

const $ = (sel) => document.querySelector(sel);
const store = {
  get(k, d) { try { const v = localStorage.getItem(`fz:${k}`); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(`fz:${k}`, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};

const ui = {
  pin: store.get("pin", null), // the game in the phone pin bar
  mode: null, hasServer: false,
  // where you are
  tab: null, tabIds: [], pages: {}, scroll: {}, cols: null, pick: store.get("pick", null), fantasyOn: store.get("fantasy", true) !== false,
  settings: { banners: store.get("banners", true) !== false },
  starred: store.get("starred", []), // starred players' names
  trophies: { unlocked: {}, counts: { games: 0, story: 0, share: 0, whatif: 0, plays: 0 }, sweatSeen: false, ...store.get("trophies", {}) },
  gamesSeen: new Set(),
  account: store.get("account", null), // your synced Sleeper: { user, leagues, chosen, active, synced }
  badges: { zone: 0, matchup: false }, seenWp: null, // tab badges (plan M4)
  // the Zone filter
  filter: store.get("filter", "mine"),
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
shell.classList.toggle("nofantasy", !ui.fantasyOn);
const appbar = createAppbar({ el: $("#appbar"), ui });
// Layers and sheets share one stack with Back-button steps. Forward (to a layer's step) reopens it from the address.
const layers = createLayers({ ui, onForward: (hash, st) => (st?.sheet ? SHEETS[st.sheet] && openSheet(st.sheet) : route(hash, { smooth: false })) });
const sheet = createSheet({ sheet: $("#sheet"), backdrop: $("#backdrop"), others: () => [$("#appbar"), $("#pinbar"), $("#rail"), tabbar, main, layerEl, $("#story")], onDismiss: () => closeSheet() });
const gameLayer = createGameLayer({ el: layerEl, ui, order: () => ui.gameOrder });
// The game chips between the app bar and the tabs. Their order only changes on a jump, Live/Replay or ↻.
const rail = createRail({ el: $("#rail"), getCtx: () => (ui.tracker ? lazyCtx() : null), current: () => gameLayer.id, now: () => ui.replay?.time ?? Date.now() });
const views = {
  zone: createZoneView({ ui, store }),
  matchup: createMatchupView({ ui }),
  games: createGamesView({ ui, store, getCtx: () => lazyCtx() }),
  league: createLeagueView({ ui }),
};

// The tabs, in order. League shows once the whole league's data is there (the replay has it; live mode
// doesn't fetch it yet). The same list becomes the phone app's tabs.
const TABS = [
  { id: "zone", label: "Zone", view: views.zone },
  { id: "matchup", label: "Matchup", view: views.matchup, fantasy: true },
  { id: "league", label: "League", view: views.league, fantasy: true, needs: (d) => !!d?.teams },
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
  const tabs = visibleTabs(TABS, { fantasyOn: ui.fantasyOn, data: ui.mode === "replay" ? ui.replayData?.leagues?.[0] : ui.liveLeagues?.[0] });
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
  mainPager = createPager({ tabbar, pager: pagerEl, tabs: buttons, pages, onSettle, onReselect, onGo: (i) => catchUp(undefined, [ui.tabIds[i]]) });
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
  renderTitle();
  if (swipe && changed) $("#announce").textContent = `${tabOf(id).label} tab`;
  const ctx = ui.tracker ? lazyCtx() : null;
  if (changed && ctx) tabOf(id).view.activate?.(ctx); // e.g. Games re-sorts when you arrive
  catchUp(ctx);
  renderBadges(ctx);
}

function onReselect(i) {
  const pg = ui.pages[ui.tabIds[i]];
  pg?.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}

// Pages that just came into reach get what they missed.
function catchUp(ctx = ui.tracker ? lazyCtx() : null, also = []) {
  if (!ctx || !mainPager) return;
  for (const id of [...nearTabs(ui.tabIds, mainPager.active, ui.cols), ...also]) {
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
  if (!ui.gamesSeen.has(id)) { ui.gamesSeen.add(id); count("games"); } // Trophies: Scout
  if (layers.top()?.kind === "sheet") { layers.back(() => openGame(id)); return true; } // a sheet goes first
  if (gameLayer.id) {
    if (id === gameLayer.id) return true;
    if (!ui.gameOrder.includes(id)) ui.gameOrder = freezeOrder(ctx, id);
    gameLayer.open(id, ctx);
    H.replace(`#game/${id}`);
    rail.markCurrent();
    renderTitle();
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

// Sunday Story (plan M5): full screen over everything, with its own Back step.
const story = createStory({ el: $("#story"), onClose: () => layers.back(), onPicture: (url) => { ui.picture = url; openSheet("picture"); }, onShare: () => count("share") });
const storyNow = (ctx) => {
  const m = ctx.snap.matchups[0];
  return m ? storyCards({ m, history: ui.tracker.history(m.league.league_id), feed: ui.tracker.feed() }) : null;
};
function openStory() {
  if (!ui.tracker || layers.has("story")) return;
  const s = storyNow(lazyCtx());
  if (!s) return;
  count("story");
  const opener = document.activeElement;
  let saved = [];
  layers.open({
    kind: "story",
    show() {
      banner.hide();
      saved = [$("#appbar"), $("#pinbar"), $("#rail"), tabbar, main, layerEl, $("#alert")].map((el) => [el, el.inert]);
      for (const [el] of saved) el.inert = true;
      story.open(s);
      renderTitle();
    },
    hide() {
      story.close();
      for (const [el, was] of saved) el.inert = was;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
      renderTitle();
    },
  }, "#story");
}

// Multi-view: a layer with up to 4 games (own Back step, like a game).
const multi = createMulti({ el: $("#multi"), ui, store, onOpenGame: (id) => layers.back(() => openGame(id)) });
function openMulti() {
  if (!ui.tracker || layers.has("multi")) return;
  const ctx = lazyCtx();
  let saved = [];
  layers.open({
    kind: "multi",
    show() { saved = [tabbar, main].map((x) => [x, x.inert]); for (const [x] of saved) x.inert = true; multi.open(ctx); renderTitle(); },
    hide() { multi.close(); for (const [x, was] of saved) x.inert = was; renderTitle(); },
  }, "#multi");
}

// ‹ › in the game's head, and the [ ] keys.
function stepGame(dir) {
  const to = layerEl.querySelector(`[data-step="${dir}"]`)?.dataset.to;
  if (to) openGame(to);
}

// Close the game (‹, ×, Esc): through Back when it has a Back step, so the browser's Back stays in step.
function closeGame() { const k = layers.top()?.kind; if ((gameLayer.id && k === "game") || k === "multi") layers.back(); }

function openSheet(kind) {
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
  renderBadges();
  tabbar.inert = open && !ui.cols;
  main.inert = open && !ui.cols;
  if (ui.cols) for (const id of ui.cols) ui.pages[id].inert = open && id === ui.cols.at(-1);
  renderPin();
  renderTitle();
}

// The browser tab's name follows what's on screen: "Matchup · Fantasy Zone", "DAL @ GB · Fantasy Zone". The
// sign-in screen and the columns on a wide screen keep the page's own title.
const PAGE_TITLE = document.title;
function renderTitle() {
  const top = [...ui.stack].reverse().find((x) => x.kind !== "sheet")?.kind;
  const g = top === "game" && gameLayer.id ? ui.tracker?.snapshot().games.find((x) => x.id === gameLayer.id) : null;
  const what = !boot.hidden ? (boot.querySelector("#onboard-leagues") ? "Pick your leagues" : "")
    : top === "story" ? "Story" : top === "multi" ? "Multi-view" : g ? `${g.away} @ ${g.home}`
    : ui.cols ? "" : tabOf(ui.tab)?.label ?? "";
  const t = what ? `${what} · Fantasy Zone` : PAGE_TITLE;
  if (document.title !== t) document.title = t;
}

// ---------- Update loop (plan B1.10) ----------

// Every live poll (10 s).
function tick(cards) {
  appbar.renderTransport();
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
  renderPin(ctx);
  headsUp(ctx, ui.pending);
  stepPicks(ctx, ui.pending);
  const seen = ui.pending.filter((c) => !c.silent && c.kind !== "marker").length;
  if (seen) count("plays", seen); else checkTrophiesNow(ctx);
  if (story.isOpen && ui.pending.length) story.update(storyNow(ctx));
  if (multi.isOpen) multi.update(ctx);
  ui.pending = [];
}

// Free Picks (plan M7): new questions, locks and grades from each update; Zone shows them.
function stepPicks(ctx, cards) {
  if (!ui.picks || !ui.fantasyOn) return false;
  return ui.picks.step({ cards, snap: ctx.snap, now: ui.replay?.time ?? Date.now(), speed: 1 });
}
function newPicks(mode) {
  const key = `picks:${mode}`;
  ui.picks = createPicks({ saved: store.get(key, null), onSave: (s) => store.set(key, s) });
}

// ---------- Trophies ----------
ui.onWhatIf = () => count("whatif");
// count("games") etc. from actions; checkTrophiesNow() after each update shows a toast for new ones.
function count(kind, n = 1) { ui.trophies.counts[kind] = (ui.trophies.counts[kind] ?? 0) + n; store.set("trophies", ui.trophies); checkTrophiesNow(); }

// A short message at the top for a few seconds: kind "ok" (✓ Synced, Back online), "err" (⚠ Connection lost),
// or a new trophy (a button: tap it for Trophies). It never opens or switches anything by itself.
let toastTimer = 0;
function toast(html, kind = "", { opens = null, say = null } = {}) {
  const el = $("#toast");
  const text = `${kind === "ok" ? "✓ " : kind === "err" ? "⚠ " : ""}${html}`;
  el.innerHTML = opens ? `<button type="button" class="toast" data-sheet="${opens}">${text}</button>` : `<p class="toast ${kind}">${text}</p>`;
  el.hidden = false;
  $("#announce").textContent = say ?? el.textContent;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; el.innerHTML = ""; }, 4500);
}
function checkTrophiesNow(ctx = ui.tracker ? lazyCtx() : null) {
  const m = ctx?.snap.matchups[0];
  if (m && sweat(m).label === "Full sweat") ui.trophies.sweatSeen = true;
  const state = { picks: ui.picks?.score() ?? { right: 0, best: 0, points: 0 }, history: m ? ui.tracker.history(m.league.league_id) : [], counts: ui.trophies.counts, sweatSeen: ui.trophies.sweatSeen };
  const fresh = checkTrophies(state, ui.trophies.unlocked);
  if (!fresh.length) return;
  for (const id of fresh) ui.trophies.unlocked[id] = Date.now();
  store.set("trophies", ui.trophies);
  const t = TROPHIES.find((x) => x.id === fresh[0]);
  toast(`<span class="confetti" aria-hidden="true">${"<i></i>".repeat(12)}</span>${t.icon} Trophy unlocked: <b>${t.name}</b>${fresh.length > 1 ? ` +${fresh.length - 1}` : ""}`, "", { opens: "trophies", say: `Trophy unlocked: ${t.name}` });
}

// ---------- Heads-up (plan M4): banners and tab badges ----------
// A banner for a big moment in your matchup, unless you're already watching that game (it's open, or pinned
// with its bar showing). Tabs you can't see collect a badge: Zone counts new My-matchup plays, Matchup gets a
// dot when your win chance moved 5 points or the lead changed since you last looked. Nothing ever switches.
const alerts = createAlerts();
const banner = createBanner({ el: $("#alert"), announce: (t) => { $("#announce").textContent = t; } });
function tabOnScreen(id) {
  if (ui.cols) return ui.cols.includes(id) && !(gameLayer.id && ui.cols.at(-1) === id);
  return ui.tab === id && !gameLayer.id;
}

function headsUp(ctx, fresh) {
  const live = fresh.filter((c) => !c.silent);
  const pinShown = !$("#pinbar").hidden;
  const list = alerts.take(fresh, ctx.snap, { skip: [gameLayer.id, pinShown ? ui.pin : null].filter(Boolean) });
  if (ui.fantasyOn) {
    if (!tabOnScreen("zone")) ui.badges.zone += live.filter((c) => c.impacts.length > 0 && c.kind !== "marker").length;
    if (list.some((a) => a.lead)) ui.badges.matchup = true;
    if (ui.settings.banners && list.length) banner.show(list);
  }
  const stars = starAlerts(live, new Set(ui.starred), { skip: [gameLayer.id].filter(Boolean), already: new Set(list.map((a) => a.cardId)) });
  if (ui.settings.banners && stars.length && !list.length) banner.show(stars);
  renderBadges(ctx);
}

function renderBadges(ctx = ui.tracker ? lazyCtx() : null) {
  const m = ctx?.snap.matchups[0];
  if (tabOnScreen("zone")) ui.badges.zone = 0;
  if (m) {
    if (tabOnScreen("matchup") || ui.seenWp == null) { ui.badges.matchup = false; ui.seenWp = m.winProb; }
    else if (Math.abs(m.winProb - ui.seenWp) >= WP_ALERT) ui.badges.matchup = true;
  }
  for (const [id, label] of [["zone", ui.badges.zone ? `${ui.badges.zone > 99 ? "99+" : ui.badges.zone}` : ""], ["matchup", ui.badges.matchup ? "•" : ""]]) {
    const b = document.getElementById(`tab-${id}`);
    if (!b) continue;
    let dot = b.querySelector(".tbadge");
    if (!label) { dot?.remove(); b.removeAttribute("aria-description"); continue; }
    if (!dot) { dot = document.createElement("span"); dot.className = "tbadge"; dot.setAttribute("aria-hidden", "true"); b.append(dot); }
    dot.classList.toggle("dot", id === "matchup");
    dot.textContent = id === "matchup" ? "" : label;
    b.setAttribute("aria-description", id === "matchup" ? "Your win chance moved" : `${label} new plays`);
  }
}

// Pin (phones): one game's score in a thin bar under the app bar, on every tab. It never opens anything by
// itself; it hides while that game is open, and on wide screens (where games stay open in their column).
function renderPin(ctx = ui.tracker ? lazyCtx() : null) {
  const bar = $("#pinbar");
  const g = ui.pin && ctx?.snap.games.find((x) => x.id === ui.pin);
  bar.hidden = !g || !!ui.cols || gameLayer.id === ui.pin;
  if (bar.hidden) return;
  if (bar.dataset.game !== g.id) {
    bar.dataset.game = g.id;
    bar.innerHTML = `<button class="pin-open" type="button" data-game="${g.id}"><span class="pin-l">Pinned</span><span class="pin-t num"></span></button><button class="pin-x" type="button" data-act="unpin" aria-label="Unpin ${g.away} @ ${g.home}">×</button>`;
  }
  const mine = ctx.snap.matchups.flatMap((m) => [...m.mine, ...m.theirs]).filter((p) => p.game?.id === g.id && p.pos !== "DEF").map((p) => p.name.split(" ").slice(-1)[0]);
  const state = g.state === "pre" ? "Kickoff later" : g.state === "post" ? "Final" : gameClock(g);
  const t = [`${g.away} ${g.awayScore}-${g.homeScore} ${g.home}`, state, ...mine.slice(0, 2)].join(" · ");
  const el = bar.querySelector(".pin-t");
  if (el.textContent !== t) el.textContent = t;
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
  alerts.prime(ctx.snap);
  banner.hide();
  ui.picks?.reset(); stepPicks(ctx, []); // a jump: open picks are gone; kickoff picks for what's next
  ui.badges = { zone: 0, matchup: false }; ui.seenWp = null;
  appbar.update(ctx);
  rail.reset(ctx);
  for (const t of TABS) if (ui.pages[t.id]) t.view.reset(ctx);
  if (!gameLayer.reset(ctx)) layers.closeAll(); // the open game keeps its place, with fresh plays
  placeLayer();
  appbar.renderTransport();
  if (ui.wantGame) {
    const id = ui.wantGame; ui.wantGame = null;
    if (!openGame(id)) views.zone.note("That game isn't on this week's schedule.");
  }
}

document.addEventListener("visibilitychange", () => { if (!document.hidden && ui.dirty) flush(); });

// ---------- Data sources ----------

function stop() { clearInterval(ui.timer); ui.timer = null; }

function showBoot(html) { boot.innerHTML = html; boot.hidden = false; shell.classList.add("booting"); renderTitle(); }
function hideBoot() { boot.hidden = true; boot.innerHTML = ""; shell.classList.remove("booting"); renderTitle(); }

// Live: this week's real matchup (Sleeper) and real games (ESPN), new plays every 10 seconds.
// One fetcher is kept between starts so switching leagues doesn't download everything again.
let liveFetch = null;
function getLiveFetch(fresh) {
  if (fresh || !liveFetch) liveFetch = ui.hasServer
    ? makeFetchJson({ rewrite: (u) => u.replace("https://api.sleeper.app", "/proxy/sleeper").replace("https://site.api.espn.com", "/proxy/espn") })
    : makeFetchJson({ load: loadJson });
  return liveFetch;
}

// ok: what to say once it's running ("Synced 2 leagues"); nothing when the app just opens.
async function startLive({ fresh = false, ok = "" } = {}) {
  if (ui.stack.length) return layers.closeAll(() => startLive({ fresh, ok }));
  stop();
  ui.mode = "live"; ui.tracker = null; ui.replay = null; ui.error = null; ui.updatedAt = 0; ui.connecting = true;
  appbar.clear(); appbar.renderTransport(); rail.clear();
  showBoot(`<div class="intro" role="status"><h1 class="intro-logo">Fantasy <b>Zone</b></h1><p class="intro-tag">Loading your matchup and this week's games…</p><div class="intro-bar" aria-hidden="true"><span></span></div></div>`);
  try {
    const { createLive } = await import("./src/live.js");
    ui.live = await createLive(getLiveFetch(fresh), { username: ui.username, leagueIds: ui.account?.chosen ?? null, activeId: ui.account?.active ?? null });
    await ui.live.poll(); // what already happened this week, quietly
    ui.tracker = ui.live.tracker;
    ui.liveLeagues = ui.live.leagues;
    newPicks("live");
    ui.updatedAt = Date.now();
  } catch (e) {
    ui.error = e.message; ui.connecting = false;
    const error = netHelp(e);
    return showOnboard(ui.account ? { step: "leagues", account: ui.account, chosen: ui.account.chosen, error } : { username: ui.username ?? "", error });
  }
  ui.error = null; ui.connecting = false;
  hideBoot();
  buildTabs(); // League appears now that its data is here
  resetAll();
  if (ok) toast(esc(ok), "ok");
  let fails = 0; // a message after two misses in a row (20 seconds), not for every hiccup
  ui.timer = setInterval(async () => {
    try {
      const cards = await ui.live.poll();
      if (fails >= 2) toast("Back online", "ok");
      fails = 0; ui.error = null; ui.updatedAt = Date.now();
      tick(cards);
    } catch (e) {
      if (++fails === 2) toast("Connection lost. Trying again every 10 seconds.", "err");
      ui.error = e.message; appbar.renderTransport();
    }
  }, POLL_MS);
}

// ---------- Sleeper sign-in (first open, "Sync another account", "Sync more leagues") ----------
// Straight to Sleeper from the browser; through the local server when the app runs with npm start.
// On a real website it asks Sleeper directly; if that's refused, it tries two free public relays (Sleeper's
// data is public, nothing secret goes through them). The claude.ai preview blocks every outside site.
const RELAYS = [(u) => u, (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`, (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`];
const relayFor = new Map(); // site -> the route that worked last time
async function loadJson(url) {
  let err = null;
  const host = new URL(url).host, relay = relayFor.get(host) ?? 0;
  for (let k = 0; k < RELAYS.length; k++) {
    const i = (relay + k) % RELAYS.length;
    try {
      const res = await fetch(RELAYS[i](url), { headers: { accept: "application/json" }, signal: AbortSignal.timeout ? AbortSignal.timeout(12000) : undefined });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`${res.status} from Sleeper`);
      const text = (await res.text()).trim();
      relayFor.set(host, i);
      return text && text !== "null" ? JSON.parse(text) : null;
    } catch (e) { err = e; }
  }
  throw err;
}
const sleeperFetch = () => (ui.hasServer ? makeFetchJson({ rewrite: (u) => u.replace("https://api.sleeper.app", "/proxy/sleeper") }) : makeFetchJson({ load: loadJson }));
const inClaude = /claude\.ai|claudeusercontent/.test(document.referrer) || (() => { try { return window.top !== window.self; } catch { return true; } })();
const netHelp = (e) => (/fetch|network|load failed|abort|timed? ?out|failed to/i.test(e.message) || e.name === "TypeError"
  ? (inClaude ? "Claude's preview doesn't let apps reach Sleeper. Open Fantasy Zone's own website (the github.io link) to sync your league." : "Couldn't reach Sleeper. Check your internet and try again.")
  : e.message);

function showOnboard(state = {}) {
  if (ui.stack.length) return layers.closeAll(() => showOnboard(state));
  stop();
  appbar.clear(); rail.clear();
  showBoot(onboardHTML(state));
  boot.querySelector("#ob-username")?.focus();
  boot.querySelector("#onboard-name")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = boot.querySelector("#ob-username").value.trim();
    if (!username) return;
    showOnboard({ username, busy: "Finding your leagues…" });
    try {
      const account = await findAccount(sleeperFetch(), username);
      showOnboard({ step: "leagues", account });
    } catch (err) { showOnboard({ username, error: netHelp(err) }); }
  });
  boot.querySelector("#onboard-leagues")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const chosen = [...boot.querySelectorAll('input[name="lg"]:checked')].map((x) => x.value);
    if (!chosen.length) return showOnboard({ ...state, error: "Pick at least one league." });
    await syncAccount(state.account, chosen);
  });
}

async function syncAccount(account, chosen) {
  ui.account = { user: account.user, leagues: account.leagues, chosen, active: chosen.includes(account.active) ? account.active : chosen[0] };
  store.set("account", ui.account);
  ui.username = account.user.username; store.set("username", ui.username);
  startLive({ fresh: true, ok: `Synced ${chosen.length} league${chosen.length === 1 ? "" : "s"}` });
}

// ---------- Controls ----------

const SHEETS = {
  live: () => liveSheetHTML({ ui }),
  find: () => findSheetHTML(),
  play: () => playSheetHTML(ui.tracker?.feed().find((c) => c.id === ui.playId), new Set(ui.starred)),
  player: () => (ui.findPick ? playerSheetHTML(ui.findPick, playerCards(ui.findPick), cardHTML, new Set(ui.starred)) : ""),
  trophies: () => trophiesSheetHTML(TROPHIES, ui.trophies.unlocked),
  starred: () => starredSheetHTML(ui.starred, (n) => (ui.tracker?.feed() ?? []).filter((c) => c.kind !== "marker" && isStarredCard(c, new Set([n]))), cardHTML),
  settings: () => settingsSheetHTML({ ui, tabs: ui.tracker ? ui.tabIds.map((id) => ({ id, label: tabOf(id).label })) : [] }),
  picture: () => pictureSheetHTML(ui.picture),
};

// Fantasy on/off (Settings): Matchup and the score come and go, the chips change, the game chips re-rank
// (by your players, or by drama). Matchup keeps its scroll spot for when it comes back.
function setFantasy(on) {
  ui.fantasyOn = on; store.set("fantasy", on);
  shell.classList.toggle("nofantasy", !on);
  views.zone.note(null);
  buildTabs();
  banner.hide(); ui.badges = { zone: 0, matchup: false };
  if (!ui.tracker) return;
  const ctx = lazyCtx();
  views.zone.fantasyChanged(ctx);
  appbar.update(ctx);
  rail.reset(ctx);
  renderBadges(ctx);
}
function refreshSettings() {
  if (sheet.kind !== "settings") return;
  const focus = document.activeElement?.dataset?.act;
  const fresh = new DOMParser().parseFromString(SHEETS.settings(), "text/html");
  for (const sel of [".menu-go", ".setlist"]) {
    const now = sheet.body.querySelector(sel), next = fresh.querySelector(sel);
    if (now && next) now.outerHTML = next.outerHTML;
  }
  if (focus) sheet.body.querySelector(`[data-act="${focus}"]`)?.focus();
}

document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-find],[data-play],[data-game],[data-sheet],[data-act],[data-pick],[data-close],[data-step],#scorebug");
  if (!t) return;
  if (t.id === "scorebug") { // the score: your matchup, one tap from anywhere; the logo: Zone. Whatever is open closes first, in one Back step
    const to = t.querySelector(".brand") || !ui.tabIds.includes("matchup") ? "zone" : "matchup";
    return layers.closeAll(() => { if (boot.hidden) selectTab(to, { focus: true }); });
  }
  if (t.dataset.close === "layer") return closeGame();
  if (t.dataset.step) return stepGame(Number(t.dataset.step));
  if (t.dataset.find) { ui.findPick = ui.findResults?.[Number(t.dataset.find)]; return ui.findPick && openSheet("player"); }
  if (t.dataset.play) return openPlay(t.dataset.play); // a dot on the win chart
  if (t.matches("article.play") && !ui.cols) return openPlay(t.dataset.id); // phones: the play's details first
  if (t.dataset.game) return openGame(t.dataset.game); // a game chip, a tile, a play card on a wide screen
  if (t.dataset.sheet) return openSheet(t.dataset.sheet);
  if (t.dataset.pick) { ui.pick = t.dataset.pick; store.set("pick", ui.pick); layoutColumns(); return selectTab(ui.pick); }
  switch (t.dataset.act) {
    case "pin": ui.pin = ui.pin === gameLayer.id ? null : gameLayer.id; store.set("pin", ui.pin); gameLayer.update(lazyCtx(), []); return renderPin();
    case "unpin": ui.pin = null; store.set("pin", null); return renderPin();
    case "open-games": return layers.closeAll(() => selectTab("games", { focus: true })); // "All games ›"
    case "change-user": return layers.closeAll(() => { ui.error = null; showOnboard({}); });
    case "fantasy-on": setFantasy(true); return selectTab("matchup");
    case "story": return openStory();
    case "multi": return layers.closeAll(() => openMulti());
    case "star": {
      ui.starred = toggleStar(ui.starred, t.dataset.name); store.set("starred", ui.starred);
      const on = ui.starred.includes(t.dataset.name);
      for (const b of document.querySelectorAll(`[data-act="star"]`)) if (b.dataset.name === t.dataset.name) { b.setAttribute("aria-pressed", String(on)); b.textContent = on ? "★ Starred" : "☆ Star"; }
      if (ui.filter === "starred") views.zone.fantasyChanged?.(ui.tracker ? lazyCtx() : null);
      return;
    }
    case "goto-matchup": return selectTab("matchup", { focus: true });
    case "go": return layers.closeAll(() => selectTab(t.dataset.tab, { focus: true })); // the menu's sections
    case "toggle-fantasy": setFantasy(!ui.fantasyOn); return refreshSettings();
    case "new-account": return layers.closeAll(() => showOnboard({}));
    case "more-leagues": return layers.closeAll(() => showOnboard({ step: "leagues", account: ui.account, chosen: ui.account?.chosen }));
    case "resync": return layers.closeAll(() => startLive({ fresh: true, ok: "Synced again: everything is up to date" }));
    case "league": {
      ui.account.active = t.dataset.league; store.set("account", ui.account);
      const name = ui.account.leagues.find((l) => l.league_id === t.dataset.league)?.name;
      return layers.closeAll(() => startLive({ ok: name ? `Now showing ${name}` : "" }));
    }
    case "toggle-banners": ui.settings.banners = !ui.settings.banners; store.set("banners", ui.settings.banners); if (!ui.settings.banners) banner.hide(); return refreshSettings();
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
    if (ui.tracker) { if (!openGame(game[1])) views.zone.note("That game isn't on this week's schedule."); }
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

ui.hasServer = location.protocol.startsWith("http") && !window.__FZ_SITE__ && await fetch("/proxy/ping").then((r) => r.ok).catch(() => false);
await new Promise((r) => setTimeout(r, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1400)); // the intro
if (ui.account || (ui.hasServer && ui.username)) startLive();
else showOnboard({});
