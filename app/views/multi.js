// Multi-view: up to 4 games at once. The big one shows the field and its last plays; tap a small one to make
// it big. Nothing moves by itself. "+ Add game" fills an empty spot; × takes a game out.
//   const multi = createMulti({ el, ui, store })   multi.open(ctx)  multi.update(ctx)  multi.close()

import { esc } from "./cards.js";
import { fieldSvg } from "./charts.js";
import { gameClock, kickoffShort } from "../src/view-models.js";
import { MAX_MULTI, defaultPick, swapBig, removeGame, addGame, keepKnown } from "../src/multiview.js";

const set = (el, html) => { if (el._h !== html) el.innerHTML = el._h = html; };

export function createMulti({ el, ui, store, onOpenGame }) {
  let ids = [], picking = false, ctxNow = null;
  const now = () => ui.replay?.time ?? Date.now();
  const state = (g) => (g.state === "pre" ? kickoffShort(g, now()) : g.state === "post" ? "Final" : gameClock(g));
  const score = (g) => (g.state === "pre" ? `${g.away} @ ${g.home}` : `${g.away} ${g.awayScore} @ ${g.home} ${g.homeScore}`);
  const plays = (id, n) => ui.tracker.feed().filter((c) => c.gameId === id && c.kind !== "marker").slice(0, n);
  const players = (g, snap) => snap.matchups.flatMap((m) => [...m.mine, ...m.theirs]).filter((p) => p.game?.id === g.id && p.pos !== "DEF");

  function bigHTML(g, snap) {
    const who = players(g, snap);
    return `<article class="mv-big${g.isRedZone ? " red" : ""}">
      <div class="mv-head"><button type="button" class="mv-title" data-mv-open="${esc(g.id)}"><b class="num">${esc(score(g))}</b> <span class="num">${esc(state(g))}</span></button><button type="button" class="iconbtn mv-x" data-mv-remove="${esc(g.id)}" aria-label="Take ${esc(g.away)} @ ${esc(g.home)} out">×</button></div>
      <p class="mv-sit num">${g.state === "in" && g.offense ? `${esc(g.offense)} ball${g.downText ? ` · ${esc(g.downText)}` : ""}` : ""}</p>
      ${g.state === "in" && g.offense && g.yardsToGoal != null ? fieldSvg(g) : ""}
      ${who.length ? `<p class="mv-who">${who.map((p) => `<span class="${p.owner}">${esc(p.name)}</span>`).join(", ")}</p>` : ""}
      <ol class="mv-plays">${plays(g.id, 4).map((c) => `<li><b>${esc(c.name || c.offense || "")} ${esc(c.label)}</b>${c.td ? ` <span class="badge">TD</span>` : ""}</li>`).join("") || `<li class="mv-none">No plays yet.</li>`}</ol>
    </article>`;
  }
  function smallHTML(g) {
    const last = plays(g.id, 1)[0];
    return `<div class="mv-small${g.isRedZone ? " red" : ""}"><button type="button" class="mv-pick" data-mv-big="${esc(g.id)}" aria-label="Make ${esc(g.away)} @ ${esc(g.home)} the big one">
        <b class="num">${esc(score(g))}</b><span class="num">${esc(state(g))}${g.state === "in" && g.downText ? ` · ${esc(g.downText)}` : ""}</span>
        <small>${last ? esc(`${last.name || last.offense || ""} ${last.label}`) : "No plays yet"}</small></button>
      <button type="button" class="mv-x" data-mv-remove="${esc(g.id)}" aria-label="Take ${esc(g.away)} @ ${esc(g.home)} out">×</button></div>`;
  }

  function render(ctx) {
    ctxNow = ctx;
    const games = ctx.snap.games;
    const gs = ids.map((id) => games.find((g) => g.id === id)).filter(Boolean);
    const [big, ...small] = gs;
    const others = games.filter((g) => !ids.includes(g.id)).sort((a, b) => ["in", "pre", "post"].indexOf(a.state) - ["in", "pre", "post"].indexOf(b.state));
    set(el, `<div class="layer-head"><button class="iconbtn back" type="button" data-close="layer" aria-label="Close multi-view">‹</button><div class="gtitle"><h2 id="layer-title">Multi-view</h2><p class="gt-sub">Tap a small game to make it big</p></div></div>
      <div class="mv-body">
        ${big ? bigHTML(big, ctx.snap) : `<p class="empty">Pick a game to watch.</p>`}
        <div class="mv-row">${small.map(smallHTML).join("")}${gs.length < MAX_MULTI ? `<button type="button" class="mv-add" data-mv-add aria-expanded="${picking}">+ Add game</button>` : ""}</div>
        ${picking ? `<div class="mv-list" role="list">${others.map((g) => `<button type="button" role="listitem" class="chipbtn" data-mv-addid="${esc(g.id)}">${esc(score(g))} · ${esc(state(g))}</button>`).join("")}</div>` : ""}
      </div>`);
  }
  const save = () => store.set("multi", ids);

  el.addEventListener("click", (e) => {
    const t = e.target.closest("[data-mv-big],[data-mv-remove],[data-mv-add],[data-mv-addid],[data-mv-open]");
    if (!t || !ctxNow) return;
    if (t.dataset.mvOpen) return onOpenGame(t.dataset.mvOpen);
    if (t.dataset.mvBig) ids = swapBig(ids, t.dataset.mvBig);
    else if (t.dataset.mvRemove) ids = removeGame(ids, t.dataset.mvRemove);
    else if (t.dataset.mvAddid) { ids = addGame(ids, t.dataset.mvAddid); picking = false; }
    else if (t.hasAttribute("data-mv-add")) picking = !picking;
    save(); render(ctxNow);
  });

  return {
    get isOpen() { return !el.hidden; },
    open(ctx) {
      ids = keepKnown(store.get("multi", []), ctx.snap.games);
      if (!ids.length) ids = defaultPick(ctx.ranked);
      picking = false; save(); render(ctx); el.hidden = false;
      el.querySelector(".back")?.focus({ preventScroll: true });
    },
    update(ctx) { if (!el.hidden) render(ctx); },
    close() { el.hidden = true; el.innerHTML = ""; el._h = null; },
  };
}
