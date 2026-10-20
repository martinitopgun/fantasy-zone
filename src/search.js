// Find: type a few letters, get players and games. Pure, no DOM.
//   buildIndex({ lineups, cards, games })   lineups: [{ id, name, pos, team, owner }] (both starting lineups)
//   search(index, "swi") -> [{ kind: "player", id, name, team, pos, owner } | { kind: "name", name, team } | { kind: "game", id, label }]
// Your lineup and your opponent's come first, then anyone else named in today's plays, then games.

const TEAM_NAMES = {
  ARI: "arizona cardinals", ATL: "atlanta falcons", BAL: "baltimore ravens", BUF: "buffalo bills", CAR: "carolina panthers",
  CHI: "chicago bears", CIN: "cincinnati bengals", CLE: "cleveland browns", DAL: "dallas cowboys", DEN: "denver broncos",
  DET: "detroit lions", GB: "green bay packers", HOU: "houston texans", IND: "indianapolis colts", JAX: "jacksonville jaguars",
  KC: "kansas city chiefs", LV: "las vegas raiders", LAC: "los angeles chargers", LAR: "los angeles rams", MIA: "miami dolphins",
  MIN: "minnesota vikings", NE: "new england patriots", NO: "new orleans saints", NYG: "new york giants", NYJ: "new york jets",
  PHI: "philadelphia eagles", PIT: "pittsburgh steelers", SF: "san francisco 49ers", SEA: "seattle seahawks", TB: "tampa bay buccaneers",
  TEN: "tennessee titans", WAS: "washington commanders",
};

export const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/['’.]/g, "");
const words = (s) => norm(s).split(/[\s/@-]+/).filter(Boolean);

export function buildIndex({ lineups = [], cards = [], games = [] }) {
  const out = [], seen = new Set();
  for (const p of lineups) {
    if (seen.has(p.name)) continue;
    seen.add(p.name);
    out.push({ kind: "player", id: p.id, name: p.name, team: p.team, pos: p.pos, owner: p.owner, rank: 0, words: words(p.name) });
  }
  for (const c of cards) {
    if (!c.name || seen.has(c.name) || !/^[A-Z][a-z'’.-]+ [A-Z]/.test(c.name)) continue; // full names only, not "C.Lamb" or a team
    seen.add(c.name);
    out.push({ kind: "name", name: c.name, team: c.offense, rank: 1, words: words(c.name) });
  }
  for (const g of games) {
    const label = `${g.away} @ ${g.home}`;
    out.push({ kind: "game", id: g.id, label, rank: 2, words: [...words(label), ...words(TEAM_NAMES[g.away]), ...words(TEAM_NAMES[g.home])] });
  }
  return out;
}

// Every typed word has to start one of the entry's words ("dandre" matches D'Andre, "colts" matches IND games).
export function search(index, q, limit = 8) {
  const typed = words(q);
  if (!typed.length) return [];
  return index
    .filter((e) => typed.every((t) => e.words.some((w) => w.startsWith(t))))
    .sort((a, b) => a.rank - b.rank || (a.name ?? a.label).length - (b.name ?? b.label).length)
    .slice(0, limit)
    .map(({ words: _w, rank: _r, ...e }) => e);
}
