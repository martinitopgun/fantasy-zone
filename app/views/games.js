// The Games tab: every game as a tile in a grid (2 across on a phone, 3 or 4 when there's room).
//   Chips at the top: All / Live / Next / Final, each with its count.
//   Sort: "Matters to me" (live games that can change your matchup most first) or "Kickoff" (start time).
// The order is frozen while you look at it (R5). It's worked out again only when the tab becomes the current
// one (and while it's out of sight), after a jump or a Live/Replay switch, when you change the chips or the
// sort, or when you tap ↻ (which appears when the top of the grid is out of date). In between, tiles change their contents in place (the
// <button> stays put, so a tap always lands on the game you aimed at) and games that newly fit the chip join
// at the end.

import { esc, tileHTML, tileClass, tileInner } from "./cards.js";
import { flip } from "../ui/rail.js";
import { tileVM, gamesOrder, segmentCounts, topChanged, GAME_SEGMENTS, GAME_SORTS } from "../src/view-models.js";

const EMPTY = {
  all: "No games this week.",
  live: "No games are on right now.",
  next: "No more games to come this week.",
  final: "No games have finished yet.",
};

export function createGamesView({ ui, store, getCtx }) {
  const pick = (k, list, d) => { const v = store.get(k, d); return list.some(([id]) => id === v) ? v : d; };
  let seg = pick("gamesSeg", GAME_SEGMENTS, "all"), sort = pick("gamesSort", GAME_SORTS, "matters");
  let page, grid, resortBtn;
  let shown = [], staleAt = 0; // game ids, in the order on screen; when ↻ appeared
  let fresh = []; // the order the grid would use now
  const tiles = new Map(); // game id -> <button class="tile">

  const now = () => ui.replay?.time ?? Date.now();
  const vmOf = (ctx) => { const at = now(), by = new Map(); for (const r of ctx.ranked) by.set(r.game.id, tileVM(r, { now: at })); return by; };

  function counts(ctx) {
    const n = segmentCounts(ctx.ranked);
    for (const b of page.querySelectorAll("[data-seg]")) {
      const t = String(n[b.dataset.seg] ?? 0), el = b.querySelector(".n");
      if (el.textContent !== t) el.textContent = t;
    }
  }

  function patch(btn, vm) {
    const cls = tileClass(vm);
    if (btn.className !== cls) btn.className = cls;
    const html = tileInner(vm);
    if (btn._h !== html) btn.innerHTML = btn._h = html;
  }

  function tileFor(vm) {
    const tpl = document.createElement("template");
    tpl.innerHTML = tileHTML(vm);
    const btn = tpl.content.firstElementChild;
    btn._h = btn.innerHTML;
    tiles.set(vm.id, btn);
    return btn;
  }

  function setEmpty() {
    let e = grid.querySelector(".empty");
    if (shown.length) { e?.remove(); return; }
    if (!e) { e = document.createElement("p"); e.className = "empty"; grid.append(e); }
    const t = ui.tracker ? EMPTY[seg] : "Loading…";
    if (e.textContent !== t) e.textContent = t;
  }

  // A fresh order: the same buttons move (only the ones out of place), new ones are made, others go.
  function arrange(ctx, { animate = false } = {}) {
    fresh = gamesOrder(ctx.ranked, { seg, sort });
    const vms = vmOf(ctx);
    const apply = () => {
      for (const [id, btn] of tiles) if (!fresh.includes(id)) { btn.remove(); tiles.delete(id); }
      let cursor = grid.firstElementChild;
      for (const id of fresh) {
        const btn = tiles.get(id) ?? tileFor(vms.get(id));
        if (btn === cursor) cursor = cursor.nextElementSibling;
        else grid.insertBefore(btn, cursor);
      }
      shown = fresh.slice();
    };
    if (animate) flip(() => [...tiles.values()], apply); else apply();
    for (const id of shown) patch(tiles.get(id), vms.get(id));
    setEmpty();
    counts(ctx);
    resortBtn.hidden = true;
  }

  function setSeg(k, ctx) {
    seg = k; store.set("gamesSeg", k);
    for (const b of page.querySelectorAll("[data-seg]")) b.setAttribute("aria-pressed", String(b.dataset.seg === k));
    if (ctx) arrange(ctx);
  }
  function setSort(k, ctx) {
    sort = k; store.set("gamesSort", k);
    for (const b of page.querySelectorAll("[data-sort]")) b.setAttribute("aria-pressed", String(b.dataset.sort === k));
    if (ctx) arrange(ctx, { animate: true });
  }

  return {
    mount(el) {
      page = el;
      el.insertAdjacentHTML("beforeend", `
        <div class="page-head">
          <div class="colhead"><h2 class="coltitle" id="col-games" tabindex="-1">Games</h2><span class="colpick-slot"></span></div>
          <div class="filters" role="group" aria-label="Which games">
            <button class="chipbtn mvbtn" type="button" data-act="multi">📺 Multi-view</button>
            ${GAME_SEGMENTS.map(([k, l]) => `<button class="chipbtn" type="button" data-seg="${k}" aria-pressed="${seg === k}">${esc(l)} <span class="n num"></span></button>`).join("")}
          </div>
          <div class="sortrow">
            <span class="label" id="games-sort-label">Sort</span>
            <span class="seg" role="group" aria-labelledby="games-sort-label">${GAME_SORTS.map(([k, l]) => `<button type="button" data-sort="${k}" aria-pressed="${sort === k}">${esc(l)}</button>`).join("")}</span>
            <button class="chipbtn resort" type="button" data-grid-resort hidden aria-label="Re-sort games, most important first">↻</button>
          </div>
        </div>
        <div class="tiles" data-grid></div>`);
      grid = el.querySelector("[data-grid]");
      resortBtn = el.querySelector("[data-grid-resort]");
      setEmpty();
      el.addEventListener("click", (e) => {
        const ctx = ui.tracker ? getCtx() : null;
        const s = e.target.closest("[data-seg]");
        if (s) { if (s.dataset.seg !== seg) setSeg(s.dataset.seg, ctx); return; }
        const o = e.target.closest("[data-sort]");
        if (o) { if (o.dataset.sort !== sort) setSort(o.dataset.sort, ctx); return; }
        if (e.target.closest("[data-grid-resort]") && ctx) {
          const wasFocused = document.activeElement === resortBtn;
          arrange(ctx, { animate: true });
          page.scrollTo({ top: 0, behavior: "auto" });
          if (wasFocused) page.querySelector(`[data-sort="${sort}"]`)?.focus({ preventScroll: true }); // ↻ is gone
        }
      });
    },
    // New data from scratch (start, jump, Live/Replay): a fresh order.
    reset(ctx) { if (ui.tracker) arrange(ctx); },
    // The tab just became the current one (or got a column): a fresh order.
    activate(ctx) { if (ui.tracker) arrange(ctx); },
    // Live data: contents change in place; games that newly fit the chip join at the end; nothing moves.
    // While the tab is out of sight (another tab is open on a phone) it simply keeps itself sorted.
    update(ctx) {
      if (!ui.tracker) return;
      if (!(ui.cols ? ui.cols.includes("games") : ui.tab === "games")) return arrange(ctx);
      fresh = gamesOrder(ctx.ranked, { seg, sort });
      const vms = vmOf(ctx);
      for (const id of fresh) if (!tiles.has(id)) { grid.append(tileFor(vms.get(id))); shown.push(id); }
      for (const id of shown) { const vm = vms.get(id); if (vm) patch(tiles.get(id), vm); }
      setEmpty();
      counts(ctx);
      // ↻ when the top is out of date; once shown it stays at least 5 s, so it doesn't blink.
      const stale = topChanged(shown, fresh), t = performance.now();
      if (stale && resortBtn.hidden) { resortBtn.hidden = false; staleAt = t; }
      else if (!stale && !resortBtn.hidden && t - staleAt > 5000) resortBtn.hidden = true;
    },
    // For checks from the console: the ids in the grid, in order.
    get order() { return shown.slice(); },
  };
}
