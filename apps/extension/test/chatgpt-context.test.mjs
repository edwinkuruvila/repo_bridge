import assert from "node:assert/strict";
import test from "node:test";
import { parseRepoBridgeContext } from "../dist-test/lib/chatgpt-context.js";

test("context parser accepts canonical string searches", () => {
  const parsed = parseRepoBridgeContext(
    '# repobridge:context\n{"searches":["handled"],"reads":[]}',
  );
  assert.deepEqual(parsed?.searches, ["handled"]);
});

test("context parser defaults omitted reads to an empty array", () => {
  const parsed = parseRepoBridgeContext(
    '# repobridge:context\n{"searches":["handled"]}',
  );
  assert.deepEqual(parsed, {
    searches: ["handled"],
    reads: [],
  });
});

test("context parser defaults omitted searches to an empty array", () => {
  const parsed = parseRepoBridgeContext(
    '# repobridge:context\n{"reads":["README.md"]}',
  );
  assert.deepEqual(parsed, {
    searches: [],
    reads: [{ path: "README.md", startLine: 1, endLine: 500 }],
  });
});

test("context parser accepts a name-search-only request", () => {
  const parsed = parseRepoBridgeContext(
    '# repobridge:context\n{"searchesByName":["NativeMessage"]}',
  );
  assert.deepEqual(parsed, {
    searches: [],
    reads: [],
    searchesByName: ["NativeMessage"],
  });
});

test("context parser accepts a repository-map-only request", () => {
  const parsed = parseRepoBridgeContext(
    '# repobridge:context\n{"includeRepositoryMap":true}',
  );
  assert.deepEqual(parsed, {
    searches: [],
    reads: [],
    includeRepositoryMap: true,
  });
});

test("context parser normalizes query-shaped searches", () => {
  const parsed = parseRepoBridgeContext(
    '# repobridge:context\n{"searches":[{"query":"handled"},{"q":"mutation"}],"reads":[]}',
  );
  assert.deepEqual(parsed?.searches, ["handled", "mutation"]);
});

test("context parser rejects malformed search objects", () => {
  const parsed = parseRepoBridgeContext(
    '# repobridge:context\n{"searches":[{"term":"handled"}],"reads":[]}',
  );
  assert.equal(parsed, undefined);
});

test("context parser accepts a 500-line read range", () => {
  const parsed = parseRepoBridgeContext(
    '# repobridge:context\n{"searches":[],"reads":[{"path":"source.txt","startLine":1,"endLine":500}]}',
  );
  assert.equal(parsed?.reads[0]?.endLine, 500);
});

test("context parser normalizes string reads to the bounded default range", () => {
  const parsed = parseRepoBridgeContext(
    '# repobridge:context\n{"searches":[],"reads":["README.md","package.json"]}',
  );
  assert.deepEqual(parsed?.reads, [
    { path: "README.md", startLine: 1, endLine: 500 },
    { path: "package.json", startLine: 1, endLine: 500 },
  ]);
});

test("context parser lets oversized ranges reach host validation", () => {
  const parsed = parseRepoBridgeContext(
    '# repobridge:context\n{"searches":[],"reads":[{"path":"source.txt","startLine":1,"endLine":501}]}',
  );
  assert.equal(parsed?.reads[0]?.endLine, 501);
});

test("context parser accepts canonical name searches", () => {
  const parsed = parseRepoBridgeContext(
    '# repobridge:context\n{"searches":[],"reads":[],"searchesByName":["NativeMessage"]}',
  );
  assert.deepEqual(parsed, {
    searches: [],
    reads: [],
    searchesByName: ["NativeMessage"],
  });
});
