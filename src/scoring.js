// Scores any stat line with a league's own rules, so PPR, half-PPR, 6-point passing TDs,
// TE premium and anything custom all work automatically. Nobody picks a format by hand.

// Stat keys Sleeper stores that are labels or rankings, not things a league scores.
const NOT_SCORING = new Set(["gp", "gs", "gms_active", "adp_dd_ppr", "pos_adp_dd_ppr"]);

export function fantasyPoints(stats, scoring) {
  if (!stats) return 0;
  let pts = 0;
  for (const [key, value] of Object.entries(stats)) {
    if (NOT_SCORING.has(key) || key.startsWith("pts_") && !key.startsWith("pts_allow")) continue;
    const per = scoring[key];
    if (typeof per === "number" && typeof value === "number") pts += value * per;
  }
  return pts;
}

// A short human description of what the app detected about the league.
export function describeLeague(league) {
  const s = league.scoring_settings ?? {};
  const rec = s.rec ?? 0;
  const format = rec === 1 ? "PPR" : rec === 0.5 ? "Half-PPR" : rec === 0 ? "Standard" : `Custom (${rec} per catch)`;
  const extras = [];
  if ((s.pass_td ?? 4) !== 4) extras.push(`${s.pass_td}-pt passing TDs`);
  if (s.bonus_rec_te) extras.push(`TE premium +${s.bonus_rec_te}`);
  if ((league.roster_positions ?? []).includes("SUPER_FLEX")) extras.push("Superflex");
  const type = { 0: "Redraft", 1: "Keeper", 2: "Dynasty", 3: "Guillotine" }[league.settings?.type] ?? "League";
  return { format, extras, type, label: [format, ...extras].join(", ") + ` · ${type}` };
}
