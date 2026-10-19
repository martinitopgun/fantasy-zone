// Turns ESPN play-by-play into Real-style play cards and fantasy stats.
//   "(Shotgun) D.Prescott pass short left to J.Williams to DAL 43 for 16 yards (X.McKinney)."
//   -> { kind: "catch", player: "J.Williams", yards: 16, headline: "16-yd catch", stats: {...} }

const ESPN_TO_SLEEPER = { WSH: "WAS", JAC: "JAX", LA: "LAR" };
// Inside play text ESPN uses the league's older codes for a few teams.
const TEXT_TEAM = { BLT: "BAL", CLV: "CLE", HST: "HOU", ARZ: "ARI", LA: "LAR", JAC: "JAX", WSH: "WAS", SL: "LAR", SD: "LAC", OAK: "LV" };
const team = (abbr) => ESPN_TO_SLEEPER[abbr] ?? abbr;
const textTeam = (abbr) => TEXT_TEAM[abbr] ?? abbr;

// "J.Williams", "Ja.Chase", "AJ.Brown", "A.St. Brown", "J.Smith-Njigba", "M.Harrison Jr."
const NAME = String.raw`[A-Z][A-Za-z]{0,2}\.\s?(?:St\.\s?)?[A-Z][\w'\-]+(?:\s(?:Jr\.|Sr\.|II|III|IV))?`;
const YDS = String.raw`for (-?\d+) yards?|for no gain`;
const re = (s, f = "") => new RegExp(s, f);

// ---------- ESPN summary -> plain game + plays ----------

export function parseSummary(data) {
  const comp = data.header.competitions[0];
  const sides = {};
  for (const c of comp.competitors) sides[c.homeAway] = { id: c.team.id, team: team(c.team.abbreviation) };
  const byId = { [sides.home.id]: sides.home.team, [sides.away.id]: sides.away.team };
  const wp = new Map((data.winprobability ?? []).map((w) => [w.playId, w.homeWinPercentage]));
  const odds = data.pickcenter?.[0];
  const drives = [...(data.drives?.previous ?? []), ...(data.drives?.current ? [data.drives.current] : [])];
  const seen = new Set();
  const plays = [];
  for (const d of drives) {
    for (const p of d.plays ?? []) {
      if (seen.has(p.id)) continue; // the current drive can repeat the last plays
      seen.add(p.id);
      plays.push({
        id: p.id,
        seq: Number(p.sequenceNumber ?? 0),
        gameId: comp.id,
        type: p.type?.text ?? "",
        text: p.text ?? "",
        period: p.period?.number ?? 1,
        clock: p.clock?.displayValue ?? "",
        wallclock: p.wallclock ? Date.parse(p.wallclock) : null,
        offense: byId[p.start?.team?.id] ?? null,
        homeTeam: sides.home.team,
        awayTeam: sides.away.team,
        start: side(p.start, byId),
        end: side(p.end, byId),
        homeScore: p.homeScore ?? 0,
        awayScore: p.awayScore ?? 0,
        scoring: Boolean(p.scoringPlay),
        statYardage: p.statYardage ?? 0,
        homeWinProb: wp.get(p.id) ?? null,
      });
    }
  }
  plays.sort((a, b) => (a.wallclock ?? 0) - (b.wallclock ?? 0) || a.seq - b.seq);
  return {
    id: comp.id,
    home: sides.home.team,
    away: sides.away.team,
    kickoff: comp.date ?? data.header?.competitions?.[0]?.date,
    state: comp.status?.type?.state ?? "pre",
    favorite: odds?.details ? team(odds.details.split(" ")[0]) : null,
    spread: odds?.details ? Math.abs(Number(odds.details.split(" ")[1])) || 0 : null,
    overUnder: odds?.overUnder ?? null,
    plays,
  };
}

function side(s, byId) {
  if (!s) return null;
  return { down: s.down ?? null, distance: s.distance ?? null, yardsToGoal: s.yardsToEndzone ?? null, downText: s.downDistanceText ?? null, team: byId[s.team?.id] ?? null };
}

