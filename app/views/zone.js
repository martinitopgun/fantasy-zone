// The Zone tab: the live play feed. Filter chips (My matchup / All / Big) stay pinned at the top; the
// newest card is on top; scrolled down, new plays wait behind the "↑ N new plays" pill.
// The first time someone opens the replay, a dismissible note says it's a replay, not live.

import { esc } from "./cards.js";
import { createFeedList } from "../ui/feed.js";
import { FEED_FILTERS, feedFilter } from "../src/view-models.js";
import { REPLAY_NOTE } from "./sheets.js";

const EMPTY = {
  mine: "No plays for your matchup yet. They show up here the moment your players or your opponent's touch the ball.",
  all: "No plays yet. Kickoff is coming.",
  big: "No big plays yet. Touchdowns, turnovers, long gains and big swings in your win chance show up here.",
};

export function createZoneView({ ui, store }) {
  let page, feed, note, firstrun;

  function setFilter(kind) {
    ui.filter = kind;
    store.set("filter", kind);
    for (const b of page.querySelectorAll("[data-filter]")) b.setAttribute("aria-pressed", String(b.dataset.filter === kind));
    feed.setFilter(feedFilter(kind));
  }

  function showFirstRun() {
    firstrun.hidden = !(ui.mode === "replay" && !store.get("replayNoteSeen", false));
    if (!firstrun.hidden) firstrun.querySelector("p").innerHTML = `${REPLAY_NOTE(ui.replayData?.user ?? "ontopgun")} Tap the clock at the top to jump to a kickoff or change the speed.`;
  }

  return {
    mount(el) {
      page = el;
      page.insertAdjacentHTML("beforeend", `
        <div class="page-head">
          <div class="colhead"><h2 class="coltitle" id="col-zone" tabindex="-1">Zone</h2><span class="colpick-slot"></span></div>
          <div class="filters" role="group" aria-label="Which plays">
            ${FEED_FILTERS.map(([k, l]) => `<button class="chipbtn" type="button" data-filter="${k}" aria-pressed="${ui.filter === k}">${esc(l)}</button>`).join("")}
          </div>
          <p class="note" data-note hidden></p>
          <button class="newpill" type="button" hidden></button>
        </div>
        <aside class="firstrun" data-firstrun hidden aria-label="About the replay">
          <p></p><button class="chipbtn" type="button" data-dismiss>Got it</button>
        </aside>
        <div data-feed></div>`);
      note = page.querySelector("[data-note]");
      firstrun = page.querySelector("[data-firstrun]");
      feed = createFeedList(page.querySelector("[data-feed]"), {
        root: page,
        source: () => ui.tracker?.feed() ?? [],
        filter: feedFilter(ui.filter),
        pill: page.querySelector(".newpill"),
        emptyText: () => (ui.tracker ? EMPTY[ui.filter] ?? EMPTY.all : "Loading…"),
      });
      page.addEventListener("click", (e) => {
        const f = e.target.closest("[data-filter]");
        if (f && f.dataset.filter !== ui.filter) return setFilter(f.dataset.filter);
        if (e.target.closest("[data-dismiss]")) { firstrun.hidden = true; store.set("replayNoteSeen", true); }
      });
    },
    reset() { feed.reset(); showFirstRun(); },
    update(ctx, fresh) { if (fresh?.length) feed.add(fresh); },
    // A one-line note under the chips, e.g. why a deep link landed here. null clears it.
    note(html) { note.hidden = !html; note.innerHTML = html ?? ""; },
  };
}
