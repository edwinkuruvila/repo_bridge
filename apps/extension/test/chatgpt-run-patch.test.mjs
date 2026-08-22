import assert from "node:assert/strict";
import test from "node:test";
import { parseRepoBridgeRun } from "../dist-test/lib/chatgpt-run.js";
import { parseRepoBridgePatch } from "../dist-test/lib/chatgpt-patch.js";

test("preserves multiline run commands", () => {
  assert.deepEqual(
    parseRepoBridgeRun("# repobridge:run\nset -e\nprintf 'one\\n'\nprintf 'two\\n'"),
    { command: "set -e\nprintf 'one\\n'\nprintf 'two\\n'" },
  );
});

test("accepts RepoBridge patch envelopes containing standard unified hunk headers", () => {
  const patch = [
    "*** Begin Patch",
    "*** Update File: README.md",
    "@@ -1,1 +1,1 @@",
    "-old",
    "+new",
    "*** End Patch",
  ].join("\n");
  assert.deepEqual(parseRepoBridgePatch(`# repobridge:patch\n${patch}`), { patch });
});
