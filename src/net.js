// One place where the engine talks to the internet.
// Live mode uses fetch(); offline mode reads saved responses from fixtures/,
// so the whole engine can be tested without a network connection.

import { readFile } from "node:fs/promises";
import path from "node:path";

export function fixtureName(url) {
  return url.replace(/^https?:\/\//, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "") + ".json";
}

export function makeFetchJson({ fixturesDir } = {}) {
  const cache = new Map();
  return async function fetchJson(url) {
    if (cache.has(url)) return cache.get(url);
    let data;
    if (fixturesDir) {
      const file = path.join(fixturesDir, fixtureName(url));
      try {
        data = JSON.parse(await readFile(file, "utf8"));
      } catch {
        throw new Error(`No saved data for ${url} (expected ${file})`);
      }
    } else {
      const res = await fetch(url, { headers: { accept: "application/json" } });
      if (res.status === 404) data = null;
      else if (!res.ok) throw new Error(`${res.status} from ${url}`);
      else data = await res.json();
    }
    cache.set(url, data);
    return data;
  };
}
