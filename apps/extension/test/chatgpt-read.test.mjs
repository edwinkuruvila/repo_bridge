import assert from "node:assert/strict";
import test from "node:test";
import { parseKavrithRead } from "../dist-test/lib/chatgpt-read.js";

test("accepts one-line read form", () => {
  assert.deepEqual(parseKavrithRead("# kavrith:read README.md 1 100"), {
    path: "README.md",
    startLine: 1,
    endLine: 100,
  });
});

test("accepts multiline read form", () => {
  assert.deepEqual(parseKavrithRead("# kavrith:read\nREADME.md\n1\n100"), {
    path: "README.md",
    startLine: 1,
    endLine: 100,
  });
});
