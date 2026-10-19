// The model. Everything here is automatic: it only reads synced Sleeper data and live ESPN data.
//
//   Watch Score = Fantasy Score x Fantasy Dial  +  Game Score x Game Dial
//
//   Fantasy Score = Flip Power x Live Situation          (how much this game can change MY matchups, right now)
//     Flip Power   = sum over leagues of  Stake in this game / (expected gap + 10)
//     Stake        = points still to come x Boom Factor x Role Factor   (for my starters AND my opponent's)
//   Game Score     = Closeness x Time Pressure x Scoring Threat (+ upset bonus)   (works with fantasy off)

import { fantasyPoints } from "./scoring.js";
import { fractionLeft } from "./espn.js";

export const DIALS = {
  fantasyOn: { fantasy: 1, game: 0.3 },
  fantasyOff: { fantasy: 0, game: 1 },
};

// ---------- Matchups and win chances ----------

export function buildMatchupView({ league, scoring, me, opponent, projections, gamesByTeam, profile, weight = 1 }) {
  const side = (team, owner) =>
    team.starters.map((id, i) => {
      const row = projections.get(id);
      const pos = row?.player?.position ?? (/^[A-Z]{2,3}$/.test(id) ? "DEF" : "?");
      const nflTeam = row?.team ?? (pos === "DEF" ? id : null);
      const name = pos === "DEF" ? `${id} D/ST` : row?.player ? `${row.player.first_name} ${row.player.last_name}` : `Player ${id}`;
      const game = nflTeam ? gamesByTeam.get(nflTeam) : null;
      const frac = game ? fractionLeft(game) : 0; // no game = bye or not found
      const projected = fantasyPoints(row?.stats, scoring);
      const prof = profile(id, pos, nflTeam);
      return {
        id, name, pos, nflTeam, owner, game,
        current: team.starters_points?.[i] ?? 0,
        projected,
        remaining: projected * frac,
        remainingSpread: prof.spread * Math.sqrt(frac),
        profile: prof,
        boomFactor: boomFactor(prof, game, nflTeam),
      };
    });

  const mine = side(me, "me");
  const theirs = side(opponent, "opponent");
  const total = (ps, k) => ps.reduce((s, p) => s + p[k], 0);
  const myNow = total(mine, "current"), oppNow = total(theirs, "current");
  const myFinal = myNow + total(mine, "remaining"), oppFinal = oppNow + total(theirs, "remaining");
  const spread = Math.sqrt([...mine, ...theirs].reduce((s, p) => s + p.remainingSpread ** 2, 0));
  return {
    league, weight, mine, theirs, myNow, oppNow, myFinal, oppFinal, spread,
    winProb: winChance(myFinal - oppFinal, spread),
  };
}

// Chance the final margin ends up above 0, treating what's left as a bell curve.
export function winChance(expectedMargin, spread) {
  if (spread < 0.01) return expectedMargin > 0 ? 1 : expectedMargin < 0 ? 0 : 0.5;
  return normalCdf(expectedMargin / spread);
}

