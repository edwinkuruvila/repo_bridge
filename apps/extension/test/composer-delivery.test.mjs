import assert from "node:assert/strict";
import test from "node:test";
import { composerRollbackDecision, firstUsableCandidate } from "../dist-test/lib/composer-delivery.js";

test("failed delivery restores an untouched Kavrith insertion", () => {
  assert.equal(
    composerRollbackDecision("", "queued result", "queued result"),
    "restore",
  );
});

test("editor whitespace normalization still restores Kavrith insertion", () => {
  assert.equal(
    composerRollbackDecision(
      "",
      "queued result\n",
      "queued result\n\n",
    ),
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

test("send selection skips an unusable first match", () => {
  const candidates = [
    { id: "hidden", usable: false },
    { id: "visible", usable: true },
  ];
  assert.equal(
    firstUsableCandidate(candidates, (candidate) => candidate.usable)?.id,
    "visible",
  );
});
