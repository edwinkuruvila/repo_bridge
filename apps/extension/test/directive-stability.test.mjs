import assert from "node:assert/strict";
import test from "node:test";
import { deferredPrimeDecision } from "../dist-test/lib/directive-stability.js";

test("deferred startup priming waits while the assistant is generating", () => {
  assert.equal(deferredPrimeDecision(true, true), "wait");
});

test("deferred startup priming runs after generation finishes", () => {
  assert.equal(deferredPrimeDecision(true, false), "prime");
});

test("startup priming stays idle when nothing is pending", () => {
  assert.equal(deferredPrimeDecision(false, false), "idle");
});
