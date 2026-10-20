// Pure helpers that explain your matchup in words. No DOM here, so they run in tests (and later, unchanged,
// in the phone app). For now: a player's stat line in a few words. Later steps add the sweat meter, what
// you need, and the biggest swings.

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const yds = (n) => plural(n, "yd", "yds").replace(/^-1 yds$/, "-1 yd");

// A player's stats so far as short text, for the lineup rows:
//   QB  "18/27 245 yds, 2 TD, 1 INT, 4 car 21 yds"
//   RB  "15 car 97 yds, 3 rec 18 yds, 2 TD"
//   WR/TE "6 rec 88 yds, 1 TD"
//   K   "2/2 FG, 3 XP"          DEF "2 sacks, 1 INT, 17 pts allowed"
// `line` is a tracker stat line (tracker.statLine), `pos` the player's position. "" when there's nothing yet.
export function statText(line, pos) {
  const n = (k) => line?.[k] ?? 0;
  const out = [];
  if (pos === "K") {
    const fga = n("fgm") + n("fgmiss"), xpa = n("xpm") + n("xpmiss");
    if (fga) out.push(`${n("fgm")}/${fga} FG`);
    if (xpa) out.push(n("xpmiss") ? `${n("xpm")}/${xpa} XP` : `${n("xpm")} XP`);
    return out.join(", ");
  }
  if (pos === "DEF") {
    if (n("sack")) out.push(plural(n("sack"), "sack"));
    if (n("int")) out.push(`${n("int")} INT`);
    if (n("fum_rec")) out.push(plural(n("fum_rec"), "fumble rec", "fumble recs"));
    const td = n("def_td") + n("def_st_td");
    if (td) out.push(`${td} TD`);
    if (n("safe")) out.push(plural(n("safe"), "safety", "safeties"));
    if (n("blk_kick")) out.push(`${n("blk_kick")} blocked`);
    if (line && line.pts_allow != null) out.push(`${n("pts_allow")} pts allowed`);
    return out.join(", ");
  }
  const rush = n("rush_att") ? `${n("rush_att")} car ${yds(n("rush_yd"))}` : "";
  const rec = n("rec") || n("rec_tgt") ? `${n("rec")} rec ${yds(n("rec_yd"))}` : "";
  const lost = n("fum_lost") ? `${n("fum_lost")} fum lost` : "";
  if (pos === "QB") {
    if (n("pass_att")) out.push(`${n("pass_cmp")}/${n("pass_att")} ${yds(n("pass_yd"))}`);
    if (n("pass_td")) out.push(`${n("pass_td")} TD`);
    if (n("pass_int")) out.push(`${n("pass_int")} INT`);
    if (rush) out.push(rush);
    if (n("rush_td")) out.push(`${n("rush_td")} rush TD`);
    if (rec) out.push(rec);
  } else {
    const first = pos === "RB" ? [rush, rec] : [rec, rush];
    out.push(...first.filter(Boolean));
    const td = n("rush_td") + n("rec_td");
    if (td) out.push(`${td} TD`);
  }
  if (lost) out.push(lost);
  return out.join(", ");
}
