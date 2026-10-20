// One game, opened on top of the tabs (on a wide screen it covers only the last column).
//   Head:  ‹ (× on a wide screen) · "CHI 14 @ ATL 0  Q2 12:08" · [‹][›] the previous / next live game
//          (in the order the game chips had when you opened it; it never reshuffles while you look)
//   Field: who has the ball and where (a mini field), or the kickoff time, or Final
//   Then:  your matchup's players in this game, the momentum line, and the game's plays (newest on top).
// The game's own swipeable tabs (Plays, My guys, Momentum) arrive in the next step; until then these sit
// one under the other, the short ones first. Everything is updated in place; the head's buttons are never
// rebuilt, so a tap always lands and focus stays put when you switch games.
//
//   const layer = createGameLayer({ el, ui, order })   order(): game ids for ‹ › (frozen at open by app.js)
//   layer.open(id, ctx) -> false when there's no such game     layer.close()     layer.id
//   layer.update(ctx, freshCards)    layer.reset(ctx) (a jump: same game, fresh plays)

import { esc, pct, n1 } from "./cards.js";
import { fieldSvg, momentumSvg } from "./charts.js";
import { createFeedList } from "../ui/feed.js";
import { gameClock, kickoffShort } from "../src/view-models.js";

const set = (el, html) => { if (el && el._h !== html) el.innerHTML = el._h = html; };
const text = (el, t) => { if (el && el.textContent !== t) el.textContent = t; };
const CHEV = (d) => `<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="${d < 0 ? "M7.5 2.5 4 6l3.5 3.5" : "M4.5 2.5 8 6l-3.5 3.5"}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export const gameName = (g) => `${g.away} @ ${g.home}`;
const scoreName = (g) => (g.state === "pre" ? gameName(g) : `${g.away} ${g.awayScore} @ ${g.home} ${g.homeScore}`);
const stateText = (g, now) => (g.state === "pre" ? kickoffShort(g, now) : g.state === "post" ? "Final" : gameClock(g));

function subText(g, now) {
  if (g.state === "pre") return `Kickoff ${kickoffShort(g, now)}`;
  if (g.state === "post") return "Final";
  const ball = g.offense ? `${g.offense} ball${g.downText ? ` · ${g.downText}` : ""}` : "";
  const wp = g.homeWinProb != null ? `${g.home} win ${pct(g.homeWinProb)}` : "";
  return [ball, wp].filter(Boolean).join(" · ");
}

function guysHTML(g, snap) {
  const players = snap.matchups.flatMap((m) => [...m.mine, ...m.theirs]).filter((p) => p.game?.id === g.id)
    .sort((a, b) => (a.owner === "me" ? 0 : 1) - (b.owner === "me" ? 0 : 1) || b.current - a.current);
  if (!players.length) return "";
  return `<div class="section-title"><span class="label">Your matchup in this game</span></div>
    <div class="stakes">${players.map((p) => `<div class="stake ${p.owner}">
      <span class="pos">${esc(p.pos === "DEF" ? "D/ST" : p.pos)}</span>
      <span class="who">${esc(p.name)} <small>· ${p.owner === "me" ? "yours" : "theirs"}</small></span>
      <span class="now num">${n1(p.current)}</span>
      <span class="left num">${g.state === "post" ? "final" : `+${n1(Math.max(0, p.remaining))} exp`}</span></div>`).join("")}</div>`;
}

export function createGameLayer({ el, ui, order = () => [] }) {
  let id = null, feed = null, parts = null;
  const now = () => ui.replay?.time ?? Date.now();

  function skeleton() {
    el.innerHTML = `
      <div class="layer-head">
        <button class="iconbtn back" type="button" data-close="layer" aria-label="Close this game"><span class="ph" aria-hidden="true">‹</span><span class="dk" aria-hidden="true">×</span></button>
        <div class="gtitle"><h2 id="layer-title"><span class="gt-name num"></span> <span class="gt-clock num"></span></h2><p class="gt-sub num"></p></div>
        <span class="seg gnav" role="group" aria-label="Other live games">
          <button type="button" data-step="-1">${CHEV(-1)}</button><button type="button" data-step="1">${CHEV(1)}</button>
        </span>
      </div>
      <div class="layer-field" data-field></div>
      <div class="layer-body">
        <div class="layer-pillbar"><button class="newpill" type="button" hidden></button></div>
        <section class="gguys" data-guys></section>
        <section class="gmomentum" data-momentum></section>
        <div class="section-title gplays-title"><span class="label">Plays</span></div>
        <div data-feed></div>
      </div>`;
    parts = {
      name: el.querySelector(".gt-name"), clock: el.querySelector(".gt-clock"), sub: el.querySelector(".gt-sub"),
      prev: el.querySelector('[data-step="-1"]'), next: el.querySelector('[data-step="1"]'),
      field: el.querySelector("[data-field]"), guys: el.querySelector("[data-guys]"), momentum: el.querySelector("[data-momentum]"),
      body: el.querySelector(".layer-body"), feed: el.querySelector("[data-feed]"), pill: el.querySelector(".newpill"),
    };
  }

  // The parts that change with every play.
  function paint(g, ctx) {
    text(parts.name, scoreName(g));
    text(parts.clock, stateText(g, now()));
    text(parts.sub, subText(g, now()));
    set(parts.field, g.state === "in" && g.offense && g.yardsToGoal != null ? fieldSvg(g) : "");
    parts.field.hidden = !parts.field._h;
    set(parts.guys, guysHTML(g, ctx.snap));
    const mo = ui.tracker.momentum(g.id);
    set(parts.momentum, mo.length > 1 ? momentumSvg(g, mo) : "");
    // ‹ › go round the frozen order (from the last game, › goes back to the first).
    const ids = order(), k = ids.indexOf(g.id);
    const pick = (step) => {
      if (!ids.length) return null;
      const to = k < 0 ? (step > 0 ? ids[0] : ids.at(-1)) : ids[(k + step + ids.length) % ids.length];
      return to === g.id ? null : ctx.snap.games.find((x) => x.id === to) ?? null;
    };
    for (const [btn, step] of [[parts.prev, -1], [parts.next, 1]]) {
      const tg = pick(step), word = step < 0 ? "Previous" : "Next";
      const label = tg ? `${word} live game: ${gameName(tg)}` : `${word} live game (no other game is on)`;
      btn.disabled = !tg;
      if (btn.getAttribute("aria-label") !== label) { btn.setAttribute("aria-label", label); btn.title = label; }
      btn.dataset.to = tg?.id ?? "";
    }
  }

  // Show game `gid`: the head stays (so focus does too), the rest starts over at the top.
  function fill(gid, ctx) {
    const g = ctx.snap.games.find((x) => x.id === gid);
    if (!g) return false;
    if (!parts) skeleton();
    id = gid;
    feed?.destroy();
    parts.guys._h = parts.momentum._h = parts.field._h = null;
    paint(g, ctx);
    feed = createFeedList(parts.feed, {
      root: parts.body,
      source: () => ui.tracker.feed(),
      filter: (c) => c.gameId === gid,
      pill: parts.pill,
      emptyText: () => (g.state === "pre" ? `No plays yet. Kickoff is ${kickoffShort(g, now())}.` : "No plays yet."),
    });
    feed.reset();
    parts.body.scrollTop = 0;
    return true;
  }

  return {
    get id() { return id; },
    get feed() { return feed; },
    open(gid, ctx) {
      if (!fill(gid, ctx)) return false;
      el.hidden = false;
      return true;
    },
    close() { id = null; feed?.destroy(); feed = null; parts = null; el.hidden = true; el.innerHTML = ""; },
    reset(ctx) { return !id || fill(id, ctx); },
    update(ctx, fresh) {
      if (!id) return;
      const g = ctx.snap.games.find((x) => x.id === id);
      if (!g) return;
      paint(g, ctx);
      if (fresh?.length) feed.add(fresh);
    },
  };
}
