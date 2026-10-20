// Follows a whole NFL Sunday play by play. Live mode and replay both feed plays in here.
// For every play it updates the game (score, clock, field), each player's fantasy points
// under the league's own rules, your win chance, and makes a Real-style card for the feed.

import { analyzePlay, headline, cleanText } from "./plays.js";
import { fantasyPoints } from "./scoring.js";
import { fractionLeft } from "./espn.js";
import { winChance } from "./model.js";

// ---------- Matching "J.Williams" (DAL) to Javonte Williams ----------

const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z]/g, "");
const dropSuffix = (s) => String(s ?? "").replace(/\s+(Jr\.?|Sr\.?|II|III|IV|V)$/i, "");

export function makeNameIndex(players) {
  const byKey = new Map();
  for (const p of players) {
    const key = `${p.team}|${norm(dropSuffix(p.last))}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(p);
  }
  const cache = new Map();
  return function resolve(abbr, teams) {
    const ck = `${abbr}|${teams.join(",")}`;
    if (cache.has(ck)) return cache.get(ck);
    // "J.Williams" style, or a full name like "Tommy Tremble" / "Amon-Ra St. Brown"
    const m = /^([A-Za-z]{1,3})\.\s?(.+)$/.exec(abbr ?? "");
    const full = !m && /^(\S+) (.+)$/.exec(abbr ?? "");
    let found = null;
    if (m || full) {
      const init = norm(m ? m[1] : full[1]), last = norm(dropSuffix(m ? m[2] : full[2]));
      for (const t of teams) {
        const list = (byKey.get(`${t}|${last}`) ?? []).filter((p) => (m ? norm(p.first).startsWith(init) : norm(p.first) === init));
        if (list.length) { found = list[0]; break; }
      }
    }
    cache.set(ck, found);
    return found;
  };
}

// ---------- Tracker ----------

const OFFENSE_TYPES = /^(Rush|Pass Reception|Passing Touchdown|Rushing Touchdown|Sack|Fumble Recovery \(Own\)|Fumble Recovery \(Opponent\)|Sack Opp Fumble Recovery)$/;

export function createTracker({ leagues, players, games }) {
  const resolve = makeNameIndex(players);
  const gameMap = new Map(games.map((g) => [g.id, {
    homeScore: 0, awayScore: 0, state: "pre", period: 1, clockSec: 900, offense: null, yardsToGoal: null,
    down: null, distance: null, downText: null, isRedZone: false, lastPlay: null, homeWinProb: null,
    driveStart: null, momentum: [], // momentum: home win chance after each play, for the game screen
    ...g, name: `${g.away} @ ${g.home}`,
  }]));
  const gameByTeam = new Map();
  for (const g of gameMap.values()) { gameByTeam.set(g.home, g.id); gameByTeam.set(g.away, g.id); }
  const seen = new Set();
  const stats = new Map(); // player id -> stat line
  const defStats = new Map(); // team -> defensive stat line
  const yardsGained = new Map(); // team -> offensive yards
  const feed = []; // newest first
  const history = new Map(); // league id -> [{ t, wp, cardId }]: your win chance after every play that moved it
  const posById = new Map(players.map((p) => [p.id, p.pos]));
  const playerById = new Map(players.map((p) => [p.id, p]));
  const playsByGame = new Map(); // game id -> its plays so far, in order (drives)
  let version = 0; // goes up whenever anything changes, so the screen can skip ticks where nothing happened
  const starters = leagues.flatMap((l) => [...l.mine.map((p) => ({ ...p, owner: "me", league: l })), ...l.theirs.map((p) => ({ ...p, owner: "opponent", league: l }))]);

  const add = (map, key, k, v) => { const line = map.get(key) ?? {}; line[k] = (line[k] ?? 0) + v; map.set(key, line); };

  function pointsFor(p, scoring) {
    const g = gameMap.get(gameByTeam.get(p.team));
    if (p.pos === "DEF") return g && g.state !== "pre" ? fantasyPoints(defenseLine(p.team, g), scoring) : 0;
    return fantasyPoints(withBonuses(stats.get(p.id), p.pos), scoring);
  }

  function defenseLine(t, g) {
    const allowed = t === g.home ? g.awayScore : g.homeScore;
    const yds = yardsGained.get(t === g.home ? g.away : g.home) ?? 0;
    const line = { ...(defStats.get(t) ?? {}), pts_allow: allowed, yds_allow: yds };
    line[`pts_allow_${allowed === 0 ? "0" : allowed <= 6 ? "1_6" : allowed <= 13 ? "7_13" : allowed <= 20 ? "14_20" : allowed <= 27 ? "21_27" : allowed <= 34 ? "28_34" : "35p"}`] = 1;
    line[`yds_allow_${yds < 100 ? "0_100" : yds < 200 ? "100_199" : yds < 300 ? "200_299" : yds < 350 ? "300_349" : yds < 400 ? "350_399" : yds < 450 ? "400_449" : yds < 500 ? "450_499" : yds < 550 ? "500_549" : "550p"}`] = 1;
    return line;
  }

  // A defense starts every game with "nothing allowed yet" bonuses that usually shrink as the game goes on.
  // Expected final = what it has now + (projection - those starting bonuses) x share of game left.
  function allowedBonus(t, g, scoring) {
    const line = defenseLine(t, g);
    for (const k of Object.keys(line)) if (!/^(pts|yds)_allow_/.test(k)) delete line[k];
    return fantasyPoints(line, scoring);
  }

  function matchupViews() {
    return leagues.map((l) => {
      const side = (list, owner) => list.map((p) => {
        const game = gameMap.get(gameByTeam.get(p.team)) ?? null;
        const frac = game ? fractionLeft(game) : 0;
        const bonus = p.pos === "DEF" && game && game.state !== "pre" ? allowedBonus(p.team, game, l.scoring) : 0;
        return {
          ...p, owner, nflTeam: p.team, game,
          current: pointsFor(p, l.scoring),
          remaining: (p.projected - bonus) * frac,
          remainingSpread: (p.profile?.spread ?? 6) * Math.sqrt(frac),
        };
      });
      const mine = side(l.mine, "me"), theirs = side(l.theirs, "opponent");
      const sum = (ps, k) => ps.reduce((s, p) => s + p[k], 0);
      const myNow = sum(mine, "current"), oppNow = sum(theirs, "current");
      const myFinal = myNow + sum(mine, "remaining"), oppFinal = oppNow + sum(theirs, "remaining");
      const spread = Math.sqrt([...mine, ...theirs].reduce((s, p) => s + p.remainingSpread ** 2, 0));
      return { league: l.league, info: l.info, opponentName: l.opponentName, weight: l.weight ?? 1, mine, theirs, myNow, oppNow, myFinal, oppFinal, spread, winProb: winChance(myFinal - oppFinal, spread) };
    });
  }

  // Feed one game's plays in (any order, repeats are ignored). Returns the new cards.
  function addPlays(gameId, plays, { silent = false } = {}) {
    const g = gameMap.get(gameId);
    if (!g) return [];
    const fresh = plays.filter((p) => !seen.has(p.id)).sort((a, b) => (a.wallclock ?? 0) - (b.wallclock ?? 0));
    const cards = [];
    for (const play of fresh) {
      seen.add(play.id);
      if (!playsByGame.has(gameId)) playsByGame.set(gameId, []);
      playsByGame.get(gameId).push(play);
      version++;
      const involved = starters.filter((p) => p.team === g.home || p.team === g.away);
      // A player's stat line as scored (bonuses included), so a card can show where its points came from.
      const lineOf = (p) => (p.pos === "DEF" ? (g.state !== "pre" ? defenseLine(p.team, g) : {}) : withBonuses(stats.get(p.id), p.pos));
      const before = new Map(involved.map((p) => [`${p.league.league.league_id}:${p.owner}:${p.id}`, pointsFor(p, p.league.scoring)]));
      const linesBefore = new Map(involved.map((p) => [p.id, lineOf(p)]));
      const wpBefore = matchupViews().map((m) => m.winProb);
      const gameWpBefore = g.homeWinProb;
      const prevHome = g.homeScore, prevAway = g.awayScore;
      const kickoff = g.state === "pre"; // a defense's starting bonuses appear on the first play; that isn't news

      const a = analyzePlay(play);
      // Quarter ends, two-minute warnings and finals. ESPN sometimes tags them wrong (ARI@LAR's end of the
      // 1st quarter came as "End of Half", period 2), so the period and clock only come from the text.
      const marker = a.kind === "marker", endOfGame = marker && /End of Game/i.test(play.type);
      const quarterEnd = marker ? /END QUARTER (\d)/i.exec(play.text ?? "") : null;
      const teams = [play.offense, play.offense === g.home ? g.away : g.home].filter(Boolean);
      for (const s of a.stats) {
        const p = resolve(s.name, s.team ? [s.team, ...teams] : teams);
        if (p) add(stats, p.id, s.key, s.value);
      }
      for (const [t, line] of Object.entries(a.def)) for (const [k, v] of Object.entries(line)) add(defStats, t, k, v);
      // Yards allowed by defenses, counted the official way (a holding call doesn't erase the run).
      if (OFFENSE_TYPES.test(play.type) && play.offense && !/No Play\./i.test(play.text)) {
        const y = ["rush", "catch", "sack", "kneel"].includes(a.kind) && a.yards != null ? a.yards : play.statYardage ?? 0;
        yardsGained.set(play.offense, (yardsGained.get(play.offense) ?? 0) + y);
      }

      // Game state after the play.
      if (!marker) { g.period = play.period; g.clockSec = clockToSec(play.clock); }
      else if (quarterEnd) { g.period = Number(quarterEnd[1]); g.clockSec = 0; }
      g.homeScore = play.homeScore; g.awayScore = play.awayScore;
      if (a.returnTd) {
        const scorer = g.homeScore - prevHome >= 6 ? g.home : g.awayScore - prevAway >= 6 ? g.away : null;
        if (scorer) add(defStats, scorer, ["punt", "kickoff"].includes(a.kind) || /Blocked|Return Touchdown/i.test(play.type) && !/Interception|Fumble/i.test(play.type) ? "def_st_td" : "def_td", 1);
      }
      if (play.end) {
        const newOffense = play.end.team ?? play.offense;
        if (newOffense !== g.offense || a.kind === "kickoff" || play.scoring) g.driveStart = play.end.yardsToGoal;
        g.offense = newOffense;
        g.yardsToGoal = play.end.yardsToGoal; g.down = play.end.down; g.distance = play.end.distance; g.downText = play.end.downText;
        g.isRedZone = g.yardsToGoal != null && g.yardsToGoal <= 20;
      }
      if (play.homeWinProb != null) {
        g.homeWinProb = play.homeWinProb;
        g.momentum.push({ wp: play.homeWinProb, period: play.period, scored: play.scoring });
      }
      g.lastPlay = play.text;
      g.state = /End of Game/i.test(play.type) ? "post" : "in";
      if (g.state === "post") { g.clockSec = 0; g.offense = null; g.downText = null; g.isRedZone = false; }

      // Only halftime and the final get a card. Quarter ends and two-minute warnings stay out of the feed.
      const halftime = quarterEnd ? quarterEnd[1] === "2" : /End of Half/i.test(play.type);
      if (marker && !endOfGame && !halftime) continue;

      const views = matchupViews();
      const impacts = [];
      for (const p of involved) {
        const key = `${p.league.league.league_id}:${p.owner}:${p.id}`;
        if (kickoff && p.pos === "DEF") continue;
        const delta = pointsFor(p, p.league.scoring) - before.get(key);
        if (Math.abs(delta) >= 0.05) impacts.push({ id: p.id, name: p.name, pos: p.pos, owner: p.owner, league: p.league.league.name, delta, rows: scoreRows(linesBefore.get(p.id), lineOf(p), p.league.scoring) });
      }
      // A marker card never carries a win move: nothing happened on the field.
      const wp = views.map((m, i) => ({ league: m.league.name, before: marker ? m.winProb : wpBefore[i], after: m.winProb }));
      const keyPlayer = a.player ? resolve(a.player, teams) : null;
      const passer = a.passer ? resolve(a.passer, teams) : null;
      const gameWpAfter = g.homeWinProb;
      const gameSwing = !marker && gameWpBefore != null && gameWpAfter != null ? Math.abs(gameWpAfter - gameWpBefore) : 0;
      const card = {
        id: play.id, gameId, gameName: g.name, home: g.home, away: g.away, homeScore: g.homeScore, awayScore: g.awayScore,
        wallclock: play.wallclock, period: play.period, clock: play.clock, situation: play.start?.downText ?? null,
        offense: play.offense, kind: a.kind, td: a.td, turnover: a.turnover, yards: a.yards,
        ytg: play.end?.yardsToGoal ?? null, // yards to the end zone after the play (Free Picks: red-zone entries)
        name: keyPlayer ? `${keyPlayer.first} ${keyPlayer.last}` : a.player ?? a.label ?? "",
        label: headline(a),
        from: a.kind === "catch" && passer ? `from ${passer.first} ${passer.last}` : a.kind === "incomplete" && passer && a.target ? `from ${passer.first} ${passer.last}` : a.kind === "int" && a.by ? `by ${a.by}` : null,
        text: cleanText(play.text),
        impacts, wp, gameSwing, silent,
        gameWpBefore: marker ? gameWpAfter : gameWpBefore, gameWpAfter, // home team's win chance (ESPN) around the play
        scored: g.homeScore + g.awayScore > prevHome + prevAway,
      };
      card.big = !marker && (a.td || a.turnover || (Math.abs(a.yards ?? 0) >= 20 && ["catch", "rush"].includes(a.kind)) || gameSwing >= 0.1
        || impacts.some((x) => Math.abs(x.delta) >= 4) || wp.some((w) => Math.abs(w.after - w.before) >= 0.05));
      feed.push(card);
      if (!marker) views.forEach((m, i) => {
        const id = m.league.league_id;
        if (!history.has(id)) history.set(id, [{ t: play.wallclock, wp: wpBefore[i], cardId: null }]);
        const list = history.get(id);
        if (Math.abs(m.winProb - list.at(-1).wp) >= 0.005) list.push({ t: play.wallclock, wp: m.winProb, cardId: card.id });
      });
      cards.push(card);
    }
    if (cards.length) feed.sort((x, y) => (y.wallclock ?? 0) - (x.wallclock ?? 0));
    return cards;
  }

  // Live mode: the scoreboard knows about kickoffs, finals and the clock between plays.
  function updateGame(gameId, fields) {
    const g = gameMap.get(gameId);
    if (!g) return;
    if (Object.entries(fields).some(([k, v]) => g[k] !== v)) version++;
    Object.assign(g, fields);
  }

  return {
    addPlays, updateGame,
    version: () => version,
    snapshot: () => ({ games: [...gameMap.values()].map((g) => ({ ...g, momentum: undefined })), matchups: matchupViews() }),
    history: (leagueId) => history.get(leagueId) ?? [],
    momentum: (id) => gameMap.get(id)?.momentum ?? [],
    feed: () => feed,
    // A player's stats so far (a copy), for the lineup rows. A defense (id = its team, "KC") gets its
    // defensive line plus points and yards allowed once its game has started.
    statLine: (id, pos = posById.get(id)) => {
      if (pos === "DEF") {
        const g = gameMap.get(gameByTeam.get(id));
        return g && g.state !== "pre" ? defenseLine(id, g) : {};
      }
      return { ...(stats.get(id) ?? {}) };
    },
    pointsById: (scoring) => {
      const out = {};
      for (const [id, line] of stats) out[id] = fantasyPoints(withBonuses(line, posById.get(id)), scoring);
      for (const g of gameMap.values()) for (const t of [g.home, g.away]) if (g.state !== "pre") out[t] = fantasyPoints(defenseLine(t, g), scoring);
      return out;
    },
    game: (id) => gameMap.get(id),
    plays: (gameId) => playsByGame.get(gameId) ?? [],
    // Box score so far (live, unofficial): each team's players with their stat lines, from the plays seen.
    box: (gameId) => {
      const g = gameMap.get(gameId);
      if (!g) return null;
      const out = { [g.away]: [], [g.home]: [] };
      for (const [id, line] of stats) {
        const p = playerById.get(id);
        if (p && out[p.team]) out[p.team].push({ id, name: `${p.first} ${p.last}`, pos: p.pos, line });
      }
      return out;
    },
    // Every team in the league (League tab): points now, expected final, spread of what's left, who's playing.
    //   teams: [{ roster_id, starters: [{ id, pos, team, projected, profile }] }]
    board: (teams, scoring) => teams.map((t) => {
      let now = 0, left = 0, spread2 = 0, playing = 0, toPlay = 0;
      for (const p of t.starters) {
        const g = gameMap.get(gameByTeam.get(p.team));
        const frac = g ? fractionLeft(g) : 0;
        const bonus = p.pos === "DEF" && g && g.state !== "pre" ? allowedBonus(p.team, g, scoring) : 0;
        now += pointsFor(p, scoring);
        left += (p.projected - bonus) * frac;
        spread2 += ((p.profile?.spread ?? 6) ** 2) * frac;
        if (g?.state === "in") playing++; else if (g?.state === "pre") toPlay++;
      }
      return { roster_id: t.roster_id, now, final: now + left, spread2, playing, toPlay };
    }),
  };
}

// Where a play's points came from: each scored stat that changed, times what the league pays for it.
// [[key, change, points], ...]; the points add up to the play's fantasy change.
export function scoreRows(before = {}, after = {}, scoring = {}) {
  const rows = [];
  for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const change = (after[k] ?? 0) - (before[k] ?? 0);
    const pts = change * (scoring[k] ?? 0);
    if (Math.abs(pts) >= 0.005) rows.push([k, change, pts]);
  }
  return rows.sort((a, b) => Math.abs(b[2]) - Math.abs(a[2]));
}

// Totals-based bonuses (100-yard games, TE premium, ...) are worked out from the running stat line.
export function withBonuses(line, pos) {
  if (!line) return {};
  const s = { ...line };
  const n = (k) => s[k] ?? 0;
  if (pos === "TE") s.bonus_rec_te = n("rec");
  if (pos === "RB") s.bonus_rec_rb = n("rec");
  if (pos === "WR") s.bonus_rec_wr = n("rec");
  for (const [k, stat, at] of [["bonus_rec_yd_100", "rec_yd", 100], ["bonus_rec_yd_200", "rec_yd", 200], ["bonus_rush_yd_100", "rush_yd", 100], ["bonus_rush_yd_200", "rush_yd", 200], ["bonus_pass_yd_300", "pass_yd", 300], ["bonus_pass_yd_400", "pass_yd", 400], ["bonus_pass_cmp_25", "pass_cmp", 25], ["bonus_rush_att_20", "rush_att", 20]]) {
    if (n(stat) >= at) s[k] = 1;
  }
  const scrimmage = n("rush_yd") + n("rec_yd");
  if (scrimmage >= 100) s.bonus_rush_rec_yd_100 = 1;
  if (scrimmage >= 200) s.bonus_rush_rec_yd_200 = 1;
  const fd = n("rush_fd") + n("rec_fd") + (pos === "QB" ? n("pass_fd") : 0);
  if (pos && fd) s[`bonus_fd_${pos.toLowerCase()}`] = fd;
  return s;
}

function clockToSec(text) {
  const [m, s] = String(text ?? "0:00").split(":").map(Number);
  return (m || 0) * 60 + (s || 0);
}
