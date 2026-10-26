// Starred players: follow anyone, not just your lineup. Stored by full name (each play card names its key
// player). Pure, no DOM.
//   toggleStar(list, name) -> new list (max 30)    isStarredCard(card, set) -> bool
//   starAlerts(cards, set, { skip, already }) -> banners for a starred player's touchdown or turnover

export const MAX_STARS = 30;

export function toggleStar(list, name) {
  if (!name) return list;
  return list.includes(name) ? list.filter((n) => n !== name) : [...list, name].slice(-MAX_STARS);
}

export const isStarredCard = (c, set) => set.has(c.name) || (c.impacts ?? []).some((i) => set.has(i.name));

const last = (n) => String(n).split(" ").slice(1).join(" ") || n;

export function starAlerts(cards, set, { skip = [], already = new Set() } = {}) {
  if (!set.size) return [];
  return cards
    .filter((c) => !c.silent && c.kind !== "marker" && !skip.includes(c.gameId) && !already.has(c.id) && (c.td || c.turnover) && isStarredCard(c, set))
    .map((c) => ({ cardId: c.id, gameId: c.gameId, owner: "star", kind: "star", text: `★ ${last(c.name)} ${c.label}`, weight: 1 }));
}
