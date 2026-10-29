// The app bar at the top of every screen: your score against your opponent's and your win chance (tap it
// for Matchup; before that, or with fantasy off, the Fantasy Zone logo, which goes to Zone), the live status,
// Find and the ☰ menu, and a thin yellow/purple win bar along the bottom. It's changed in place: buttons are
// never replaced, so a tap during an update still lands.

import { esc, pct, n1 } from "./cards.js";

const set = (el, html) => { if (el && el._h !== html) el.innerHTML = el._h = html; };
const text = (el, t) => { if (el && el.textContent !== t) el.textContent = t; };
const attr = (el, k, v) => { if (el && el.getAttribute(k) !== v) el.setAttribute(k, v); };

export function createAppbar({ el, ui }) {
  const score = el.querySelector("#scorebug");
  const transport = el.querySelector("#transport");
  const winbar = el.querySelector(".winbar");
  let kind = null; // what's in #transport: "live" | ""

  function clear() {
    set(score, `<span class="brand">Fantasy <b>Zone</b></span>`);
    score.setAttribute("aria-label", "Fantasy Zone home");
    winbar.classList.add("off");
  }

  // Score bug + win bar; after every change in the data.
  function update(ctx) {
    const m = ui.fantasyOn ? ctx.snap.matchups[0] : null;
    if (!m) return clear();
    const opp = m.opponentName || "Opponent";
    set(score, `<span class="sb me"><span class="sbw">You</span><b class="sbn num">${n1(m.myNow)}</b><small class="sbp num">proj ${n1(m.myFinal)}</small></span>
      <span class="sbwp num"><small class="sbw">Win</small>${pct(m.winProb)}</span>
      <span class="sb opp"><small class="sbp num">proj ${n1(m.oppFinal)}</small><b class="sbn num">${n1(m.oppNow)}</b><span class="sbw"><span class="short">Opp</span><span class="long">${esc(opp)}</span></span></span>`);
    score.setAttribute("aria-label", `Your matchup: you ${n1(m.myNow)}, ${opp} ${n1(m.oppNow)}, win chance ${pct(m.winProb)}. Opens Matchup.`);
    winbar.classList.remove("off");
    const w = `${(m.winProb * 100).toFixed(1)}%`;
    if (winbar.firstElementChild.style.width !== w) winbar.firstElementChild.style.width = w;
  }

  // The live status (Live 4s, Offline...). Every second; text only.
  function renderTransport() {
    const want = ui.mode === "live" ? "live" : "";
    if (want !== kind) {
      kind = want;
      transport.innerHTML = want === "live" ? `<button class="livepill" type="button" data-sheet="live" aria-haspopup="dialog"><i aria-hidden="true"></i><span class="num"></span></button>` : "";
    }
    if (kind === "live") {
      const pill = transport.querySelector(".livepill");
      const ago = ui.updatedAt ? Math.round((Date.now() - ui.updatedAt) / 1000) : 0;
      const offline = !!ui.tracker && (!!ui.error || ago > 30);
      pill.classList.toggle("on", !!ui.tracker && !offline);
      pill.classList.toggle("off", offline);
      const t = !ui.tracker ? (ui.connecting ? "Connecting" : "Not live") : offline ? "Offline" : `Live ${ago}s`;
      text(pill.lastElementChild, t);
      attr(pill, "aria-label", `${t}. Live mode: tap for options.`);
    }
  }

  clear();
  return { update, renderTransport, clear };
}
