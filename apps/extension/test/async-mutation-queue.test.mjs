import assert from "node:assert/strict";
import test from "node:test";
import { createAsyncMutationQueue } from "../dist-test/lib/async-mutation-queue.js";

test("serializes overlapping async mutations", async () => {
  const mutate = createAsyncMutationQueue();
  const events = [];
  let releaseFirst;
  const gate = new Promise((resolve) => {
    releaseFirst = resolve;
  });

  const first = mutate(async () => {
    events.push("first:start");
    await gate;
    events.push("first:end");
  });
  const second = mutate(async () => {
    events.push("second:start");
    events.push("second:end");
  });

  await Promise.resolve();
  assert.deepEqual(events, ["first:start"]);
  releaseFirst();
  await Promise.all([first, second]);
  assert.deepEqual(events, [
    "first:start",
    "first:end",
    "second:start",
    "second:end",
  ]);
});

test("continues after a failed mutation", async () => {
  const mutate = createAsyncMutationQueue();
  await assert.rejects(
    mutate(async () => {
      throw new Error("failed");
    }),
  );
  assert.equal(await mutate(async () => "ok"), "ok");
});
