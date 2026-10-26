// What goes inside the bottom sheets (clock, live, Find, settings) and the "connect your league" form.
// Plain HTML strings; app.js opens them with the sheet from ui/layers.js.

import { esc, ET, n1, pct } from "./cards.js";
import { SPEEDS } from "../src/view-models.js";

// "Sun 1:40:12 PM ET", or "... · end of saved plays" when the replay has run out.
export function clockLong(replay) {
  const t = new Date(replay.time).toLocaleString("en-US", { ...ET, weekday: "short", hour: "numeric", minute: "2-digit", second: "2-digit" });
  return replay.done ? `${t} ET · end of saved plays` : `${t} ET`;
}

export const REPLAY_NOTE = (user) =>
  `<b>Replay, not live.</b> Every real play from NFL Week 6 arrives at the moment it happened, with ${esc(user)}'s real league.`;

// The replay clock: jump to a kickoff (the windows from src/replay.js), pick a speed, read what this is.
export function clockSheetHTML({ ui, wins }) {
  return `<h2 class="sheet-title" id="sheet-title">Replay clock</h2>
    <p class="sheet-clock num" data-sheet-clock>${esc(clockLong(ui.replay))}</p>
    <p class="label">Jump to a kickoff</p>
    <div class="jumps">${wins.map((w) => `<button class="jump" type="button" data-jump="${w.at}"><b>${esc(w.label)}</b><small>${w.games.length} ${w.games.length === 1 ? "game" : "games"}</small></button>`).join("")}</div>
    <p class="label">Speed</p>
    <div class="seg" role="group" aria-label="Speed">
      <button type="button" data-act="pause" aria-pressed="${ui.paused}">Pause</button>
      ${SPEEDS.map((s) => `<button type="button" data-speed="${s}" aria-pressed="${ui.speed === s}">${s}×</button>`).join("")}
    </div>
    <p class="sheet-note">${REPLAY_NOTE(ui.replayData?.user ?? "ontopgun")} Going back to an earlier kickoff replays the day from there.</p>
    <div class="sheet-actions">
      ${ui.hasServer ? `<button class="go" type="button" data-mode="live">Back to live</button>` : ""}
      <button class="chipbtn" type="button" data-close="sheet">Done</button>
    </div>`;
}

// Keep an open clock sheet current (every tick): the time and which speed is on.
export function refreshClockSheet(sheet, ui) {
  const c = sheet.querySelector("[data-sheet-clock]");
  const t = clockLong(ui.replay);
  if (c && c.textContent !== t) c.textContent = t;
  for (const b of sheet.querySelectorAll("[data-speed]")) b.setAttribute("aria-pressed", String(Number(b.dataset.speed) === ui.speed));
  sheet.querySelector('[data-act="pause"]')?.setAttribute("aria-pressed", String(ui.paused));
}

export function liveSheetHTML({ ui }) {
  const ago = ui.updatedAt ? Math.round((Date.now() - ui.updatedAt) / 1000) : null;
  const status = !ui.tracker ? "Connecting to Sleeper and ESPN…"
    : ui.error ? `Offline: ${esc(ui.error)}. Trying again every 10 seconds.`
    : `Live${ui.live?.user ? ` as ${esc(ui.live.user)}` : ""} · updated ${ago ?? 0}s ago.`;
  return `<h2 class="sheet-title" id="sheet-title">Live</h2>
    <p>${status}</p>
    <p class="sheet-note">New plays arrive about every 10 seconds from ESPN. Points use your league's own scoring.</p>
    <div class="sheet-actions">
      <button class="chipbtn" type="button" data-mode="replay">Watch last Sunday's replay</button>
      <button class="chipbtn" type="button" data-act="change-user">Use a different Sleeper user</button>
      <button class="chipbtn" type="button" data-close="sheet">Done</button>
    </div>`;
}

