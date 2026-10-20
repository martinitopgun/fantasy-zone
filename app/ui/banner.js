// The heads-up banner (plan M4): one at a time, just under the tabs, yellow for your player and purple for
// your opponent's. It stays about 6 seconds and a newer one takes its place. It never opens anything by
// itself: a tap opens the game (the app's [data-game] click), × or a swipe up puts it away.
//   const banner = createBanner({ el, announce })   announce(text): read it out for screen readers
//   banner.show(alerts)   biggest first (alerts.take); shows the first, with "+N more" for the rest
//   banner.hide()

import { esc } from "../views/cards.js";

export function createBanner({ el, announce = () => {}, ms = 6000 }) {
  let timer = 0;

  function hide() {
    clearTimeout(timer);
    el.hidden = true;
    el.innerHTML = "";
  }

  function show(list) {
    if (!list?.length) return;
    const a = list[0], more = list.length - 1;
    el.innerHTML = `<div class="banner ${a.owner}">
        <button class="banner-open" type="button" data-game="${esc(a.gameId)}" aria-label="${esc(`${a.text}. Open the game`)}">
          <span class="banner-t">${esc(a.text)}</span>${more ? `<span class="banner-more">+${more} more</span>` : ""}
        </button>
        <button class="banner-x" type="button" aria-label="Dismiss">×</button>
      </div>`;
    el.hidden = false;
    el.style.translate = "";
    announce(a.text);
    clearTimeout(timer);
    timer = setTimeout(hide, ms);
  }

  // Any tap puts it away. The open button's [data-game] also bubbles up to the app, which opens the game.
  el.addEventListener("click", (e) => { if (e.target.closest(".banner-open, .banner-x")) setTimeout(hide); });

  // Swipe up to dismiss.
  let y0 = null, dy = 0;
  el.addEventListener("pointerdown", (e) => { y0 = e.clientY; dy = 0; });
  el.addEventListener("pointermove", (e) => {
    if (y0 == null) return;
    dy = Math.min(0, e.clientY - y0);
    if (dy < -4) el.style.translate = `0 ${dy}px`;
  });
  const end = () => {
    if (y0 == null) return;
    y0 = null;
    if (dy < -24) hide(); else el.style.translate = "";
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
  // A swipe shouldn't also count as a tap.
  el.addEventListener("click", (e) => { if (dy < -8) { e.stopPropagation(); e.preventDefault(); } }, true);

  return { show, hide };
}
