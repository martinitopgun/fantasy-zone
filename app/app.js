// Fantasy Zone app. Three ways to run:
//   live    when served by server.js (npm start): syncs Sleeper + ESPN every 10 seconds
//   sim     a simulated Sunday: real Week 6 schedule, players and league, made-up plays (sim.js)
//   replay  real snapshots saved from Sunday night, Week 6 (demo.json)

import { rankGames, detectBigPlays, gameScore, DIALS } from "./src/model.js";

const POLL_MS = 10_000;
const REPLAY_MS = 7_000;
const SWITCH_RATIO = 1.3; // a game must score 30% higher to take the big screen
const SWITCH_COOLDOWN_MS = 20_000;
const SIM_TICK_MS = 1_500; // one play per game at 1x
const TOAST_GAP_MS = 2_500; // at most one new pop-up this often

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const store = {
  get(k, d) { try { const v = localStorage.getItem(`fz:${k}`); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(`fz:${k}`, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};

const ui = {
  mode: null, // "live" | "sim" | "replay"
  speed: store.get("speed", 3),
  stop: null, // stops the current data source
  view: store.get("view", "focus"),
  fantasy: store.get("fantasy", true),
  username: store.get("username", null),
  pinned: null, // game id the user tapped, overrides auto-switching
  focusId: null,
  lastSwitch: 0,
  data: null, prev: null,
  feeds: new Map(), // game id -> [{ clock, text, big }]
  flashes: new Set(), // player ids whose points just went up
  updatedAt: 0,
  error: null,
};

// ---------- Data sources ----------

async function startLive() {
  const { makeFetchJson } = await import("./src/net.js");
  const { syncEverything } = await import("./src/sync.js");
  const fetchJson = makeFetchJson({
    rewrite: (u) => u.replace("https://api.sleeper.app", "/proxy/sleeper").replace("https://site.api.espn.com", "/proxy/espn"),
  });
  const tick = async () => {
    try {
      const d = await syncEverything(fetchJson, { username: ui.username });
      ui.error = null;
      ingest({ games: d.games, matchups: d.matchups, week: d.week, user: d.user.display_name });
    } catch (e) {
      ui.error = e.message;
      render();
    }
  };
  await tick();
  const timer = setInterval(tick, POLL_MS);
  ui.stop = () => clearInterval(timer);
}

async function startSim() {
  const [{ createSim }, slate] = await Promise.all([import("./sim.js"), fetch("slate.json").then((r) => r.json())]);
  let sim, timer;
  const run = () => {
    clearInterval(timer);
    if (sim.done) return;
    timer = setInterval(() => {
      ingest({ ...sim.step(), week: 6, user: "ontopgun" });
      if (sim.done) { clearInterval(timer); render(); }
    }, SIM_TICK_MS / ui.speed);
  };
  ui.restartSim = () => {
    resetView();
    sim = createSim(slate);
    ingest({ ...sim.snapshot(), week: 6, user: "ontopgun" });
    run();
  };
  ui.setSpeed = (x) => { ui.speed = x; store.set("speed", x); run(); render(); };
  ui.simDone = () => sim?.done;
  ui.stop = () => clearInterval(timer);
  ui.restartSim();
}

function resetView() {
  ui.data = null; ui.prev = null; ui.feeds.clear(); ui.focusId = null; ui.pinned = null; ui.lastSwitch = 0;
  toastQueue.length = 0;
  $("#toasts").replaceChildren();
}

function switchMode(mode) {
  ui.stop?.();
  ui.stop = null;
  ui.mode = mode;
  ui.error = null;
  resetView();
  render();
  if (mode === "sim") startSim();
  else if (mode === "replay") startReplay();
  else if (ui.username) startLive();
}

async function startReplay() {
  const demo = await (await fetch("demo.json")).json();
  let i = 0, timer = null;
  const next = () => {
    const f = demo.frames[i];
    // Re-link each player to his game object (the file stores only the id).
    for (const m of f.matchups) for (const p of [...m.mine, ...m.theirs]) p.game = f.games.find((g) => g.id === p.gameId) ?? null;
    ui.replay = { step: i + 1, steps: demo.frames.length, done: i === demo.frames.length - 1 };
    ingest({ games: f.games, matchups: f.matchups, week: demo.week, user: demo.user });
    i += 1;
    if (i >= demo.frames.length) clearInterval(timer); // play once, then stop on the last moment
  };
  ui.restartReplay = () => {
    clearInterval(timer);
    i = 0;
    resetView();
    next();
    timer = setInterval(next, REPLAY_MS);
  };
  ui.stop = () => clearInterval(timer);
  ui.restartReplay();
}

// ---------- Each update ----------

function ingest(d) {
  const before = ui.data;
  ui.prev = before;
  ui.data = d;
  ui.updatedAt = Date.now();

  // Play feed: keep each game's new "last play" lines.
  for (const g of d.games) {
    if (!g.lastPlay || g.state === "pre") continue;
    const list = ui.feeds.get(g.id) ?? [];
    if (list[0]?.text !== g.lastPlay) {
      const old = before?.games.find((x) => x.id === g.id);
      const scored = old && g.homeScore + g.awayScore > old.homeScore + old.awayScore;
      list.unshift({ clock: g.state === "post" ? "Final" : `Q${g.period} ${clock(g.clockSec)}`, text: g.lastPlay, big: scored });
      ui.feeds.set(g.id, list.slice(0, 12));
    }
  }

  // Players whose points went up get a yellow/purple flash.
  ui.flashes.clear();
  if (before) {
    const was = new Map(before.matchups.flatMap((m) => [...m.mine, ...m.theirs]).map((p) => [`${p.owner}:${p.id}`, p.current]));
    for (const m of d.matchups) for (const p of [...m.mine, ...m.theirs]) if (p.current > (was.get(`${p.owner}:${p.id}`) ?? p.current)) ui.flashes.add(`${p.owner}:${p.id}`);
  }

  chooseFocus();
  // Pop-ups: fantasy swings, plays by your or your opponent's players, and touchdowns/turnovers
  // in close games. Never for the game already on the big screen.
  if (before) {
    const starters = d.matchups.flatMap((m) => [...m.mine, ...m.theirs]);
    for (const p of detectBigPlays(before.games, d.games, { matchupsBefore: before.matchups, matchupsAfter: d.matchups })) {
      if (p.kind === "fantasy") { if (ui.fantasy) queueToast(p); continue; }
      if (p.gameId === ui.focusId) continue;
      const g = d.games.find((x) => x.id === p.gameId);
      const play = g?.lastPlay ?? "";
      const who = ui.fantasy && play ? starters.find((x) => x.pos !== "DEF" && play.includes(shortName(x))) : null;
      const close = g && gameScore({ ...g, state: "in" }).score >= 35;
      if (who) queueToast({ ...p, who, play });
      else if (close && (p.kind === "touchdown" || p.kind === "turnover")) queueToast({ ...p, play });
    }
  }
  render();
}

// "Jayden Daniels" -> "J.Daniels", the way play-by-play names players.
const shortName = (p) => p.short ?? (p.name.includes(" ") ? `${p.name[0]}.${p.name.split(" ").slice(1).join(" ")}` : p.name);

function ranked() {
  if (!ui.data) return [];
  return rankGames({ games: ui.data.games, matchups: ui.data.matchups, dials: ui.fantasy ? DIALS.fantasyOn : DIALS.fantasyOff });
}

// Games you can follow right now come first; games that haven't started wait their turn.
function watchable() {
  const r = ranked();
  return [...r.filter((x) => x.game.state === "in"), ...r.filter((x) => x.game.state === "pre")];
}

function chooseFocus() {
  const r = watchable();
  if (!r.length) { ui.focusId = null; return; }
  if (ui.pinned && r.some((x) => x.game.id === ui.pinned)) { ui.focusId = ui.pinned; return; }
  ui.pinned = null;
  const current = r.find((x) => x.game.id === ui.focusId);
  const best = r[0];
  const cooled = Date.now() - ui.lastSwitch > SWITCH_COOLDOWN_MS / (ui.mode === "sim" ? ui.speed : 1);
  const kickedOff = current?.game.state === "pre" && best.game.state === "in";
  if (!current || kickedOff || (best.game.id !== current.game.id && best.watch > current.watch * SWITCH_RATIO && cooled)) {
    if (current) queueToast({ kind: "switch", gameId: best.game.id, text: `${best.game.name}: ${best.reason}` });
    ui.focusId = best.game.id;
    ui.lastSwitch = Date.now();
  }
}

// ---------- Pop-ups ----------

const toastQueue = [];
let lastToastAt = 0;
function queueToast(pop) {
  toastQueue.push(pop);
  if (toastQueue.length > 3) toastQueue.shift(); // keep only the newest few
}
setInterval(() => {
  const gap = TOAST_GAP_MS / (ui.mode === "sim" ? Math.min(ui.speed, 3) : 1);
  if (!toastQueue.length || Date.now() - lastToastAt < gap) return;
  lastToastAt = Date.now();
  toast(toastQueue.shift(), ui.data);
}, 250);

function toast(pop, d) {
  if (!d) return;
  const el = document.createElement("button");
  el.type = "button";
  let title, body = pop.text ?? "", tone = "";
  if (pop.kind === "fantasy") {
    const up = pop.to > pop.from;
    title = `${up ? "▲" : "▼"} ${pop.league}`;
    body = `Win chance ${pct(pop.from)} → ${pct(pop.to)}`;
    tone = up ? "good" : "bad";
  } else if (pop.kind === "switch") {
    title = "Big screen switched";
  } else {
    title = { touchdown: "Touchdown", turnover: "Turnover", "big play": "Big play", "momentum swing": "Momentum swing" }[pop.kind] ?? pop.kind;
    title += ` · ${pop.game}`;
    if (pop.who) {
      // A fantasy starter made the play: yellow for yours, purple for your opponent's.
      tone = pop.who.owner === "me" ? "me" : "opponent";
      body = `${pop.who.owner === "me" ? "Your" : "Opponent's"} ${pop.who.pos} · ${pop.play}`;
    } else if (pop.play && pop.kind !== "touchdown") {
      body = pop.play;
    }
  }
  if (!ui.fantasy && (pop.kind === "fantasy")) return;
  el.className = `toast ${tone}`;
  el.innerHTML = `<b>${esc(title)}</b><span>${esc(body)}</span>`;
  el.addEventListener("click", () => { if (pop.gameId) { ui.pinned = pop.gameId; ui.focusId = pop.gameId; render(); } el.remove(); });
  $("#toasts").prepend(el);
  setTimeout(() => el.remove(), 6000);
  while ($("#toasts").children.length > 2) $("#toasts").lastChild.remove();
}

// ---------- Rendering ----------

const pct = (x) => (x > 0.99 && x < 1 ? ">99%" : x < 0.01 && x > 0 ? "<1%" : `${Math.round(x * 100)}%`);
const n1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function render() {
  renderHeader();
  const root = $("#root");
  if (ui.mode === "live" && !ui.username) return renderSetup(root);
  if (!ui.data) {
    root.innerHTML = ui.error ? `<p class="note">Couldn't load data: ${esc(ui.error)}</p>` : `<p class="note">Loading…</p>`;
    return;
  }
  const r = ranked();
  const note = ui.mode === "sim" ? simNote() : ui.mode === "replay"
    ? `<p class="note"><b style="color:var(--chalk)">Replay, not live.</b> Three real moments saved from Sunday night, Week 6 (DAL @ GB, 2nd quarter) in ${esc(ui.data.user)}'s league, shown in order${ui.replay?.done ? ". Replay finished." : ` (moment ${ui.replay?.step} of ${ui.replay?.steps})…`} This preview can't connect to live games; run the app on a computer (npm start) for that.
        ${ui.replay?.done ? `<button class="pill" type="button" data-replay>Watch the replay again</button>` : ""}
        <button class="pill" type="button" data-mode="sim">Simulated Sunday</button></p>`
    : `<p class="note">${ui.error ? `Last update failed (${esc(ui.error)}). Retrying in ${POLL_MS / 1000}s. ` : ""}<button class="pill" type="button" data-mode="sim">Try the demo Sunday</button></p>`;
  root.innerHTML = note + renderLeagues() + (ui.view === "guys" ? renderGuys() : renderBoard(r));
  root.querySelectorAll("[data-game]").forEach((b) => b.addEventListener("click", () => {
    ui.pinned = b.dataset.game; ui.focusId = b.dataset.game; render();
  }));
  root.querySelector("[data-replay]")?.addEventListener("click", () => ui.restartReplay());
  root.querySelector("[data-restart]")?.addEventListener("click", () => ui.restartSim());
  root.querySelectorAll("[data-speed]").forEach((b) => b.addEventListener("click", () => ui.setSpeed(Number(b.dataset.speed))));
  root.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => switchMode(b.dataset.mode)));
  root.querySelector("[data-auto]")?.addEventListener("click", () => { ui.pinned = null; ui.lastSwitch = 0; chooseFocus(); render(); });
}

function simNote() {
  const done = ui.simDone?.();
  return `<div class="note simbar"><span><b style="color:var(--chalk)">Simulated Sunday, not real games.</b> The real Week 6 schedule, players and projections in ${esc(ui.data.user)}'s league, with made-up plays to test the app${done ? ". All games final." : "."}</span>
    <span class="simctl"><span class="seg" role="group" aria-label="Speed">${[1, 3, 10].map((x) => `<button type="button" data-speed="${x}" aria-pressed="${ui.speed === x}">${x}×</button>`).join("")}</span>
    <button class="pill" type="button" data-restart>${done ? "Play again" : "Restart"}</button>
    <button class="pill" type="button" data-mode="replay">Real Sunday-night replay</button>
    ${ui.hasServer ? `<button class="pill" type="button" data-mode="live">Back to live</button>` : ""}</span></div>`;
}

function renderHeader() {
  const s = $("#status");
  const live = ui.mode === "live";
  s.className = `status ${live && !ui.error ? "live" : ""}`;
  const ago = ui.updatedAt ? Math.round((Date.now() - ui.updatedAt) / 1000) : null;
  s.querySelector("span").textContent = live ? (ui.error ? "Reconnecting" : `Live · ${ago ?? 0}s ago`) : ui.mode === "replay" ? "Replay · not live" : ui.mode === "sim" ? "Simulated · not real" : "Loading";
  $("#fantasyToggle").setAttribute("aria-pressed", String(ui.fantasy));
  document.querySelectorAll("[data-view]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === ui.view)));
}

function renderLeagues() {
  if (!ui.fantasy || !ui.data.matchups.length) return "";
  return `<section class="leagues" aria-label="Your matchups">${ui.data.matchups.map((m) => {
    const old = ui.prev?.matchups.find((x) => x.league.league_id === m.league.league_id);
    const d = old ? m.winProb - old.winProb : 0;
    const delta = Math.abs(d) >= 0.01 ? `<span class="delta ${d > 0 ? "up" : "down"}">${d > 0 ? "▲" : "▼"} ${Math.round(Math.abs(d) * 100)}</span>` : "";
    return `<article class="league">
      <div class="name"><span>${esc(m.league.name)}</span><span>${esc(m.info.format)}</span></div>
      <div class="score num"><div>${n1(m.myNow)}<small>You · proj ${n1(m.myFinal)}</small></div>
        <div style="text-align:right">${n1(m.oppNow)}<small>${esc(m.opponentName)} · proj ${n1(m.oppFinal)}</small></div></div>
      <div class="wpbar" role="img" aria-label="Win chance ${pct(m.winProb)}"><span style="width:${(m.winProb * 100).toFixed(1)}%"></span></div>
      <div class="name"><span>Win chance <b style="color:var(--chalk)">${pct(m.winProb)}</b> ${delta}</span></div>
    </article>`;
  }).join("")}</section>`;
}

function renderBoard(r) {
  const open = watchable();
  const finals = r.filter((x) => x.game.state === "post");
  const focus = open.find((x) => x.game.id === ui.focusId) ?? open[0];
  const rest = open.filter((x) => x !== focus);
  const liveRest = rest.filter((x) => x.game.state === "in"), later = rest.filter((x) => x.game.state === "pre");
  const laterList = later.length ? `<h3>Coming up</h3>${later.map(miniCard).join("")}` : "";
  const doneLine = finals.length ? `<p class="done">${finals.length} games final today: ${finals.map((x) => `${esc(x.game.away)} ${x.game.awayScore}–${x.game.homeScore} ${esc(x.game.home)}`).join(" · ")}</p>` : "";
  if (!focus) return `<main class="board"><p class="note">No games left this week.</p>${doneLine}</main>`;
  if (ui.view === "grid") {
    return `<main class="board grid">${focusCard(focus)}${liveRest.map(miniCard).join("")}</main>
      <section class="side">${laterList}${doneLine}</section>`;
  }
  return `<main class="board focus">${focusCard(focus)}
    <aside class="side"><h3>Also live</h3>${liveRest.map(miniCard).join("") || `<p class="done">Nothing else live.</p>`}${laterList}${doneLine}</aside></main>`;
}

function focusCard(x) {
  const g = x.game;
  const hot = x.live >= 2;
  const ball = (t) => (g.offense === t ? `<i class="ballmark" title="Has the ball"></i>` : "");
  const status = g.state === "pre" ? `<b>${kickoffLabel(g)}</b>Kickoff`
    : `<b>Q${g.period > 4 ? "OT" : g.period} ${clock(g.clockSec)}</b>${g.homeWinProb != null ? `${esc(g.home)} win ${pct(g.homeWinProb)}` : ""}`;
  const feed = ui.feeds.get(g.id) ?? [];
  return `<section class="card focus-card ${hot ? "hot" : ""}" aria-label="Big screen">
    <div class="eyebrow"><span>★ Big screen</span>
      ${ui.pinned ? `<button class="pill pinned" type="button" data-auto>Pinned · back to auto</button>` : `<span class="pill auto">Auto</span>`}
      <span class="ws num">Watch score ${Math.round(x.watch)}</span></div>
    <div class="scoreline">
      <div class="team"><span class="abbr">${esc(g.away)} ${ball(g.away)}</span><span class="pts num">${g.awayScore}</span></div>
      <div class="clock num">${status}</div>
      <div class="team home"><span class="abbr">${ball(g.home)} ${esc(g.home)}</span><span class="pts num">${g.homeScore}</span></div>
    </div>
    ${g.state === "in" && g.offense ? `<div class="situation">${esc(g.offense)} ball · ${esc(g.downText ?? "")}</div>${fieldSvg(g)}` : ""}
    <p class="why"><strong>Why:</strong> ${esc(x.reason)}</p>
    ${ui.fantasy && x.involved.length ? `<div class="stakes">${x.involved.map(stakeRow).join("")}</div>` : ""}
    ${feed.length ? `<div class="feed"><h3>Play by play</h3>${feed.map((p) => `<div class="play ${p.big ? "big" : ""}"><span class="t num">${esc(p.clock)}</span><span>${esc(p.text)}</span></div>`).join("")}</div>` : ""}
  </section>`;
}

const kickoffLabel = (g) => (ui.mode === "sim" ? "Later today" : new Date(g.kickoff).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" }));

function stakeRow(p) {
  const key = `${p.owner}:${p.id}`;
  return `<div class="stake ${p.owner} ${ui.flashes.has(key) ? "flash" : ""}">
    <span class="pos">${esc(p.pos)}</span>
    <span class="who">${esc(p.name)} <small>· ${p.owner === "me" ? "you" : "opponent"}${p.roleWhy ? ` · ${esc(p.roleWhy)}` : ""}</small></span>
    <span class="now num">${n1(p.current)}</span>
    <span class="left num">+${n1(p.remaining)}<br>to go</span>
  </div>`;
}

function miniCard(x) {
  const g = x.game;
  const meta = g.state === "pre" ? kickoffLabel(g)
    : `Q${g.period} ${clock(g.clockSec)}${g.downText ? ` · ${g.downText}` : ""}`;
  const hot = x.live >= 2;
  return `<button class="mini ${hot ? "hot" : ""}" type="button" data-game="${esc(g.id)}" aria-label="Show ${esc(g.name)} on the big screen">
    <div class="row"><span class="teams num">${esc(g.away)} ${g.state === "pre" ? "" : g.awayScore} <span style="color:var(--mute)">@</span> ${esc(g.home)} ${g.state === "pre" ? "" : g.homeScore}</span>
      <span class="meta num">${hot ? "🔥 " : ""}${Math.round(x.watch)}</span></div>
    <div class="meter"><span style="width:${Math.min(100, x.watch)}%"></span></div>
    <div class="meta">${esc(meta)}</div>
    <div class="why">${esc(x.reason)}</div>
  </button>`;
}

// The field from the offense's point of view: own goal line on the left, scoring end on the right.
function fieldSvg(g) {
  const W = 600, H = 64, ez = 40, play = W - 2 * ez;
  const x = (yd) => ez + (yd / 100) * play;
  const ballYd = 100 - (g.yardsToGoal ?? 50);
  const lines = [];
  for (let yd = 10; yd < 100; yd += 10) {
    lines.push(`<line x1="${x(yd)}" y1="6" x2="${x(yd)}" y2="${H - 6}" stroke="var(--field-line)" stroke-width="1"/>`);
    lines.push(`<text x="${x(yd)}" y="${H - 9}" text-anchor="middle" font-size="10" fill="var(--mute)" font-family="Barlow Condensed, sans-serif">${yd <= 50 ? yd : 100 - yd}</text>`);
  }
  const toGain = g.distance && g.yardsToGoal > g.distance ? x(ballYd + g.distance) : null;
  return `<svg class="field" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(g.offense)} ball, ${g.yardsToGoal} yards from the end zone">
    <rect x="0" y="0" width="${W}" height="${H}" rx="8" fill="var(--field)"/>
    <rect x="${x(80)}" y="0" width="${x(100) - x(80)}" height="${H}" fill="var(--down)" opacity="0.14"/>
    <rect x="${W - ez}" y="0" width="${ez}" height="${H}" rx="8" fill="var(--down)" opacity="0.3"/>
    <rect x="0" y="0" width="${ez}" height="${H}" rx="8" fill="var(--field-line)" opacity="0.6"/>
    ${lines.join("")}
    ${toGain ? `<line x1="${toGain}" y1="4" x2="${toGain}" y2="${H - 4}" stroke="var(--you)" stroke-width="2" stroke-dasharray="4 3"/>` : ""}
    <line x1="${x(ballYd)}" y1="4" x2="${x(ballYd)}" y2="${H - 4}" stroke="var(--chalk)" stroke-width="2"/>
    <ellipse cx="${x(ballYd)}" cy="${H / 2 - 4}" rx="9" ry="5.5" fill="var(--you)" stroke="var(--you-ink)" stroke-width="1"/>
    <text x="${W - ez / 2}" y="${H / 2}" text-anchor="middle" dominant-baseline="middle" font-size="11" font-weight="700" fill="var(--chalk)" font-family="Barlow Condensed, sans-serif" transform="rotate(90 ${W - ez / 2} ${H / 2})">END ZONE</text>
  </svg>`;
}

function renderGuys() {
  const rows = ui.data.matchups.flatMap((m) => [...m.mine, ...m.theirs].map((p) => ({ ...p, league: m.league.name })));
  rows.sort((a, b) => (b.remaining > 0) - (a.remaining > 0) || (a.owner === "me" ? -1 : 1) - (b.owner === "me" ? -1 : 1) || b.current - a.current);
  const status = (p) => !p.game ? `<span class="tag">Bye</span>` : p.game.state === "in" ? `<span class="tag live">Live</span>` : p.game.state === "pre" ? `<span class="tag">Later</span>` : `<span class="tag">Done</span>`;
  return `<main class="board"><section class="card guys-wrap"><table class="guys">
    <thead><tr><th>Player</th><th>Team</th><th>Status</th><th style="text-align:right">Pts</th><th style="text-align:right">To go</th><th style="text-align:right">Boom</th></tr></thead>
    <tbody>${rows.map((p) => `<tr class="${p.owner} ${ui.flashes.has(`${p.owner}:${p.id}`) ? "flash" : ""}">
      <td><b>${esc(p.name)}</b> <span style="color:var(--mute)">${esc(p.pos)} · ${p.owner === "me" ? "you" : "opponent"}</span></td>
      <td>${esc(p.nflTeam ?? "")}</td><td>${status(p)}</td>
      <td class="n num">${n1(p.current)}</td><td class="n num">${p.remaining > 0 ? n1(p.remaining) : "–"}</td>
      <td class="n num" title="${p.profile.booms} booms in ${p.profile.games} games">${(p.boomFactor ?? 1).toFixed(2)}</td></tr>`).join("")}</tbody>
  </table></section></main>`;
}

function renderSetup(root) {
  root.innerHTML = `<form class="card setup" id="setup">
    <h1>Connect your Sleeper league</h1>
    <p class="why">Type your Sleeper username. The app finds your leagues, team, opponent and scoring by itself. No password needed.</p>
    <label for="username">Sleeper username</label>
    <input id="username" autocomplete="username" required placeholder="ontopgun">
    <button class="go" type="submit">Connect</button>
    <button class="pill" type="button" data-demo>Or try the demo Sunday</button>
    ${ui.error ? `<p class="err">${esc(ui.error)}</p>` : ""}
  </form>`;
  root.querySelector("[data-demo]").addEventListener("click", () => switchMode("sim"));
  $("#setup").addEventListener("submit", (e) => {
    e.preventDefault();
    ui.username = $("#username").value.trim();
    store.set("username", ui.username);
    startLive();
  });
}

// ---------- Controls ----------

$("#fantasyToggle").addEventListener("click", () => { ui.fantasy = !ui.fantasy; store.set("fantasy", ui.fantasy); chooseFocus(); render(); });
document.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => { ui.view = b.dataset.view; store.set("view", ui.view); render(); }));
setInterval(renderHeader, 1000);

// ---------- Start ----------

ui.hasServer = await fetch("/proxy/ping").then((r) => r.ok).catch(() => false);
switchMode(ui.hasServer ? "live" : "sim");