// What each scored stat is called on the play sheet.
const STAT_NAMES = {
  rush_yd: "rush yds", rec_yd: "receiving yds", pass_yd: "passing yds", rec: "catch", rush_td: "Rush TD", rec_td: "Receiving TD",
  pass_td: "Passing TD", pass_int: "Interception thrown", fum_lost: "Fumble lost", pass_2pt: "2-pt pass", rec_2pt: "2-pt catch", rush_2pt: "2-pt run",
  xpm: "Extra point", xpmiss: "Missed extra point", fgm: "Field goal", fgm_yds: "FG distance", fgmiss: "Missed field goal",
  sack: "Sack", int: "Interception", fum_rec: "Fumble recovery", def_td: "Defensive TD", def_st_td: "Return TD", safe: "Safety", blk_kick: "Blocked kick",
  def_st_ff: "Forced fumble on a return", bonus_rec_te: "TE catch bonus", bonus_rec_rb: "RB catch bonus", bonus_rec_wr: "WR catch bonus",
  rush_td_40p: "40+ yd TD bonus", rush_td_50p: "50+ yd TD bonus", rec_td_40p: "40+ yd TD bonus", rec_td_50p: "50+ yd TD bonus", pass_td_40p: "40+ yd TD bonus", pass_td_50p: "50+ yd TD bonus",
};
const statName = (k) => STAT_NAMES[k]
  ?? (/^bonus_.*_(\d+)$/.test(k) ? `${k.match(/_(\d+)$/)[1]}-yd game bonus` : /^(pts|yds)_allow_/.test(k) ? "Points/yards allowed tier" : /^fgm_/.test(k) ? "Field goal" : /_fd$|^bonus_fd/.test(k) ? "First down" : k.replace(/_/g, " "));
const rowText = ([k, change, pts]) => {
  const count = /_yd$|^fgm_yds/.test(k) ? `${change} ` : Math.abs(change) > 1 && !/^(pts|yds)_allow_/.test(k) ? `${change}× ` : "";
  return `<li><span>${esc(count + statName(k))}</span><b class="num ${pts < 0 ? "neg" : ""}">${pts > 0 ? "+" : ""}${n1(pts)}</b></li>`;
};

// One play: what happened, every fantasy point it moved (and why), and what it did to your win chance.
export function playSheetHTML(c) {
  if (!c) return `<h2 class="sheet-title" id="sheet-title">Play</h2><p>That play isn't here any more.</p>`;
  const wins = c.wp.filter((w) => Math.abs(w.after - w.before) >= 0.005);
  return `<h2 class="sheet-title" id="sheet-title">${esc(c.name || c.offense || "")} <span class="plabel">${esc(c.label)}</span></h2>
    <p class="label num">${esc(c.away)} ${c.awayScore} – ${esc(c.home)} ${c.homeScore} · ${c.period > 4 ? "OT" : "Q" + c.period} ${esc(c.clock)}${c.situation ? ` · ${esc(c.situation)}` : ""}</p>
    <p class="sheet-play">${esc(c.text)}</p>
    ${c.impacts.map((i) => `<section class="breakdown ${i.owner}">
      <h3><span>${esc(i.name)} <small>· ${i.owner === "me" ? "your" : "their"} ${esc(i.pos === "DEF" ? "D/ST" : i.pos)}</small></span><b class="num">${i.delta > 0 ? "+" : ""}${n1(i.delta)}</b></h3>
      <ul>${(i.rows ?? []).map(rowText).join("")}</ul></section>`).join("") || `<p class="sheet-note">No fantasy points moved on this play for your matchup.</p>`}
    ${wins.map((w) => `<p class="sheet-win num">Your win chance <b>${pct(w.before)} → ${pct(w.after)}</b></p>`).join("")}
    <div class="sheet-actions">
      <button class="chipbtn" type="button" data-game="${esc(c.gameId)}">Open ${esc(c.gameName)}</button>
      <button class="chipbtn" type="button" data-close="sheet">Done</button>
    </div>`;
}

