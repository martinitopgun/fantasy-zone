import test from "node:test";
import assert from "node:assert/strict";
import { defaultPick, swapBig, removeGame, addGame, keepKnown } from "../src/multiview.js";

const r = (id, state) => ({ game: { id, state } });
test("multi-view: live games first, at most 4; swap, add, remove", () => {
  assert.deepEqual(defaultPick([r("a", "pre"), r("b", "in"), r("c", "post"), r("d", "in"), r("e", "pre")]), ["b", "d", "a", "c"]);
  assert.deepEqual(swapBig(["a", "b", "c"], "c"), ["c", "a", "b"]);
  assert.deepEqual(removeGame(["a", "b"], "a"), ["b"]);
  assert.deepEqual(addGame(["a", "b", "c", "d"], "e"), ["a", "b", "c", "d"]);
  assert.deepEqual(addGame(["a"], "a"), ["a"]);
  assert.deepEqual(keepKnown(["a", "zz"], [{ id: "a" }]), ["a"]);
});
