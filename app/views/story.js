// Sunday Story (plan M5): full screen, one card at a time, like Instagram stories but it never moves by
// itself. Tap the right half for the next card, the left half to go back (or ← →); swipe down or × closes.
// "Share picture" draws the card on a 1080×1350 canvas (team abbreviations and our colours only, no logos)
// and tries, in order: the phone's share sheet, a download, and (always inside the claude.ai preview, or when
// both fail) a picture you press and hold (or right-click) to save.
//
//   const story = createStory({ el, onClose, onPicture })   onPicture(dataUrl): show the save-it-yourself sheet
//   story.open(s)  s from storyCards()      story.close()      story.update(s) (new plays while it's open)

import { esc } from "./cards.js";
import { framed } from "../ui/layers.js";

export function createStory({ el, onClose, onPicture, onShare = () => {} }) {
  let s = null, k = 0;
  let y0 = null, dy = 0, moved = false; // swipe-down state

  function render() {
    const c = s.cards[k];
    el.innerHTML = `
      <div class="story-top">
        <div class="story-bars" aria-hidden="true">${s.cards.map((_, i) => `<span class="${i < k ? "done" : i === k ? "on" : ""}"></span>`).join("")}</div>
        <div class="story-head"><h2 id="story-title">${esc(s.title)}</h2><button class="iconbtn" type="button" data-story="close" aria-label="Close the story">×</button></div>
      </div>
      <button class="story-tap prev" type="button" data-story="prev" aria-label="Previous card"${k === 0 ? " disabled" : ""}></button>
      <button class="story-tap next" type="button" data-story="next" aria-label="Next card"${k === s.cards.length - 1 ? " disabled" : ""}></button>
      <article class="story-card s-${esc(c.kind)}" aria-live="polite" aria-label="Card ${k + 1} of ${s.cards.length}">
        <p class="story-kicker">${esc(c.kicker)}</p>
        ${c.big ? `<p class="story-big">${esc(c.big)}</p>` : ""}
        ${c.lines.map((l) => `<p class="story-line">${esc(l)}</p>`).join("")}
      </article>
      <div class="story-foot">
        <span class="num">${k + 1} / ${s.cards.length}</span>
        <button class="chipbtn" type="button" data-story="share">Share picture</button>
      </div>`;
  }

  const go = (d) => { const to = Math.max(0, Math.min(s.cards.length - 1, k + d)); if (to !== k) { k = to; render(); el.querySelector(`[data-story="${d > 0 ? "next" : "prev"}"]:not([disabled])`)?.focus({ preventScroll: true }); } };

  el.addEventListener("click", (e) => {
    const b = e.target.closest("[data-story]");
    if (!b || !s || moved) return;
    if (b.dataset.story === "next") go(1);
    else if (b.dataset.story === "prev") go(-1);
    else if (b.dataset.story === "close") onClose();
    else if (b.dataset.story === "share") share();
  });
  el.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
  });

  // Swipe down to close (never sideways).
  el.addEventListener("pointerdown", (e) => { y0 = e.clientY; dy = 0; moved = false; });
  el.addEventListener("pointermove", (e) => {
    if (y0 == null) return;
    dy = Math.max(0, e.clientY - y0);
    if (dy > 8) { moved = true; el.style.translate = `0 ${dy}px`; }
  });
  const end = () => {
    if (y0 == null) return;
    y0 = null; el.style.translate = "";
    if (dy > 90) onClose();
    setTimeout(() => { moved = false; });
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);

  async function share() {
    onShare();
    const url = drawCard(s, k);
    const name = `fantasy-zone-${s.cards[k].kind}.png`;
    let ok = false;
    try {
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], name, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: s.title }); ok = true; }
    } catch { /* not allowed here, or cancelled */ }
    if (!ok && !framed) {
      try { const a = document.createElement("a"); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); ok = true; } catch { /* blocked */ }
    }
    if (!ok || framed) onPicture(url);
  }

  return {
    get isOpen() { return !!s && !el.hidden; },
    open(story) { s = story; k = 0; render(); el.hidden = false; el.querySelector('[data-story="next"]')?.focus({ preventScroll: true }); },
    update(story) { if (!s || el.hidden) return; s = story; k = Math.min(k, s.cards.length - 1); const f = document.activeElement?.dataset?.story; render(); if (f) el.querySelector(`[data-story="${f}"]`)?.focus({ preventScroll: true }); },
    close() { s = null; el.hidden = true; el.innerHTML = ""; },
  };
}

// One card as a 1080×1350 picture: dark field, yellow and purple, the score, our name. Returns a data: URL.
// Always the dark theme's colours, whatever the phone is set to: the picture should look the same everywhere.
const C = { bg: "#0e1411", panel: "#161f1a", chalk: "#e8eee9", mute: "#8d9c92", you: "#f2c230", opp: "#ab8cf6" };
function drawCard(s, k) {
  const cv = document.createElement("canvas");
  cv.width = 1080; cv.height = 1350;
  const g = cv.getContext("2d");
  g.fillStyle = C.bg; g.fillRect(0, 0, 1080, 1350);
  // yard lines
  g.strokeStyle = "rgba(255,255,255,0.05)"; g.lineWidth = 4;
  for (let y = 150; y < 1350; y += 120) { g.beginPath(); g.moveTo(0, y); g.lineTo(1080, y); g.stroke(); }
  const font = (w, px) => `${w} ${px}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  const card = s.cards[k], score = s.cards[0];
  // header
  g.fillStyle = C.you; g.fillRect(0, 0, 540, 14); g.fillStyle = C.opp; g.fillRect(540, 0, 540, 14);
  g.fillStyle = C.chalk; g.font = font(800, 54); g.textAlign = "left"; g.fillText("FANTASY ZONE", 80, 120);
  g.fillStyle = C.mute; g.font = font(600, 40); g.textAlign = "right"; g.fillText(s.title.toUpperCase(), 1000, 120);
  // card
  g.textAlign = "left";
  g.fillStyle = C.you; g.font = font(700, 58); g.fillText(card.kicker.toUpperCase(), 80, 340);
  let y = 340;
  if (card.big) y = wrap(g, card.big, 80, 470, 920, 132, font(800, card.big.length > 12 ? 112 : 170), C.chalk);
  g.font = font(500, 50); g.fillStyle = C.chalk;
  for (const line of card.lines) y = wrap(g, line, 80, y + 90, 920, 64, font(500, 50), C.chalk);
  // footer: the score, yours in yellow and theirs in purple
  const [a, b] = score.big.split(" – ");
  g.fillStyle = C.panel; g.fillRect(0, 1150, 1080, 200);
  g.font = font(800, 96); g.textAlign = "left"; g.fillStyle = C.you; g.fillText(a ?? "", 80, 1290);
  g.textAlign = "right"; g.fillStyle = C.opp; g.fillText(b ?? "", 1000, 1290);
  g.textAlign = "center"; g.fillStyle = C.mute; g.font = font(600, 40); g.fillText(score.kicker.toUpperCase(), 540, 1278);
  return cv.toDataURL("image/png");
}

// Draw text wrapped to a width; returns the y of the last line.
function wrap(g, text, x, y, width, lh, f, color) {
  g.font = f; g.fillStyle = color;
  const words = String(text).split(" ");
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > width && line) { g.fillText(line, x, y); line = w; y += lh; }
    else line = test;
  }
  if (line) g.fillText(line, x, y);
  return y;
}
