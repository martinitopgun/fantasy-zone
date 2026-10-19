// Node-only: read saved API responses from fixtures/ instead of the internet.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fixtureName } from "./net.js";

export function fixtureLoader(dir, overrides = {}) {
  return async (url) => {
    if (overrides[url] !== undefined) return overrides[url];
    const file = path.join(dir, fixtureName(url));
    try {
      return JSON.parse(await readFile(file, "utf8"));
    } catch {
      throw new Error(`No saved data for ${url} (expected ${file})`);
    }
  };
}
