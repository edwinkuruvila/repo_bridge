import assert from "node:assert/strict";
import test from "node:test";
import { parseHTML } from "linkedom";
import {
  assistantCodeBlocks,
  assistantMessageForNode,
} from "../dist-test/lib/chatgpt-assistant-dom.js";

test("finds only assistant directives in the current ChatGPT markup", () => {
  const { document, HTMLElement } = parseHTML(`
    <div data-turn-key="turn-1">
      <div data-chatgpt-search-unit-key="fallback-turn-1:0:user">
        <div data-markdown-copy="code-block"><code id="user"># repobridge:run</code></div>
      </div>
      <div data-chatgpt-search-unit-key="fallback-turn-1:1:assistant">
        <div data-markdown-copy="code-block" id="assistant-block">
          <div data-markdown-copy="exclude">Copy</div>
          <div><code id="assistant"># repobridge:git-status</code></div>
        </div>
      </div>
    </div>
  `);
  globalThis.HTMLElement = HTMLElement;

  const blocks = assistantCodeBlocks(document);
  assert.deepEqual(
    blocks.map((block) => block.id),
    ["assistant-block"],
  );
  assert.equal(
    assistantMessageForNode(document.querySelector("#assistant")),
    document.querySelector("[data-chatgpt-search-unit-key$=':assistant']"),
  );
});

test("supports older markup and avoids duplicate nested code blocks", () => {
  const { document, HTMLElement } = parseHTML(`
    <div data-message-author-role="assistant">
      <pre id="legacy"><code># repobridge:git-status</code></pre>
    </div>
    <div data-chatgpt-search-unit-key="fallback-turn-2:1:assistant">
      <div data-markdown-copy="code-block" id="current">
        <pre><code># repobridge:git-diff</code></pre>
      </div>
    </div>
  `);
  globalThis.HTMLElement = HTMLElement;

  assert.deepEqual(
    assistantCodeBlocks(document).map((block) => block.id),
    ["legacy", "current"],
  );
});
