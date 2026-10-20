// The app bar at the top of every screen: your score against your opponent's and your win chance (tap it
// for Matchup), the replay controls (pause, speed, clock) or the live status, Find and settings, and a thin
// yellow/purple win bar along the bottom. It's changed in place: buttons are never replaced, so a tap
// during an update still lands.

import { esc, pct, n1 } from "./cards.js";
import { SPEEDS, clockPill } from "../src/view-models.js";

const ICON = {
  pause: `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><rect x="3" y="2" width="3.6" height="12" rx="1" fill="currentColor"/><rect x="9.4" y="2" width="3.6" height="12" rx="1" fill="currentColor"/></svg>`,
  play: `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4 2.2v11.6a.8.8 0 0 0 1.2.7l9.4-5.8a.8.8 0 0 0 0-1.4L5.2 1.5A.8.8 0 0 0 4 2.2Z" fill="currentColor"/></svg>`,
  down: `<svg viewBox="0 0 10 10" width="9" height="9" aria-hidden="true"><path d="M1.5 3.5 5 7l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  clock: `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 4.6V8l2.4 1.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
};

const set = (el, html) => { if (el && el._h !== html) el.innerHTML = el._h = html; };
const text = (el, t) => { if (el && el.textContent !== t) el.textContent = t; };
const attr = (el, k, v) => { if (el && el.getAttribute(k) !== v) el.setAttribute(k, v); };

export function createAppbar({ el, ui }) {
  const score = el.querySelector("#scorebug");
  const transport = el.querySelector("#transport");
  const winbar = el.querySelector(".winbar");
  let kind = null; // which controls are in #transport: "replay" | "live" | ""

  function clear() {
    set(score, `<span class="brand">Fantasy <b>Zone</b></span>`);
    score.setAttribute("aria-label", "Fantasy Zone");
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

  // Pause / speed / clock (replay) or the live status. Every tick; text only.
  function renderTransport() {
    const want = ui.mode === "replay" && ui.replay ? "replay" : ui.mode === "live" ? "live" : "";
    if (want !== kind) {
      kind = want;
      transport.innerHTML = want === "replay" ? `
        <button class="tbtn" type="button" data-act="pause"></button>
        <button class="tbtn speedcycle num" type="button" data-act="speed"></button>
        <div class="seg speeds" role="group" aria-label="Speed">${SPEEDS.map((s) => `<button type="button" data-speed="${s}" aria-pressed="false">${s}×</button>`).join("")}</div>
        <button class="clockpill" type="button" data-sheet="clock" aria-haspopup="dialog"><span class="cp-t num"></span><span class="cp-i">${ICON.clock}</span>${ICON.down}</button>`
        : want === "live" ? `<button class="livepill" type="button" data-sheet="live" aria-haspopup="dialog"><i aria-hidden="true"></i><span class="num"></span></button>` : "";
    }
    if (kind === "replay") {
      const pause = transport.querySelector('[data-act="pause"]');
      const icon = ui.paused ? "play" : "pause";
      if (pause.dataset.icon !== icon) {
        pause.dataset.icon = icon;
        pause.innerHTML = ICON[icon];
        attr(pause, "aria-label", ui.paused ? "Play the replay" : "Pause the replay");
      }
      const sp = transport.querySelector('[data-act="speed"]');
      text(sp, `${ui.speed}×`);
      attr(sp, "aria-label", `Speed ${ui.speed} times. Tap for the next speed.`);
      for (const b of transport.querySelectorAll("[data-speed]")) attr(b, "aria-pressed", String(Number(b.dataset.speed) === ui.speed));
      const t = ui.replay.done ? "End" : clockPill(ui.replay.time);
      text(transport.querySelector(".cp-t"), t);
      attr(transport.querySelector(".clockpill"), "aria-label",
        `Replay clock ${ui.replay.done ? "at the end of saved plays" : t.replace(/([AP])$/, " $1M")} Eastern. Jump to a kickoff or change speed.`);
    } else if (kind === "live") {
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
