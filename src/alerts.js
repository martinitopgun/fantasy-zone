// Heads-up banners (plan M4): which new plays deserve a banner. Pure, no DOM, so it runs in tests.
// A banner never moves you anywhere; the app shows one at a time and a tap opens the game.
//
// Triggers, for your matchup:
//   a touchdown by your or your opponent's starter, a turnover that moved fantasy points, your win chance
//   moving 5 points or more on one play, and the lead changing hands (who has more points right now).
// Never: halftime/final markers, plays replayed silently by a jump, plays from the games in `skip`
// (the open game, the pinned game while its bar shows). A lead change on a kickoff doesn't count: in the
// replay the lead "flips" at 4:05 and 4:25 PM only because a D/ST starts with its points-allowed bonus.
//
//   const alerts = createAlerts()
//   alerts.prime(snap)                   after a start or jump: remember who's ahead, nothing to say yet
//   alerts.take(cards, snap, { skip })   the new cards of one update -> alerts, biggest first:
//     [{ cardId, gameId, owner: "me"|"opponent", kind, text, weight, wpMove, lead: "me"|"opponent"|null }]

import { cardOwner } from "./view-models.js";

const lastName = (n) => String(n ?? "").split(" ").slice(1).join(" ") || String(n ?? "");
const pct = (p) => (p >= 0.995 ? ">99%" : p <= 0.005 ? "<1%" : `${Math.round(p * 100)}%`);
const net = (c) => c.impacts.reduce((s, i) => s + (i.owner === "me" ? i.delta : -i.delta), 0);
const side = (lead) => (lead > 0.001 ? "me" : lead < -0.001 ? "opponent" : null);

export const WP_ALERT = 0.05;

export function createAlerts() {
  let lead = 0;

  function prime(snap) {
    const m = snap?.matchups[0];
    lead = m ? m.myNow - m.oppNow : 0;
  }

  function take(cards, snap, { skip = [] } = {}) {
    const m = snap?.matchups[0];
    if (!m) return [];
    const out = [];
    for (const c of [...cards].sort((a, b) => a.wallclock - b.wallclock)) {
      const before = lead;
      lead += net(c);
      if (c.kind === "marker" || c.silent || skip.includes(c.gameId)) continue;
      const w = c.wp?.[0], wpMove = w ? w.after - w.before : 0;
      const flipped = c.kind !== "kickoff" && side(before) !== side(lead) && side(lead) !== null;
      const td = c.td && c.impacts.some((i) => i.delta >= 3.5);
      const to = c.turnover && c.impacts.length > 0;
      const big = Math.abs(wpMove) >= WP_ALERT;
      if (!td && !to && !big && !flipped) continue;
      const owner = cardOwner(c) || (wpMove >= 0 ? "me" : "opponent");
      const kind = td ? "td" : to ? "turnover" : big ? "swing" : "lead";
      const what = kind === "lead" ? (side(lead) === "me" ? "You took the lead" : "They took the lead")
        : `${lastName(c.name)} ${c.label}${c.turnover && !/intercept/i.test(c.label) ? ", fumble lost" : ""}`.trim();
      const parts = [what];
      if (w && Math.abs(wpMove) >= 0.005) parts.push(`Win ${pct(w.before)}→${pct(w.after)}`);
      if (flipped && kind !== "lead") parts.push(side(lead) === "me" ? "You lead" : "They lead");
      out.push({
        cardId: c.id, gameId: c.gameId, owner, kind, text: parts.join(" · "), wpMove,
        lead: flipped ? side(lead) : null,
        weight: (td ? 3 : to ? 2.5 : flipped ? 2 : 1) + Math.abs(wpMove) * 10,
      });
    }
    // Back in step with the real score (a D/ST's starting bonus never shows up as a play's points).
    lead = m.myNow - m.oppNow;
    return out.sort((a, b) => b.weight - a.weight);
  }

  return { prime, take };
}
