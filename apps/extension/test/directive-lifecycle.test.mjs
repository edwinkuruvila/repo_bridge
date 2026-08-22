import assert from "node:assert/strict";
import test from "node:test";
import {
  directiveOccurrenceId,
  hashDirectiveText,
  lifecycleState,
  withLifecycleState,
} from "../dist-test/lib/directive-lifecycle.js";

test("directive occurrence ids distinguish repeated directives", () => {
  const text = "# repobridge:run\necho ok";
  assert.notEqual(
    directiveOccurrenceId(3, 0, "run", text),
    directiveOccurrenceId(4, 0, "run", text),
  );
  assert.notEqual(
    directiveOccurrenceId(3, 0, "run", text),
    directiveOccurrenceId(3, 1, "run", text),
  );
});

test("streamed text keeps one directive occurrence id", () => {
  assert.equal(
    directiveOccurrenceId(3, 0, "run", "# repobridge:run\necho par"),
    directiveOccurrenceId(3, 0, "run", "# repobridge:run\necho partial complete"),
  );
});

test("streamed startup directives keep one occurrence until generation completes", () => {
  const partial = directiveOccurrenceId(5, 0, "invalid-run", "# repobridge:run");
  const complete = directiveOccurrenceId(
    5,
    0,
    "run",
    "# repobridge:run\necho complete",
  );
  assert.equal(partial, complete);
});

test("streamed parse-state changes keep one directive occurrence id", () => {
  assert.equal(
    directiveOccurrenceId(3, 0, "invalid-run", "# repobridge:run"),
    directiveOccurrenceId(3, 0, "run", "# repobridge:run\necho complete"),
  );
});

test("directive hashes are deterministic", () => {
  assert.equal(hashDirectiveText("abc"), hashDirectiveText("abc"));
  assert.notEqual(hashDirectiveText("abc"), hashDirectiveText("abd"));
});

test("lifecycle updates preserve sibling directives", () => {
  let state = {};
  state = withLifecycleState(state, "chat", "a", "pending", 1);
  state = withLifecycleState(state, "chat", "b", "completed", 2);
  assert.equal(lifecycleState(state, "chat", "a"), "pending");
  assert.equal(lifecycleState(state, "chat", "b"), "completed");
});
