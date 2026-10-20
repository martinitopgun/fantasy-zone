// What goes inside the bottom sheets (clock, live, Find, settings) and the "connect your league" form.
// Plain HTML strings; app.js opens them with the sheet from ui/layers.js.

import { esc, ET } from "./cards.js";
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

export function findSheetHTML() {
  return `<h2 class="sheet-title" id="sheet-title">Find</h2>
    <p>Search for any player or game. This arrives in the next step.</p>
    <p class="sheet-note">Until then, the Games tab lists every game, and tapping a play opens its game.</p>
    <div class="sheet-actions">
      <button class="chipbtn" type="button" data-act="open-games">Open Games</button>
      <button class="chipbtn" type="button" data-close="sheet">Done</button>
    </div>`;
}

export function settingsSheetHTML() {
  return `<h2 class="sheet-title" id="sheet-title">Settings</h2>
    <p>Settings arrive in a later step: fantasy on or off, banners for big plays, shapes for colour-blind viewers, and hiding the game chips.</p>
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
