// The game rail: a row of game chips you slide sideways, between the app bar and the tabs (plan B1.4).
// Each chip: "CHI 17-14 ATL" with a yellow dot for each of your starters in the game and a purple one for each
// of your opponent's, then the clock and a short reason ("Q2 12:42 Swift RZ"). It ends with "All games ›".
//
//   const rail = createRail({ el, getCtx, current, now })
//     el        the <nav class="rail">            getCtx()  { snap, ranked } right now (for the ↻ chip)
//     current() id of the game that's open        now()     the clock (replay time in a replay), for kickoffs
//   rail.reset(ctx)   a fresh order (first render, a jump, Live/Replay switch)
//   rail.update(ctx)  new data: contents change in place, nothing moves
//   rail.markCurrent()  after a game opens or closes          rail.clear()  no data: hide the row
//
// The order never changes by itself while you look at it (R5): chips are keyed by data-game and only their
// insides change; a game that starts joins at the end, a game that ends stays put as "Final". When the top 3
// would be different, a ↻ chip appears at the start; tapping it re-sorts (chips glide to their new places)
// and slides the rail back to the start. Taps are handled by app.js (data-game, data-act="open-games").

import { railOrder, railMerge, topChanged, chipVM, ALL_GAMES } from "../src/view-models.js";
import { esc } from "../views/cards.js";

const TOUCH_MS = 1500; // a chip touched this recently is never dropped, and the ↻ chip waits this long after a touch
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

// Move things, then let each element glide from where it was to where it is now (FLIP, 200 ms).
// `items()` lists the elements to animate; skipped under reduced motion.
export function flip(items, mutate) {
  const before = new Map(items().map((el) => [el, el.getBoundingClientRect()]));
  mutate();
  if (reduceMotion.matches) return;
  for (const el of items()) {
    const b = before.get(el);
    if (!b) continue;
    const a = el.getBoundingClientRect();
    const dx = b.left - a.left, dy = b.top - a.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
    el.animate?.([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: 200, easing: "ease-out" });
  }
}

function chipInner(vm) {
  const score = vm.awayScore == null ? `${esc(vm.away)} <span class="at">@</span> ${esc(vm.home)}` : `${esc(vm.away)} ${vm.awayScore}-${vm.homeScore} ${esc(vm.home)}`;
  const dots = vm.dots.length ? `<span class="dots" aria-hidden="true">${vm.dots.slice(0, 5).map((o) => `<i class="${o}"></i>`).join("")}${vm.dots.length > 5 ? "<b>+</b>" : ""}</span>` : "";
  return `<span class="l1 num"><span class="sc">${score}</span>${dots}</span><span class="l2 num"><span class="t">${esc(vm.time)}</span>${vm.why ? ` <span class="w">${esc(vm.why)}</span>` : ""}</span>`;
}

