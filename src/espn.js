// ESPN's free scoreboard: every NFL game this week with score, clock, who has the ball,
// down & distance, red zone, ESPN's live win probability, and the pregame Vegas line.

const SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";

// ESPN and Sleeper spell a few teams differently. Everything inside the engine uses Sleeper's.
const TO_SLEEPER = { WSH: "WAS", JAC: "JAX", LA: "LAR" };
const code = (abbr) => TO_SLEEPER[abbr] ?? abbr;

export function espn(fetchJson) {
  return { scoreboard: async () => parseScoreboard(await fetchJson(SCOREBOARD)) };
}

export function parseScoreboard(data) {
  return (data?.events ?? []).map((ev) => {
    const comp = ev.competitions[0];
    const teams = {};
    for (const c of comp.competitors) teams[c.homeAway] = { id: c.team.id, team: code(c.team.abbreviation), score: Number(c.score ?? 0) };
    const { home, away } = teams;
    const st = ev.status;
    const sit = comp.situation ?? {};
    const prob = sit.lastPlay?.probability;
    const odds = comp.odds?.[0];

    // Who has the ball, and how far from the end zone they are.
    let offense = null, yardsToGoal = null;
    // Right after kickoffs and turnovers ESPN can leave out "possession"; the team that
    // ended the last play with the ball has it.
    const possession = sit.possession ?? sit.lastPlay?.end?.team?.id;
    if (possession && st.type.state === "in") {
      offense = possession === home.id ? home.team : away.team;
      const m = /^(\w+)\s+(\d+)$/.exec(sit.possessionText ?? "");
      if (m) {
        const side = code(m[1]);
        const yl = Number(m[2]);
        yardsToGoal = side === offense ? 100 - yl : yl;
      } else if (sit.possessionText?.includes("50")) yardsToGoal = 50;
    }

    return {
      id: ev.id,
      name: `${away.team} @ ${home.team}`,
      home: home.team,
      away: away.team,
      homeScore: home.score,
      awayScore: away.score,
      state: st.type.state, // "pre" | "in" | "post"
      period: st.period,
      clockSec: clockToSec(st.displayClock),
      kickoff: ev.date,
      offense,
      yardsToGoal,
      down: sit.down ?? null,
      distance: sit.distance ?? null,
      downText: sit.downDistanceText ?? null,
      isRedZone: Boolean(sit.isRedZone),
      lastPlay: sit.lastPlay?.text ?? null,
      homeWinProb: prob ? prob.homeWinPercentage : null,
      // Pregame line, e.g. "SF -7.5" and over/under 47.5 -> expected points per team.
      favorite: odds?.details ? code(odds.details.split(" ")[0]) : null,
      spread: odds?.details ? Math.abs(Number(odds.details.split(" ")[1])) || 0 : null,
      overUnder: odds?.overUnder ?? null,
    };
  });
}

function clockToSec(text) {
  const [m, s] = String(text ?? "0:00").split(":").map(Number);
  return (m || 0) * 60 + (s || 0);
}

// Share of the game still to be played (1 before kickoff, 0 when it's over).
export function fractionLeft(game) {
  if (!game || game.state === "pre") return 1;
  if (game.state === "post") return 0;
  if (game.period > 4) return 0.05; // overtime
  return Math.max(0, Math.min(1, ((4 - game.period) * 900 + game.clockSec) / 3600));
}