// ---------- One play -> what happened ----------

// Replay reviews: "...The Replay Official reviewed the X ruling, and the play was REVERSED.<corrected play>"
// Only the final ruling counts. ("Upheld" keeps the original.)
const REVIEW = String.raw`(?:The Replay Official reviewed|[A-Z][A-Za-z .]+ challenged) [^.]*?ruling, and the play was`;
export function finalRuling(raw) {
  const rev = re(`${REVIEW} REVERSED\\.\\s*(.*)$`, "s").exec(raw);
  if (rev && rev[1].trim()) return rev[1].trim();
  return raw.replace(re(`${REVIEW} Upheld\\..*$`, "s"), "").trim();
}

// Drop formation notes ESPN puts before the action: "(Shotgun)", "X reported in as eligible.", "Direct snap to X."
export function cleanText(raw) {
  let s = finalRuling(String(raw ?? "").trim());
  for (;;) {
    const next = s.replace(/^\([^)]*\)\s*/, "")
      .replace(re(`^${NAME} reported in as eligible\\.\\s*`), "")
      .replace(re(`^Direct snap to ${NAME}\\.\\s*`), "")
      .trim();
    if (next === s) return s;
    s = next;
  }
}

export function analyzePlay(play) {
  const raw = play.text;
  const text = cleanText(raw);
  const out = { kind: "other", player: null, passer: null, yards: null, td: false, turnover: false, stats: [], def: {} };
  const offense = play.offense;
  const defense = offense && play.homeTeam ? (offense === play.homeTeam ? play.awayTeam : play.homeTeam) : null;
  const stat = (name, key, value = 1, t = offense) => out.stats.push({ name, team: t, key, value });
  const defStat = (t, key, value = 1) => { if (t) out.def[t] = { ...(out.def[t] ?? {}), [key]: (out.def[t]?.[key] ?? 0) + value }; };
  const noPlay = /No Play\./i.test(text);
  const type = play.type;

  // Non-plays first.
  if (/Timeout/i.test(type)) return { ...out, kind: "timeout", label: text.replace(/\.$/, "") };
  if (/End Period|End of Half|End of Game|End of Regulation|Two-minute/i.test(type)) return { ...out, kind: "marker", label: text.replace(/\.$/, "") };

  const main = text.split(/(?:TWO-POINT CONVERSION ATTEMPT|PENALTY on)/i)[0];
  const yards = (s) => { const m = re(YDS).exec(s); return m ? (m[1] === undefined ? 0 : Number(m[1])) : null; };
  let m;

  if (!noPlay) {
    if ((m = re(`^(${FULL}) (\\d+) Yd (pass from|Run|Rush|Field Goal|Interception Return|Fumble Return|Punt Return|Kickoff Return)(?: (${FULL}))?`).exec(main))) {
      // Scoring-summary style: "Tommy Tremble 19 Yd pass from Bryce Young (Ryan Fitzgerald PAT failed)"
      const y = Number(m[2]);
      if (m[3] === "pass from") {
        Object.assign(out, { kind: "catch", player: m[1], passer: m[4], yards: y, td: true });
        for (const k of ["pass_att", "pass_cmp", "pass_td", "pass_fd"]) stat(m[4], k);
        stat(m[4], "pass_yd", y);
        for (const k of ["rec", "rec_tgt", "rec_td", "rec_fd"]) stat(m[1], k);
        stat(m[1], "rec_yd", y);
        longTd(stat, m[4], "pass", y); longTd(stat, m[1], "rec", y);
      } else if (m[3] === "Run" || m[3] === "Rush") {
        Object.assign(out, { kind: "rush", player: m[1], yards: y, td: true });
        stat(m[1], "rush_att"); stat(m[1], "rush_yd", y); stat(m[1], "rush_td"); stat(m[1], "rush_fd");
        longTd(stat, m[1], "rush", y);
      } else if (m[3] === "Field Goal") {
        Object.assign(out, { kind: "fg", player: m[1], yards: y });
        stat(m[1], "fgm"); stat(m[1], `fgm_${fgBucket(y)}`); stat(m[1], "fgm_yds", y); stat(m[1], "fgm_yds_over_30", Math.max(0, y - 30));
      } else {
        Object.assign(out, { kind: /Punt/.test(m[3]) ? "punt" : /Kickoff/.test(m[3]) ? "kickoff" : "other", player: m[1], yards: y, returnTd: true, td: true });
      }
      const pat = /\(([^)]*)\)\s*$/.exec(main)?.[1] ?? "";
      const kicker = re(`^(${FULL}) (?:Kick|PAT)`).exec(pat)?.[1];
      if (kicker) stat(kicker, /failed|blocked|missed/i.test(pat) ? "xpmiss" : "xpm", 1, out.returnTd ? defense : offense);
      out.summaryStyle = true;
    } else if ((m = re(`^(${NAME}) (\\d+) yard field goal is (GOOD|No Good|BLOCKED)`, "i").exec(main))) {
      const dist = Number(m[2]);
      const good = /GOOD/.test(m[3]) && !/No Good/i.test(m[3]);
      Object.assign(out, { kind: good ? "fg" : "fg-miss", player: m[1], yards: dist });
      const b = fgBucket(dist);
      if (good) { stat(m[1], "fgm"); stat(m[1], `fgm_${b}`); stat(m[1], "fgm_yds", dist); stat(m[1], "fgm_yds_over_30", Math.max(0, dist - 30)); }
      else { stat(m[1], "fgmiss"); stat(m[1], `fgmiss_${b}`); if (/BLOCKED/i.test(m[3])) defStat(defense, "blk_kick"); }
    } else if ((m = re(`^(${NAME}) sacked`).exec(main))) {
      Object.assign(out, { kind: "sack", player: m[1], yards: yards(main) });
      stat(m[1], "pass_sack");
      defStat(defense, "sack");
    } else if ((m = re(`^(${NAME}) pass (?:[a-z]+ )*?(?:intended for (${NAME}) )?INTERCEPTED by (${NAME})`).exec(main))) {
      Object.assign(out, { kind: "int", player: m[1], target: m[2] ?? null, by: m[3], turnover: true });
      stat(m[1], "pass_att"); stat(m[1], "pass_int");
      defStat(defense, "int");
    } else if ((m = re(`^(${NAME}) pass incomplete`).exec(main))) {
      const target = re(`(?:to|for) (${NAME})`).exec(main)?.[1] ?? null;
      Object.assign(out, { kind: "incomplete", player: target ?? m[1], target, passer: m[1] });
      stat(m[1], "pass_att"); stat(m[1], "pass_inc");
      if (target) stat(target, "rec_tgt");
    } else if ((m = re(`^(${NAME}) pass (?:[a-z]+ )*?to (${NAME})`).exec(main))) {
      const y = spotFoul(play, yards(main) ?? play.statYardage, text, offense);
      Object.assign(out, { kind: "catch", player: m[2], passer: m[1], yards: y });
      stat(m[1], "pass_att"); stat(m[1], "pass_cmp"); stat(m[1], "pass_yd", y);
      stat(m[2], "rec"); stat(m[2], "rec_tgt"); stat(m[2], "rec_yd", y);
      // "... for 2 yards. Lateral to R.Johnson pushed ob at ATL 28 for 12 yards": the passer gets those yards too.
      const lat = re(`Lateral to (${NAME}).*?for (-?\\d+) yards?`).exec(main);
      if (lat) { stat(m[1], "pass_yd", Number(lat[2])); stat(lat[1], "rec_yd", Number(lat[2])); }
      if (firstDown(play, y, main)) { stat(m[1], "pass_fd"); stat(m[2], "rec_fd"); }
      if (/TOUCHDOWN/.test(main)) { out.td = true; stat(m[1], "pass_td"); stat(m[2], "rec_td"); longTd(stat, m[1], "pass", y); longTd(stat, m[2], "rec", y); }
    } else if (/Punt|Kickoff/i.test(type) || re(`^(${NAME}) (punts|kicks)`).test(main)) {
      out.kind = /Kickoff/i.test(type) || / kicks /.test(main) ? "kickoff" : "punt";
      out.yards = yards(main.split(".")[0]) ?? (/(\d+) yards/.exec(main)?.[1] ? Number(/(\d+) yards/.exec(main)[1]) : null);
    } else if ((m = re(`^(${NAME}) (?:[a-z]+ )*?(?:to [A-Z]{2,3} \\d+ )?(?:${YDS})`).exec(main)) || (m = re(`^(${NAME}) (?:up the middle|left|right|scrambles|kneels)`).exec(main))) {
      const y = spotFoul(play, yards(main) ?? 0, text, offense);
      Object.assign(out, { kind: /kneels/.test(main) ? "kneel" : "rush", player: m[1], yards: y });
      stat(m[1], "rush_att"); stat(m[1], "rush_yd", y);
      if (firstDown(play, y, main)) stat(m[1], "rush_fd");
      if (/TOUCHDOWN/.test(main)) { out.td = true; stat(m[1], "rush_td"); longTd(stat, m[1], "rush", y); }
    }

    // Fumbles: lost if the other team recovers. The fumbler is the last player with the ball.
    // Kick coverage forcing a fumble on a return: "... R.Shaheed to SEA 44 for 39 yards. FUMBLES (K.Abrams-Draine)"
    if (["punt", "kickoff"].includes(out.kind) && /FUMBLES \(/.test(text)) {
      const kicking = out.kind === "kickoff" ? textTeam(/kicks \d+ yards from ([A-Z]{2,3})/.exec(text)?.[1] ?? "") || offense : offense;
      defStat(kicking, "def_st_ff");
    }
    const fum = /FUMBLES.*?recovered by ([A-Z]{2,3})-/i.exec(text) ?? /MUFFS.*?recovered by ([A-Z]{2,3})-/i.exec(text);
    if (fum && !["incomplete", "int"].includes(out.kind)) {
      const recoveredBy = textTeam(fum[1]);
      const kick = ["punt", "kickoff"].includes(out.kind);
      const ballCarrierTeam = kick ? defense : offense;
      if (recoveredBy !== ballCarrierTeam) {
        out.turnover = true;
        if (!kick && out.player) { stat(out.player, "fum"); stat(out.player, "fum_lost"); }
        defStat(recoveredBy, "fum_rec");
      } else if (!kick) {
        // Own recovery, then the play kept going: "...recovered by KC-P.Mahomes at KC 28. P.Mahomes pass ... to T.Kelce for 16 yards"
        const rest = re(`recovered by [A-Z]{2,3}-${NAME} at [A-Z]{2,3} \\d+\\.\\s*(.*)$`, "i").exec(main)?.[1];
        if (rest && re(`^${NAME} (pass|up the|left|right|scrambles)`).test(rest)) {
          const more = analyzePlay({ ...play, text: rest, type: "Rush" });
          out.stats.push(...more.stats);
        }
      }
    }
    // Touchdowns scored by the team without the ball: returns, picks, fumbles, blocked kicks.
    if (/TOUCHDOWN/.test(main) && !out.td && !out.summaryStyle) {
      out.td = true;
      out.returnTd = true;
    }
    if (/SAFETY/i.test(main)) defStat(defense, "safe");
    if (/BLOCKED/i.test(main) && /punt/i.test(main)) defStat(defense, "blk_kick");
  }

  // Extra points and two-point tries ride along on the touchdown play.
  if (!out.summaryStyle && (m = re(`(${NAME}) extra point is (GOOD|No Good|BLOCKED)`).exec(text))) {
    stat(m[1], /GOOD/.test(m[2]) && !/No Good/.test(m[2]) ? "xpm" : "xpmiss", 1, out.returnTd ? defense : offense);
  }
  const two = /TWO-POINT CONVERSION ATTEMPT\.(.*?)ATTEMPT (SUCCEEDS|FAILS)/.exec(text);
  if (two && two[2] === "SUCCEEDS") {
    if ((m = re(`(${NAME}) pass to (${NAME})`).exec(two[1]))) { stat(m[1], "pass_2pt"); stat(m[2], "rec_2pt"); }
    else if ((m = re(`(${NAME}) (?:rushes|[a-z ]+for)`).exec(two[1]))) stat(m[1], "rush_2pt");
  }
  if (noPlay) out.kind = "penalty";
  if (/^PENALTY|Penalty/.test(type) && out.kind === "other") out.kind = "penalty";
  out.penalty = /PENALTY on ([A-Z]{2,3})-?(?:[^,]*), ([^,]+),/.exec(raw)?.[2] ?? null;
  return out;
}

