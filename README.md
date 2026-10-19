# Fantasy Zone — engine (step 1)

The "brain" of the app. From just a Sleeper username it automatically:

1. Finds every league, your team, and this week's opponent (Sleeper, free, no login)
2. Detects each league's scoring rules (PPR / half / standard / custom / superflex / TE premium)
3. Pulls projections + the last 5 weeks of real stats to build each player's Boom Rate, spread and red-zone share
4. Reads every live NFL game from ESPN (score, clock, possession, down & distance, red zone, win probability, Vegas line)
5. Computes live win chances and a Watch Score for every game, with a plain-English reason

```
node src/cli.js <sleeper-username>                # live data (run on your own computer)
node src/cli.js feiyingx --offline --players      # saved real data from Week 6, 2026
node src/cli.js <username> --fantasy-off          # pure "RedZone" mode
npm test
```

No dependencies, no API keys, no cost. The model is documented at the top of `src/model.js`.
