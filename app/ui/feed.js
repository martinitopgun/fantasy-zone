// A list of play cards, newest on top, that never moves under your thumb (plan B1.10 c).
// Used by Zone (and the game screen's plays). One per scrolling page.
//
//   const feed = createFeedList(el, { root, source, filter, pill, emptyText, limit, page })
//     el         where the list goes                 root    the element that scrolls (IntersectionObserver root)
//     source()   every card so far, newest first     filter  which cards this list shows
//     pill       a button for "↑ N new plays"        emptyText(): text when nothing matches
//   feed.add(cards)    new cards (oldest first, as the tracker hands them out)
//   feed.setFilter(fn) feed.reset()  feed.destroy()
//
// Rules:
//   - New cards go in at the top only while you're at the top of the page. Scrolled down, they wait behind
//     the pill; tapping it puts them in and takes you to the top. (iPhones don't keep your place when
//     something is added above you, so we never do that.)
//   - Older cards load when you get near the bottom. The list is trimmed back to `limit` when new ones arrive.
//   - More than 40 new cards at once (20x, or back from another app) rebuild the list instead.

import { cardHTML } from "../views/cards.js";

const REMOUNT_OVER = 40;

export function createFeedList(el, { root, source, filter = () => true, pill = null, emptyText = () => "No plays yet.", limit = 200, page = 60 }) {
  el.innerHTML = `<div class="feed"></div><div class="sentinel" aria-hidden="true"></div>`;
  const list = el.firstElementChild, bottom = list.nextElementSibling;
  // The top sentinel sits at the very top of the scroller (absolutely placed), so "at the top" means
  // scrolled less than its height, whatever is above the list.
  const top = document.createElement("div");
  top.className = "top-sentinel";
  top.setAttribute("aria-hidden", "true");
  root.prepend(top);

  let f = filter, atTop = true, pending = [], ids = [];

  const ioTop = new IntersectionObserver((entries) => {
    atTop = entries.at(-1).isIntersecting;
    if (atTop && pending.length) release();
  }, { root });
  const ioBottom = new IntersectionObserver((entries) => {
    if (entries.at(-1).isIntersecting) older();
  }, { root, rootMargin: "0px 0px 800px 0px" });
  ioTop.observe(top);
  ioBottom.observe(bottom);

  function setPill() {
    if (!pill) return;
    pill.hidden = !pending.length;
    if (pending.length) pill.textContent = `↑ ${pending.length} new ${pending.length === 1 ? "play" : "plays"}`;
  }

  function empty() {
    list.innerHTML = `<p class="empty">${emptyText()}</p>`;
  }

  // Rebuild from the source: the newest `page` cards that pass the filter.
  function remount() {
    pending = []; setPill();
    const shown = source().filter(f).slice(0, page);
    ids = shown.map((c) => c.id);
    if (!shown.length) return empty();
    list.innerHTML = shown.map((c) => cardHTML(c, false)).join("");
    reobserve();
  }

  // New cards at the top (only ever called while at the top, or right before jumping there).
  function insert(cards) {
    if (cards.length > REMOUNT_OVER) return remount();
    if (!ids.length) list.innerHTML = "";
    const newest = cards.slice().reverse();
    list.insertAdjacentHTML("afterbegin", newest.map((c) => cardHTML(c, true)).join(""));
    ids.unshift(...newest.map((c) => c.id));
    while (ids.length > limit) { list.lastElementChild?.remove(); ids.pop(); }
  }

  function release() {
    const cards = pending;
    pending = []; setPill();
    insert(cards);
  }

  // Next page of older cards, after the last one shown.
  function older() {
    if (!ids.length) return;
    const all = source().filter(f);
    const i = all.findIndex((c) => c.id === ids.at(-1));
    if (i < 0) return;
    const more = all.slice(i + 1, i + 1 + page);
    if (!more.length) return;
    list.insertAdjacentHTML("beforeend", more.map((c) => cardHTML(c, false)).join(""));
    ids.push(...more.map((c) => c.id));
    reobserve();
  }

  // Observing again reports the bottom sentinel's state afresh, so a short list keeps filling.
  function reobserve() { ioBottom.unobserve(bottom); ioBottom.observe(bottom); }

  pill?.addEventListener("click", () => {
    release();
    root.scrollTo({ top: 0, behavior: "auto" });
  });

  return {
    add(cards) {
      const mine = cards.filter(f);
      if (!mine.length) return;
      pending.push(...mine);
      if (atTop) release(); else setPill();
    },
    setFilter(fn) { f = fn; remount(); root.scrollTo({ top: 0, behavior: "auto" }); },
    reset() { remount(); root.scrollTo({ top: 0, behavior: "auto" }); },
    get pending() { return pending.length; },
    destroy() { ioTop.disconnect(); ioBottom.disconnect(); top.remove(); },
  };
}
