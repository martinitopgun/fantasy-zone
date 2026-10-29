# Fantasy Zone

Live fantasy football companion (like the Real app + fantasy). Sign in with a Sleeper username; the app loads
this week's real matchup (Sleeper) and real games (ESPN) and shows plays as they happen. Live only: no replay or
demo in the app.

- Website: https://martinitopgun.github.io/fantasy-zone/ (GitHub Pages serves `index.html` from the top folder).
- Source: `app/` (UI), `src/` (engine), `test/` (node tests), `tools/bundle.mjs` (builds `index.html`).

## After every change (always, without being asked)
1. `npm test` — all tests must pass.
2. `node tools/bundle.mjs` — rebuilds `index.html`, the website.
3. Commit and push to `main` on `origin` (martinitopgun/fantasy-zone). The site updates about a minute later.

The owner is a kid: keep it free, no betting words, no video, logos or headshots, and nothing may switch what
they're watching by itself.
