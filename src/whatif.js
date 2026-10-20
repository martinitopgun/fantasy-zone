// What-if (plan M9): try "Kittle scores a TD" or "Walker gets nothing more" and see your win chance move.
// Pure: it never touches the tracker; the real numbers stay as they are. No edits = the real win chance, exactly.
//   const edits = new Map()   key `${owner}:${id}` -> { add: points, zero: bool }
//   whatIfMoves(p, scoring) -> [{ key: "td"|"yds"|"catch", label, points }]  (what each button adds for him)
//   applyWhatIf(m, edits) -> { myFinal, oppFinal, winProb, changed }

import { winChance } from "./model.js";

export function whatIfMoves(p, scoring = {}) {
  const s = (k) => scoring[k] ?? 0;
  const pos = p.pos;
  if (pos === "QB") return [
    { key: "td", label: "+TD", points: s("pass_td") },
    { key: "yds", label: "+20 yds", points: 20 * s("pass_yd") },
  ];
  if (pos === "RB") return [
    { key: "td", label: "+TD", points: s("rush_td") },
    { key: "yds", label: "+20 yds", points: 20 * s("rush_yd") },
    { key: "catch", label: "+catch", points: s("rec") + s("bonus_rec_rb") },
  ];
  if (pos === "WR" || pos === "TE") return [
    { key: "td", label: "+TD", points: s("rec_td") },
    { key: "yds", label: "+20 yds", points: 20 * s("rec_yd") },
    { key: "catch", label: "+catch", points: s("rec") + s(pos === "TE" ? "bonus_rec_te" : "bonus_rec_wr") },
  ];
  if (pos === "DEF") return [{ key: "td", label: "+TD", points: s("def_td") }];
  return [];
}

export function applyWhatIf(m, edits) {
  if (!edits?.size) return { myFinal: m.myFinal, oppFinal: m.oppFinal, winProb: m.winProb, changed: false };
  let my = 0, opp = 0, spread2 = 0;
  for (const p of [...m.mine, ...m.theirs]) {
    const e = edits.get(`${p.owner}:${p.id}`);
    const final = p.current + (e?.zero ? 0 : p.remaining) + (e?.add ?? 0);
    if (p.owner === "me") my += final; else opp += final;
    if (!e?.zero) spread2 += p.remainingSpread ** 2;
  }
  return { myFinal: my, oppFinal: opp, winProb: winChance(my - opp, Math.sqrt(spread2)), changed: true };
}
