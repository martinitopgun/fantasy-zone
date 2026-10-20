// The League tab (plan M6): the whole league, play by play.
//   [Matchups]  all 5 pairings with points now and a win bar; yours first. Tap one to see both lineups.
//   [Standings] records through last week (then points for), with this week's W/L as it stands.
//   [Moves]     the latest adds, drops and trades, never anything later than the replay clock.
// Usernames only (team names in a league can be anything). Changed in place on each update.

import { esc, pct, n1 } from "./cards.js";
import { liveMatchups, standings } from "../src/league.js";

const set = (el, html) => { if (el._h !== html) el.innerHTML = el._h = html; };
const VIEWS = [["matchups", "Matchups"], ["standings", "Standings"], ["moves", "Moves"]];
const when = (t) => new Date(t).toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "2-digit" });

export function createLeagueView({ ui }) {
  let page, body;
  ui.lview ??= "matchups";
  const open = new Set(); // matchups showing their lineups

  const league = () => ui.replayData?.leagues?.[0];
  // Whose side a team is on in your matchup: yellow for you, purple for your opponent.
  const tone = (t, oppId) => (t.me ? "me" : t.roster_id === oppId ? "opponent" : "");

  function matchupsHTML(L, lm) {
    const pts = open.size ? ui.tracker.pointsById(L.scoring) : {};
    const oppId = lm.find((m) => m.mine)?.b.roster_id;
    return lm.map((m, i) => {
      const side = (t) => `<span class="lteam ${tone(t, oppId)}"><span class="lown">${esc(t.owner)}</span><b class="num">${n1(t.now)}</b><small class="num">proj ${n1(t.final)}</small></span>`;
      const left = m.a.playing + m.b.playing, toPlay = m.a.toPlay + m.b.toPlay;
      const meta = m.done ? "Final" : [left ? `${left} playing` : "", toPlay ? `${toPlay} yet to play` : ""].filter(Boolean).join(" · ");
      const key = `${m.a.roster_id}-${m.b.roster_id}`, isOpen = open.has(key);
      const lineup = (t) => t.starters.map((p) => `<li><span>${esc(p.name)}</span><b class="num">${n1(pts[p.id] ?? 0)}</b></li>`).join("");
      return `<article class="lmatch${m.mine ? " mine" : ""}">
        <button class="lmhead" type="button" data-lm="${key}" aria-expanded="${isOpen}">
          ${side(m.a)}<span class="lvs" aria-hidden="true">vs</span>${side(m.b)}
        </button>
        <div class="lbar" aria-hidden="true"><span style="width:${(m.aWin * 100).toFixed(1)}%"></span></div>
        <p class="lmeta num"><span>${esc(meta)}</span><span>${esc(m.a.owner)} ${pct(m.aWin)}</span></p>
        ${isOpen ? `<div class="llineups"><ol>${lineup(m.a)}</ol><ol>${lineup(m.b)}</ol></div>${m.mine ? `<button class="chipbtn" type="button" data-act="goto-matchup">Open your matchup ›</button>` : ""}` : ""}
      </article>`;
    }).join("");
  }

  function standingsHTML(L, lm) {
    const oppId = lm.find((m) => m.mine)?.b.roster_id;
    const rows = standings(L.results, L.teams, lm);
    return `<table class="ltable"><thead><tr><th>#</th><th class="tl">Team</th><th>W-L</th><th>PF</th><th>Now</th></tr></thead><tbody>
      ${rows.map((s, i) => `<tr class="${tone(s, oppId)}"><td class="num">${i + 1}</td><td class="tl">${esc(s.owner)}</td><td class="num">${s.w}-${s.l}${s.t ? `-${s.t}` : ""}</td><td class="num">${n1(s.pf)}</td><td><span class="lnow ${s.now ?? ""}">${s.now ?? ""}</span></td></tr>`).join("")}
      </tbody></table>
      <p class="sheet-note">Record through week 5. "Now" is this week's matchup as it stands.</p>`;
  }

  function movesHTML(L) {
    const now = ui.replay?.time ?? Date.now();
    const owner = new Map(L.teams.map((t) => [t.roster_id, t.owner]));
    const names = (list) => list.map((x) => esc(x.name)).join(", ");
    const items = L.moves.filter((m) => m.t <= now).slice(0, 30).map((m) => {
      let text;
      if (m.type === "trade") {
        const got = (rid) => m.adds.filter((a) => a.roster_id === rid);
        text = `<b>${m.roster_ids.map((r) => esc(owner.get(r))).join(" and ")}</b> traded: ${m.roster_ids.map((r) => `${esc(owner.get(r))} got ${got(r).length ? names(got(r)) : "FAAB"}`).join(" · ")}`;
      } else {
        const who = esc(owner.get(m.roster_ids[0]));
        const add = m.adds.length ? `added ${names(m.adds)}${m.type === "waiver" && m.bid ? ` ($${m.bid})` : ""}` : "";
        const drop = m.drops.length ? `dropped ${names(m.drops)}` : "";
        text = `<b>${who}</b> ${[add, drop].filter(Boolean).join(", ")}`;
      }
      return `<li><span class="mvtype ${m.type}">${m.type === "free_agent" ? "Free agent" : m.type === "waiver" ? "Waiver" : "Trade"}</span><p>${text}</p><time class="num">${when(m.t)}</time></li>`;
    });
    return items.length ? `<ol class="moves">${items.join("")}</ol>` : `<p class="empty">No moves yet.</p>`;
  }

  function render(ctx) {
    const L = league();
    if (!L?.teams || !ui.tracker) return set(body, `<p class="empty">Loading…</p>`);
    const lm = liveMatchups(ui.tracker.board(L.teams, L.scoring), L.pairings, L.teams);
    set(body, ui.lview === "standings" ? standingsHTML(L, lm) : ui.lview === "moves" ? movesHTML(L) : matchupsHTML(L, lm));
  }

  return {
    mount(el) {
      page = el;
      el.insertAdjacentHTML("beforeend", `
        <div class="page-head"><div class="colhead"><h2 class="coltitle" id="col-league" tabindex="-1">League</h2><span class="colpick-slot"></span></div>
          <div class="mseg"><span class="seg" role="group" aria-label="League view">${VIEWS.map(([k, l]) => `<button type="button" data-lview="${k}" aria-pressed="${ui.lview === k}">${l}</button>`).join("")}</span></div>
        </div>
        <div class="lbody" data-lbody></div>`);
      body = el.querySelector("[data-lbody]");
      el.addEventListener("click", (e) => {
        const v = e.target.closest("[data-lview]");
        if (v) {
          ui.lview = v.dataset.lview;
          for (const b of el.querySelectorAll("[data-lview]")) b.setAttribute("aria-pressed", String(b === v));
          return render();
        }
        const m = e.target.closest("[data-lm]");
        if (m) {
          if (open.has(m.dataset.lm)) open.delete(m.dataset.lm); else open.add(m.dataset.lm);
          render();
          page.querySelector(`[data-lm="${m.dataset.lm}"]`)?.focus({ preventScroll: true });
        }
      });
    },
    reset(ctx) { render(ctx); },
    update(ctx) { render(ctx); },
  };
}