// "Tommy Tremble", "Amon-Ra St. Brown", "Marvin Harrison Jr."
const FULL = String.raw`[A-Z][\w'.\-]+(?: (?:St\. )?[A-Z][\w'.\-]+)+?`;

const fgBucket = (d) => (d < 20 ? "0_19" : d < 30 ? "20_29" : d < 40 ? "30_39" : d < 50 ? "40_49" : d < 60 ? "50_59" : "60p");

// A penalty on the offense during the run (holding, illegal block) is enforced from where it happened,
// and the player only keeps the yards gained up to that spot.
function spotFoul(play, y, text, offense) {
  const pen = /PENALTY on ([A-Z]{2,3})-[^,]*, [^,]+, \d+ yards?, enforced at ([A-Z]{2,3}) (\d+)\b/.exec(text);
  if (!pen || /No Play\./.test(text) || textTeam(pen[1]) !== offense || play.start?.yardsToGoal == null) return y;
  const spotToGoal = textTeam(pen[2]) === offense ? 100 - Number(pen[3]) : Number(pen[3]);
  const toSpot = play.start.yardsToGoal - spotToGoal;
  return toSpot >= 0 && toSpot < y ? toSpot : y;
}

function firstDown(play, y, text) {
  return /TOUCHDOWN/.test(text) || (play.start?.distance != null && y >= play.start.distance);
}

