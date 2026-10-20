// Small SVG pictures for the game screen: the field with the current drive, and the momentum line.

import { esc, pct } from "./cards.js";

// The field from the offense's view: own end zone left, the one they're attacking on the right.
// The shaded band is this drive so far.
export function fieldSvg(g) {
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
export function momentumSvg(g, pts) {
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

// Time on the win chart: quiet stretches (Thursday night to Sunday morning, the gaps between windows) are
// squeezed to a short break so the day's games get the room. x(t) for drawing, t(x) for the crosshair.
const GAP_MS = 40 * 60_000;
export function winChartScale(history, { L = 50, R = 12, W = 600 } = {}) {
  const knots = [[history[0].t, 0]], breaks = [];
  for (let i = 1; i < history.length; i++) {
    const [pt, pe] = knots.at(-1), gap = history[i].t - pt;
    if (gap > GAP_MS) { knots.push([pt + 60_000, pe + 60_000], [history[i].t, pe + 60_000 + 1]); breaks.push(knots.length - 2); }
    else if (gap > 0) knots.push([history[i].t, pe + gap]);
  }
  const active = Math.max(1, knots.at(-1)[1]), brk = active * 0.035; // each break is drawn 3.5% wide
  let add = 0;
  const pts = knots.map(([t, e], i) => { if (breaks.includes(i - 1)) add += brk; return [t, e + add]; });
  const total = Math.max(1, pts.at(-1)[1]), px = (e) => L + (e / total) * (W - L - R);
  const x = (t) => {
    if (t <= pts[0][0]) return px(0);
    for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) {
      const [ta, ea] = pts[i - 1], [tb, eb] = pts[i];
      return px(ea + ((t - ta) / Math.max(1, tb - ta)) * (eb - ea));
    }
    return px(pts.at(-1)[1]);
  };
  const t = (xv) => {
    const e = ((xv - L) / (W - L - R)) * total;
    for (let i = 1; i < pts.length; i++) if (e <= pts[i][1]) {
      const [ta, ea] = pts[i - 1], [tb, eb] = pts[i];
      return ta + ((e - ea) / Math.max(1e-9, eb - ea)) * (tb - ta);
    }
    return pts.at(-1)[0];
  };
  return { x, t, breaks: breaks.map((k) => (px(pts[k][1]) + px(pts[k + 1][1])) / 2) };
}

const day = (t) => new Date(t).toLocaleDateString("en-US", { timeZone: "America/New_York", weekday: "short" });

// Your win chance through the day: one yellow line, the 50% line dashed, the biggest swings as dots you
// can tap (each opens its play). x = clock time with the quiet gaps squeezed, y = 0-100%.
export function winChartSvg(history, top, ticks = []) {
  const W = 600, H = 200, L = 50, R = 12, T = 12, B = 32;
  if (history.length < 2) return `<p class="empty">Your win-chance line starts with the first play that moves it.</p>`;
  const t0 = history[0].t, t1 = history.at(-1).t;
  const { x, breaks } = winChartScale(history, { L, R, W });
  const y = (wp) => T + (1 - wp) * (H - T - B);
  const path = history.map((h, i) => `${i ? "L" : "M"}${x(h.t).toFixed(1)},${y(h.wp).toFixed(1)}`).join("");
  const grid = [1, 0.5, 0].map((v) => `<line x1="${L}" y1="${y(v)}" x2="${W - R}" y2="${y(v)}" stroke="var(--line)" ${v === 0.5 ? 'stroke-dasharray="3 4"' : ""}/>
    <text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" font-size="17" fill="var(--mute)" font-family="Barlow Condensed, sans-serif">${v * 100}%</text>`).join("");
  // Window labels; a label too close to the one before it is left out. A day that isn't the last one is named.
  const labels = [];
  if (day(t0) !== day(t1)) labels.push({ x: x(t0) + 16, label: day(t0) });
  for (const k of ticks.filter((k) => k.t > t0 && k.t < t1)) labels.push({ x: x(k.t), label: k.label });
  let lastX = -99;
  const xt = labels.filter((k) => (k.x - lastX >= 72 ? (lastX = k.x, true) : false)).map((k) => `<text x="${k.x.toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="17" fill="var(--mute)" font-family="Barlow Condensed, sans-serif">${k.label}</text>`).join("");
  const gaps = breaks.map((bx) => `<path d="M${(bx - 3).toFixed(1)},${H - B + 4} l3,-8 l3,8" fill="none" stroke="var(--mute)" stroke-width="1"/>`).join("");
  const dots = top.map((s) => `<circle class="swingdot" data-play="${s.cardId}" cx="${x(s.t).toFixed(1)}" cy="${y(s.to).toFixed(1)}" r="7" fill="${s.move > 0 ? "var(--up)" : "var(--down)"}" stroke="var(--panel)" stroke-width="2.5"><title>${Math.round(s.from * 100)}% → ${Math.round(s.to * 100)}%</title></circle>`).join("");
  return `<svg class="winchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Your win chance through the week, now ${Math.round(history.at(-1).wp * 100)}%">
    ${grid}${xt}${gaps}
    <path d="${path}" fill="none" stroke="var(--you)" stroke-width="2.5" stroke-linejoin="round"/>
    <line class="xhair" x1="0" x2="0" y1="${T}" y2="${H - B}" stroke="var(--mute)" stroke-width="1" visibility="hidden"/>
    ${dots}
  </svg>`;
}
