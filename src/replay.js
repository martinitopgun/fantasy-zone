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
    const batch = new Map();
    while (idx < plays.length && plays[idx].wallclock <= until) {
      const p = plays[idx++];
      if (!batch.has(p.gameId)) batch.set(p.gameId, []);
      batch.get(p.gameId).push(p);
    }
    const cards = [];
    for (const [gameId, list] of batch) cards.push(...tracker.addPlays(gameId, list, { silent }));
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

// Kickoff windows of the day, for the jump buttons.
export function windows(data) {
  const starts = [...new Set(data.games.map((g) => Date.parse(g.kickoff)))].sort((a, b) => a - b);
  const firstPlay = Math.min(...data.plays.map((p) => p.wallclock));
  return starts.filter((s) => s >= firstPlay - 3 * 3600_000 || true);
}
