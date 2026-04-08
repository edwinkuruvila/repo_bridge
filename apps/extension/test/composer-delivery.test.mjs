import assert from "node:assert/strict";
import test from "node:test";
import { composerRollbackDecision } from "../dist-test/lib/composer-delivery.js";

test("failed delivery restores an untouched Kavrith insertion", () => {
  assert.equal(
    composerRollbackDecision("", "queued result", "queued result"),
    "restore",
  );
});

test("failed delivery never overwrites user edits made after insertion", () => {
  assert.equal(
    composerRollbackDecision(
      "",
      "queued result",
      "queued result plus user typing",
    ),
    "leave-user-changes",
  );
});

test("rollback does not erase pre-existing composer content", () => {
  assert.equal(
    composerRollbackDecision("draft", "draft", "draft"),
    "leave-user-changes",
  );
});
