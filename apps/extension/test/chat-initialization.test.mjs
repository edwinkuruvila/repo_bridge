import assert from "node:assert/strict";
import test from "node:test";
import { conversationSessionIdFromUrl } from "../dist-test/lib/conversation-session.js";

test("extracts conversation ids from ChatGPT conversation URLs", () => {
  assert.equal(
    conversationSessionIdFromUrl("https://chatgpt.com/c/abc123"),
    "/c/abc123",
  );
});

test("ignores provisional ChatGPT WEB conversation ids", () => {
  assert.equal(
    conversationSessionIdFromUrl(
      "https://chatgpt.com/c/WEB:92e25974-0805-4398-ad10-9e8a6679159c",
    ),
    undefined,
  );
});
