// Simulated Sunday for testing: real teams, players and projections; made-up plays.
// Each game runs drive by drive (runs, passes, sacks, picks, fumbles, field goals, punts) and
// produces the same shape of data the app gets from ESPN + Sleeper, so the real model ranks it.

import { fantasyPoints } from "./src/scoring.js";
import { winChance } from "./src/model.js";

const SEC_PER_QUARTER = 900;

export function createSim(slate, { seed = Date.now() } = {}) {
  let rand = mulberry32(seed);
  const r = () => rand();
  const stats = new Map(); // player id -> stat line
  const add = (p, key, v = 1) => { if (!p) return; const s = stats.get(p.id) ?? {}; s[key] = (s[key] ?? 0) + v; stats.set(p.id, s); };

  // Kickoff waves like a real Sunday: early games, late games, then the night games.
  const waves = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 160, 160, 300, 300];
  const games = slate.games.map((g, i) => ({
    ...g, name: `${g.away} @ ${g.home}`, homeScore: 0, awayScore: 0, state: "pre", period: 1, clockSec: SEC_PER_QUARTER,
    offense: null, yardsToGoal: null, down: null, distance: null, downText: null, isRedZone: false,
    lastPlay: null, homeWinProb: 0.5, startTick: waves[i] ?? 0, receiving: r() < 0.5 ? g.home : g.away,
  }));
  let tick = 0;

  function step() {
    tick += 1;
    for (const g of games) {
      if (g.state === "post") continue;
      if (g.state === "pre") { if (tick >= g.startTick) kickoffStart(g); continue; }
      playOnce(g);
    }
    return snapshot();
  }

  function kickoffStart(g) {
    g.state = "in";
    g.offense = g.receiving;
    setFirstDown(g, 75);
    g.lastPlay = `Kickoff. ${g.offense} starts at its own 25.`;
  }

  function setFirstDown(g, ytg) {
    g.yardsToGoal = ytg; g.down = 1; g.distance = Math.min(10, ytg);
    updateText(g);
  }

  function updateText(g) {
    const ord = ["", "1st", "2nd", "3rd", "4th"][g.down];
    const def = g.offense === g.home ? g.away : g.home;
    const spot = g.yardsToGoal > 50 ? `${g.offense} ${100 - g.yardsToGoal}` : g.yardsToGoal === 50 ? "50" : `${def} ${g.yardsToGoal}`;
    g.downText = `${ord} & ${g.distance >= g.yardsToGoal ? "Goal" : g.distance} at ${spot}`;
    g.isRedZone = g.yardsToGoal <= 20;
  }

  function playOnce(g) {
    const d = slate.depth[g.offense] ?? {};
    const qb = d.QB?.[0], k = d.K?.[0];
    const def = g.offense === g.home ? g.away : g.home;
    let text, used = 0, gain = 0, turnover = false, scored = 0, keepClock = true;

    if (g.down === 4 && g.yardsToGoal > 2) {
      if (g.yardsToGoal <= 37) { // field goal try
        const dist = g.yardsToGoal + 17;
        const good = r() < (dist < 40 ? 0.95 : dist < 50 ? 0.82 : 0.6);
        text = `${k?.short ?? g.offense} ${dist} yard field goal is ${good ? "GOOD" : "No Good"}`;
        if (good) { scored = 3; add(k, `fgm_${dist < 20 ? "0_19" : dist < 30 ? "20_29" : dist < 40 ? "30_39" : dist < 50 ? "40_49" : dist < 60 ? "50_59" : "60p"}`); add(k, "fgm_yds", dist); }
        else add(k, "fgmiss");
        return finish(g, text, 5, scored, true, scored ? 75 : Math.max(20, 100 - g.yardsToGoal - 7));
      }
      const net = 38 + Math.floor(r() * 12);
      return finish(g, `Punt ${net} yards`, 8, 0, true, Math.min(90, Math.max(10, 100 - (g.yardsToGoal - net))));
    }

    const nearGoal = g.yardsToGoal <= 5;
    if (r() < (nearGoal ? 0.6 : 0.45)) { // run
      const rb = weighted([[d.RB?.[0], nearGoal ? 0.75 : 0.65], [d.RB?.[1], 0.25], [qb, 0.1]]);
      gain = r() < 0.04 ? 20 + Math.floor(r() * 45) : Math.round(-2 + r() * 9);
      if (r() < 0.012) { turnover = true; text = `${rb?.short} run for ${gain} yards, FUMBLES, recovered by ${def}`; add(rb, "fum_lost"); }
      else { text = `${rb?.short} run for ${gain} yards`; add(rb, "rush_yd", Math.min(gain, g.yardsToGoal)); }
      used = 38;
      if (!turnover && gain >= g.yardsToGoal) { scored = 7; add(rb, "rush_td"); text = `${rb?.short} ${g.yardsToGoal} yard run, TOUCHDOWN`; add(k, "xpm"); }
    } else { // pass
      const target = weighted([[d.WR?.[0], 0.3], [d.WR?.[1], 0.2], [d.WR?.[2], 0.12], [d.TE?.[0], 0.18], [d.RB?.[0], 0.12], ...(d.WR?.slice(3) ?? []).map((p) => [p, 0.1])]);
      const roll = r();
      if (roll < 0.06) { gain = -6; text = `${qb?.short} sacked for a loss of 6 yards`; used = 35; }
      else if (roll < 0.085) { turnover = true; text = `${qb?.short} pass INTERCEPTED by ${def}`; add(qb, "pass_int"); used = 8; }
      else if (roll < 0.43) { text = `${qb?.short} pass incomplete to ${target?.short}`; used = 6; keepClock = false; }
      else {
        gain = r() < 0.07 ? 30 + Math.floor(r() * 40) : Math.round(3 + r() * 13);
        const yds = Math.min(gain, g.yardsToGoal);
        add(qb, "pass_yd", yds); add(target, "rec"); add(target, "rec_yd", yds);
        used = 36;
        if (gain >= g.yardsToGoal) { scored = 7; add(qb, "pass_td"); add(target, "rec_td"); add(k, "xpm"); text = `${qb?.short} pass to ${target?.short} for ${g.yardsToGoal} yards, TOUCHDOWN`; }
        else text = `${qb?.short} pass to ${target?.short} for ${gain} yards`;
      }
    }

    if (scored) return finish(g, text, used, scored, true, 75);
    if (turnover) return finish(g, text, used, 0, true, Math.min(90, Math.max(10, 100 - (g.yardsToGoal - gain))));
    g.yardsToGoal = Math.min(99, g.yardsToGoal - gain);
    if (gain >= g.distance) setFirstDown(g, g.yardsToGoal);
    else if (g.down === 4) return finish(g, `${text}. Turnover on downs`, used, 0, true, 100 - g.yardsToGoal);
    else { g.down += 1; g.distance -= gain; updateText(g); }
    finish(g, text, used, 0, false, null, keepClock);
  }

  // Apply points, the clock, and (when needed) a change of possession.
  function finish(g, text, used, scored, change, newYtg) {
    if (scored) { if (g.offense === g.home) g.homeScore += scored; else g.awayScore += scored; }
    g.lastPlay = text;
    g.clockSec -= used;
    if (change) { g.offense = g.offense === g.home ? g.away : g.home; setFirstDown(g, newYtg); }
    if (g.clockSec <= 0) {
      if (g.period === 2) { g.offense = g.receiving === g.home ? g.away : g.home; setFirstDown(g, 75); }
      if (g.period === 4) { g.state = "post"; g.clockSec = 0; g.offense = null; g.downText = null; g.isRedZone = false; }
      else { g.period += 1; g.clockSec = SEC_PER_QUARTER; }
    }
    g.homeWinProb = homeWinProb(g);
  }

  function snapshot() {
    const view = games.map((g) => ({ ...g }));
    const byTeam = new Map(view.flatMap((g) => [[g.home, g], [g.away, g]]));
    const scoring = slate.league.scoring_settings;
    const side = (list, owner) => list.map((p) => {
      const game = byTeam.get(p.team) ?? null;
      const frac = fractionLeft(game);
      const current = p.pos === "DEF" ? p.projected * (1 - frac) : fantasyPoints(stats.get(p.id), scoring);
      return { ...p, owner, nflTeam: p.team, game, current, remaining: p.projected * frac,
        remainingSpread: p.profile.spread * Math.sqrt(frac), boomFactor: 1 + p.profile.boomRate };
    });
    const mine = side(slate.mine, "me"), theirs = side(slate.theirs, "opponent");
    const sum = (ps, k) => ps.reduce((s, p) => s + p[k], 0);
    const myNow = sum(mine, "current"), oppNow = sum(theirs, "current");
    const myFinal = myNow + sum(mine, "remaining"), oppFinal = oppNow + sum(theirs, "remaining");
    const spread = Math.sqrt([...mine, ...theirs].reduce((s, p) => s + p.remainingSpread ** 2, 0));
    return {
      games: view,
      matchups: [{ league: slate.league, info: slate.info, opponentName: slate.opponentName, weight: 1,
        mine, theirs, myNow, oppNow, myFinal, oppFinal, spread, winProb: winChance(myFinal - oppFinal, spread) }],
    };
  }

  function weighted(options) {
    const opts = options.filter(([p]) => p);
    const total = opts.reduce((s, [, w]) => s + w, 0);
    let x = r() * total;
    for (const [p, w] of opts) { x -= w; if (x <= 0) return p; }
    return opts[0]?.[0];
  }

  return { step, snapshot, get done() { return games.every((g) => g.state === "post"); } };
}

function fractionLeft(g) {
  if (!g || g.state === "pre") return 1;
  if (g.state === "post") return 0;
  return Math.max(0, ((4 - g.period) * SEC_PER_QUARTER + g.clockSec) / (4 * SEC_PER_QUARTER));
}

// Rough live win chance: score margin plus a little for having the ball, shrinking with time left.
function homeWinProb(g) {
  if (g.state === "post") return g.homeScore > g.awayScore ? 1 : g.homeScore < g.awayScore ? 0 : 0.5;
  const left = Math.max(0.02, fractionLeft(g));
  const ball = g.offense === g.home ? 1 : -1;
  const fieldValue = ball * (2.5 - 0.04 * (g.yardsToGoal ?? 50) * 1.5);
  return winChance(g.homeScore - g.awayScore + fieldValue + 1.5, 13.5 * Math.sqrt(left));
}

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
