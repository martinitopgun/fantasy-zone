// Serves the app exactly as the published preview sees it: no /proxy (so it opens the replay),
// index.html wrapped in the same skeleton, app/* at the root and src/* under src/.
//   node tools/preview.mjs [port]      ->  http://localhost:8765/
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.argv[2] ?? 8765);
const TYPES = { ".js": "text/javascript", ".json": "application/json", ".html": "text/html; charset=utf-8", ".css": "text/css", ".svg": "image/svg+xml" };

// Same wrapper the artifact host adds: charset, viewport with viewport-fit=cover, a tiny reset.
const wrap = (body) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style>
</head><body>${body}</body></html>`;

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  try {
    if (url.pathname === "/" || url.pathname === "/index.html") {
      res.writeHead(200, { "content-type": TYPES[".html"], "cache-control": "no-store" });
      return res.end(wrap(await readFile(path.join(root, "app/index.html"), "utf8")));
    }
    const rel = url.pathname.startsWith("/src/") ? url.pathname : path.join("app", url.pathname);
    const file = path.normalize(path.join(root, rel));
    if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(404); res.end("Not found");
  }
}).listen(PORT, () => console.log(`preview: http://localhost:${PORT}/`));