export function createRail({ el, getCtx, current = () => null, now = () => Date.now() }) {
  el.innerHTML = `
    <button class="railnav" type="button" data-rail="prev" aria-label="Scroll the games left" tabindex="-1">‹</button>
    <ul>
      <li class="resort" hidden><button class="gchip resort" type="button" data-rail="resort" aria-label="Re-sort games, most important first">↻</button></li>
      <li class="allgames"><button class="gchip all" type="button" data-act="open-games">All games ›</button></li>
    </ul>
    <button class="railnav" type="button" data-rail="next" aria-label="Scroll the games right" tabindex="-1">›</button>`;
  const ul = el.querySelector("ul");
  const resortLi = ul.querySelector(".resort"), allLi = ul.querySelector(".allgames");
  const prev = el.querySelector('[data-rail="prev"]'), next = el.querySelector('[data-rail="next"]');
  const items = new Map(); // game id -> <li>
  let shown = []; // game ids, in the order on screen
  let fresh = []; // the order the rail would use now (railOrder, without "All games")
  let lastTouch = -Infinity, touched = new Map(), wait = 0, staleSince = 0;

  const chips = () => [...ul.children].filter((li) => !li.hidden);
  const busy = () => performance.now() - lastTouch < TOUCH_MS;

  function chipFor(id) {
    const li = document.createElement("li");
    li.innerHTML = `<button class="gchip" type="button" data-game="${esc(id)}"></button>`;
    items.set(id, li);
    return li;
  }

  // Change one chip's contents in place (the <button> itself stays).
  function patch(li, vm) {
    const b = li.firstElementChild;
    const cls = `gchip ${vm.state}${vm.hot ? " hot" : ""}`;
    if (b.className !== cls) b.className = cls;
    const html = chipInner(vm);
    if (b._h !== html) b.innerHTML = b._h = html;
    if (b.getAttribute("aria-label") !== vm.label) b.setAttribute("aria-label", vm.label);
  }

  function patchAll(ctx) {
    const at = now();
    const byId = new Map(ctx.ranked.map((r) => [r.game.id, r]));
    for (const [id, li] of items) {
      const r = byId.get(id);
      if (r) patch(li, chipVM(r, { matchups: ctx.snap.matchups, now: at }));
    }
    markCurrent();
  }

  function markCurrent() {
    const id = current();
    for (const [gid, li] of items) {
      const b = li.firstElementChild, on = gid === id;
      if (on !== (b.getAttribute("aria-current") === "true")) on ? b.setAttribute("aria-current", "true") : b.removeAttribute("aria-current");
    }
  }

  // Put the chips in `order` (moving the same <li>s, and only the ones out of place), dropping games no
  // longer in it. Only for a re-sort: the first render, a jump, Live/Replay, or a tap on ↻.
  function arrange(order) {
    for (const [id, li] of items) if (!order.includes(id)) { li.remove(); items.delete(id); }
    let cursor = resortLi.nextElementSibling;
    for (const id of order) {
      const li = items.get(id) ?? chipFor(id);
      if (li === cursor) cursor = cursor.nextElementSibling;
      else ul.insertBefore(li, cursor);
    }
    shown = order.slice();
  }

  // Between re-sorts: chips that stay are never touched; new ones go in just before "All games ›".
  function merge(order) {
    for (const id of shown) if (!order.includes(id)) { items.get(id)?.remove(); items.delete(id); }
    for (const id of order) if (!items.has(id)) ul.insertBefore(chipFor(id), allLi);
    shown = order.slice();
  }

  // Show or hide the ↻ chip without moving what's in view: at the start of the rail the chips slide over
  // for it; scrolled along, the scroll position makes up for it, so nothing under your finger moves.
  function setResort(on) {
    if (resortLi.hidden === !on) return;
    clearTimeout(wait);
    if (busy()) { wait = setTimeout(() => setResort(topChanged(shown, fresh)), TOUCH_MS - (performance.now() - lastTouch) + 20); return; }
    if (!on && performance.now() - staleSince < 5000) { wait = setTimeout(() => setResort(topChanged(shown, fresh)), 5000); return; } // no flicker
    const atStart = ul.scrollLeft < 4;
    flip(chips, () => {
      const w0 = resortLi.hidden ? 0 : resortLi.getBoundingClientRect().width + 8;
      resortLi.hidden = !on;
      const w1 = resortLi.hidden ? 0 : resortLi.getBoundingClientRect().width + 8;
      if (!atStart) ul.scrollLeft += w1 - w0;
    });
    if (on) staleSince = performance.now();
  }

  function navState() {
    const max = ul.scrollWidth - ul.clientWidth;
    prev.disabled = ul.scrollLeft <= 1;
    next.disabled = ul.scrollLeft >= max - 1;
  }

  function toStart(smooth) {
    ul.scrollTo({ left: 0, behavior: smooth && !reduceMotion.matches ? "smooth" : "auto" });
  }

  // ↻: the new order, with the chips gliding there, and back to the start of the rail.
  function resort() {
    const ctx = getCtx();
    if (!ctx) return;
    const hadFocus = document.activeElement === resortLi.firstElementChild;
    fresh = railOrder(ctx.ranked).filter((id) => id !== ALL_GAMES);
    clearTimeout(wait);
    flip(chips, () => { arrange(fresh); resortLi.hidden = true; ul.scrollLeft = 0; });
    patchAll(ctx);
    navState();
    if (hadFocus) (items.get(shown[0]) ?? allLi).firstElementChild.focus({ preventScroll: true }); // ↻ is gone; stay in the rail
  }

  // Touches: remember which chip, so an update never drops it and the ↻ chip never shifts it.
  ul.addEventListener("pointerdown", (e) => {
    lastTouch = performance.now();
    const id = e.target.closest("[data-game]")?.dataset.game;
    if (id) touched.set(id, lastTouch);
  }, { passive: true });
  ul.addEventListener("wheel", () => { lastTouch = performance.now(); }, { passive: true });
  ul.addEventListener("scroll", () => { lastTouch = performance.now(); navState(); }, { passive: true });
  el.addEventListener("click", (e) => {
    const k = e.target.closest("[data-rail]")?.dataset.rail;
    if (k === "resort") return resort();
    if (k === "prev" || k === "next") {
      const step = Math.max(160, ul.clientWidth - 56);
      ul.scrollBy({ left: k === "next" ? step : -step, behavior: reduceMotion.matches ? "auto" : "smooth" });
    }
  });
  new ResizeObserver(navState).observe(ul);

  return {
    reset(ctx) {
      fresh = railOrder(ctx.ranked).filter((id) => id !== ALL_GAMES);
      clearTimeout(wait);
      resortLi.hidden = true;
      arrange(fresh);
      patchAll(ctx);
      el.hidden = false;
      toStart(false);
      navState();
    },
    update(ctx) {
      fresh = railOrder(ctx.ranked).filter((id) => id !== ALL_GAMES);
      const states = new Map(ctx.ranked.map((r) => [r.game.id, r.game.state]));
      const t = performance.now();
      const order = railMerge(shown, fresh, { stateOf: (id) => states.get(id), keep: (id) => t - (touched.get(id) ?? -Infinity) < TOUCH_MS });
      if (order.join() !== shown.join()) merge(order); // only appends (and drops of upcoming/final games)
      patchAll(ctx);
      setResort(topChanged(shown, fresh));
      navState();
    },
    markCurrent,
    clear() { el.hidden = true; clearTimeout(wait); },
    // For checks from the console and tests: the ids in the rail, in order.
    get order() { return shown.slice(); },
  };
}
