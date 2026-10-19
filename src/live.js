// Live game day: Sleeper once for your leagues and lineups, then every few seconds ESPN's scoreboard
// plus the full play-by-play of every game in progress. Same tracker as the replay, so the same cards.

import { syncEverything } from "./sync.js";
import { espn } from "./espn.js";
import { parseSummary } from "./plays.js";
import { createTracker } from "./tracker.js";

const SUMMARY = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=";

export async function createLive(fetchJson, { username }) {
  const data = await syncEverything(fetchJson, { username });
  const players = [...data.projections.values()]
    .filter((r) => r.player && r.team && r.player.position !== "DEF")
    .map((r) => ({ id: r.player_id, first: r.player.first_name, last: r.player.last_name, team: r.team, pos: r.player.position }));
  const leagues = data.matchups.map((m) => ({
    league: { league_id: m.league.league_id, name: m.league.name },
    scoring: m.league.scoring_settings, info: m.info, opponentName: m.opponentName, weight: m.weight,
    mine: m.mine.map(slim), theirs: m.theirs.map(slim),
  }));
  const tracker = createTracker({
    leagues, players,
    games: data.games.map((g) => ({ id: g.id, home: g.home, away: g.away, kickoff: g.kickoff, favorite: g.favorite, spread: g.spread, overUnder: g.overUnder })),
  });

  const loaded = new Set(); // finished games already read in full
  async function loadGame(id, silent) {
    const game = parseSummary(await fetchJson(SUMMARY + id));
    return tracker.addPlays(id, game.plays, { silent });
  }

  // One update: returns the new play cards. The first call loads what already happened, quietly.
  let first = true;
  async function poll() {
    const games = await espn(fetchJson).scoreboard();
    const cards = [];
    await Promise.all(games.map(async (g) => {
      if (g.state === "pre") return;
      if (g.state === "post" && loaded.has(g.id)) return;
      try {
        cards.push(...await loadGame(g.id, first));
        if (g.state === "post") loaded.add(g.id);
      } catch { /* one game's feed failing shouldn't stop the others */ }
      // The scoreboard is the authority on game state and clock between plays.
      const fields = { state: g.state, period: g.period, clockSec: g.clockSec, homeScore: g.homeScore, awayScore: g.awayScore };
      if (g.state === "in" && g.offense) Object.assign(fields, { offense: g.offense, yardsToGoal: g.yardsToGoal, downText: g.downText, isRedZone: g.isRedZone });
      if (g.homeWinProb != null) fields.homeWinProb = g.homeWinProb;
      tracker.updateGame(g.id, fields);
    }));
    first = false;
    return cards.sort((a, b) => (a.wallclock ?? 0) - (b.wallclock ?? 0));
  }

  return { tracker, poll, user: data.user.display_name, week: data.week, skipped: data.skipped };
}

function slim(p) {
  return { id: p.id, name: p.name, pos: p.pos, team: p.nflTeam, projected: p.projected, boomFactor: p.boomFactor, profile: p.profile };
}
