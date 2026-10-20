// Pure helpers that explain your matchup in words. No DOM here, so they run in tests (and later, unchanged,
// in the phone app): a player's stat line in a few words, the sweat meter, what you need, who swings it most,
// and the plays that moved your win chance the most.

import { winChance } from "./model.js";

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const yds = (n) => plural(n, "yd", "yds").replace(/^-1 yds$/, "-1 yd");

// A player's stats so far as short text, for the lineup rows:
//   QB  "18/27 245 yds, 2 TD, 1 INT, 4 car 21 yds"
//   RB  "15 car 97 yds, 3 rec 18 yds, 2 TD"
//   WR/TE "6 rec 88 yds, 1 TD"
//   K   "2/2 FG, 3 XP"          DEF "2 sacks, 1 INT, 17 pts allowed"
// `line` is a tracker stat line (tracker.statLine), `pos` the player's position. "" when there's nothing yet.
export function statText(line, pos) {
  const n = (k) => line?.[k] ?? 0;
  const out = [];
  if (pos === "K") {
    const fga = n("fgm") + n("fgmiss"), xpa = n("xpm") + n("xpmiss");
    if (fga) out.push(`${n("fgm")}/${fga} FG`);
    if (xpa) out.push(n("xpmiss") ? `${n("xpm")}/${xpa} XP` : `${n("xpm")} XP`);
    return out.join(", ");
  }
  if (pos === "DEF") {
    if (n("sack")) out.push(plural(n("sack"), "sack"));
    if (n("int")) out.push(`${n("int")} INT`);
    if (n("fum_rec")) out.push(plural(n("fum_rec"), "fumble rec", "fumble recs"));
    const td = n("def_td") + n("def_st_td");
    if (td) out.push(`${td} TD`);
    if (n("safe")) out.push(plural(n("safe"), "safety", "safeties"));
    if (n("blk_kick")) out.push(`${n("blk_kick")} blocked`);
    if (line && line.pts_allow != null) out.push(`${n("pts_allow")} pts allowed`);
    return out.join(", ");
  }
  const rush = n("rush_att") ? `${n("rush_att")} car ${yds(n("rush_yd"))}` : "";
  const rec = n("rec") || n("rec_tgt") ? `${n("rec")} rec ${yds(n("rec_yd"))}` : "";
  const lost = n("fum_lost") ? `${n("fum_lost")} fum lost` : "";
  if (pos === "QB") {
    if (n("pass_att")) out.push(`${n("pass_cmp")}/${n("pass_att")} ${yds(n("pass_yd"))}`);
    if (n("pass_td")) out.push(`${n("pass_td")} TD`);
    if (n("pass_int")) out.push(`${n("pass_int")} INT`);
    if (rush) out.push(rush);
    if (n("rush_td")) out.push(`${n("rush_td")} rush TD`);
    if (rec) out.push(rec);
  } else {
    const first = pos === "RB" ? [rush, rec] : [rec, rush];
    out.push(...first.filter(Boolean));
    const td = n("rush_td") + n("rec_td");
    if (td) out.push(`${td} TD`);
  }
  if (lost) out.push(lost);
  return out.join(", ");
}

// How sweaty your matchup is right now: close (near 50%) and lots of points still to come = Full sweat.
//   closeness c = 1 - |2p - 1|, volume v = min(1, points still expected on both sides / 40)
//   score = round(100 x c x (0.4 + 0.6 v)): under 35 Chill, under 70 Sweaty, otherwise Full sweat.
export function sweat(m) {
  const left = (ps) => ps.reduce((s, p) => s + Math.max(0, p.remaining), 0);
  const c = 1 - Math.abs(2 * m.winProb - 1);
  const v = Math.min(1, (left(m.mine) + left(m.theirs)) / 40);
  const score = Math.round(100 * c * (0.4 + 0.6 * v));
  return { score, label: score < 35 ? "Chill" : score < 70 ? "Sweaty" : "Full sweat" };
}

// What you still need: their score plus what their players should still get, minus your score.
export function needs(m) {
  const left = (ps) => ps.reduce((s, p) => s + Math.max(0, p.remaining), 0);
  const playersLeft = m.mine.filter((p) => p.remaining > 0.05).length;
  return { need: Math.max(0, m.oppNow + left(m.theirs) - m.myNow), mineLeft: left(m.mine), playersLeft };
}

// The plays that moved your win chance the most, biggest first: [{ cardId, t, from, to, move }].
export function swings(history, n = 5) {
  return history.slice(1).map((h, i) => ({ cardId: h.cardId, t: h.t, from: history[i].wp, to: h.wp, move: h.wp - history[i].wp }))
    .filter((s) => s.cardId).sort((a, b) => Math.abs(b.move) - Math.abs(a.move)).slice(0, n);
}

// Who can swing it most from here: your win chance if each starter still to play booms (one spread above what
// he's expected to add) versus busts (one spread below, but never under zero more points), the rest of the
// matchup's spread unchanged. Biggest gap first; gaps under 0.1% count as equal and then the player with the
// most still to come goes first (once it's decided, Kittle's whole game outranks Aubrey's last kick).
//   -> [{ id, name, owner, boom, bust, swing, spread, toCome }]
//   toCome: "whole" (his game hasn't started) or "rest" (he's playing)
export function playerSwings(m) {
  const M = m.myFinal - m.oppFinal, S = m.spread ?? 0;
  return [...m.mine, ...m.theirs].map((p) => {
    const s = p.remainingSpread ?? 0, sign = p.owner === "me" ? 1 : -1;
    const rest = Math.sqrt(Math.max(0, S * S - s * s));
    const boom = winChance(M + sign * s, rest), bust = winChance(M - sign * Math.min(s, Math.max(0, p.remaining)), rest);
    return { id: p.id, name: p.name, owner: p.owner, boom, bust, swing: Math.abs(boom - bust), spread: s, toCome: p.game?.state === "pre" ? "whole" : "rest" };
  }).sort((a, b) => Math.round(b.swing * 1000) - Math.round(a.swing * 1000) || b.spread - a.spread);
}

// The points that flip who's favored. Yours: you're favored if he gets more than this from here. Theirs: you're
// favored if he gets less than this. null when it isn't a useful number (below zero, or far beyond his range).
export function breakeven(m, p) {
  const gap = m.myFinal - m.oppFinal;
  const v = p.owner === "me" ? p.remaining - gap : p.remaining + gap;
  return v > 0 && v <= p.remaining + 2 * (m.spread ?? 0) ? v : null;
}