function longTd(stat, name, prefix, y) {
  if (y >= 40) stat(name, `${prefix}_td_40p`);
  if (y >= 50) stat(name, `${prefix}_td_50p`);
}

// Short label for a card: "16-yd catch", "3-yd rush TD", "Sacked, -7", "47-yd FG"
export function headline(a) {
  const yd = (y) => (y === 0 ? "No gain" : y < 0 ? `Loss of ${-y}` : `${y}-yd`);
  const td = a.td ? " TD" : "";
  switch (a.kind) {
    case "catch": return a.yards === 0 ? `Catch, no gain${td}` : `${yd(a.yards)} catch${td}`;
    case "rush": return a.yards === 0 && !a.td ? "Rush, no gain" : `${yd(a.yards)} rush${td}`;
    case "incomplete": return "Incomplete";
    case "sack": return a.yards ? `Sacked, ${a.yards}` : "Sacked";
    case "int": return "Intercepted";
    case "fg": return `${a.yards}-yd field goal`;
    case "fg-miss": return `${a.yards}-yd field goal missed`;
    case "kneel": return "Kneel";
    case "punt": return a.returnTd ? "Punt return TD" : "Punt";
    case "kickoff": return a.returnTd ? "Kickoff return TD" : "Kickoff";
    case "penalty": return a.penalty ? `Penalty: ${a.penalty}` : "Penalty";
    default: return a.label ?? (a.td ? "Touchdown" : "");
  }
}

export { team as espnTeam, textTeam };
