// A game's drives (plan M8), from its plays in order. Pure, no DOM.
//   drives(plays) -> [{ team, period, plays: [..], result, text }]   result: "TD", "FG", "PUNT", "INT", "FUMBLE",
//   "MISSED FG", "DOWNS", "SAFETY", "END OF HALF", "END OF GAME", or null (still going)
// A new drive starts after a kickoff, a score, a change of possession or the start of a half; its result comes
// from the play that ended it. Timeouts, quarter breaks and the two-minute warning aren't plays.

const NOT_A_PLAY = /^(Timeout|Official Timeout|End Period|Two-minute warning|End of Regulation)$/i;

function ending(type, text = "") {
  if (/Interception/i.test(type)) return "INT";
  if (/Fumble Recovery \(Opponent\)|Opp Fumble Recovery/i.test(type)) return "FUMBLE";
  if (/Blocked Punt|Punt/i.test(type)) return "PUNT";
  if (/Field Goal Good/i.test(type)) return "FG";
  if (/Field Goal Missed|Blocked Field Goal/i.test(type)) return "MISSED FG";
  if (/Safety/i.test(type)) return "SAFETY";
  if (/Touchdown/i.test(type) || /TOUCHDOWN/.test(text)) return "TD";
  return null;
}

const secs = (p) => { const [m, s] = String(p.clock || "0:00").split(":").map(Number); return (Math.min(p.period, 5) - 1) * 900 + (900 - (m * 60 + (s || 0))); };
const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.max(0, Math.round(t % 60))).padStart(2, "0")}`;

export function drives(plays) {
  const out = [];
  let cur = null;
  const close = (result) => {
    if (!cur) return;
    const first = cur.plays[0], last = cur.plays.at(-1), prev = cur.plays.at(-2);
    const startYtg = first.start?.yardsToGoal;
    // ESPN measures a punt's spot from the other end, so a punted drive ends where the play before it ended.
    const endYtg = result === "TD" ? 0 : result === "PUNT" ? (prev ? prev.end?.yardsToGoal : startYtg)
      : ["INT", "FUMBLE", "FG", "MISSED FG", "DOWNS", "SAFETY"].includes(result) ? last.start?.yardsToGoal
      : last.end?.team === cur.team ? last.end?.yardsToGoal : last.start?.yardsToGoal;
    const yards = startYtg != null && endYtg != null ? startYtg - endYtg : null;
    const n = cur.plays.filter((p) => !/^(Penalty|Punt)$/i.test(p.type)).length;
    cur.result = result;
    cur.text = [`${n} play${n === 1 ? "" : "s"}`, yards != null ? `${yards} yds` : "", mmss(Math.max(0, secs(last) - secs(first)))].filter(Boolean).join(" · ");
    out.push(cur);
    cur = null;
  };
  for (const p of plays) {
    if (NOT_A_PLAY.test(p.type)) continue;
    if (/^End of (Half|Game)$/i.test(p.type)) { close(/Game/i.test(p.type) ? "END OF GAME" : "END OF HALF"); continue; }
    if (/Kickoff/i.test(p.type)) { close(cur ? "DOWNS" : null); continue; } // a kickoff never belongs to a drive
    const team = p.offense;
    if (!team) continue;
    if (cur && (team !== cur.team || (p.period >= 3 && cur.period <= 2))) close(team !== cur.team ? "DOWNS" : "END OF HALF");
    cur ??= { team, period: p.period, plays: [], result: null, text: "" };
    cur.plays.push(p);
    const r = ending(p.type, p.text);
    if (r) close(r);
  }
  if (cur) { out.push(cur); cur.text = `${cur.plays.length} play${cur.plays.length === 1 ? "" : "s"} so far`; }
  return out;
}
