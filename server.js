// Runs the app with live data:  npm start  ->  open http://localhost:3000
// Serves the app and passes Sleeper/ESPN requests through, so the browser never hits CORS limits.
// Open it from your phone too: same Wi-Fi, http://<your computer's IP>:3000

import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3000);
const UPSTREAM = { sleeper: "https://api.sleeper.app", espn: "https://site.api.espn.com" };
const TYPES = { ".js": "text/javascript", ".json": "application/json", ".html": "text/html; charset=utf-8" };

const page = (body) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
</head><body>${body}</body></html>`;

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  try {
    if (url.pathname === "/proxy/ping") return send(res, 200, "application/json", "{\"ok\":true}");
    const m = /^\/proxy\/(sleeper|espn)(\/.*)$/.exec(url.pathname);
    if (m) {
      const up = await fetch(UPSTREAM[m[1]] + m[2] + url.search, { headers: { accept: "application/json" } });
      return send(res, up.status, "application/json", await up.text());
    }
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return send(res, 200, TYPES[".html"], page(await readFile(path.join(root, "app/index.html"), "utf8")));
    }
    // /app.js and /demo.json live in app/, the engine lives in src/
    const rel = url.pathname.startsWith("/src/") ? url.pathname : path.join("app", url.pathname);
    const file = path.normalize(path.join(root, rel));
    if (!file.startsWith(root)) return send(res, 403, "text/plain", "Forbidden");
    send(res, 200, TYPES[path.extname(file)] ?? "application/octet-stream", await readFile(file));
  } catch (e) {
    send(res, e.code === "ENOENT" ? 404 : 502, "text/plain", e.code === "ENOENT" ? "Not found" : `Upstream error: ${e.message}`);
  }
}).listen(PORT, () => console.log(`Fantasy Zone running: http://localhost:${PORT}`));

function send(res, status, type, body) {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  res.end(body);
}
