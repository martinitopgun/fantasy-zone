// The Zone tab: the live play feed. Filter chips (My matchup / All / Big) stay pinned at the top; the
// newest card is on top; scrolled down, new plays wait behind the "↑ N new plays" pill.
// Under the chips, "On the field": your guys (yellow) and theirs (purple) whose team has the ball right now; a
// tap opens that game. Hidden when nobody is out there.
// The first time someone opens the replay, a dismissible note says it's a replay, not live.

import { esc } from "./cards.js";
import { createFeedList } from "../ui/feed.js";
import { FEED_FILTERS, feedFilter, onFieldVM } from "../src/view-models.js";
import { REPLAY_NOTE } from "./sheets.js";
import { windows } from "../src/replay.js";

const EMPTY = {
  mine: "No plays for your matchup yet. They show up here the moment your players or your opponent's touch the ball.",
  all: "No plays yet. Kickoff is coming.",
  big: "No big plays yet. Touchdowns, turnovers, long gains and big swings in your win chance show up here.",
};

export function createZoneView({ ui, store }) {
  let page, feed, note, firstrun, when, onfield, wins = [];
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

  return {
    mount(el) {
      page = el;
      page.insertAdjacentHTML("beforeend", `
        <div class="page-head">
          <div class="colhead"><h2 class="coltitle" id="col-zone" tabindex="-1">Zone</h2><span class="colpick-slot"></span></div>
          <div class="filters" role="group" aria-label="Which plays">
            ${FEED_FILTERS.map(([k, l]) => `<button class="chipbtn" type="button" data-filter="${k}" aria-pressed="${ui.filter === k}">${esc(l)}</button>`).join("")}
            <label class="when"><span class="sr-only">When</span><select data-when aria-label="Which kickoff window"></select></label>
          </div>
          <div class="onfield" data-onfield hidden></div>
          <p class="note" data-note hidden></p>
          <button class="newpill" type="button" hidden></button>
        </div>
        <aside class="firstrun" data-firstrun hidden aria-label="About the replay">
          <p></p><button class="chipbtn" type="button" data-dismiss>Got it</button>
        </aside>
        <div data-feed></div>`);
      note = page.querySelector("[data-note]");
      firstrun = page.querySelector("[data-firstrun]");
      onfield = page.querySelector("[data-onfield]");
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
        if (f && f.dataset.filter !== ui.filter) return setFilter(f.dataset.filter);
        if (e.target.closest("[data-dismiss]")) { firstrun.hidden = true; store.set("replayNoteSeen", true); }
      });
    },
    reset(ctx) { fillWhen(); feed.reset(); showFirstRun(); if (ctx) paintOnField(ctx); },
    update(ctx, fresh) { if (fresh?.length) feed.add(fresh); paintOnField(ctx); },
    // A one-line note under the chips, e.g. why a deep link landed here. null clears it.
    note(html) { note.hidden = !html; note.innerHTML = html ?? ""; },
  };
}
