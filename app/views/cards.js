// Card and tile templates shared by every screen: play cards for the feeds, game tiles for the grids.
// Plain strings of HTML; the views put them on the page.

import { cardOwner } from "../src/view-models.js";

export const ET = { timeZone: "America/New_York" };
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const pct = (x) => (x > 0.99 && x < 1 ? ">99%" : x < 0.01 && x > 0 ? "<1%" : `${Math.round(x * 100)}%`);
export const n1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
export const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function cardHTML(c, isNew) {
  if (c.kind === "marker" || c.kind === "timeout") {
    const what = c.kind === "timeout" ? c.text.replace(/\.$/, "") : /END GAME/i.test(c.text) ? "Final" : /QUARTER 2/i.test(c.text) ? "Halftime" : c.text.replace(/\.$/, "");
    return `<div class="marker" data-id="${esc(c.id)}">${esc(c.gameName)} · ${esc(what)}${c.kind === "marker" ? ` · ${esc(c.away)} ${c.awayScore}–${c.homeScore} ${esc(c.home)}` : ""}</div>`;
  }
  const owner = cardOwner(c);
  const homeLeads = c.homeScore > c.awayScore, awayLeads = c.awayScore > c.homeScore;
  const side = (t, s, lead) => (lead ? `<b>${esc(t)} ${s}</b>` : `${esc(t)} ${s}`);
  const score = `<span class="score">${side(c.away, c.awayScore, awayLeads)} – ${side(c.home, c.homeScore, homeLeads)}</span>`;
  const chips = [
    ...c.impacts.map((i) => `<span class="chip ${i.owner}">${i.delta > 0 ? "+" : ""}${n1(i.delta)} · ${i.owner === "me" ? "your" : "opp"} ${esc(i.pos === "DEF" ? "D/ST" : i.pos)}</span>`),
    ...c.wp.filter((w) => Math.abs(w.after - w.before) >= 0.005).map((w) => `<span class="chip ${w.after > w.before ? "up" : "down"}">Win ${pct(w.before)} → ${pct(w.after)}</span>`),
  ];
  const name = c.name || c.offense || "";
  return `<article class="play ${owner} ${c.big ? "big" : ""} ${isNew ? "new" : ""}" data-game="${esc(c.gameId)}" data-id="${esc(c.id)}" tabindex="0" role="button" aria-label="${esc(`${name} ${c.label}, ${c.gameName}`)}">
    <div class="pmeta">${score}<span>· ${c.period > 4 ? "OT" : "Q" + c.period} ${esc(c.clock)}</span>${c.situation ? `<span>· ${esc(c.situation)}</span>` : ""}</div>
    <div class="phead"><span class="pname">${esc(name)}</span><span class="plabel">${esc(c.label)}</span>${c.td ? `<span class="badge">TD</span>` : c.turnover ? `<span class="badge">Turnover</span>` : ""}</div>
    ${c.from ? `<div class="pfrom">${esc(c.from)}</div>` : ""}
    <div class="ptext">${esc(c.text)}</div>
    ${chips.length ? `<div class="pchips">${chips.join("")}</div>` : ""}
  </article>`;
}

// A game tile for the Games grid, from tileVM(): teams and score, the state line, the stake bar (yellow =
// what's still to come for your players, purple = your opponent's), who's at stake and why the game matters.
// tileInner() is what changes on updates; the <button> itself stays.
export function tileHTML(vm) {
  return `<button class="${tileClass(vm)}" type="button" data-game="${esc(vm.id)}">${tileInner(vm)}</button>`;
}
export const tileClass = (vm) => `tile ${vm.state}${vm.hot ? " hot" : ""}`;
export function tileInner(vm) {
  const score = (t, s) => `${esc(t)}${s == null ? "" : ` <b>${s}</b>`}`;
  const bar = vm.state === "post" ? "" : vm.mineShare == null
    ? `<div class="stakebar none" aria-hidden="true"></div>`
    : `<div class="stakebar" aria-hidden="true"><span style="width:${(vm.mineShare * 100).toFixed(1)}%"></span></div>`;
  const stake = vm.mineShare == null ? "" : vm.mineShare >= 0.995 ? "All yours" : vm.mineShare <= 0.005 ? "All theirs" : `${Math.round(vm.mineShare * 100)}% yours`;
  const who = vm.players.length ? `<div class="who">${vm.players.slice(0, 3).map((p) => `<span class="${p.owner}">${esc(p.name)}</span>`).join(", ")}${vm.players.length > 3 ? ` +${vm.players.length - 3}` : ""}</div>` : "";
  return `<div class="row"><span class="teams num">${score(vm.away, vm.awayScore)} <span class="at">@</span> ${score(vm.home, vm.homeScore)}</span>${vm.hot ? `<span class="flame">Hot</span>` : ""}</div>
    <div class="meta num">${esc(vm.meta)}</div>
    ${bar}${stake ? `<span class="sr-only">Still to come: ${stake}.</span>` : ""}
    ${who}${vm.why ? `<div class="why">${esc(vm.why)}</div>` : ""}`;
}

export function kickoffText(g) {
  return new Date(g.kickoff).toLocaleString("en-US", { ...ET, weekday: "short", hour: "numeric", minute: "2-digit" });
}
