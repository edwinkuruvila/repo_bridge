import assert from "node:assert/strict";
import test from "node:test";
import { parseHTML } from "linkedom";
import {
  composerContainer,
  findComposer,
} from "../dist-test/lib/composer-discovery.js";

test("finds the current ChatGPT composer and its responsive footer", () => {
  const { document } = parseHTML(`
    <div data-composer-footer-responsive>
      <div data-composer-layout="single-line">
        <div data-composer-input-layout="single-line">
          <div data-composer-markdown="" contenteditable="true"
            aria-multiline="true" role="textbox" aria-label="Ask ChatGPT"></div>
        </div>
      </div>
    </div>
  `);

  const composer = findComposer(document);
  assert.equal(composer?.getAttribute("data-composer-markdown"), "");
  assert.equal(
    composerContainer(composer),
    document.querySelector("[data-composer-footer-responsive]"),
  );
});

test("finds a semantic textbox when the markdown attribute is absent", () => {
  const { document } = parseHTML(`
    <form><div contenteditable="true" role="textbox"
      aria-label="Ask ChatGPT"></div></form>
  `);

  const composer = findComposer(document);
  assert.equal(composer?.getAttribute("role"), "textbox");
  assert.equal(composerContainer(composer), document.querySelector("form"));
});

test("prefers the current composer over a legacy editor", () => {
  const { document } = parseHTML(`
    <form>
      <div id="prompt-textarea" contenteditable="true"></div>
      <div data-composer-markdown="" contenteditable="true"></div>
    </form>
  `);

  assert.equal(
    findComposer(document),
    document.querySelector("[data-composer-markdown]"),
  );
});

test("keeps older ChatGPT composer selectors working", () => {
  for (const markup of [
    '<div id="prompt-textarea" contenteditable="true"></div>',
    '<textarea id="prompt-textarea"></textarea>',
    '<textarea data-testid="prompt-textarea"></textarea>',
  ]) {
    const { document } = parseHTML(`<form>${markup}</form>`);
    const composer = findComposer(document);
    assert.ok(composer, markup);
    assert.equal(composerContainer(composer), document.querySelector("form"));
  }
});

test("ignores unrelated textboxes", () => {
  const { document } = parseHTML(`
    <form><div contenteditable="true" role="textbox"
      aria-label="Search"></div></form>
  `);
  assert.equal(findComposer(document), undefined);
});
