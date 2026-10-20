// Sunday Story (plan M5): your day in 6 cards, from templates (no AI). Pure, no DOM, so it runs in tests.
//   storyCards({ m, history, feed, now }) -> { title, done, cards: [{ kind, kicker, big, lines: [..], cardIds: [..] }] }
//     m: your matchup (snapshot().matchups[0])   history: tracker.history(leagueId)   feed: tracker.feed()
//   1 the score and result ("so far" while players are still to play)   2 the low point
//   3 the biggest swing   4 MVP and bust (points against projection)   5 the top 5 plays by win move
//   6 the closest call (the last time the other side was favored), then who's left ("Monday: Daniels + Pineiro vs Kittle")

import { swings } from "./insights.js";

const ET = { timeZone: "America/New_York" };
const clock = (t) => new Date(t).toLocaleTimeString("en-US", { ...ET, hour: "numeric", minute: "2-digit" });
const day = (t) => new Date(t).toLocaleDateString("en-US", { ...ET, weekday: "long" });
const pct = (p) => (p >= 0.995 ? ">99%" : p <= 0.005 ? "<1%" : `${Math.round(p * 100)}%`);
const n1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
const last = (n) => String(n ?? "").split(" ").slice(1).join(" ") || String(n ?? "");
const playName = (c) => `${c.name ? `${last(c.name)} ` : ""}${c.label}`.trim();

// The play behind the biggest move in your win chance (never a halftime/final marker).
export function biggestSwing(history, feed) {
  const byId = new Map(feed.map((c) => [c.id, c]));
  const s = swings(history, 50).find((x) => byId.get(x.cardId)?.kind !== "marker");
  return s ? { ...s, card: byId.get(s.cardId) } : null;
}

export function storyCards({ m, history, feed }) {
  const byId = new Map(feed.map((c) => [c.id, c]));
  const left = [...m.mine, ...m.theirs].filter((p) => p.game?.state !== "post" && p.remaining > 0.05);
  const done = left.length === 0;
  const lead = m.myNow - m.oppNow;
  const opp = m.opponentName || "your opponent";
  const cards = [];

  // 1. Score and result
  cards.push({
    kind: "score",
    kicker: done ? (lead >= 0 ? "You won" : "You lost") : "So far",
    big: `${n1(m.myNow)} – ${n1(m.oppNow)}`,
    lines: [done ? `vs ${opp}` : `vs ${opp} · win chance ${pct(m.winProb)}`],
    cardIds: [],
  });

  // 2. Low point: your lowest win chance after a play
  const moves = history.filter((h) => h.cardId && byId.get(h.cardId)?.kind !== "marker");
  const low = moves.reduce((a, h) => (!a || h.wp < a.wp ? h : a), null);
  if (low) {
    const c = byId.get(low.cardId);
    cards.push({ kind: "low", kicker: "Low point", big: pct(low.wp), lines: [`${day(low.t)} ${clock(low.t)} · ${playName(c)}`, c.gameName], cardIds: [c.id] });
  }

  // 3. Biggest swing
  const big = biggestSwing(history, feed);
  if (big) cards.push({ kind: "swing", kicker: "Biggest swing", big: playName(big.card), lines: [`Win ${pct(big.from)} → ${pct(big.to)}`, `${clock(big.t)} · ${big.card.gameName}`], cardIds: [big.cardId] });

  // 4. MVP and bust: your starters against their projection (only once their game has started)
  const played = m.mine.filter((p) => p.game && p.game.state !== "pre").map((p) => ({ p, diff: p.current - p.projected }));
  if (played.length) {
    const mvp = played.reduce((a, x) => (x.diff > a.diff ? x : a));
    const bust = played.reduce((a, x) => (x.diff < a.diff ? x : a));
    const vs = (x) => `${n1(x.p.current)} pts (proj ${n1(x.p.projected)})`;
    cards.push({ kind: "mvp", kicker: "MVP", big: mvp.p.name, lines: [vs(mvp), bust !== mvp && bust.diff < 0 ? `Bust: ${bust.p.name} · ${vs(bust)}` : ""].filter(Boolean), cardIds: [] });
  }

  // 5. Top 5 plays by win move
  const top = swings(history, 20).filter((s) => byId.get(s.cardId)?.kind !== "marker").slice(0, 5);
  if (top.length) cards.push({ kind: "top", kicker: `Top ${top.length} plays`, big: "", lines: top.map((s) => `${s.to > s.from ? "▲" : "▼"} ${Math.round(Math.abs(s.to - s.from) * 100)} · ${playName(byId.get(s.cardId))}`), cardIds: top.map((s) => s.cardId) });

  // 6. Closest call: the last time the side now ahead wasn't favored, then who's left
  const ahead = done ? lead >= 0 : m.winProb >= 0.5;
  const coin = [...moves].reverse().find((h) => (ahead ? h.wp < 0.5 : h.wp > 0.5));
  const leftLine = (() => {
    if (done) return "";
    const days = new Map([["Still playing", { me: [], opp: [] }]]);
    for (const p of left) {
      const d = p.game?.state === "pre" ? day(Date.parse(p.game.kickoff)) : "Still playing";
      if (!days.has(d)) days.set(d, { me: [], opp: [] });
      days.get(d)[p.owner === "me" ? "me" : "opp"].push(last(p.name));
    }
    return [...days].filter(([, s]) => s.me.length + s.opp.length).map(([d, s]) => `${d}: ${s.me.join(" + ") || "nobody"} vs ${s.opp.join(" + ") || "nobody"}`).join(" · ");
  })();
  const c = coin && byId.get(coin.cardId);
  cards.push({
    kind: "close", kicker: "Closest call",
    big: c ? pct(coin.wp) : "Never close",
    lines: [c ? `${day(coin.t)} ${clock(coin.t)} · ${playName(c)}, the last time ${ahead ? "you were the underdog" : "you were favored"}` : ahead ? "You were favored all day." : "You were never favored.", leftLine].filter(Boolean),
    cardIds: c ? [c.id] : [],
  });

  return { title: done ? "Your Sunday Story" : "Story so far", done, cards };
}
