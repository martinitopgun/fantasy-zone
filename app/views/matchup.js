// The Matchup tab: the score and your win chance on top, then your 10 starters next to your opponent's,
// slot by slot (QB, RB, RB, WR, WR, TE, FLEX, FLEX, K, DEF from your league's settings), each with his
// points so far and where his game is:
//   ○ yet to play (with the day and time, "MON 8:15 PM · yet to play")   ● playing
//   ◉ his team has the ball (a defense: it's on the field)              ✓ his game is over
// Only the [Lineup] chip for now: more views (Swings, Story, What-if) arrive with their own steps, so there
// are no empty chips. Everything is changed in place on each update; nothing here moves by itself.

import { esc, pct, n1 } from "./cards.js";
import { lineupVM } from "../src/view-models.js";

const set = (el, html) => { if (el._h !== html) el.innerHTML = el._h = html; };

export function createMatchupView({ ui }) {
  let hero, rows;

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
      <div class="wpbar" aria-hidden="true"><span style="width:${(m.winProb * 100).toFixed(1)}%"></span></div>`;
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
        <div class="mseg"><span class="seg" role="group" aria-label="Matchup view"><button type="button" aria-pressed="true">Lineup</button></span></div>
        <ol class="lineup" data-rows aria-label="Starters, yours on the left, theirs on the right"></ol>`);
      hero = el.querySelector("[data-hero]");
      rows = el.querySelector("[data-rows]");
    },
    reset(ctx) { this.update(ctx); },
    update(ctx) {
      if (!ui.tracker) return;
      const m = ctx.snap.matchups[0];
      if (!m) { set(hero, `<p class="empty">No fantasy matchup this week.</p>`); set(rows, ""); return; }
      set(hero, heroHTML(m));
      const vm = lineupVM(m, { now: ui.replay?.time ?? Date.now(), statLine: (p) => ui.tracker.statLine?.(p.id, p.pos) });
      set(rows, rowsHTML(vm));
    },
  };
}
