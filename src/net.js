// One place where the engine talks to the internet. Works in Node and in the browser.
// Live game data must never come from a stale cache, so each kind of URL has its own max age.

export function fixtureName(url) {
  return url.replace(/^https?:\/\//, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "") + ".json";
}

// How long a response stays fresh (ms).
export function defaultMaxAge(url) {
  if (url.includes("/scoreboard")) return 8_000; // live games
  if (url.includes("/matchups/")) return 30_000; // fantasy points
  if (url.includes("/projections/") || url.includes("/stats/")) return 6 * 3600_000;
  return 3600_000; // users, leagues, rosters
}

// load(url) does the actual fetching: plain fetch() by default, or a fixtures reader in tests.
// rewrite(url) lets the browser app send requests through its own server (no CORS issues).
export function makeFetchJson({ load, rewrite = (u) => u, maxAge = defaultMaxAge } = {}) {
  const cache = new Map();
  const loader = load ?? (async (url) => {
    const res = await fetch(rewrite(url), { headers: { accept: "application/json" } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`${res.status} from ${url}`);
    return res.json();
  });
  return async function fetchJson(url) {
    const hit = cache.get(url);
    if (hit && Date.now() - hit.at < maxAge(url)) return hit.data;
    const data = await loader(url);
    cache.set(url, { data, at: Date.now() });
    return data;
  };
}