export function findSheetHTML() {
  return `<h2 class="sheet-title" id="sheet-title">Find</h2>
    <label class="label" for="find-q">A player or a game</label>
    <input id="find-q" class="findbox" type="search" autocomplete="off" spellcheck="false" placeholder="Try swift, colts or kc">
    <ul class="findlist" data-find-results aria-live="polite"></ul>
    <div class="sheet-actions"><button class="chipbtn" type="button" data-close="sheet">Done</button></div>`;
}

export function findResultsHTML(results, q) {
  if (!q.trim()) return "";
  if (!results.length) return `<li class="sheet-note">Nothing found for "${esc(q)}".</li>`;
  return results.map((r, i) => {
    const attrs = r.kind === "game" ? `data-game="${esc(r.id)}"` : `data-find="${i}"`;
    const what = r.kind === "game" ? "Game" : r.kind === "player" ? `${r.owner === "me" ? "Your" : "Their"} ${r.pos === "DEF" ? "D/ST" : r.pos} · ${r.team}` : r.team ?? "";
    return `<li><button type="button" class="findrow ${r.owner ?? ""}" ${attrs}><b>${esc(r.label ?? r.name)}</b><span>${esc(what)}</span></button></li>`;
  }).join("");
}

// A player: every play he was in today, newest first (tap one for its details).
export function playerSheetHTML(entry, cards, cardHTML) {
  const total = entry.id ? cards.reduce((s, c) => s + (c.impacts.find((i) => i.id === entry.id)?.delta ?? 0), 0) : null;
  return `<h2 class="sheet-title" id="sheet-title">${esc(entry.name)}</h2>
    <p class="label">${esc([entry.owner ? (entry.owner === "me" ? "Your" : "Their") + " " + (entry.pos === "DEF" ? "D/ST" : entry.pos) : null, entry.team].filter(Boolean).join(" · "))}${total != null ? ` · <span class="num">${n1(total)} pts from plays</span>` : ""}</p>
    <div class="feed sheet-feed">${cards.length ? cards.slice(0, 40).map((c) => cardHTML(c, false)).join("") : `<p class="empty">No plays for him yet.</p>`}</div>
    <div class="sheet-actions"><button class="chipbtn" type="button" data-close="sheet">Done</button></div>`;
}

// The share picture, to save by hand: inside the claude.ai preview the share sheet and downloads may be blocked.
export function pictureSheetHTML(url) {
  const touch = matchMedia("(pointer: coarse)").matches;
  return `<h2 class="sheet-title" id="sheet-title">Your picture</h2>
    ${url ? `<img class="sharepic" src="${url}" alt="Your story card as a picture">` : ""}
    <p class="sheet-note">${touch ? "Press and hold the picture to save or share it." : "Right-click the picture, then Save image."}</p>
    <div class="sheet-actions"><button class="chipbtn" type="button" data-close="sheet">Done</button></div>`;
}

// Settings: switches that are remembered on this device.
const SWITCH = (act, on, title, sub) => `<button class="setrow" type="button" role="switch" aria-checked="${on}" data-act="${act}">
    <span><b>${title}</b><small>${sub}</small></span><i class="switch" aria-hidden="true"></i></button>`;
