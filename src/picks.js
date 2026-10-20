// Free Picks (plan M7): quick questions about your matchup's games that earn Zone points and streaks.
// No money, no prizes, nothing to buy: just points for calling it right. Pure, no DOM.
//
//   Drive:  when a drive involving either lineup gets inside the 20, "How does this drive end?
//           TD / FG / No score". It locks at the next snap and is graded from the plays.
//   Player: before a starter's kickoff, "Will Swift reach 15.5 points?" (his projection, to the half point).
//           It locks at kickoff and is graded when his game ends. One of yours and one of theirs per kickoff.
//   New picks are only offered at 5x or slower (faster, there's no time to answer).
//
//   const picks = createPicks({ saved, onSave })   saved: what onSave stored last time (or null)
//   picks.step({ cards, snap, now, speed }) -> true when anything changed (new, locked or graded)
//   picks.choose(id, key)      picks.list()   (newest first)      picks.score() -> { points, streak, best, right, played }
//   picks.reset()              a jump: drop open and locked picks (their moment is gone), keep the score

export const PICK_POINTS = 10;
export const MAX_PICK_SPEED = 5;
const SKILL = new Set(["QB", "RB", "WR", "TE"]);
const DRIVE_OPTIONS = [["td", "TD"], ["fg", "FG"], ["none", "No score"]];
const last = (n) => String(n ?? "").split(" ").slice(1).join(" ") || String(n ?? "");

// How a drive ended, from one play after the pick locked; null while it's still going.
export function driveResult(pick, c) {
  if (c.kind === "marker") return "none"; // halftime or the final (the only markers in the feed)
  if (c.td && c.offense === pick.offense && !c.turnover) return "td";
  if (c.kind === "fg") return "fg";
  if (c.kind === "fg-miss" || c.turnover || c.td) return "none";
  if (c.offense && c.offense !== pick.offense && !["kickoff", "penalty", "timeout"].includes(c.kind)) return "none";
  return null;
}

export function createPicks({ saved = null, onSave = () => {} } = {}) {
  const done = new Map(Object.entries(saved?.done ?? {})); // id -> finished pick (survives reloads)
  let score = { points: 0, streak: 0, best: 0, right: 0, played: 0, ...(saved?.score ?? {}) };
  let live = []; // open and locked picks
  const lastYtg = new Map(); // game id -> { offense, ytg } after its latest play
  const picked = new Map(); // game id -> the offense whose current drive already had its pick (one per drive)

  const save = () => onSave({ done: Object.fromEntries(done), score });

  function finish(p, answer) {
    p.answer = answer;
    p.state = p.choice == null ? "missed" : p.choice === answer ? "right" : "wrong";
    if (p.state !== "missed") {
      score.played++;
      if (p.state === "right") { score.right++; score.points += PICK_POINTS; score.streak++; score.best = Math.max(score.best, score.streak); }
      else score.streak = 0;
    }
    done.set(p.id, p);
    live = live.filter((x) => x !== p);
  }

  function involved(snap, team) {
    const m = snap.matchups[0];
    if (!m) return null;
    const ps = [...m.mine, ...m.theirs];
    return ps.some((p) => p.nflTeam === team && SKILL.has(p.pos)) || ps.some((p) => p.pos === "DEF" && p.game && [p.game.home, p.game.away].includes(team) && p.nflTeam !== team);
  }

  function step({ cards = [], snap, now, speed = 1 }) {
    let changed = false;
    const canOffer = speed <= MAX_PICK_SPEED;
    for (const c of [...cards].sort((a, b) => a.wallclock - b.wallclock)) {
      // Lock or grade the drive picks on this game.
      for (const p of live.filter((x) => x.kind === "drive" && x.gameId === c.gameId)) {
        if (p.state === "open") { p.state = p.choice == null ? "missed" : "locked"; changed = true; if (p.state === "missed") { done.set(p.id, p); live = live.filter((x) => x !== p); continue; } }
        const r = driveResult(p, c);
        if (r) { finish(p, r); changed = true; }
      }
      // A drive that just got inside the 20 (not on the scoring play itself).
      const before = lastYtg.get(c.gameId);
      if (c.ytg != null && c.offense) lastYtg.set(c.gameId, { offense: c.offense, ytg: c.ytg });
      if (c.offense && picked.get(c.gameId) !== c.offense && c.kind !== "kickoff") picked.delete(c.gameId); // the ball changed hands
      if (c.silent || !canOffer || c.scored || c.kind === "marker" || c.ytg == null || c.ytg > 20 || c.ytg <= 0) continue;
      if (before && before.offense === c.offense && before.ytg <= 20) continue;
      const id = `d:${c.id}`;
      if (picked.get(c.gameId) === c.offense || !involved(snap, c.offense)) continue;
      picked.set(c.gameId, c.offense);
      if (done.has(id)) continue; // answered before a reload
      live.unshift({ id, kind: "drive", gameId: c.gameId, offense: c.offense, at: c.wallclock, state: "open", choice: null,
        q: `${c.offense} at the ${c.ytg}. How does this drive end?`, game: c.gameName, options: DRIVE_OPTIONS });
      changed = true;
    }

    // Player picks: lock at kickoff, grade at the final.
    const m = snap.matchups[0];
    const starters = m ? [...m.mine, ...m.theirs] : [];
    for (const p of live.filter((x) => x.kind === "player")) {
      const s = starters.find((x) => x.id === p.playerId && x.owner === p.owner);
      const g = s?.game;
      if (!g) continue;
      if (p.state === "open" && g.state !== "pre") { p.state = p.choice == null ? "missed" : "locked"; changed = true; if (p.state === "missed") { done.set(p.id, p); live = live.filter((x) => x !== p); continue; } }
      if (g.state === "post") { finish(p, s.current >= p.line ? "yes" : "no"); changed = true; }
    }
    if (canOffer && m) {
      for (const owner of ["me", "opponent"]) {
        const soon = starters.filter((s) => s.owner === owner && SKILL.has(s.pos) && s.game?.state === "pre" && Date.parse(s.game.kickoff) - now <= 20 * 60_000 && Date.parse(s.game.kickoff) > now);
        const top = soon.sort((a, b) => b.projected - a.projected)[0];
        if (!top) continue;
        const id = `p:${owner}:${top.id}`;
        const window = Date.parse(top.game.kickoff);
        if (done.has(id) || live.some((p) => p.id === id || (p.kind === "player" && p.owner === owner && p.window === window))) continue;
        const line = Math.floor(top.projected) + 0.5;
        live.unshift({ id, kind: "player", playerId: top.id, owner, window, gameId: top.game.id, line, at: now, state: "open", choice: null,
          q: `Will ${last(top.name)} reach ${line} points?`, game: `${top.game.away} @ ${top.game.home}`,
          options: [["yes", `Yes, ${line}+`], ["no", "No"]] });
        changed = true;
      }
    }
    if (changed) save();
    return changed;
  }

  return {
    step,
    choose(id, key) {
      const p = live.find((x) => x.id === id);
      if (!p || p.state !== "open" || !p.options.some(([k]) => k === key)) return false;
      p.choice = key;
      return true;
    },
    list: () => [...live, ...[...done.values()].sort((a, b) => b.at - a.at)],
    open: () => live.filter((p) => p.state === "open"),
    score: () => ({ ...score }),
    reset() { live = []; lastYtg.clear(); picked.clear(); },
  };
}
