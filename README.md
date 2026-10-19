# Fantasy Zone

A Real-style live play feed for NFL Sundays, ranked by your fantasy matchup.

- **The Zone**: your matchup and live win chance, the 3 hottest games for you, and a feed of play cards
  (newest on top). Filter: *My matchup* (plays that move your points or your opponent's), *All plays*, *Big plays*.
- **Game screen**: score, field with the current drive, momentum (win chance after every play), your
  players in that game, and its play-by-play. Back arrow (top left) to *All games*.
- Nothing switches by itself. Hot games re-rank; you choose what to open.

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
npm test                       # 19 tests: scoring, play reading, replay, live mode, the ranking model
npm run replay                 # rebuild app/replay.json from fixtures/week6
node tools/save-week6.js DIR   # turn raw ESPN game summaries into fixtures/week6/game-*.json
node src/cli.js <username>     # the ranking engine in a terminal
```

No dependencies, no API keys, no cost.
