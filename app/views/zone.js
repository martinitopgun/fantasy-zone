// The Zone tab: the live play feed. Filter chips (My matchup / All / Big) stay pinned at the top; the
// newest card is on top; scrolled down, new plays wait behind the "↑ N new plays" pill.
// Under the chips, "On the field": your guys (yellow) and theirs (purple) whose team has the ball right now; a
// tap opens that game. Hidden when nobody is out there.
// Free Picks (M7): open questions sit above the plays; the [Picks] chip swaps the plays for your Zone points,
// streak and every pick so far. Only with fantasy on.
// The first time someone opens the replay, a dismissible note says it's a replay, not live.

import { esc } from "./cards.js";
import { createFeedList } from "../ui/feed.js";
import { feedFilters, feedFilter, onFieldVM } from "../src/view-models.js";
import { REPLAY_NOTE } from "./sheets.js";
import { windows } from "../src/replay.js";

const EMPTY = {
  mine: "No plays for your matchup yet. They show up here the moment your players or your opponent's touch the ball.",
  all: "No plays yet. Kickoff is coming.",
  big: "No big plays yet. Touchdowns, turnovers, long gains and big swings in your win chance show up here.",
  close: "No plays from close games yet.",
};

export function createZoneView({ ui, store }) {
  let page, feed, note, firstrun, when, onfield, picknow, pickslist, feedEl, wins = [];
  const recent = new Map(); // pick id -> until when (ms) its result stays above the plays
  ui.zview ??= "feed";
  ui.when ??= store.get("when", "all");

  // When: only the plays from one kickoff window (the 1 PM games, the 4 PM games, ...), by the game's kickoff.
  function kickoffWindows() {
    if (ui.replayData) return windows(ui.replayData);
    const games = ui.tracker?.snapshot().games ?? [];
    return windows({ games, plays: games.filter((g) => g.state !== "pre").map((g) => ({ gameId: g.id })) });
  }
  function fillWhen() {
    wins = kickoffWindows();
    const opts = [["all", "All day"], ...wins.map((w) => [String(w.kickoff), `${w.label} ${w.games.length === 1 ? "game" : "games"}`])];
    if (!opts.some(([v]) => v === ui.when)) ui.when = "all";
    when.innerHTML = opts.map(([v, l]) => `<option value="${v}"${v === ui.when ? " selected" : ""}>${esc(l)}</option>`).join("");
  }
  function currentFilter() {
    const base = feedFilter(ui.filter);
    const w = wins.find((x) => String(x.kickoff) === ui.when);
    if (!w) return base;
    const ids = new Set(w.games);
    return (c) => ids.has(c.gameId) && base(c);
  }

  // The chips: My matchup / All / Big, or with fantasy off All / Big / Close games.
  function fillChips() {
    const list = feedFilters(ui.fantasyOn);
    if (!list.some(([k]) => k === ui.filter)) ui.filter = ui.fantasyOn ? "mine" : "all";
    page.querySelector(".fchips").innerHTML = list.map(([k, l]) => `<button class="chipbtn" type="button" data-filter="${k}" aria-pressed="${ui.filter === k}">${esc(l)}</button>`).join("");
  }

  function setFilter(kind) {
    ui.filter = kind;
    store.set("filter", kind);
    for (const b of page.querySelectorAll("[data-filter]")) b.setAttribute("aria-pressed", String(b.dataset.filter === kind));
    feed.setFilter(currentFilter());
  }

  function showFirstRun() {
    firstrun.hidden = !(ui.mode === "replay" && !store.get("replayNoteSeen", false));
    if (!firstrun.hidden) firstrun.querySelector("p").innerHTML = `${REPLAY_NOTE(ui.replayData?.user ?? "ontopgun")} Tap the clock at the top to jump to a kickoff or change the speed.`;
  }

  function paintOnField(ctx) {
    const list = ui.fantasyOn ? onFieldVM(ctx?.snap?.matchups[0]) : [];
    const html = list.length ? `<span class="label">On the field</span>${list.map((p) => `<button type="button" class="ofchip ${p.owner}${p.red ? " red" : ""}" data-game="${esc(p.gameId)}" aria-label="${esc(`${p.name}, ${p.owner === "me" ? "yours" : "theirs"}, has the ball${p.red ? " in the red zone" : ""}. Open his game`)}">${esc(p.name.split(" ").slice(1).join(" ") || p.name)}<small>${esc(p.pos)}</small></button>`).join("")}` : "";
    if (onfield._h !== html) { onfield.innerHTML = onfield._h = html; onfield.hidden = !html; }
  }

  // ---------- Free Picks ----------
  const label = (p, k) => p.options.find(([x]) => x === k)?.[1] ?? k;
  function pickHTML(p) {
    const status = p.state === "open" ? (p.kind === "drive" ? "locks at the next snap" : "locks at kickoff")
      : p.state === "locked" ? `locked in: ${label(p, p.choice)}` : p.state === "missed" ? "no pick" : "";
    const result = p.state === "right" ? `<p class="pk-res right">Right! +10</p>`
      : p.state === "wrong" ? `<p class="pk-res wrong">Not this time: ${esc(label(p, p.answer))}</p>` : "";
    return `<article class="pick ${p.state}">
      <p class="pk-meta"><span class="pk-tag">Pick</span> ${esc(p.game)}${status ? ` · ${esc(status)}` : ""}</p>
      <p class="pk-q">${esc(p.q)}</p>
      ${p.state === "open" || p.state === "locked" ? `<div class="pk-opts" role="group" aria-label="${esc(p.q)}">${p.options.map(([k, l]) => `<button class="chipbtn" type="button" data-pickc="${esc(p.id)}" data-key="${k}" aria-pressed="${p.choice === k}"${p.state !== "open" ? " disabled" : ""}>${esc(l)}</button>`).join("")}</div>` : ""}
      ${result}
    </article>`;
  }
  function paintPicks() {
    const on = !!ui.picks && ui.fantasyOn;
    const showList = on && ui.zview === "picks";
    page.querySelector("[data-zpicks]").hidden = !on;
    page.querySelector("[data-zpicks]").setAttribute("aria-pressed", String(showList));
    for (const b of page.querySelectorAll("[data-filter]")) b.setAttribute("aria-pressed", String(!showList && b.dataset.filter === ui.filter));
    feedEl.hidden = showList;
    pickslist.hidden = !showList;
    if (!on) { picknow.hidden = true; return; }
    const now = Date.now();
    const list = ui.picks.list();
    for (const p of list) if ((p.state === "open" || p.state === "locked") && !recent.has(p.id)) recent.set(p.id, Infinity);
    for (const [id, until] of recent) {
      const p = list.find((x) => x.id === id);
      if (!p) recent.delete(id);
      else if (until === Infinity && p.state !== "open" && p.state !== "locked") recent.set(id, now + 10_000); // show the result a moment
      else if (until < now) recent.delete(id);
    }
    const top = list.filter((p) => recent.has(p.id) && p.state !== "missed");
    const html = top.map(pickHTML).join("");
    if (picknow._h !== html) picknow.innerHTML = picknow._h = html;
    picknow.hidden = !html || showList;
    if (showList) {
      const sc = ui.picks.score();
      const rows = list.filter((p) => p.state !== "missed").slice(0, 40);
      const body = `<div class="pk-score"><span><b class="num">${sc.points}</b> Zone points</span><span><b class="num">${sc.streak}</b> streak</span><span><b class="num">${sc.best}</b> best</span></div>
        <p class="sheet-note">Free Picks: call how a drive in your matchup ends, or whether a starter reaches his projection. Right = +10. Just for fun: points only, nothing to buy. New picks show up at 5× or slower.</p>
        ${rows.length ? rows.map(pickHTML).join("") : `<p class="empty">No picks yet. They pop up when a drive with your or your opponent's players gets inside the 20, and before kickoffs.</p>`}`;
      if (pickslist._h !== body) pickslist.innerHTML = pickslist._h = body;
    }
  }

  return {
    mount(el) {
      page = el;
      page.insertAdjacentHTML("beforeend", `
        <div class="page-head">
          <div class="colhead"><h2 class="coltitle" id="col-zone" tabindex="-1">Zone</h2><span class="colpick-slot"></span></div>
          <div class="filters" role="group" aria-label="Which plays">
            <span class="fchips"></span>
            <button class="chipbtn pickschip" type="button" data-zpicks aria-pressed="false">Picks</button>
            <label class="when"><span class="sr-only">When</span><select data-when aria-label="Which kickoff window"></select></label>
          </div>
          <div class="onfield" data-onfield hidden></div>
          <p class="note" data-note hidden></p>
          <button class="newpill" type="button" hidden></button>
        </div>
        <aside class="firstrun" data-firstrun hidden aria-label="About the replay">
          <p></p><button class="chipbtn" type="button" data-dismiss>Got it</button>
        </aside>
        <section class="picknow" data-picknow hidden aria-label="Free Picks"></section>
        <div data-feed></div>
        <section class="pickslist" data-pickslist hidden aria-label="Your picks"></section>`);
      note = page.querySelector("[data-note]");
      firstrun = page.querySelector("[data-firstrun]");
      onfield = page.querySelector("[data-onfield]");
      picknow = page.querySelector("[data-picknow]");
      pickslist = page.querySelector("[data-pickslist]");
      feedEl = page.querySelector("[data-feed]");
      fillChips();
      when = page.querySelector("[data-when]");
      when.addEventListener("change", () => { ui.when = when.value; store.set("when", ui.when); feed.setFilter(currentFilter()); });
      feed = createFeedList(page.querySelector("[data-feed]"), {
        root: page,
        source: () => ui.tracker?.feed() ?? [],
        filter: (c) => currentFilter()(c),
        pill: page.querySelector(".newpill"),
        emptyText: () => (ui.tracker ? EMPTY[ui.filter] ?? EMPTY.all : "Loading…"),
      });
      page.addEventListener("click", (e) => {
        const f = e.target.closest("[data-filter]");
        if (f && ui.zview === "picks") { ui.zview = "feed"; paintPicks(); }
        if (f && f.dataset.filter !== ui.filter) return setFilter(f.dataset.filter);
        if (e.target.closest("[data-dismiss]")) { firstrun.hidden = true; store.set("replayNoteSeen", true); }
        if (e.target.closest("[data-zpicks]")) { ui.zview = ui.zview === "picks" ? "feed" : "picks"; return paintPicks(); }
        const c = e.target.closest("[data-pickc]");
        if (c && ui.picks?.choose(c.dataset.pickc, c.dataset.key)) paintPicks();
      });
    },
    reset(ctx) { fillWhen(); feed.reset(); showFirstRun(); recent.clear(); if (ctx) paintOnField(ctx); paintPicks(); },
    update(ctx, fresh) { if (fresh?.length) feed.add(fresh); paintOnField(ctx); paintPicks(); },
    // Fantasy turned on or off: new chips (keeping your pick when it still exists), on-the-field line.
    fantasyChanged(ctx) {
      fillChips();
      feed.setFilter(currentFilter());
      if (ctx) paintOnField(ctx);
      paintPicks();
    },
    // A one-line note under the chips, e.g. why a deep link landed here. null clears it.
    note(html) { note.hidden = !html; note.innerHTML = html ?? ""; },
  };
}