export function settingsSheetHTML({ ui }) {
  const acct = ui.account;
  const leagues = acct ? acct.leagues.filter((l) => acct.chosen.includes(l.league_id)) : [];
  return `<h2 class="sheet-title" id="sheet-title">Settings</h2>
    <section class="acct">
      <p class="label">Your Sleeper</p>
      ${acct ? `<p class="acct-who"><b>${esc(acct.user.display_name)}</b> · ${leagues.length} league${leagues.length === 1 ? "" : "s"} synced</p>
        ${leagues.length > 1 ? `<div class="acct-leagues" role="radiogroup" aria-label="Main league">${leagues.map((l) => `<button class="setrow" type="button" role="radio" aria-checked="${l.league_id === acct.active}" data-act="league" data-league="${esc(l.league_id)}"><span><b>${esc(l.name)}</b><small>${l.league_id === acct.active ? "Showing now" : "Tap to show this league"}</small></span></button>`).join("")}</div>` : ""}`
      : `<p class="acct-who">Watching the demo league (ontopgun).</p>`}
      <div class="acct-btns">
        ${acct ? `<button class="chipbtn" type="button" data-act="resync">Sync again</button><button class="chipbtn" type="button" data-act="more-leagues">Sync more leagues</button>` : ""}
        <button class="chipbtn" type="button" data-act="new-account">${acct ? "Sync another account" : "Sync my Sleeper"}</button>
        ${acct ? `<button class="chipbtn" type="button" data-act="demo">Use the demo league</button>` : ""}
      </div>
    </section>
    <div class="setlist">
      ${SWITCH("toggle-fantasy", ui.fantasyOn, "Fantasy", "Your matchup, the score at the top, and ranking games by your players. Off: just football, ranked by how exciting each game is.")}
      ${SWITCH("toggle-banners", ui.settings.banners, "Banners for big moments", "A short banner when something big happens in your matchup. It never switches what you're watching.")}
    </div>
    <div class="sheet-actions"><button class="chipbtn" type="button" data-close="sheet">Done</button></div>`;
}

// Live mode without a Sleeper user yet (or after a failed connection).
export function setupHTML({ error, username }) {
  return `<form class="setup" id="setup">
    <h1>Connect your Sleeper league</h1>
    <p>Type your Sleeper username. The app finds your leagues, team, opponent and scoring by itself. No password needed.</p>
    <label class="label" for="username">Sleeper username</label>
    <input id="username" autocomplete="username" required placeholder="ontopgun" value="${esc(username ?? "")}">
    <button class="go" type="submit">Connect</button>
    <button class="chipbtn" type="button" data-mode="replay">Or watch last Sunday's replay</button>
    ${error ? `<p class="err">${esc(error)}</p>` : ""}
  </form>`;
}

// First open (and "Sync another account"): ask for a Sleeper username, then which leagues to sync.
export function onboardHTML({ step = "name", username = "", error = "", busy = "", account = null, chosen = null }) {
  if (step === "leagues" && account) {
    const pick = chosen ?? account.leagues.map((l) => l.league_id);
    return `<form class="setup onboard" id="onboard-leagues">
      <p class="label">Hi ${esc(account.user.display_name)} 👋</p>
      <h1>Pick your leagues</h1>
      ${account.leagues.length ? `<div class="ob-leagues">${account.leagues.map((l) => `<label class="ob-league"><input type="checkbox" name="lg" value="${esc(l.league_id)}"${pick.includes(l.league_id) ? " checked" : ""}><span><b>${esc(l.name)}</b><small>${l.total_rosters ?? "?"} teams</small></span></label>`).join("")}</div>`
        : `<p>No 2026 leagues found for this account.</p>`}
      <button class="go" type="submit"${busy || !account.leagues.length ? " disabled" : ""}>${busy ? esc(busy) : "Sync and start"}</button>
      ${error ? `<p class="err">${esc(error)}</p>` : ""}
      <button class="chipbtn" type="button" data-act="new-account">Different account</button>
    </form>`;
  }
  return `<form class="setup onboard" id="onboard-name">
    <p class="label">Welcome to Fantasy Zone</p>
    <h1>Sync your Sleeper league</h1>
    <p>Type your Sleeper username. We find your leagues, team, opponent and scoring automatically. No password.</p>
    <label class="label" for="ob-username">Sleeper username</label>
    <input id="ob-username" autocomplete="username" autocapitalize="none" spellcheck="false" required placeholder="your username" value="${esc(username)}">
    <button class="go" type="submit"${busy ? " disabled" : ""}>${busy ? esc(busy) : "Find my leagues"}</button>
    ${error ? `<p class="err">${esc(error)}</p>` : ""}
    <button class="chipbtn" type="button" data-act="demo">Just look around (demo league)</button>
  </form>`;
}
