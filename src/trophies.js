// Trophies: badges you unlock while watching. Pure, no DOM.
//   checkTrophies(state, unlocked) -> ids newly unlocked (each only once)
//   state: { picks: { right, streak, best, points }, history: [{ wp }], counts: { games, story, share, whatif, plays }, sweatSeen }

export const TROPHIES = [
  { id: "first-pick", icon: "🎯", name: "Called it", how: "Get a Free Pick right.", check: (s) => s.picks.right >= 1 },
  { id: "streak-3", icon: "🔥", name: "Hot streak", how: "Get 3 Free Picks right in a row.", check: (s) => s.picks.best >= 3 },
  { id: "streak-5", icon: "🌋", name: "On fire", how: "Get 5 Free Picks right in a row.", check: (s) => s.picks.best >= 5 },
  { id: "points-100", icon: "💯", name: "Century", how: "Earn 100 Zone points.", check: (s) => s.picks.points >= 100 },
  { id: "comeback", icon: "🧗", name: "Comeback kid", how: "Be under 25% to win, then climb over 75%.", check: (s) => { let low = false; for (const h of s.history) { if (h.wp < 0.25) low = true; else if (low && h.wp > 0.75) return true; } return false; } },
  { id: "never-doubt", icon: "🧊", name: "Never in doubt", how: "Stay over 50% to win after every play (10+ moves).", check: (s) => s.history.length >= 10 && s.history.slice(1).every((h) => h.wp > 0.5) },
  { id: "sweat", icon: "😅", name: "Sweat survivor", how: "Hit Full sweat, then get over 90% to win.", check: (s) => s.sweatSeen && (s.history.at(-1)?.wp ?? 0) > 0.9 },
  { id: "scout", icon: "🔭", name: "Scout", how: "Open 5 different games.", check: (s) => s.counts.games >= 5 },
  { id: "story", icon: "📖", name: "Storyteller", how: "Open your Sunday Story.", check: (s) => s.counts.story >= 1 },
  { id: "share", icon: "📸", name: "Shutterbug", how: "Share a story picture.", check: (s) => s.counts.share >= 1 },
  { id: "whatif", icon: "🧪", name: "Mad scientist", how: "Try What-if 3 times.", check: (s) => s.counts.whatif >= 3 },
  { id: "plays-200", icon: "📺", name: "Couch coach", how: "Watch 200 plays come in.", check: (s) => s.counts.plays >= 200 },
];

export function checkTrophies(state, unlocked) {
  return TROPHIES.filter((t) => !unlocked[t.id] && t.check(state)).map((t) => t.id);
}
