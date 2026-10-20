// One game, opened on top of the tabs (on a wide screen it covers only the last column).
//   Head:  ‹ (× on a wide screen) · "CHI 14 @ ATL 0  Q2 12:08" · [‹][›] the previous / next live game
//          (in the order the game chips had when you opened it; it never reshuffles while you look)
//   Field: who has the ball and where (a mini field), or the kickoff time, or Final
//   Then:  the game's own tabs, swipe or tap: Plays (All / Scoring / My players) · Drives · Box (live,
//          unofficial, from the plays so far) · My guys · Info (what was expected, the momentum line, and live:
//          the stadium and injuries). The tab you're on stays picked when you switch games.
// Everything is updated in place; the head's buttons are never rebuilt, so a tap always lands and focus
// stays put when you switch games.
//
//   const layer = createGameLayer({ el, ui, order })   order(): game ids for ‹ › (frozen at open by app.js)
//   layer.open(id, ctx) -> false when there's no such game     layer.close()     layer.id
//   layer.update(ctx, freshCards)    layer.reset(ctx) (a jump: same game, fresh plays)

import { esc, pct, n1 } from "./cards.js";
import { fieldSvg, momentumSvg } from "./charts.js";
import { createFeedList } from "../ui/feed.js";
import { createPager } from "../ui/pager.js";
import { gameClock, kickoffShort, expectText } from "../src/view-models.js";
import { drives } from "../src/drives.js";

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

// Drives, newest first: who had it, how it ended, "8 plays · 75 yds · 4:12".
const RESULT = { TD: "TD", FG: "FG", PUNT: "Punt", INT: "Interception", FUMBLE: "Fumble", "MISSED FG": "Missed FG", DOWNS: "Downs", SAFETY: "Safety", "END OF HALF": "End of half", "END OF GAME": "End of game" };
function drivesHTML(plays) {
  const list = drives(plays).reverse();
  if (!list.length) return "";
  return `<ol class="drives">${list.map((d) => {
    const first = d.plays[0];
    return `<li class="drive${d.result === "TD" || d.result === "FG" ? " score" : ""}">
      <span class="dteam">${esc(d.team)}</span>
      <span class="dmain"><b>${esc(d.result ? RESULT[d.result] ?? d.result : "On the field")}</b><small class="num">${esc(d.text)}</small></span>
      <span class="dwhen num">${first.period > 4 ? "OT" : `Q${first.period}`} ${esc(first.clock)}</span></li>`;
  }).join("")}</ol>`;
}

// Box score from the plays so far. Your players in yellow, your opponent's in purple.
function boxHTML(g, box, owners) {
  if (!box) return "";
  const n = (l, k) => l?.[k] ?? 0;
  const who = (p) => `<td class="tl ${owners.get(p.id) ?? ""}">${esc(p.name)}</td>`;
  const table = (title, head, rows) => (rows.length ? `<table class="box"><caption>${title}</caption><thead><tr><th class="tl"></th>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>` : "");
  const team = (t) => {
    const ps = box[t] ?? [];
    const pass = ps.filter((p) => n(p.line, "pass_att")).sort((a, b) => n(b.line, "pass_yd") - n(a.line, "pass_yd"))
      .map((p) => `<tr>${who(p)}<td>${n(p.line, "pass_cmp")}/${n(p.line, "pass_att")}</td><td>${n(p.line, "pass_yd")}</td><td>${n(p.line, "pass_td")}</td><td>${n(p.line, "pass_int")}</td></tr>`);
    const rush = ps.filter((p) => n(p.line, "rush_att")).sort((a, b) => n(b.line, "rush_yd") - n(a.line, "rush_yd"))
      .map((p) => `<tr>${who(p)}<td>${n(p.line, "rush_att")}</td><td>${n(p.line, "rush_yd")}</td><td>${n(p.line, "rush_td")}</td></tr>`);
    const rec = ps.filter((p) => n(p.line, "rec") || n(p.line, "rec_tgt")).sort((a, b) => n(b.line, "rec_yd") - n(a.line, "rec_yd"))
      .map((p) => `<tr>${who(p)}<td>${n(p.line, "rec")}</td><td>${n(p.line, "rec_yd")}</td><td>${n(p.line, "rec_td")}</td></tr>`);
    const body = table("Passing", ["C/ATT", "YDS", "TD", "INT"], pass) + table("Rushing", ["CAR", "YDS", "TD"], rush) + table("Receiving", ["REC", "YDS", "TD"], rec);
    return `<section class="boxteam"><h3 class="label">${esc(t)}</h3>${body || `<p class="empty">No stats yet.</p>`}</section>`;
  };
  return `<p class="sheet-note">Live, unofficial: added up from the plays so far.</p>${team(g.away)}${team(g.home)}`;
}

