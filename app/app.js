// Fantasy Zone app.
//   live    when served by server.js (npm start): Sleeper + ESPN play-by-play every 10 seconds
//   replay  anywhere else: every real play of NFL Week 6, at the speed it happened or faster (replay.json)
// Nothing on screen switches by itself: the Zone feed fills in, the hot games re-rank, and you choose.

import { rankGames, DIALS } from "./src/model.js";
import { createReplay } from "./src/replay.js";

const POLL_MS = 10_000;
const TICK_MS = 250;
const FEED_PAGE = 150;
const ELSEWHERE_MS = 25_000;
const REPLAY_START = Date.parse("2026-10-18T16:57:00Z"); // just before the 1 PM ET kickoffs
const ET = { timeZone: "America/New_York" };

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const store = {
  get(k, d) { try { const v = localStorage.getItem(`fz:${k}`); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(`fz:${k}`, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};
const wide = () => matchMedia("(min-width: 1000px)").matches;
const pct = (x) => (x > 0.99 && x < 1 ? ">99%" : x < 0.01 && x > 0 ? "<1%" : `${Math.round(x * 100)}%`);
const n1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const ui = {
  mode: null, hasServer: false,
  screen: "zone", // "zone" | "game" | "games"
  gameId: null, // game open on the game screen (phones)
  panelId: null, // game in the side panel (wide screens); only changes when you pick one
  filter: store.get("filter", "mine"),
  speed: store.get("speed", 1),
  username: store.get("username", null),
  tracker: null, replay: null, replayData: null, live: null,
  feedLimit: FEED_PAGE, newCount: 0,
  elsewhere: null,
  lastWp: new Map(), wpDelta: new Map(),
  error: null, updatedAt: 0, wasWide: wide(),
};

// ---------- Data sources ----------

async function startReplay() {
  ui.mode = "replay";
  ui.replayData ??= await (await fetch("replay.json")).json();
  ui.replay = createReplay(ui.replayData, { startAt: REPLAY_START });
  ui.tracker = ui.replay.tracker;
  render();
  let last = performance.now();
  clearInterval(ui.timer);
  ui.timer = setInterval(() => {
    const now = performance.now();
    const cards = ui.replay.advance(now - last, ui.speed);
    last = now;
    update(cards);
  }, TICK_MS);
}

async function startLive() {
  ui.mode = "live";
  clearInterval(ui.timer);
  ui.tracker = null; ui.error = null;
  render();
  try {
    const [{ makeFetchJson }, { createLive }] = await Promise.all([import("./src/net.js"), import("./src/live.js")]);
    const fetchJson = makeFetchJson({ rewrite: (u) => u.replace("https://api.sleeper.app", "/proxy/sleeper").replace("https://site.api.espn.com", "/proxy/espn") });
    ui.live = await createLive(fetchJson, { username: ui.username });
    await ui.live.poll(); // what already happened today, quietly
    ui.tracker = ui.live.tracker;
    ui.updatedAt = Date.now();
    render();
  } catch (e) {
    ui.error = e.message;
    if (/No Sleeper user/.test(e.message)) { ui.username = null; store.set("username", null); }
    render();
    return;
  }
  ui.timer = setInterval(async () => {
    try {
      const cards = await ui.live.poll();
      ui.error = null; ui.updatedAt = Date.now();
      update(cards);
    } catch (e) { ui.error = e.message; renderHeader(); }
  }, POLL_MS);
}

// ---------- Screens ----------

function go(screen, gameId) {
  if (screen === "game" && wide()) { ui.panelId = gameId; screen = "zone"; }
  ui.screen = screen;
  if (gameId) ui.gameId = gameId;
  ui.feedLimit = FEED_PAGE;
  render();
  if (screen !== "zone" || !wide()) window.scrollTo({ top: 0 });
}

function snapshot() { return ui.tracker.snapshot(); }

function ranked(snap) {
  return rankGames({ games: snap.games, matchups: snap.matchups, dials: DIALS.fantasyOn });
}

// Full render of the current screen (on navigation, filter change, replay jump).
function render() {
  renderHeader();
  renderReplayBar();
  const root = $("#root");
  if (ui.mode === "live" && !ui.tracker) {
    if (!ui.username) return renderSetup(root);
    root.innerHTML = `<p class="empty">${ui.error ? `Couldn't connect: ${esc(ui.error)}` : "Connecting to Sleeper and ESPN…"}</p>`;
    return;
  }
  if (!ui.tracker) return;
  const snap = snapshot();
  const r = ranked(snap);
  if (ui.screen === "games") root.innerHTML = allGamesHTML(r);
  else if (ui.screen === "game") {
    root.innerHTML = `<div class="zone"><div id="elsewhere"></div><section class="game" id="panel">${panelHTML(ui.gameId, snap)}</section></div>`;
    renderElsewhere();
  } else {
    const split = wide();
    if (split && !ui.panelId) ui.panelId = (r.find((x) => x.game.state === "in") ?? r.find((x) => x.game.state === "pre") ?? r[0])?.game.id;
    root.innerHTML = `<div class="zone ${split ? "split" : ""}">
      <div class="col">
        <div id="matchup">${matchupHTML(snap)}</div>
        <section class="col" style="gap:8px"><div class="hot-head"><span class="label">Hot right now</span>
          <button class="linkbtn" type="button" data-nav="games">All games ›</button></div>
          <div class="strip" id="hot">${hotHTML(r)}</div></section>
        <div class="filters" role="group" aria-label="Which plays">
          ${[["mine", "My matchup"], ["all", "All plays"], ["big", "Big plays"]].map(([k, l]) => `<button class="chipbtn" type="button" data-filter="${k}" aria-pressed="${ui.filter === k}">${l}</button>`).join("")}
        </div>
        <div class="feed" id="feed">${feedHTML(zoneCards())}</div>
      </div>
      ${split ? `<aside class="deskpanel"><section class="game" id="panel">${panelHTML(ui.panelId, snap)}</section></aside>` : ""}
    </div>`;
  }
  ui.newCount = 0;
  updateNewPill();
}

// Small update after each tick or poll: new cards slide in, scores and tiles refresh.
function update(cards) {
  if (!ui.tracker) return;
  const fresh = cards.filter((c) => !c.silent);
  for (const c of fresh) {
    const viewing = ui.screen === "game" ? ui.gameId : wide() ? ui.panelId : null;
    if (c.big && c.gameId !== viewing && c.impacts.some((i) => i.pos !== "DEF")) ui.elsewhere = { card: c, at: Date.now() };
  }
  if (ui.screen === "games") {
    if (fresh.length || !ui.lastGamesRender || Date.now() - ui.lastGamesRender > 1000) {
      $("#root").innerHTML = allGamesHTML(ranked(snapshot()));
      ui.lastGamesRender = Date.now();
    }
    renderHeader(); updateReplayClock();
    return;
  }
  const snap = snapshot();
  if (ui.screen === "zone") {
    $("#matchup").innerHTML = matchupHTML(snap);
    $("#hot").innerHTML = hotHTML(ranked(snap));
    const add = fresh.filter(passesFilter).reverse(); // newest first
    if (add.length) {
      const feed = $("#feed");
      feed.querySelector(".empty")?.remove();
      feed.insertAdjacentHTML("afterbegin", add.map((c) => cardHTML(c, true)).join(""));
      const feedTop = feed.getBoundingClientRect().top + window.scrollY;
      if (window.scrollY > feedTop + 80) { ui.newCount += add.length; updateNewPill(); }
    }
  }
  const panelGame = ui.screen === "game" ? ui.gameId : wide() ? ui.panelId : null;
  if (panelGame && $("#panel")) {
    $("#panel-top").innerHTML = panelTopHTML(panelGame, snap);
    const add = fresh.filter((c) => c.gameId === panelGame).reverse();
    if (add.length) {
      const pf = $("#panel-feed");
      pf.querySelector(".empty")?.remove();
      pf.insertAdjacentHTML("afterbegin", add.map((c) => cardHTML(c, true)).join(""));
    }
  }
  if (ui.screen === "game") renderElsewhere();
  renderHeader();
  updateReplayClock();
}

// ---------- Pieces ----------

function zoneCards() { return ui.tracker.feed().filter(passesFilter); }

function passesFilter(c) {
  if (ui.filter === "mine") return c.impacts.length > 0;
  if (ui.filter === "big") return c.big;
  return true;
}

function feedHTML(list, emptyText) {
  if (!list.length) {
    return `<p class="empty">${esc(emptyText ?? (ui.filter === "mine" ? "No plays for your matchup yet. They show up here the moment your players or your opponent's touch the ball." : "No plays yet. Kickoff is coming."))}</p>`;
  }
  const shown = list.slice(0, ui.feedLimit);
  return shown.map((c) => cardHTML(c, false)).join("") + (list.length > shown.length ? `<button class="more" type="button" data-more>Show older plays (${list.length - shown.length})</button>` : "");
}

function cardHTML(c, isNew) {
  if (c.kind === "marker" || c.kind === "timeout") {
    const what = c.kind === "timeout" ? c.text.replace(/\.$/, "") : /END GAME/i.test(c.text) ? "Final" : /QUARTER 2/i.test(c.text) ? "Halftime" : c.text.replace(/\.$/, "");
    return `<div class="marker">${esc(c.gameName)} · ${esc(what)}${c.kind === "marker" ? ` · ${esc(c.away)} ${c.awayScore}–${c.homeScore} ${esc(c.home)}` : ""}</div>`;
  }
  const mine = c.impacts.filter((i) => i.owner === "me"), theirs = c.impacts.filter((i) => i.owner === "opponent");
  const sum = (l) => l.reduce((s, i) => s + Math.abs(i.delta), 0);
  const owner = sum(mine) || sum(theirs) ? (sum(mine) >= sum(theirs) ? "me" : "opponent") : "";
  const homeLeads = c.homeScore > c.awayScore, awayLeads = c.awayScore > c.homeScore;
  const side = (t, s, lead) => (lead ? `<b>${esc(t)} ${s}</b>` : `${esc(t)} ${s}`);
  const score = `<span class="score">${side(c.away, c.awayScore, awayLeads)} – ${side(c.home, c.homeScore, homeLeads)}</span>`;
  const chips = [
    ...c.impacts.map((i) => `<span class="chip ${i.owner}">${i.delta > 0 ? "+" : ""}${n1(i.delta)} · ${i.owner === "me" ? "your" : "opp"} ${esc(i.pos === "DEF" ? "D/ST" : i.pos)}</span>`),
    ...c.wp.filter((w) => Math.abs(w.after - w.before) >= 0.005).map((w) => `<span class="chip ${w.after > w.before ? "up" : "down"}">Win ${pct(w.before)} → ${pct(w.after)}</span>`),
  ];
  const name = c.name || c.offense || "";
  return `<article class="play ${owner} ${c.big ? "big" : ""} ${isNew ? "new" : ""}" data-game="${esc(c.gameId)}" tabindex="0" role="button" aria-label="${esc(`${name} ${c.label}, ${c.gameName}`)}">
    <div class="pmeta">${score}<span>· Q${c.period > 4 ? "OT" : c.period} ${esc(c.clock)}</span>${c.situation ? `<span>· ${esc(c.situation)}</span>` : ""}</div>
    <div class="phead"><span class="pname">${esc(name)}</span><span class="plabel">${esc(c.label)}</span>${c.td ? `<span class="badge">TD</span>` : c.turnover ? `<span class="badge">Turnover</span>` : ""}</div>
    ${c.from ? `<div class="pfrom">${esc(c.from)}</div>` : ""}
    <div class="ptext">${esc(c.text)}</div>
    ${chips.length ? `<div class="pchips">${chips.join("")}</div>` : ""}
  </article>`;
}

function matchupHTML(snap) {
  return snap.matchups.map((m) => {
    const id = m.league.league_id;
    const prev = ui.lastWp.get(id);
    if (prev != null && Math.abs(m.winProb - prev) >= 0.005) ui.wpDelta.set(id, m.winProb - prev);
    if (prev == null || Math.abs(m.winProb - prev) >= 0.005) ui.lastWp.set(id, m.winProb);
    const d = ui.wpDelta.get(id);
    const delta = d ? ` <span class="delta ${d > 0 ? "up" : "down"}">${d > 0 ? "▲" : "▼"}${Math.max(1, Math.round(Math.abs(d) * 100))}</span>` : "";
    return `<article class="matchup" aria-label="${esc(m.league.name)} matchup">
      <div class="top">
        <div class="side me"><span class="who">You</span><span class="pts num">${n1(m.myNow)}</span><span class="who num">proj ${n1(m.myFinal)}</span></div>
        <div class="mid"><span class="label">Win chance</span><b class="num">${pct(m.winProb)}${delta}</b></div>
        <div class="side opp"><span class="who">${esc(m.opponentName)}</span><span class="pts num">${n1(m.oppNow)}</span><span class="who num">proj ${n1(m.oppFinal)}</span></div>
      </div>
      <div class="wpbar"><span style="width:${(m.winProb * 100).toFixed(1)}%"></span></div>
      <div class="label">${esc(m.league.name)} · ${esc(m.info.format)}</div>
    </article>`;
  }).join("");
}

function hotHTML(r) {
  const live = r.filter((x) => x.game.state === "in");
  const next = r.filter((x) => x.game.state === "pre").sort((a, b) => a.game.kickoff.localeCompare(b.game.kickoff));
  const list = [...live, ...next].slice(0, 3);
  return list.length ? list.map(tileHTML).join("") : `<p class="empty">No games left today.</p>`;
}

function tileHTML(x) {
  const g = x.game;
  const hot = g.state === "in" && x.live >= 2;
  const showScore = g.state !== "pre";
  const meta = g.state === "pre" ? `Kickoff ${kickoffText(g)}` : g.state === "post" ? "Final" : `Q${g.period > 4 ? "OT" : g.period} ${clock(g.clockSec)}${g.downText ? ` · ${g.downText}` : ""}`;
  return `<button class="tile ${hot ? "hot" : ""} ${wide() && g.id === ui.panelId && ui.screen === "zone" ? "active" : ""}" type="button" data-game="${esc(g.id)}">
    <div class="row"><span class="teams num">${esc(g.away)}${showScore ? ` ${g.awayScore}` : ""} <span class="at">@</span> ${esc(g.home)}${showScore ? ` ${g.homeScore}` : ""}</span>
      ${hot ? `<span class="flame">🔥 Hot</span>` : ""}</div>
    <div class="meta num">${esc(meta)}</div>
    ${g.state !== "post" ? `<div class="meter" title="Watch score ${Math.round(x.watch)}"><span style="width:${Math.min(100, x.watch)}%"></span></div>` : ""}
    <div class="why">${esc(x.reason)}</div>
  </button>`;
}

function allGamesHTML(r) {
  const live = r.filter((x) => x.game.state === "in");
  const pre = r.filter((x) => x.game.state === "pre").sort((a, b) => a.game.kickoff.localeCompare(b.game.kickoff));
  const post = r.filter((x) => x.game.state === "post");
  const section = (title, list) => (list.length ? `<section class="col" style="gap:8px"><span class="label">${title}</span><div class="grid">${list.map(tileHTML).join("")}</div></section>` : "");
  return `<div class="allgames">${section("Live, most important first", live)}${section("Coming up", pre)}${section("Final", post)}</div>`;
}

function panelHTML(gameId, snap) {
  const cards = ui.tracker.feed().filter((c) => c.gameId === gameId);
  return `<div id="panel-top" class="col">${panelTopHTML(gameId, snap)}</div>
    <div class="section-title"><span class="label">Play by play</span></div>
    <div class="feed" id="panel-feed">${feedHTML(cards, "No plays yet.")}</div>`;
}

function panelTopHTML(gameId, snap) {
  const g = snap.games.find((x) => x.id === gameId);
  if (!g) return `<p class="empty">Pick a game.</p>`;
  const ball = (t) => (g.state === "in" && g.offense === t ? `<i class="ballmark" title="Has the ball"></i>` : "");
  const status = g.state === "pre" ? `<b>${esc(kickoffText(g))}</b>Kickoff` : g.state === "post" ? `<b>Final</b>` : `<b>Q${g.period > 4 ? "OT" : g.period} ${clock(g.clockSec)}</b>${g.homeWinProb != null ? `${esc(g.home)} win ${pct(g.homeWinProb)}` : ""}`;
  const players = snap.matchups.flatMap((m) => [...m.mine, ...m.theirs]).filter((p) => p.game?.id === gameId)
    .sort((a, b) => (a.owner === "me" ? 0 : 1) - (b.owner === "me" ? 0 : 1) || b.current - a.current);
  const momentum = ui.tracker.momentum(gameId);
  return `
    <div class="scoreline">
      <div class="team"><span class="abbr">${esc(g.away)} ${ball(g.away)}</span><span class="pts num">${g.state === "pre" ? "" : g.awayScore}</span></div>
      <div class="gclock num">${status}</div>
      <div class="team home"><span class="abbr">${ball(g.home)} ${esc(g.home)}</span><span class="pts num">${g.state === "pre" ? "" : g.homeScore}</span></div>
    </div>
    ${g.state === "in" && g.offense && g.yardsToGoal != null ? `<div class="situation">${esc(g.offense)} ball · ${esc(g.downText ?? "")}</div>${fieldSvg(g)}` : ""}
    ${momentum.length > 1 ? momentumSvg(g, momentum) : ""}
    ${players.length ? `<div class="section-title"><span class="label">Your matchup in this game</span></div>
      <div class="stakes">${players.map((p) => `<div class="stake ${p.owner}">
        <span class="pos">${esc(p.pos === "DEF" ? "D/ST" : p.pos)}</span>
        <span class="who">${esc(p.name)} <small>· ${p.owner === "me" ? "you" : "opponent"}</small></span>
        <span class="now num">${n1(p.current)}</span>
        <span class="left num">${g.state === "post" ? "final" : `${p.remaining >= 0 ? "+" : ""}${n1(p.remaining)}<br>expected`}</span></div>`).join("")}</div>` : ""}`;
}

// The field from the offense's view: own end zone left, the one they're attacking on the right.
// The shaded band is this drive so far.
function fieldSvg(g) {
  const W = 600, H = 66, ez = 40, play = W - 2 * ez;
  const x = (yd) => ez + (yd / 100) * play;
  const ball = 100 - g.yardsToGoal;
  const start = g.driveStart != null ? 100 - g.driveStart : ball;
  const lines = [];
  for (let yd = 10; yd < 100; yd += 10) {
    lines.push(`<line x1="${x(yd)}" y1="6" x2="${x(yd)}" y2="${H - 6}" stroke="var(--field-line)" stroke-width="1"/>`);
    lines.push(`<text x="${x(yd)}" y="${H - 9}" text-anchor="middle" font-size="11" fill="var(--mute)" font-family="Barlow Condensed, sans-serif">${yd <= 50 ? yd : 100 - yd}</text>`);
  }
  const toGain = g.distance && g.yardsToGoal > g.distance ? x(ball + g.distance) : null;
  return `<svg class="field" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(g.offense)} ball, ${g.yardsToGoal} yards from the end zone">
    <rect x="0" y="0" width="${W}" height="${H}" rx="8" fill="var(--field)"/>
    <rect x="${x(80)}" y="0" width="${x(100) - x(80)}" height="${H}" fill="var(--hot)" opacity="0.12"/>
    <rect x="${W - ez}" y="0" width="${ez}" height="${H}" rx="8" fill="var(--hot)" opacity="0.28"/>
    <rect x="0" y="0" width="${ez}" height="${H}" rx="8" fill="var(--field-line)" opacity="0.6"/>
    ${lines.join("")}
    ${ball > start ? `<rect x="${x(start)}" y="${H / 2 - 9}" width="${x(ball) - x(start)}" height="10" rx="3" fill="var(--you)" opacity="0.35"/>` : ""}
    ${toGain ? `<line x1="${toGain}" y1="4" x2="${toGain}" y2="${H - 4}" stroke="var(--you)" stroke-width="2" stroke-dasharray="4 3"/>` : ""}
    <line x1="${x(ball)}" y1="4" x2="${x(ball)}" y2="${H - 4}" stroke="var(--chalk)" stroke-width="2"/>
    <ellipse cx="${x(ball)}" cy="${H / 2 - 4}" rx="9" ry="5.5" fill="var(--you)" stroke="var(--you-ink)" stroke-width="1"/>
    <text x="${W - ez / 2}" y="${H / 2}" text-anchor="middle" dominant-baseline="middle" font-size="11" font-weight="700" fill="var(--chalk)" font-family="Barlow Condensed, sans-serif" transform="rotate(90 ${W - ez / 2} ${H / 2})">END ZONE</text>
  </svg>`;
}

// Win chance after every play: above the middle line the home team is favored.
function momentumSvg(g, pts) {
  const W = 600, H = 96, padL = 34, padR = 8, padY = 8;
  const x = (i) => padL + (i / Math.max(1, pts.length - 1)) * (W - padL - padR);
  const y = (wp) => padY + (1 - wp) * (H - 2 * padY);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.wp).toFixed(1)}`).join("");
  const area = `${line}L${x(pts.length - 1).toFixed(1)},${y(0.5)}L${x(0)},${y(0.5)}Z`;
  const quarters = [];
  for (let i = 1; i < pts.length; i++) if (pts[i].period !== pts[i - 1].period) quarters.push(`<line x1="${x(i)}" y1="${padY}" x2="${x(i)}" y2="${H - padY}" stroke="var(--line)" stroke-width="1"/>`);
  const last = pts[pts.length - 1];
  return `<div class="col" style="gap:6px"><div class="section-title"><span class="label">Momentum</span><span class="label">${esc(g.home)} win ${pct(last.wp)}</span></div>
    <svg class="momentum" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(g.home)} win chance over the game, now ${pct(last.wp)}">
      ${quarters.join("")}
      <line x1="${padL}" y1="${y(0.5)}" x2="${W - padR}" y2="${y(0.5)}" stroke="var(--line)" stroke-dasharray="3 4"/>
      <path d="${area}" fill="var(--chalk)" opacity="0.08"/>
      <path d="${line}" fill="none" stroke="var(--chalk)" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="${x(pts.length - 1)}" cy="${y(last.wp)}" r="4" fill="var(--you)"/>
      <text x="4" y="${padY + 10}" font-size="12" font-weight="700" fill="var(--mute)" font-family="Barlow Condensed, sans-serif">${esc(g.home)}</text>
      <text x="4" y="${H - padY}" font-size="12" font-weight="700" fill="var(--mute)" font-family="Barlow Condensed, sans-serif">${esc(g.away)}</text>
    </svg></div>`;
}

function renderElsewhere() {
  const el = $("#elsewhere");
  if (!el) return;
  const e = ui.elsewhere;
  if (!e || Date.now() - e.at > ELSEWHERE_MS || e.card.gameId === ui.gameId) { el.innerHTML = ""; return; }
  const c = e.card;
  const who = c.impacts.find((i) => i.pos !== "DEF");
  el.innerHTML = `<button class="elsewhere ${who?.owner ?? ""}" type="button" data-game="${esc(c.gameId)}">
    <span><b>${esc(c.name)}</b> ${esc(c.label)} · ${esc(c.gameName)} · ${who?.owner === "me" ? "your" : "opp"} ${esc(who?.pos ?? "")}</span><span aria-hidden="true">›</span></button>`;
}

function kickoffText(g) {
  return new Date(g.kickoff).toLocaleString("en-US", { ...ET, weekday: "short", hour: "numeric", minute: "2-digit" });
}

// ---------- Header, replay bar, setup ----------

function renderHeader() {
  const nav = $("#nav");
  nav.hidden = !ui.tracker;
  nav.innerHTML = ui.screen === "zone" ? `<span class="arrow" aria-hidden="true">▦</span>All games`
    : ui.screen === "game" ? `<span class="arrow" aria-hidden="true">‹</span>All games` : `<span class="arrow" aria-hidden="true">‹</span>The Zone`;
  nav.dataset.nav = ui.screen === "games" ? "zone" : "games";
  const s = $("#status");
  const live = ui.mode === "live" && ui.tracker && !ui.error;
  s.className = `status ${live ? "live" : ""}`;
  const ago = ui.updatedAt ? Math.round((Date.now() - ui.updatedAt) / 1000) : 0;
  s.querySelector("span").textContent = ui.mode === "live" ? (ui.error && ui.tracker ? "Reconnecting" : ui.tracker ? `Live · ${ago}s ago` : "Connecting") : ui.mode === "replay" ? "Replay · not live" : "Loading";
}

function renderReplayBar() {
  const bar = $("#replaybar");
  if (ui.mode !== "replay" || !ui.replayData) { bar.hidden = true; bar.innerHTML = ""; return; }
  bar.hidden = false;
  bar.innerHTML = `<div class="replaybar">
    <span class="clock num" id="rclock"></span>
    <span class="what"><b>Replay, not live.</b> Every real play from NFL Week 6, arriving at the moment it happened, with ${esc(ui.replayData.user)}'s real league.</span>
    <div class="seg" role="group" aria-label="Speed">${[[0, "Pause"], [1, "1×"], [2, "2×"], [5, "5×"], [20, "20×"]].map(([v, l]) => `<button type="button" data-speed="${v}" aria-pressed="${ui.speed === v}">${l}</button>`).join("")}</div>
    <div class="seg" role="group" aria-label="Jump to">${kickoffWindows().map((w) => `<button type="button" data-jump="${w.at}">${esc(w.label)}</button>`).join("")}</div>
    ${ui.hasServer ? `<button class="chipbtn" type="button" data-mode="live">Back to live</button>` : ""}
  </div>`;
  updateReplayClock();
}

function updateReplayClock() {
  const el = $("#rclock");
  if (!el || !ui.replay) return;
  const t = new Date(ui.replay.time).toLocaleString("en-US", { ...ET, weekday: "short", hour: "numeric", minute: "2-digit", second: "2-digit" });
  el.textContent = ui.replay.done ? `${t} · end of saved plays` : `${t} ET`;
  document.querySelectorAll("[data-speed]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.speed) === ui.speed)));
}

// Kickoff windows that have plays: London morning, 1 PM, 4 PM, night.
function kickoffWindows() {
  const d = ui.replayData;
  const played = new Set(d.plays.map((p) => p.gameId));
  const starts = [...new Set(d.games.filter((g) => played.has(g.id)).map((g) => Date.parse(g.kickoff)))]
    .filter((t) => t >= REPLAY_START - 6 * 3600_000).sort((a, b) => a - b);
  const out = [];
  for (const t of starts) {
    if (!out.length || t - 3 * 60_000 - out[out.length - 1].at > 3600_000) {
      out.push({ at: t - 3 * 60_000, label: new Date(t).toLocaleString("en-US", { ...ET, hour: "numeric", minute: "2-digit" }).replace(":00", "") });
    }
  }
  return out;
}

function renderSetup(el) {
  el.innerHTML = `<form class="setup" id="setup">
    <h1>Connect your Sleeper league</h1>
    <p>Type your Sleeper username. The app finds your leagues, team, opponent and scoring by itself. No password needed.</p>
    <label class="label" for="username">Sleeper username</label>
    <input id="username" autocomplete="username" required placeholder="ontopgun">
    <button class="go" type="submit">Connect</button>
    <button class="chipbtn" type="button" data-mode="replay">Or watch last Sunday's replay</button>
    ${ui.error ? `<p class="err">${esc(ui.error)}</p>` : ""}
  </form>`;
  $("#setup").addEventListener("submit", (e) => {
    e.preventDefault();
    ui.username = $("#username").value.trim();
    store.set("username", ui.username);
    startLive();
  });
}

function updateNewPill() {
  const pill = $("#newpill");
  pill.hidden = !(ui.newCount > 0 && ui.screen === "zone");
  pill.textContent = `↑ ${ui.newCount} new ${ui.newCount === 1 ? "play" : "plays"}`;
}

// ---------- Controls ----------

document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-game],[data-nav],[data-filter],[data-more],[data-speed],[data-jump],[data-mode]");
  if (!t) return;
  if (t.dataset.game) return go("game", t.dataset.game);
  if (t.dataset.nav) return go(t.dataset.nav);
  if (t.dataset.filter) { ui.filter = t.dataset.filter; store.set("filter", ui.filter); ui.feedLimit = FEED_PAGE; return render(); }
  if (t.dataset.more !== undefined) { ui.feedLimit += FEED_PAGE; return render(); }
  if (t.dataset.speed !== undefined) { ui.speed = Number(t.dataset.speed); store.set("speed", ui.speed); return updateReplayClock(); }
  if (t.dataset.jump) {
    ui.replay.jump(Number(t.dataset.jump));
    ui.tracker = ui.replay.tracker;
    ui.lastWp.clear(); ui.wpDelta.clear(); ui.elsewhere = null;
    return render();
  }
  if (t.dataset.mode === "replay") return startReplay();
  if (t.dataset.mode === "live") {
    if (ui.username) return startLive();
    clearInterval(ui.timer);
    ui.mode = "live"; ui.tracker = null;
    return render();
  }
});
document.addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && e.target.matches("article.play[data-game]")) { e.preventDefault(); go("game", e.target.dataset.game); }
});
$("#newpill").addEventListener("click", () => {
  const feed = $("#feed");
  if (feed) window.scrollTo({ top: feed.getBoundingClientRect().top + window.scrollY - 70, behavior: "smooth" });
  ui.newCount = 0; updateNewPill();
});
window.addEventListener("scroll", () => {
  if (ui.newCount && window.scrollY < 200) { ui.newCount = 0; updateNewPill(); }
}, { passive: true });
window.addEventListener("resize", () => {
  if (wide() !== ui.wasWide) {
    ui.wasWide = wide();
    if (ui.screen === "game" && wide()) { ui.panelId = ui.gameId; ui.screen = "zone"; }
    if (ui.tracker) render();
  }
});
setInterval(renderHeader, 1000);

// ---------- Start ----------

ui.hasServer = await fetch("/proxy/ping").then((r) => r.ok).catch(() => false);
if (ui.hasServer) {
  ui.mode = "live";
  if (ui.username) startLive(); else render();
} else {
  startReplay();
}
