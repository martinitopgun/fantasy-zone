// The Matchup tab: the score and your win chance on top, then your 10 starters next to your opponent's,
// slot by slot (QB, RB, RB, WR, WR, TE, FLEX, FLEX, K, DEF from your league's settings), each with his
// points so far and where his game is:
//   ○ yet to play (with the day and time, "MON 8:15 PM · yet to play")   ● playing
//   ◉ his team has the ball (a defense: it's on the field)              ✓ his game is over
// Chips: [Lineup] and [Swings] (your win chance through the day, the plays that moved it most), and [Story ›]
// (your day in 6 cards). What-if arrives with its own step, so there are no empty chips. The hero also says how sweaty it is and
// what you still need. Everything is changed in place on each update; nothing here moves by itself.

import { esc, pct, n1 } from "./cards.js";
import { lineupVM } from "../src/view-models.js";
import { sweat, needs, swings, playerSwings, breakeven } from "../src/insights.js";
import { winChartSvg, winChartScale } from "./charts.js";
import { cardHTML } from "./cards.js";
import { windows } from "../src/replay.js";

const set = (el, html) => { if (el._h !== html) el.innerHTML = el._h = html; };

export function createMatchupView({ ui }) {
  let hero, rows, swingsEl, page;
  ui.mview ??= "lineup";

  const myName = () => (ui.mode === "live" ? ui.live?.user : ui.replayData?.user) ?? "";

  function heroHTML(m) {
    const d = ui.wpDelta.get(m.league.league_id);
    const delta = d ? ` <span class="delta ${d > 0 ? "up" : "down"}">${d > 0 ? "▲" : "▼"}${Math.max(1, Math.round(Math.abs(d) * 100))}</span>` : "";
    const me = myName();
    return `<div class="mtop">
        <div class="side me"><span class="who">You${me ? ` · ${esc(me)}` : ""}</span><b class="pts num">${n1(m.myNow)}</b><span class="proj num">proj ${n1(m.myFinal)}</span></div>
        <div class="mid"><span class="label">Win</span><b class="num">${pct(m.winProb)}${delta}</b></div>
        <div class="side opp"><span class="who">${esc(m.opponentName || "Opponent")}</span><b class="pts num">${n1(m.oppNow)}</b><span class="proj num">proj ${n1(m.oppFinal)}</span></div>
      </div>
      <div class="wpbar" aria-hidden="true"><span style="width:${(m.winProb * 100).toFixed(1)}%"></span></div>
      ${insightHTML(m)}${playerSwingHTML(m)}`;
  }

  // "Biggest swing: Kittle (theirs) — his whole game is still to come. You're favored if he gets under 25.0."
  // The next few open under it. Hidden once nobody can move your win chance by 1%.
  function playerSwingHTML(m) {
    const list = playerSwings(m).filter((x) => x.swing >= 0.01);
    if (!list.length) return "";
    const all = [...m.mine, ...m.theirs];
    const line = (x) => {
      const be = breakeven(m, all.find((p) => p.id === x.id));
      const fav = be == null ? "" : x.owner === "me" ? ` You're favored if he gets ${n1(be)}+ more.` : ` You're favored if he gets under ${n1(be)}.`;
      return `<b class="${x.owner}">${esc(x.name.split(" ").slice(1).join(" ") || x.name)}</b>${x.owner === "me" ? "" : " (theirs)"} — ${x.toCome === "whole" ? "his whole game is still to come" : "he's still playing"}.${esc(fav)}`;
    };
    const first = `<span class="label">Biggest swing</span> ${line(list[0])}`;
    if (list.length === 1) return `<p class="mswing">${first}</p>`;
    return `<details class="mswing"${ui.mswingOpen ? " open" : ""}><summary>${first} <span class="more" aria-hidden="true">more</span></summary>
      ${list.slice(1, 4).map((x) => `<p>${line(x)}</p>`).join("")}</details>`;
  }

  // "FULL SWEAT · You need 99.0 more. Your 9 players left should get about 97.2."
  function insightHTML(m) {
    const sw = sweat(m), nd = needs(m);
    const line = nd.playersLeft === 0 ? "Everyone has played." : nd.need <= 0 ? `You're ahead of everything they have left. Your ${nd.playersLeft} still to play should add about ${n1(nd.mineLeft)}.`
      : `You need ${n1(nd.need)} more. Your ${nd.playersLeft} still to play should get about ${n1(nd.mineLeft)}.`;
    return `<p class="msweat"><b class="sweat s-${sw.label.split(" ")[0].toLowerCase()}" title="Estimate: close + lots of points still to come = sweatier">${sw.label}</b> <span>${esc(line)}</span></p>`;
  }

  function swingsHTML() {
    const lid = ui.tracker.snapshot().matchups[0]?.league.league_id;
    const hist = ui.tracker.history(lid);
    const top = swings(hist, 5);
    const ticks = ui.replayData ? windows(ui.replayData).map((w) => ({ t: w.kickoff, label: w.label })) : [];
    const feed = ui.tracker.feed();
    const cards = top.map((s) => feed.find((c) => c.id === s.cardId)).filter(Boolean);
    return `<div class="chartbox">${winChartSvg(hist, top, ticks)}<p class="readout num" data-readout aria-live="off"></p></div>
      <h3 class="label">Biggest swings</h3>
      <div class="feed">${cards.length ? cards.map((c) => cardHTML(c, false)).join("") : `<p class="empty">No swings yet.</p>`}</div>`;
  }

  function setView(v) {
    ui.mview = v;
    for (const b of page.querySelectorAll("[data-mview]")) b.setAttribute("aria-pressed", String(b.dataset.mview === v));
    rows.hidden = v !== "lineup";
    swingsEl.hidden = v !== "swings";
    if (v === "swings") { swingsEl._h = null; set(swingsEl, swingsHTML()); }
  }

  // One side of a row: name, points and the status mark on the first line, the note under it.
  // Yours reads left to right toward the slot in the middle; theirs is the mirror image.
  function sideHTML(s, cls) {
    if (!s) return `<span class="${cls}"></span>`;
    return `<span class="${cls} st-${s.status}" title="${esc(s.label)}"><span class="sr-only">${esc(s.label)}</span>
      <span class="l1" aria-hidden="true"><span class="nm">${esc(s.name)}</span><b class="num">${s.points.toFixed(1)}</b><i class="mk">${s.mark}</i></span>
      <span class="l2 num" aria-hidden="true">${esc(s.note)}</span></span>`;
  }

  function rowsHTML(vm) {
    return vm.rows.map((r) => `<li class="lrow">${sideHTML(r.mine, "lme")}<span class="lpos" aria-hidden="true">${esc(r.slot)}</span>${sideHTML(r.theirs, "lopp")}</li>`).join("");
  }

  return {
    mount(el) {
      el.insertAdjacentHTML("beforeend", `
        <div class="page-head"><div class="colhead"><h2 class="coltitle" id="col-matchup" tabindex="-1">Matchup</h2><span class="colpick-slot"></span></div></div>
        <section class="mhero" data-hero aria-label="Score and win chance"><p class="empty">Loading…</p></section>
        <div class="mseg"><span class="seg" role="group" aria-label="Matchup view"><button type="button" data-mview="lineup" aria-pressed="true">Lineup</button><button type="button" data-mview="swings" aria-pressed="false">Swings</button></span><button class="chipbtn storybtn" type="button" data-act="story">Story ›</button></div>
        <ol class="lineup" data-rows aria-label="Starters, yours on the left, theirs on the right"></ol>
        <section class="mswings" data-swings hidden></section>`);
      page = el;
      hero = el.querySelector("[data-hero]");
      hero.addEventListener("toggle", (e) => { if (e.target.matches(".mswing")) ui.mswingOpen = e.target.open; }, true);
      rows = el.querySelector("[data-rows]");
      swingsEl = el.querySelector("[data-swings]");
      el.addEventListener("click", (e) => { const b = e.target.closest("[data-mview]"); if (b) setView(b.dataset.mview); });
      // Crosshair readout on the chart: the time and your win chance under the finger or mouse.
      el.addEventListener("pointermove", (e) => {
        const svg = e.target.closest?.(".winchart");
        if (!svg) return;
        const hist = ui.tracker.history(ui.tracker.snapshot().matchups[0]?.league.league_id);
        if (hist.length < 2) return;
        const box = svg.getBoundingClientRect(), vx = Math.min(588, Math.max(50, ((e.clientX - box.left) / box.width) * 600));
        const t = winChartScale(hist).t(vx);
        let h = hist[0]; for (const x of hist) { if (x.t <= t) h = x; else break; }
        const xh = svg.querySelector(".xhair"); xh.setAttribute("x1", vx); xh.setAttribute("x2", vx); xh.setAttribute("visibility", "visible");
        const ro = el.querySelector("[data-readout]");
        if (ro) ro.textContent = `${new Date(h.t).toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "2-digit" })} · your win chance ${pct(h.wp)}`;
      });
      el.addEventListener("pointerleave", () => el.querySelector(".winchart .xhair")?.setAttribute("visibility", "hidden"), true);
      setView(ui.mview);
    },
    reset(ctx) { this.update(ctx); },
    update(ctx) {
      if (!ui.tracker) return;
      const m = ctx.snap.matchups[0];
      if (!m) { set(hero, `<p class="empty">No fantasy matchup this week.</p>`); set(rows, ""); return; }
      set(hero, heroHTML(m));
      if (ui.mview === "swings") set(swingsEl, swingsHTML());
      const vm = lineupVM(m, { now: ui.replay?.time ?? Date.now(), statLine: (p) => ui.tracker.statLine?.(p.id, p.pos) });
      set(rows, rowsHTML(vm));
    },
  };
}
