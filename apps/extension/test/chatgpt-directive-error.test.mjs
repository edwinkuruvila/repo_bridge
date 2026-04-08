import test from "node:test";
import assert from "node:assert/strict";
import { kavrithDirectiveParseError } from "../dist-test/lib/chatgpt-directive-error.js";

test("reports malformed read directives with accepted forms", () => {
  const error = kavrithDirectiveParseError("# kavrith:read README.md nope 180");
  assert.equal(error?.type, "read");
  assert.match(error?.message ?? "", /Accepted forms/i);
});

test("reports context marker/payload placement errors", () => {
  const error = kavrithDirectiveParseError(
    '# kavrith:context {"searches":["x"],"reads":[]}',
  );
  assert.equal(error?.type, "context");
  assert.match(error?.message ?? "", /marker on its own line/i);
});

test("distinguishes invalid JSON from invalid schema", () => {
  const invalidJson = kavrithDirectiveParseError(
    '# kavrith:context\n{"searches":[',
  );
  assert.match(invalidJson?.message ?? "", /not valid JSON/i);

  const invalidSchema = kavrithDirectiveParseError(
    '# kavrith:context\n{"searches":[{"term":"x"}],"reads":[]}',
  );
  assert.match(invalidSchema?.message ?? "", /JSON is valid/i);
  assert.match(invalidSchema?.message ?? "", /schema/i);
});

test("reports malformed patch directives instead of silently ignoring them", () => {
  const error = kavrithDirectiveParseError(
    "# kavrith:patch\n*** Begin Patch\n*** Update File: README.md",
  );
  assert.equal(error?.type, "patch");
  assert.match(error?.message ?? "", /Begin Patch/i);
  assert.match(error?.message ?? "", /End Patch/i);
});

test("reports malformed exec and run directives", () => {
  const exec = kavrithDirectiveParseError(
    '# kavrith:exec\n{"executable":"","args":[]}',
  );
  assert.equal(exec?.type, "exec");
  assert.match(exec?.message ?? "", /executable/i);

  const run = kavrithDirectiveParseError("# kavrith:run");
  assert.equal(run?.type, "run");
  assert.match(run?.message ?? "", /following line/i);
});

test("reports malformed git and search directives", () => {
  const status = kavrithDirectiveParseError("# kavrith:git-status\nextra");
  assert.equal(status?.type, "git-status");

  const diff = kavrithDirectiveParseError("# kavrith:git-diff\nunstaged");
  assert.equal(diff?.type, "git-diff");
  assert.match(diff?.message ?? "", /staged/i);

  const search = kavrithDirectiveParseError("# kavrith:search");
  assert.equal(search?.type, "search");
  assert.match(search?.message ?? "", /non-empty search query/i);
});

test("does not classify unrelated code as malformed Kavrith syntax", () => {
  assert.equal(
    kavrithDirectiveParseError("# kavrith:reader\nREADME.md\n1\n10"),
    undefined,
  );
  assert.equal(kavrithDirectiveParseError("console.log('hello')"), undefined);
});
