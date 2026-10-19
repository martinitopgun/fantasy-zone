// Builds a profile for every NFL player from real past weeks:
//   - Boom Rate: how often he scored 1.5x (or more) what he was projected
//   - Bust Rate: how often he scored half (or less) of his projection
//   - Spread: how far off his projections usually are (used for win chances)
//   - Red-zone share: his share of his team's red-zone carries + targets
// Small samples are pulled toward the position average so one fluky week can't dominate.

import { fantasyPoints } from "./scoring.js";

// Typical miss size (points) on a weekly projection, by position. Used as a starting point
// before a player has enough games of his own.
const BASE_SPREAD = { QB: 7, RB: 7, WR: 7.5, TE: 5.5, K: 4, DEF: 5.5 };
const PRIOR_GAMES = 3; // how many "average games" each player starts with
const MIN_PROJECTION = 3; // ignore weeks where he was barely projected to play

export function buildProfiles({ pastWeeks, scoring }) {
  const games = new Map(); // player_id -> [{ proj, actual }]
  const rz = new Map(); // player_id -> red-zone opportunities
  const teamRz = new Map(); // team -> red-zone opportunities

  for (const { projections, stats } of pastWeeks) {
    for (const [id, row] of stats) {
      const s = row.stats ?? {};
      const pos = row.player?.position;
      if (pos && pos !== "DEF" && row.team) {
        const opps = (s.rush_rz_att ?? 0) + (s.rec_rz_tgt ?? 0);
        rz.set(id, (rz.get(id) ?? 0) + opps);
        // Team total = every designed red-zone run + every red-zone pass, counted once (from QBs).
        const teamOpps = (s.rush_rz_att ?? 0) + (pos === "QB" ? s.pass_rz_att ?? 0 : 0);
        teamRz.set(row.team, (teamRz.get(row.team) ?? 0) + teamOpps);
      }
      const proj = projections.get(id);
      const played = (s.gms_active ?? s.gp ?? 0) > 0;
      if (!proj || !played) continue;
      const projPts = fantasyPoints(proj.stats, scoring);
      if (projPts < MIN_PROJECTION) continue;
      const game = { pos, proj: projPts, actual: fantasyPoints(s, scoring) };
      if (!games.has(id)) games.set(id, []);
      games.get(id).push(game);
    }
  }

  // Position averages, used as the "prior" for small samples.
  const posTotals = {};
  for (const list of games.values()) {
    for (const { pos, proj, actual } of list) {
      if (!pos) continue;
      posTotals[pos] ??= { boom: 0, bust: 0, n: 0 };
      posTotals[pos].boom += actual >= 1.5 * proj ? 1 : 0;
      posTotals[pos].bust += actual <= 0.5 * proj ? 1 : 0;
      posTotals[pos].n += 1;
    }
  }
  const posAvg = (pos, key) => (posTotals[pos]?.n ? posTotals[pos][key] / posTotals[pos].n : 0.15);

  return function profile(id, pos, team) {
    const g = games.get(id) ?? [];
    const n = g.length;
    const booms = g.filter((x) => x.actual >= 1.5 * x.proj).length;
    const busts = g.filter((x) => x.actual <= 0.5 * x.proj).length;
    const boomRate = (booms + PRIOR_GAMES * posAvg(pos, "boom")) / (n + PRIOR_GAMES);
    const bustRate = (busts + PRIOR_GAMES * posAvg(pos, "bust")) / (n + PRIOR_GAMES);
    const base = BASE_SPREAD[pos] ?? 6;
    const sq = g.reduce((sum, x) => sum + (x.actual - x.proj) ** 2, 0);
    const spread = Math.sqrt((sq + PRIOR_GAMES * base ** 2) / (n + PRIOR_GAMES));
    const rzShare = team && teamRz.get(team) ? (rz.get(id) ?? 0) / teamRz.get(team) : 0;
    return { games: n, booms, busts, boomRate, bustRate, spread, rzShare, boomFactor: 1 + boomRate };
  };
}

// How tough is this week's opponent for this position? Uses the fantasy points each defense
// has allowed to each position (Sleeper tracks it as fan_pts_allow_qb / _rb / _wr / _te).
export function buildDefenseAllowed(pastWeeks) {
  const totals = new Map(); // "TEAM:POS" -> { pts, n }
  const league = {}; // POS -> { pts, n }
  for (const { stats } of pastWeeks) {
    for (const [, row] of stats) {
      if (row.player?.position !== "DEF" || !row.team) continue;
      for (const pos of ["qb", "rb", "wr", "te"]) {
        const v = row.stats?.[`fan_pts_allow_${pos}`];
        if (typeof v !== "number") continue;
        const k = `${row.team}:${pos.toUpperCase()}`;
        const t = totals.get(k) ?? { pts: 0, n: 0 };
        t.pts += v; t.n += 1; totals.set(k, t);
        league[pos.toUpperCase()] ??= { pts: 0, n: 0 };
        league[pos.toUpperCase()].pts += v; league[pos.toUpperCase()].n += 1;
      }
    }
  }
  // > 1 means this defense gives up more than average to that position (easier matchup).
  return function matchupFactor(defTeam, pos) {
    const t = totals.get(`${defTeam}:${pos}`);
    const l = league[pos];
    if (!t || !l) return 1;
    return (t.pts / t.n) / (l.pts / l.n);
  };
}
