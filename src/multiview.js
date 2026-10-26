// Multi-view: watch up to 4 games at once, one big and three small. Pure, no DOM.
//   defaultPick(ranked) -> up to 4 game ids (live first, in the ranking's order at that moment; never reshuffles)
//   swapBig(ids, id) / removeGame(ids, id) / addGame(ids, id) -> new id lists     keepKnown(ids, games)

export const MAX_MULTI = 4;

export function defaultPick(ranked) {
  const live = ranked.filter((r) => r.game.state === "in"), rest = ranked.filter((r) => r.game.state !== "in");
  return [...live, ...rest].slice(0, MAX_MULTI).map((r) => r.game.id);
}
export const swapBig = (ids, id) => (ids.includes(id) ? [id, ...ids.filter((x) => x !== id)] : ids);
export const removeGame = (ids, id) => ids.filter((x) => x !== id);
export const addGame = (ids, id) => (ids.includes(id) || ids.length >= MAX_MULTI ? ids : [...ids, id]);
export const keepKnown = (ids, games) => ids.filter((id) => games.some((g) => g.id === id)).slice(0, MAX_MULTI);
