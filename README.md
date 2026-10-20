# Fantasy Zone

A Real-style live play feed for NFL Sundays, ranked by your fantasy matchup.

- **The top stays put**: your score against your opponent's and your win chance (tap it for Matchup), then
  pause, speed and the replay clock (tap the clock to jump to a kickoff), Find and settings.
- **Game chips** under the top bar: slide them sideways to see every live game (yellow dots = your players in
  it, purple = your opponent's; "RZ" = that team is in the red zone). Tap one to open the game. They never
  re-sort by themselves: a ↻ chip appears when the order is out of date, and tapping it re-sorts.
- **Tabs: Zone, Matchup, Games.** Tap a tab or swipe sideways anywhere below the tabs. Each tab keeps its own
  scroll spot. On a computer window 900px or wider the tabs sit side by side as columns instead.
- **Zone**: a feed of play cards, newest on top. Filters *My matchup*, *All*, *Big* stay pinned at the top.
  Scrolled down, new plays wait behind a "↑ N new plays" button instead of pushing the list around.
- **Matchup**: the score and your win chance, then your 10 starters next to your opponent's, slot by slot
  (QB, RB, RB, WR, WR, TE, FLEX, FLEX, K, DEF), each with his points, his stats so far and where his game is:
  ○ yet to play (with the day and time), ● playing, ◉ his team has the ball, ✓ his game is over.
- **Games**: every game as a tile in a grid, with chips *All / Live / Next / Final* and *Sort: Matters to me /
  Kickoff*. The yellow/purple bar shows whose players still have the most to come in that game. The grid
  re-sorts when you open the tab or tap ↻, never while you're looking at it.
- Tapping a play or a game opens that game on top: score and clock, a mini field, your players in it, the
  momentum line and its plays. ‹ › step through the live games; tapping another game chip switches to it.
  ‹, Esc or your browser's Back button closes it (on a computer it covers only the last column, with ×).
  Links work too: `#matchup`, `#games`, `#game/401873007` (DAL @ GB).
- Nothing switches or re-sorts by itself; you choose.

## Run it

```
npm start        # then open http://localhost:3000 (or http://<computer-ip>:3000 on your phone, same Wi-Fi)
```

Live mode asks for your Sleeper username once. Every 10 seconds it reads ESPN's scoreboard and the full
play-by-play of each live game. Fantasy points come from the plays under your league's own scoring rules.

Opened anywhere without the server (or with *Watch last Sunday's replay*), it replays every real play of
Week 6 at the moment it happened, at 1×–20× speed, with ontopgun's real league.

## Accuracy

`npm run check` scores every player from ESPN's play-by-play and compares with Sleeper's official points:
118 of 120 players in finished Week 6 games match exactly (the other two are within 0.12).

## Other commands

```
npm test                       # scoring, play reading, replay, live mode, the ranking model, view helpers
npm run replay                 # rebuild app/replay.json from fixtures/week6
node tools/save-week6.js DIR   # turn raw ESPN game summaries into fixtures/week6/game-*.json
node src/cli.js <username>     # the ranking engine in a terminal
```

No dependencies, no API keys, no cost.
