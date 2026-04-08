import assert from "node:assert/strict";
import test from "node:test";
import { parseKavrithRun } from "../dist-test/lib/chatgpt-run.js";
import { parseKavrithPatch } from "../dist-test/lib/chatgpt-patch.js";

test("preserves multiline run commands", () => {
  assert.deepEqual(
    parseKavrithRun("# kavrith:run\nset -e\nprintf 'one\\n'\nprintf 'two\\n'"),
    { command: "set -e\nprintf 'one\\n'\nprintf 'two\\n'" },
  );
});

test("accepts Kavrith patch envelopes containing standard unified hunk headers", () => {
  const patch = [
    "*** Begin Patch",
    "*** Update File: README.md",
    "@@ -1,1 +1,1 @@",
    "-old",
    "+new",
    "*** End Patch",
  ].join("\n");
  assert.deepEqual(parseKavrithPatch(`# kavrith:patch\n${patch}`), { patch });
});