function normalCdf(z) {
  // Abramowitz-Stegun approximation, accurate to about 0.0001.
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

// Boom Factor = 1 + Boom Rate (his real history) + Environment (Vegas expected points, when known).
// Expert disagreement (Sleeper vs ESPN projections) will slot in here once ESPN projections are synced.
function boomFactor(prof, game, team) {
  let env = 0;
  if (game?.overUnder && game.spread != null) {
    const favored = game.favorite === team;
    const teamTotal = game.overUnder / 2 + (favored ? game.spread / 2 : -game.spread / 2);
    env = clamp((teamTotal - 22) / 20, -0.2, 0.3);
  }
  return 1 + prof.boomRate + env;
}

// ---------- Per-game scores ----------

// How much a player's job fits what is happening on the field right now.
export function roleFactor(p, game) {
  if (!game || game.state !== "in" || p.pos === "DEF") return { factor: 1 };
  let factor = 1, why = null;
  const hasBall = game.offense === p.nflTeam;
  const share = p.profile.rzShare;
  if (hasBall && game.yardsToGoal != null) {
    const pct = `${Math.round(share * 100)}% of ${p.nflTeam}'s red-zone looks`;
    if (game.yardsToGoal <= 5) {
      factor = { RB: 1 + 3 * share, WR: 1 + 2 * share, TE: 1 + 2 * share, QB: 1.5, K: 1.3 }[p.pos] ?? 1;
      why = p.pos === "QB" || p.pos === "K" ? `${p.nflTeam} at the goal line` : `goal line, gets ${pct}`;
    } else if (game.yardsToGoal <= 20) {
      factor = { RB: 1 + 2 * share, WR: 1 + 1.5 * share, TE: 1 + 1.5 * share, QB: 1.3, K: 1.3 }[p.pos] ?? 1;
      why = p.pos === "QB" || p.pos === "K" ? `${p.nflTeam} in the red zone` : `red zone, gets ${pct}`;
    } else factor = 1.1;
  }
  // Game script late: the team that's behind throws, the team that's ahead runs.
  if (game.period >= 4) {
    const mine = p.nflTeam === game.home ? game.homeScore : game.awayScore;
    const theirs = p.nflTeam === game.home ? game.awayScore : game.homeScore;
    if (mine < theirs && ["QB", "WR", "TE"].includes(p.pos)) factor *= 1.2;
    if (mine < theirs - 14 && p.pos === "RB") factor *= 0.8;
    if (mine > theirs && p.pos === "RB") factor *= 1.1;
  }
  return { factor, why };
}

function liveSituation(game, involvedTeams) {
  if (!game || game.state === "post") return 0;
  if (game.state === "pre") return 0.2; // upcoming: matters, but nothing to watch yet
  let live = 1;
  if (game.offense && involvedTeams.has(game.offense)) {
    live += 0.5;
    const y = game.yardsToGoal ?? 100;
    live += y <= 5 ? 1.5 : y <= 20 ? 1.0 : y <= 50 ? 0.3 : 0;
  }
  if (isCrunchTime(game)) live += 0.5;
  return live;
}

const isCrunchTime = (g) => g.period > 4 || (g.period === 4 && (g.clockSec <= 120 || Math.abs(g.homeScore - g.awayScore) <= 8)) || (g.period === 2 && g.clockSec <= 120);

export function gameScore(game) {
  if (!game || game.state !== "in") return { score: 0, why: null };
  const wp = game.homeWinProb ?? scoreToWinProb(game);
  const closeness = 1 - Math.abs(wp - 0.5) * 2;
  const time = game.period > 4 ? 2.5 : game.period === 4 && game.clockSec <= 120 ? 2.0 : { 1: 0.6, 2: 0.8, 3: 1.0, 4: 1.4 }[game.period] ?? 1;
  const y = game.offense ? game.yardsToGoal ?? 100 : 100;
  const threat = y <= 5 ? 2.0 : y <= 20 ? 1.6 : y <= 50 ? 1.2 : 1.0;
  const favLosing = game.favorite && game.period >= 3 &&
    ((game.favorite === game.home && game.homeScore < game.awayScore) || (game.favorite === game.away && game.awayScore < game.homeScore));
  const score = Math.min(100, (100 * closeness * time * threat) / 3 + (favLosing ? 10 : 0));
  const bits = [];
  if (closeness > 0.6) bits.push("close game");
  if (time >= 2) bits.push("crunch time");
  if (threat >= 1.6) bits.push(`${game.offense} threatening (${game.downText})`);
  if (favLosing) bits.push("upset alert");
  return { score, why: bits.join(", ") || null };
}

// Rough fallback when ESPN hasn't sent a win probability: score margin vs time left.
function scoreToWinProb(g) {
  const margin = g.homeScore - g.awayScore;
  const left = Math.max(0.05, fractionLeft(g));
  return normalCdf(margin / (13.5 * Math.sqrt(left)));
}

// ---------- Ranking every game ----------

export function rankGames({ games, matchups, dials = DIALS.fantasyOn }) {
  const ranked = games.map((game) => {
    let flipPower = 0;
    const involved = [];
    for (const m of matchups) {
      const gap = Math.abs(m.myFinal - m.oppFinal);
      let stake = 0;
      for (const p of [...m.mine, ...m.theirs]) {
        if (p.game?.id !== game.id || p.remaining <= 0) continue;
        const role = roleFactor(p, game);
        const s = p.remaining * p.boomFactor * role.factor;
        stake += s;
        involved.push({ ...p, stake: s, roleWhy: role.why, league: m.league.name });
      }
      flipPower += (m.weight * stake) / (gap + 10);
    }
    const teams = new Set(involved.map((p) => p.nflTeam));
    const live = liveSituation(game, teams);
    const fantasy = Math.min(100, 30 * flipPower * live);
    const g = gameScore(game);
    const watch = dials.fantasy * fantasy + dials.game * g.score;
    involved.sort((a, b) => b.stake - a.stake);
    return { game, watch, fantasy, gameScore: g.score, gameWhy: g.why, flipPower, live, involved, reason: explain(game, dials.fantasy ? involved : [], g) };
  });
  return ranked.sort((a, b) => b.watch - a.watch);
}

function explain(game, involved, g) {
  const top = involved.slice(0, 2).map((p) => {
    const who = p.owner === "me" ? "🟡 your" : "🟣 opponent's";
    return `${who} ${p.pos} ${p.name}${p.roleWhy ? ` (${p.roleWhy})` : ""}`;
  });
  const parts = [];
  if (top.length) parts.push(top.join(" · "));
  if (g.why) parts.push(g.why);
  if (game.state === "pre") parts.push("not started yet");
  return parts.join(" — ") || "nothing at stake for you";
}

// ---------- Big-play pop-ups (compare two snapshots a few seconds apart) ----------

export function detectBigPlays(before, after, { matchupsBefore = [], matchupsAfter = [] } = {}) {
  const pops = [];
  const prev = new Map(before.map((g) => [g.id, g]));
  for (const g of after) {
    const p = prev.get(g.id);
    if (!p || g.state === "pre") continue;
    const pts = g.homeScore + g.awayScore - (p.homeScore + p.awayScore);
    const wpSwing = g.homeWinProb != null && p.homeWinProb != null ? Math.abs(g.homeWinProb - p.homeWinProb) : 0;
    const text = g.lastPlay ?? "";
    const turnover = /intercept|fumble.*recover|safety/i.test(text) && text !== p.lastPlay;
    const longPlay = /\bfor (\d+) yards?\b/i.exec(text);
    if (pts >= 6) {
      const team = g.homeScore > p.homeScore ? g.home : g.away;
      pops.push({ game: g.name, gameId: g.id, team, kind: "touchdown", text: `${team} touchdown · ${g.away} ${g.awayScore}, ${g.home} ${g.homeScore}` });
    }
    else if (turnover) pops.push({ game: g.name, gameId: g.id, kind: "turnover", text });
    else if (longPlay && Number(longPlay[1]) >= 40 && text !== p.lastPlay) pops.push({ game: g.name, gameId: g.id, kind: "big play", text });
    else if (wpSwing >= 0.15) pops.push({ game: g.name, gameId: g.id, kind: "momentum swing", text });
  }
  // Fantasy pop-ups: any league where your win chance moved 5% or more.
  for (const m of matchupsAfter) {
    const old = matchupsBefore.find((x) => x.league.league_id === m.league.league_id);
    if (old && Math.abs(m.winProb - old.winProb) >= 0.05) {
      pops.push({ kind: "fantasy", league: m.league.name, from: old.winProb, to: m.winProb });
    }
  }
  return pops;
}

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
