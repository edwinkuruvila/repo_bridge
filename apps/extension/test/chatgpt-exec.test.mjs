import assert from "node:assert/strict";
import test from "node:test";
import { parseKavrithExec } from "../dist-test/lib/chatgpt-exec.js";

const expected = {
  executable: "git",
  args: ["status", "--short"],
};

test("parses canonical exec directive with JSON on the next line", () => {
  assert.deepEqual(
    parseKavrithExec(
      '# kavrith:exec\n{"executable":"git","args":["status","--short"]}',
    ),
    expected,
  );
});

test("parses exec directive with JSON on the same line", () => {
  assert.deepEqual(
    parseKavrithExec(
      '# kavrith:exec {"executable":"git","args":["status","--short"]}',
    ),
    expected,
  );
});

test("still requires the exact exec directive marker", () => {
  assert.equal(
    parseKavrithExec(
      'prefix # kavrith:exec {"executable":"git","args":["status","--short"]}',
    ),
    undefined,
  );
});

test("rejects malformed exec payloads", () => {
  assert.equal(
    parseKavrithExec('# kavrith:exec {"executable":"git"}'),
    undefined,
  );
});
