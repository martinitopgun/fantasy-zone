// Builds index.html (top folder): the whole app in ONE file, code and styles inline. It's the website that GitHub
// Pages serves (martinitopgun.github.io/fantasy-zone), so rebuild and push after every change. No Claude needed.
// Also builds 404.html, the page GitHub Pages shows for an address that doesn't exist.
//   node tools/bundle.mjs
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { page } from "./page.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmp = path.join(root, "dist/.build");
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
cpSync(path.join(root, "app"), tmp, { recursive: true });
cpSync(path.join(root, "src"), path.join(tmp, "src"), { recursive: true }); // the app imports ./src/...
execFileSync("npx", ["-y", "esbuild@0.28.2", path.join(tmp, "app.js"), "--bundle", "--format=esm", "--target=es2022", "--minify", `--outfile=${path.join(tmp, "out.js")}`], { stdio: "inherit" });

const safe = (s) => s.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");
const js = safe(readFileSync(path.join(tmp, "out.js"), "utf8"));
const app = readFileSync(path.join(root, "app/index.html"), "utf8")
  .replace(/<script type="module" src="app.js"><\/script>/, () => `<script>window.__FZ_SITE__=true;</script>\n<script type="module">${js}</script>`);
const html = page(app);
writeFileSync(path.join(root, "index.html"), html); // the website: GitHub Pages serves this file from the repository's top folder
const notFound = page(readFileSync(path.join(root, "app/404.html"), "utf8"));
writeFileSync(path.join(root, "404.html"), notFound);
rmSync(tmp, { recursive: true, force: true });
console.log(`wrote index.html (${Math.round(html.length / 1024)} KB) and 404.html (${Math.round(notFound.length / 1024)} KB)`);