// What was expected before kickoff, and (live) where it's played and who's hurt.
function infoHTML(g, mo) {
  const expect = expectText(g);
  const venue = g.venue ? `<p class="info-line">${esc(g.venue.name)}${g.venue.city ? ` · ${esc(g.venue.city)}${g.venue.state ? `, ${esc(g.venue.state)}` : ""}` : ""}</p>` : "";
  const hurt = (g.injuries ?? []).length ? `<h3 class="label">Injuries</h3><ul class="injuries">${g.injuries.map((i) => `<li><b>${esc(i.team)}</b> ${esc(i.name)} ${esc(i.pos)} · ${esc(i.status)}</li>`).join("")}</ul>` : "";
  return `${expect ? `<p class="info-line">${esc(expect)}</p>` : ""}${venue}
    ${mo.length > 1 ? momentumSvg(g, mo) : `<p class="empty">The momentum line starts with the first play.</p>`}${hurt}`;
}

const SUBTABS = [["plays", "Plays"], ["drives", "Drives"], ["box", "Box"], ["guys", "My guys"], ["info", "Info"]];
const PLAY_FILTERS = [["all", "All", () => true], ["scoring", "Scoring", (c) => c.scored], ["mine", "My players", (c) => c.impacts.length > 0]];

export function createGameLayer({ el, ui, order = () => [] }) {
  let id = null, feed = null, parts = null, pager = null;
  const playFilter = () => PLAY_FILTERS.find((f) => f[0] === (ui.gamePlays ?? "all"))[2];
  const now = () => ui.replay?.time ?? Date.now();

  function skeleton() {
    el.innerHTML = `
      <div class="layer-head">
        <button class="iconbtn back" type="button" data-close="layer" aria-label="Close this game"><span class="ph" aria-hidden="true">‹</span><span class="dk" aria-hidden="true">×</span></button>
        <div class="gtitle"><h2 id="layer-title"><span class="gt-name num"></span> <span class="gt-clock num"></span></h2><p class="gt-sub num"></p></div>
        <button class="chipbtn pinbtn" type="button" data-act="pin" aria-pressed="false">Pin</button>
        <span class="seg gnav" role="group" aria-label="Other live games">
          <button type="button" data-step="-1">${CHEV(-1)}</button><button type="button" data-step="1">${CHEV(1)}</button>
        </span>
      </div>
      <div class="layer-field" data-field></div>
      <nav class="tabbar subtabs" role="tablist" aria-label="This game">
        ${SUBTABS.map(([k, l]) => `<button type="button" role="tab" id="gtab-${k}" aria-controls="gpage-${k}" aria-selected="false" tabindex="-1">${l}</button>`).join("")}
        <span class="ink" aria-hidden="true"></span>
      </nav>
      <div class="pager subpager">
        <section class="page" id="gpage-plays" role="tabpanel" aria-labelledby="gtab-plays">
          <div class="page-head">
            <div class="filters" role="group" aria-label="Which plays">
              ${PLAY_FILTERS.map(([k, l]) => `<button class="chipbtn" type="button" data-gplays="${k}" aria-pressed="${(ui.gamePlays ?? "all") === k}">${l}</button>`).join("")}
            </div>
            <button class="newpill" type="button" hidden></button>
          </div>
          <div data-feed></div>
        </section>
        <section class="page" id="gpage-drives" role="tabpanel" aria-labelledby="gtab-drives"><div class="gdrives" data-drives></div></section>
        <section class="page" id="gpage-box" role="tabpanel" aria-labelledby="gtab-box"><div class="gbox" data-box></div></section>
        <section class="page" id="gpage-guys" role="tabpanel" aria-labelledby="gtab-guys"><div class="gguys" data-guys></div></section>
        <section class="page" id="gpage-info" role="tabpanel" aria-labelledby="gtab-info"><div class="ginfo" data-info></div></section>
      </div>`;
    parts = {
      name: el.querySelector(".gt-name"), clock: el.querySelector(".gt-clock"), sub: el.querySelector(".gt-sub"),
      pin: el.querySelector('[data-act="pin"]'),
      prev: el.querySelector('[data-step="-1"]'), next: el.querySelector('[data-step="1"]'),
      field: el.querySelector("[data-field]"), guys: el.querySelector("[data-guys]"), info: el.querySelector("[data-info]"),
      drives: el.querySelector("[data-drives]"), box: el.querySelector("[data-box]"),
      plays: el.querySelector("#gpage-plays"), feed: el.querySelector("[data-feed]"), pill: el.querySelector(".newpill"),
    };
    const tabs = [...el.querySelectorAll('.subtabs [role="tab"]')], pages = [...el.querySelectorAll(".subpager > .page")];
    pager = createPager({
      tabbar: el.querySelector(".subtabs"), pager: el.querySelector(".subpager"), tabs, pages,
      onSettle: (i) => { ui.gameSub = SUBTABS[i][0]; },
      onReselect: (i) => pages[i].scrollTo({ top: 0 }),
    });
    el.addEventListener("click", (e) => {
      const b = e.target.closest("[data-gplays]");
      if (!b || b.dataset.gplays === (ui.gamePlays ?? "all")) return;
      ui.gamePlays = b.dataset.gplays;
      for (const x of el.querySelectorAll("[data-gplays]")) x.setAttribute("aria-pressed", String(x === b));
      feed?.setFilter((c) => c.gameId === id && playFilter()(c));
    });
  }

  // The parts that change with every play.
  function paint(g, ctx) {
    text(parts.name, scoreName(g));
    text(parts.clock, stateText(g, now()));
    text(parts.sub, subText(g, now()));
    const pinned = ui.pin === g.id;
    if (parts.pin.getAttribute("aria-pressed") !== String(pinned)) {
      parts.pin.setAttribute("aria-pressed", String(pinned));
      parts.pin.textContent = pinned ? "Pinned" : "Pin";
      parts.pin.setAttribute("aria-label", pinned ? "Unpin this game" : "Pin this game's score to the top of every tab");
    }
    set(parts.field, g.state === "in" && g.offense && g.yardsToGoal != null ? fieldSvg(g) : "");
    parts.field.hidden = !parts.field._h;
    set(parts.guys, guysHTML(g, ctx.snap) || `<p class="empty">Nobody in your matchup plays in this game.</p>`);
    set(parts.info, infoHTML(g, ui.tracker.momentum(g.id)));
    set(parts.drives, drivesHTML(ui.tracker.plays(g.id)) || `<p class="empty">${g.state === "pre" ? `No drives yet. Kickoff is ${kickoffShort(g, now())}.` : "No drives yet."}</p>`);
    const owners = new Map(ctx.snap.matchups.flatMap((m) => [...m.mine, ...m.theirs]).map((p) => [p.id, p.owner]));
    set(parts.box, g.state === "pre" ? `<p class="empty">The box score starts at kickoff.</p>` : boxHTML(g, ui.tracker.box(g.id), owners));
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
    const fresh = !parts;
    if (fresh) skeleton();
    id = gid;
    feed?.destroy();
    parts.guys._h = parts.info._h = parts.drives._h = parts.box._h = parts.field._h = null;
    paint(g, ctx);
    feed = createFeedList(parts.feed, {
      root: parts.plays,
      source: () => ui.tracker.feed(),
      filter: (c) => c.gameId === gid && playFilter()(c),
      pill: parts.pill,
      emptyText: () => (g.state === "pre" ? `No plays yet. Kickoff is ${kickoffShort(g, now())}.` : "No plays yet."),
    });
    feed.reset();
    for (const pg of el.querySelectorAll(".subpager > .page")) pg.scrollTop = 0;
    if (fresh) pager.start(Math.max(0, SUBTABS.findIndex((t) => t[0] === (ui.gameSub ?? "plays"))));
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
    close() { id = null; feed?.destroy(); feed = null; pager?.destroy(); pager = null; parts = null; el.hidden = true; el.innerHTML = ""; },
    get swiping() { return pager?.state.swiping ?? false; },
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
