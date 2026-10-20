// A row of pages you swipe between, with a tab bar on top whose underline follows your finger.
// One instance runs the main tabs (Zone | Matchup | Games). The browser does the swiping itself
// (scroll snap), so it feels native; this file only keeps the tabs, the underline and `inert` in step.
//
//   createPager({ tabbar, pager, tabs, pages, onSettle, onReselect, onGo })
//     tabs        the tab <button role="tab">s, in order      pages   the matching .page sections
//     onSettle(i, { swipe })   a page became the current one (swipe: the user dragged there)
//     onReselect(i)            the current tab was tapped again (scroll that page to the top)
//     onGo(i)                  about to slide to page i (a tab tap): bring it up to date before it shows
//   returns { go(i), start(i), setEnabled(bool), destroy(), state: { swiping }, active }
//
// Rules (plan B1.3): tapping a tab two pages away never activates the page in between; scrolling to where
// we already are calls settle() directly (no scroll => no scrollend); never scrollIntoView (it would also
// scroll the preview frame); in dashboard mode (columns) nothing scrolls sideways and every page is live.

export function createPager({ tabbar, pager, tabs, pages, onSettle, onReselect, onGo }) {
  const ink = tabbar.querySelector(".ink");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const ac = new AbortController();
  const on = (el, ev, fn, o) => el.addEventListener(ev, fn, { ...o, signal: ac.signal });
  let w = 1, active = -1, target = null, frame = 0, timer = 0, enabled = true;
  const state = { swiping: false };
  tabbar.style.setProperty("--ntabs", String(tabs.length)); // .ink is exactly one tab wide

  const pos = () => pager.scrollLeft / w; // fractional while moving
  const clamp = (i) => Math.max(0, Math.min(pages.length - 1, i));

  function paint() { // at most once per frame
    frame = 0;
    const p = pos();
    ink.style.transform = `translateX(${p * 100}%)`;
    const cur = target ?? Math.round(p);
    tabs.forEach((t, k) => t.classList.toggle("is-current", k === cur));
  }

  function activate(i, swipe = false) {
    active = i;
    tabs.forEach((t, k) => { t.setAttribute("aria-selected", String(k === i)); t.tabIndex = k === i ? 0 : -1; });
    pages.forEach((pg, k) => { pg.inert = enabled && k !== i; });
    onSettle(i, { swipe });
  }

  function settle() { // safe to call any number of times
    clearTimeout(timer);
    if (!enabled) return;
    const i = clamp(Math.round(pos()));
    if (target != null && i !== target) return; // our smooth jump is still travelling
    const swipe = target == null;
    target = null; state.swiping = false; paint();
    if (i !== active) activate(i, swipe);
  }

  function go(i, smooth = true) {
    i = clamp(i);
    if (i !== active) onGo?.(i);
    if (!enabled) { if (i !== active) activate(i); return; } // dashboard: columns, nothing scrolls
    target = i;
    if (Math.abs(pager.scrollLeft - i * w) < 1) return settle();
    pager.scrollTo({ left: i * w, behavior: smooth && !reduce.matches ? "smooth" : "auto" });
  }

  on(pager, "scroll", () => {
    if (!enabled) return;
    state.swiping = true;
    frame ||= requestAnimationFrame(paint);
    clearTimeout(timer); timer = setTimeout(settle, 150); // fallback where scrollend is missing
  }, { passive: true });
  on(pager, "scrollend", settle);
  // A finger or wheel takes over from a tab-tap jump, so the jump's target lock never gets stuck.
  for (const ev of ["pointerdown", "wheel", "touchstart"]) on(pager, ev, () => { target = null; }, { passive: true });

  on(tabbar, "click", (e) => {
    const k = tabs.indexOf(e.target.closest('[role="tab"]'));
    if (k < 0) return;
    if (k === active) onReselect?.(k); else go(k);
  });
  on(tabbar, "keydown", (e) => { // WAI-ARIA tabs, automatic activation
    const k = tabs.indexOf(document.activeElement);
    if (k < 0) return;
    const n = { ArrowRight: k + 1, ArrowLeft: k - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (n == null) return;
    e.preventDefault();
    const j = (n + tabs.length) % tabs.length;
    tabs[j].focus();
    go(j);
  });

  const ro = new ResizeObserver(() => { // rotation or resize: stay on the same page (or the one we're heading to)
    if (!enabled) return;
    const nw = pager.clientWidth || 1;
    if (nw === w) return; // the first report after observe(), or a height-only change
    w = nw;
    const i = target ?? active;
    if (i >= 0) pager.scrollTo({ left: i * w, behavior: "auto" });
    paint();
  });
  ro.observe(pager);

  return {
    go, state,
    get active() { return active; },
    start(i) { w = pager.clientWidth || 1; go(i, false); settle(); },
    setEnabled(v) { // false in dashboard mode (columns)
      enabled = v; target = null; state.swiping = false;
      if (!v) { pager.scrollLeft = 0; pages.forEach((pg) => { pg.inert = false; }); return; }
      w = pager.clientWidth || 1;
      pager.scrollTo({ left: Math.max(active, 0) * w, behavior: "auto" });
      pages.forEach((pg, k) => { pg.inert = k !== active; });
      tabs.forEach((t, k) => { t.setAttribute("aria-selected", String(k === active)); t.tabIndex = k === active ? 0 : -1; });
      paint();
    },
    destroy() { ac.abort(); ro.disconnect(); cancelAnimationFrame(frame); clearTimeout(timer); },
  };
}
