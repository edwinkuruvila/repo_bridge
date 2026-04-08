import assert from "node:assert/strict";
import test from "node:test";
import {
  directiveCodeText,
  isUnprocessedCodeBlock,
  preferredDirectiveCodeText,
} from "../dist-test/lib/chatgpt-code-block.js";
import { parseKavrithGit } from "../dist-test/lib/chatgpt-git.js";
import { parseKavrithRun } from "../dist-test/lib/chatgpt-run.js";

function pre({ textbox, code, attributes = [] }) {
  return {
    hasAttribute: (name) => attributes.includes(name),
    querySelector: (selector) => {
      const text = selector === "code" ? code : textbox;
      return text === undefined ? null : { innerText: text };
    },
  };
}

test("extracts directives from alternate code elements", () => {
  assert.equal(
    directiveCodeText(pre({ code: "  # kavrith:git-status\n" })),
    "# kavrith:git-status",
  );
});

test("prefers CodeMirror textbox text over pre UI text", () => {
  const text = directiveCodeText(
    pre({
      textbox: "# kavrith:git-status",
      code: "Copy# kavrith:git-status",
    }),
  );
  assert.deepEqual(parseKavrithGit(text), { type: "status" });
});

test("ignores non-Kavrith code blocks", () => {
  assert.equal(
    parseKavrithGit(
      directiveCodeText(pre({ textbox: "console.log('hello')" })),
    ),
    undefined,
  );
});

test("processed and claimed blocks are not processed again", () => {
  assert.equal(
    isUnprocessedCodeBlock(pre({ attributes: [] }), "processed", "claiming"),
    true,
  );
  assert.equal(
    isUnprocessedCodeBlock(
      pre({ attributes: ["processed"] }),
      "processed",
      "claiming",
    ),
    false,
  );
  assert.equal(
    isUnprocessedCodeBlock(
      pre({ attributes: ["claiming"] }),
      "processed",
      "claiming",
    ),
    false,
  );
});

test("prefers the more complete matching directive candidate", () => {
  const text = preferredDirectiveCodeText(
    "# kavrith:run\nset -e",
    "# kavrith:run\nset -e\nprintf 'done\\n'",
  );
  assert.deepEqual(parseKavrithRun(text), {
    command: "set -e\nprintf 'done\\n'",
  });
});

test("does not replace canonical code with unrelated longer DOM text", () => {
  assert.equal(
    preferredDirectiveCodeText(
      "# kavrith:git-status",
      "Copy# kavrith:git-status and some extra UI text",
    ),
    "# kavrith:git-status",
  );
});

test("does not prefer a divergent candidate with the same directive marker", () => {
  assert.equal(
    preferredDirectiveCodeText(
      "# kavrith:run\necho expected",
      "# kavrith:run\necho different and much longer",
    ),
    "# kavrith:run\necho expected",
  );
});
