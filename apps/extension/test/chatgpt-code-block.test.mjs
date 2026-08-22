import assert from "node:assert/strict";
import test from "node:test";
import {
  directiveCodeText,
  isUnprocessedCodeBlock,
  preferredDirectiveCodeText,
} from "../dist-test/lib/chatgpt-code-block.js";
import { parseRepoBridgeGit } from "../dist-test/lib/chatgpt-git.js";
import { parseRepoBridgeRun } from "../dist-test/lib/chatgpt-run.js";

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
    directiveCodeText(pre({ code: "  # repobridge:git-status\n" })),
    "# repobridge:git-status",
  );
});

test("prefers CodeMirror textbox text over pre UI text", () => {
  const text = directiveCodeText(
    pre({
      textbox: "# repobridge:git-status",
      code: "Copy# repobridge:git-status",
    }),
  );
  assert.deepEqual(parseRepoBridgeGit(text), { type: "status" });
});

test("ignores non-RepoBridge code blocks", () => {
  assert.equal(
    parseRepoBridgeGit(
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
    "# repobridge:run\nset -e",
    "# repobridge:run\nset -e\nprintf 'done\\n'",
  );
  assert.deepEqual(parseRepoBridgeRun(text), {
    command: "set -e\nprintf 'done\\n'",
  });
});

test("does not replace canonical code with unrelated longer DOM text", () => {
  assert.equal(
    preferredDirectiveCodeText(
      "# repobridge:git-status",
      "Copy# repobridge:git-status and some extra UI text",
    ),
    "# repobridge:git-status",
  );
});

test("does not prefer a divergent candidate with the same directive marker", () => {
  assert.equal(
    preferredDirectiveCodeText(
      "# repobridge:run\necho expected",
      "# repobridge:run\necho different and much longer",
    ),
    "# repobridge:run\necho expected",
  );
});
