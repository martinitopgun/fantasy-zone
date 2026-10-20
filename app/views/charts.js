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
