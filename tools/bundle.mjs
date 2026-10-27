// Builds dist/fantasy-zone.html: the whole app in ONE file (code, styles and the replay data inline), so it
// opens in any browser and can be put on any free web host. No Claude needed.
//   node tools/bundle.mjs
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmp = path.join(root, "dist/.build");
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
cpSync(path.join(root, "app"), tmp, { recursive: true });
cpSync(path.join(root, "src"), path.join(tmp, "src"), { recursive: true }); // the app imports ./src/...
execFileSync("npx", ["-y", "esbuild@0.28.2", path.join(tmp, "app.js"), "--bundle", "--format=esm", "--target=es2022", "--minify", `--outfile=${path.join(tmp, "out.js")}`], { stdio: "inherit" });

const safe = (s) => s.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");
const js = safe(readFileSync(path.join(tmp, "out.js"), "utf8"));
const data = safe(readFileSync(path.join(root, "app/replay.json"), "utf8"));
const body = readFileSync(path.join(root, "app/index.html"), "utf8")
  .replace(/<script type="module" src="app.js"><\/script>/, () => `<script>window.__FZ_REPLAY__=${data};</script>\n<script type="module">${js}</script>`);
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}html,body{height:100%}</style>
</head><body>${body}</body></html>`;
writeFileSync(path.join(root, "dist/fantasy-zone.html"), html);
writeFileSync(path.join(root, "dist/index.html"), html); // the same page, named for a website (GitHub Pages serves index.html)
rmSync(tmp, { recursive: true, force: true });
console.log(`wrote dist/fantasy-zone.html (${Math.round(html.length / 1024)} KB)`);
