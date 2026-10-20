// Replays a real Sunday from saved play-by-play, at real speed (1x) or faster.
// Plays arrive when they really happened (ESPN's wallclock), so overlapping games overlap here too.

import { createTracker } from "./tracker.js";

export function createReplay(data, { startAt }) {
  const plays = [...data.plays].sort((a, b) => a.wallclock - b.wallclock);
  let tracker, t, idx;

  function reset(at) {
    tracker = createTracker({ leagues: data.leagues, players: data.players, games: data.games });
    t = at; idx = 0;
    emit(at, true); // everything before the start time is already history
  }

  // Apply every play up to time `until`. Returns the new feed cards.
  function emit(until, silent = false) {
    // Plays go in exactly in time order, even across games (a jump covers hours of several games at once),
    // so every win chance on the way is the real one at that moment. Back-to-back plays of one game go together.
    const cards = [];
    let run = [];
    const flushRun = () => { if (run.length) cards.push(...tracker.addPlays(run[0].gameId, run, { silent })); run = []; };
    while (idx < plays.length && plays[idx].wallclock <= until) {
      const p = plays[idx++];
      if (run.length && run[0].gameId !== p.gameId) flushRun();
      run.push(p);
    }
    flushRun();
    return cards.sort((a, b) => a.wallclock - b.wallclock);
  }

  reset(startAt);
  return {
    get tracker() { return tracker; },
    get time() { return t; },
    get done() { return idx >= plays.length; },
    // Move the replay clock forward by realMs x speed and return the plays that happened.
    advance(realMs, speed) {
      t += realMs * speed;
      return emit(t);
    },
    // Jump to a moment. Going back rebuilds the day from the start.
    jump(at) {
      if (at < t) reset(at);
      else { t = at; emit(at, true); }
    },
    nextPlayAt: () => plays[idx]?.wallclock ?? null,
  };
}

// Kickoff windows of the day, for the jump buttons (and later the When filter): London morning, 1 PM, 4 PM, night.
// Only games with saved plays count. Kickoffs within an hour of each other share a window (4:25 joins 4:05).
// `from` (ms) drops earlier kickoffs; without it, only the busiest day's kickoffs count (so Thursday is left out).
// Each window: { at: 3 minutes before its first kickoff, kickoff, label: "4:05 PM", games: [game ids] }.
const ET = { timeZone: "America/New_York" };
const WINDOW_MS = 3600_000, LEAD_MS = 3 * 60_000;

export function windows(data, { from } = {}) {
  const played = new Set(data.plays.map((p) => p.gameId));
  const games = data.games.filter((g) => played.has(g.id)).map((g) => ({ id: g.id, t: Date.parse(g.kickoff) })).sort((a, b) => a.t - b.t);
  if (from == null) {
    const day = (t) => new Date(t).toLocaleDateString("en-CA", ET);
    const count = new Map();
    for (const g of games) count.set(day(g.t), (count.get(day(g.t)) ?? 0) + 1);
    const busiest = [...count].sort((a, b) => b[1] - a[1])[0]?.[0];
    from = games.find((g) => day(g.t) === busiest)?.t ?? -Infinity;
  }
  const out = [];
  for (const g of games.filter((x) => x.t >= from)) {
    const last = out[out.length - 1];
    if (last && g.t - LEAD_MS - last.at <= WINDOW_MS) { last.games.push(g.id); continue; }
    const label = new Date(g.t).toLocaleString("en-US", { ...ET, hour: "numeric", minute: "2-digit" }).replace(":00", "");
    out.push({ at: g.t - LEAD_MS, kickoff: g.t, label, games: [g.id] });
  }
  return out;
}
