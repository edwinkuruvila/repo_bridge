import assert from "node:assert/strict";
import test from "node:test";
import {
  conversationSessionIdFromUrl,
  isDraftChatUrl,
} from "../dist-test/lib/conversation-session.js";

test("extracts conversation ids from ChatGPT conversation URLs", () => {
  assert.equal(
    conversationSessionIdFromUrl("https://chatgpt.com/c/abc123"),
    "/c/abc123",
  );
});

test("extracts conversation ids inside ChatGPT projects", () => {
  assert.equal(
    conversationSessionIdFromUrl(
      "https://chatgpt.com/g/g-p-project123/c/chat456",
    ),
    "/g/g-p-project123/c/chat456",
  );
  assert.equal(
    conversationSessionIdFromUrl(
      "https://chatgpt.com/g/g-p-project123/project",
    ),
    undefined,
  );
});

test("ignores provisional ChatGPT WEB conversation ids", () => {
  assert.equal(
    conversationSessionIdFromUrl(
      "https://chatgpt.com/c/WEB:92e25974-0805-4398-ad10-9e8a6679159c",
    ),
    undefined,
  );
  assert.equal(
    conversationSessionIdFromUrl(
      "https://chatgpt.com/g/g-p-project123/c/WEB:92e25974-0805-4398-ad10-9e8a6679159c",
    ),
    undefined,
  );
});

test("recognizes new chats on the home and project landing pages", () => {
  assert.equal(isDraftChatUrl("https://chatgpt.com/"), true);
  assert.equal(
    isDraftChatUrl("https://chatgpt.com/g/g-p-project123/project"),
    true,
  );
  assert.equal(
    isDraftChatUrl("https://chatgpt.com/g/g-p-project123/c/chat456"),
    false,
  );
});
