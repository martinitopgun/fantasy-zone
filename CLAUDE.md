# Fantasy Zone

Live fantasy football companion (like the Real app + fantasy). Sign in with a Sleeper username; the app loads
this week's real matchup (Sleeper) and real games (ESPN) and shows plays as they happen. Live only: no replay or
demo in the app.

- Website: https://martinitopgun.github.io/fantasy-zone/ (GitHub Pages serves `index.html` from the top folder,
  `404.html` for links that don't exist; `apple-touch-icon.png` and `og-image.png` are the home-screen icon and
  the link-preview picture).
- Source: `app/` (UI; `app/404.html` is the 404 page), `src/` (engine), `test/` (node tests), `tools/bundle.mjs`
  (builds `index.html` and `404.html`).

## After every change (always, without being asked)
1. `npm test` — all tests must pass.
2. `node tools/bundle.mjs` — rebuilds `index.html`, the website.
3. Commit and push to `main` on `origin` (martinitopgun/fantasy-zone). The site updates about a minute later.

The owner is a kid: keep it free, no betting words, no video, logos or headshots, and nothing may switch what
they're watching by itself.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
