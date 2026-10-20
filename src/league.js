// The League tab's numbers (plan M6). Pure, no DOM.
//   liveMatchups(board, pairings, teams) -> the 5 pairings with points now, expected finals and win chances
//   standings(results, board, pairings) -> teams by record through week 5 (then points for), with this week live
// Standings never use Sleeper's roster `settings`: once Sleeper processes Week 6 they include it, which would
// spoil the replay and count this week twice.

import { winChance } from "./model.js";

export function liveMatchups(board, pairings, teams) {
  const by = new Map(board.map((b) => [b.roster_id, b]));
  const team = new Map(teams.map((t) => [t.roster_id, t]));
  return pairings.map((pair) => {
    // Yours first, otherwise in Sleeper's order.
    const [a, b] = pair.map((id) => ({ ...team.get(id), ...by.get(id) })).sort((x, y) => (y.me ? 1 : 0) - (x.me ? 1 : 0));
    const p = winChance(a.final - b.final, Math.sqrt(a.spread2 + b.spread2));
    return { a, b, aWin: p, mine: !!(a.me || b.me), done: a.playing + a.toPlay + b.playing + b.toPlay === 0 };
  }).sort((x, y) => (y.mine ? 1 : 0) - (x.mine ? 1 : 0));
}

export function standings(results, teams, live = []) {
  const rec = new Map(teams.map((t) => [t.roster_id, { roster_id: t.roster_id, owner: t.owner, me: t.me, w: 0, l: 0, t: 0, pf: 0 }]));
  for (const { rows } of results) {
    for (const r of rows) rec.get(r.roster_id).pf += r.points;
    for (const pair of Object.values(Object.groupBy(rows, (r) => r.matchup_id))) {
      if (pair.length !== 2) continue;
      const [x, y] = pair;
      const a = rec.get(x.roster_id), b = rec.get(y.roster_id);
      if (x.points > y.points) { a.w++; b.l++; } else if (x.points < y.points) { a.l++; b.w++; } else { a.t++; b.t++; }
    }
  }
  // This week, as it stands: "W" or "L" (or "T") so far, next to the record.
  for (const m of live) {
    const d = m.a.now - m.b.now;
    rec.get(m.a.roster_id).now = d > 0 ? "W" : d < 0 ? "L" : "T";
    rec.get(m.b.roster_id).now = d < 0 ? "W" : d > 0 ? "L" : "T";
  }
  return [...rec.values()].sort((a, b) => b.w + b.t / 2 - (a.w + a.t / 2) || b.pf - a.pf);
}
