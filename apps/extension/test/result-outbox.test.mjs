import assert from "node:assert/strict";
import test from "node:test";
import {
  enqueueResult,
  pendingResult,
  removeResult,
} from "../dist-test/lib/result-outbox.js";

test("outbox persists completed results until delivery", () => {
  let outbox = {};
  outbox = enqueueResult(outbox, "chat", "directive", "result", 1);
  assert.equal(pendingResult(outbox, "chat", "directive")?.result, "result");
  outbox = removeResult(outbox, "chat", "directive");
  assert.equal(pendingResult(outbox, "chat", "directive"), undefined);
});

test("removing one result preserves other queued results", () => {
  let outbox = {};
  outbox = enqueueResult(outbox, "chat", "a", "one", 1);
  outbox = enqueueResult(outbox, "chat", "b", "two", 2);
  outbox = removeResult(outbox, "chat", "a");
  assert.equal(pendingResult(outbox, "chat", "b")?.result, "two");
});
