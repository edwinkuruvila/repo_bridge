import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  access,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after } from "node:test";
import { PROTOCOL_VERSION } from "@kavrith/protocol";
import { MessageDecoder, encodeMessage } from "./framing.js";
import { handleRequest } from "./handler.js";
import { applyWorkspacePatch } from "./patcher.js";
import { runProcess } from "./process-runner.js";
import { buildFilesystemRepositoryMap } from "./repository-map.js";

const workspacePath = await realpath(
  await mkdtemp(join(tmpdir(), "kavrith-test-")),
);
process.env.KAVRITH_CONFIG_PATH = join(workspacePath, "config.json");
await writeFile(
  join(workspacePath, "matches.txt"),
  "NativeMessage\nhello world; touch injected\n",
  "utf8",
);
await writeFile(
  join(workspacePath, "large.txt"),
  "repeat-token\n".repeat(5000),
  "utf8",
);
await writeFile(join(workspacePath, "source.txt"), "one\ntwo\nthree\n", "utf8");
await writeFile(
  join(workspacePath, "oversized.txt"),
  "x".repeat(1024 * 1024 + 1),
  "utf8",
);
await writeFile(join(workspacePath, "..allowed.txt"), "allowed\n", "utf8");
await writeFile(join(workspacePath, "patch-target.txt"), "before\n", "utf8");
await writeFile(
  join(workspacePath, "patch-target-2.txt"),
  "second-before\n",
  "utf8",
);
await symlink("/etc/passwd", join(workspacePath, "outside-link"));

after(async () => {
  delete process.env.KAVRITH_CONFIG_PATH;
  await rm(workspacePath, { recursive: true });
});

test("decodes fragmented and multiple framed messages", () => {
  const first = encodeMessage({ id: "1" });
  const second = encodeMessage({ id: "2" });
  const decoder = new MessageDecoder();

  assert.deepEqual(decoder.push(first.subarray(0, 3)), []);
  assert.deepEqual(decoder.push(Buffer.concat([first.subarray(3), second])), [
    { id: "1" },
    { id: "2" },
  ]);
});

test("handles ping", async () => {
  assert.deepEqual(
    await handleRequest({
      version: PROTOCOL_VERSION,
      id: "abc",
      method: "ping",
    }),
    {
      version: PROTOCOL_VERSION,
      id: "abc",
      ok: true,
      result: { message: "pong" },
    },
  );
});

test("rejects a missing task root", async () => {
  const response = await handleRequest({
    version: PROTOCOL_VERSION,
    id: "missing-test",
    method: "inspection.search",
    rootPath: join(workspacePath, "missing-root"),
    query: "anything",
  });
  assert.equal(response.ok, false);
  if (!response.ok) assert.equal(response.error.code, "TASK_ROOT_NOT_FOUND");
});

test("records and reads a persistent task session", async () => {
  const first = await handleRequest({
    version: PROTOCOL_VERSION,
    id: "task-record-one",
    method: "task.record",
    rootPath: workspacePath,
    sessionId: "/c/test-conversation",
    operation: "inspection.read",
    ok: true,
  });
  assert.equal(first.ok, true);
  if (first.ok && "operationCount" in first.result) {
    assert.equal(first.result.operationCount, 1);
    assert.equal(first.result.startingBranch, "");
    assert.equal(first.result.startingDirty, false);
    assert.deepEqual(first.result.filesTouched, []);
    assert.deepEqual(first.result.checkpoints, []);
  } else {
    assert.fail("Expected a task record result");
  }

  const second = await handleRequest({
    version: PROTOCOL_VERSION,
    id: "task-record-two",
    method: "task.record",
    rootPath: workspacePath,
    sessionId: "/c/test-conversation",
    operation: "workspace.patch",
    ok: true,
    filesChanged: ["source.txt", "new-file.txt"],
    checkpointId: "11111111-1111-4111-8111-111111111111",
  });
  assert.equal(second.ok, true);
  if (second.ok && "operationCount" in second.result) {
    assert.equal(second.result.operationCount, 2);
    assert.deepEqual(second.result.filesTouched, [
      "source.txt",
      "new-file.txt",
    ]);
    assert.deepEqual(second.result.checkpoints, [
      "11111111-1111-4111-8111-111111111111",
    ]);
  } else {
    assert.fail("Expected a second task record result");
  }
});

test("ensures a task session before recording any operations", async () => {
  const ensured = await handleRequest({
    version: PROTOCOL_VERSION,
    id: "task-ensure",
    method: "task.ensure",
    rootPath: workspacePath,
    sessionId: "/c/ensure-before-operation",
  });
  assert.equal(ensured.ok, true);
  if (ensured.ok && "operationCount" in ensured.result) {
    assert.equal(ensured.result.operationCount, 0);
  } else {
    assert.fail("Expected a task ensure result");
  }
});

test("searches a registered workspace", async () => {
  const response = await handleRequest({
    version: PROTOCOL_VERSION,
    id: "search-match",
    method: "inspection.search",
    rootPath: workspacePath,
    query: "NativeMessage",
  });
  assert.equal(response.ok, true);
  if (response.ok && "noMatches" in response.result) {
    assert.equal(response.result.exitCode, 0);
    assert.equal(response.result.noMatches, false);
    assert.match(response.result.stdout, /matches\.txt:1:NativeMessage/);
  } else {
    assert.fail("Expected a search result");
  }
});

test("represents no search matches as a normal result", async () => {
  const response = await handleRequest({
    version: PROTOCOL_VERSION,
    id: "search-empty",
    method: "inspection.search",
    rootPath: workspacePath,
    query: "definitely-not-present-8f21d9",
  });
  assert.equal(response.ok, true);
  if (response.ok && "noMatches" in response.result) {
    assert.equal(response.result.exitCode, 1);
    assert.equal(response.result.noMatches, true);
    assert.equal(response.result.stdout, "");
  } else {
    assert.fail("Expected a search result");
  }
});

test("reports ripgrep execution errors instead of successful searches", async () => {
  const response = await handleRequest({
    version: PROTOCOL_VERSION,
    id: "search-error",
    method: "inspection.search",
    rootPath: workspacePath,
    query: "[",
  });
  assert.equal(response.ok, false);
  if (response.ok) assert.fail("expected search error");
  assert.equal(response.error.code, "INTERNAL_ERROR");
  assert.match(response.error.message, /regex|unclosed|error/i);
});

test("rejects an invalid search task root", async () => {
  const response = await handleRequest({
    version: PROTOCOL_VERSION,
    id: "search-invalid-workspace",
    method: "inspection.search",
    rootPath: join(workspacePath, "missing-root"),
    query: "NativeMessage",
  });
  assert.equal(response.ok, false);
  if (!response.ok) assert.equal(response.error.code, "TASK_ROOT_NOT_FOUND");
});

test("truncates large combined process output", async () => {
  const response = await handleRequest({
    version: PROTOCOL_VERSION,
    id: "search-large",
    method: "inspection.search",
    rootPath: workspacePath,
    query: "repeat-token",
  });
  assert.equal(response.ok, true);
  if (response.ok && "noMatches" in response.result) {
    assert.equal(response.result.truncated, true);
    assert.ok(
      Buffer.byteLength(response.result.stdout) +
        Buffer.byteLength(response.result.stderr) <=
        32 * 1024,
    );
  } else {
    assert.fail("Expected a search result");
  }
});

test("treats spaces and shell metacharacters as query data", async () => {
  const response = await handleRequest({
    version: PROTOCOL_VERSION,
    id: "search-metacharacters",
    method: "inspection.search",
    rootPath: workspacePath,
    query: "hello world; touch injected",
  });
  assert.equal(response.ok, true);
  if (response.ok && "noMatches" in response.result) {
    assert.equal(response.result.exitCode, 0);
    assert.match(response.result.stdout, /hello world; touch injected/);
  } else {
    assert.fail("Expected a search result");
  }
  await assert.rejects(access(join(workspacePath, "injected")));
});

test("reads a bounded inclusive line range from a workspace file", async () => {
  const response = await handleRequest({
    version: PROTOCOL_VERSION,
    id: "read-source",
    method: "inspection.read",
    rootPath: workspacePath,
    path: "source.txt",
    startLine: 2,
    endLine: 10,
  });
  assert.equal(response.ok, true);
  if (response.ok && "actualEndLine" in response.result) {
    assert.equal(response.result.actualEndLine, 3);
    assert.equal(response.result.content, "2 | two\n3 | three");
  } else assert.fail("Expected a read result");
});

test("accepts an inclusive 500-line read range", async () => {
  const response = await handleRequest({
    version: PROTOCOL_VERSION,
    id: "read-500-lines",
    method: "inspection.read",
    rootPath: workspacePath,
    path: "source.txt",
    startLine: 1,
    endLine: 500,
  });
  assert.equal(response.ok, true);
});

test("builds one context bundle and merges overlapping read ranges", async () => {
  const response = await handleRequest({
    version: PROTOCOL_VERSION,
    id: "context-merged-read",
    method: "inspection.context",
    rootPath: workspacePath,
    searches: ["NativeMessage"],
    reads: [
      { path: "source.txt", startLine: 1, endLine: 2 },
      { path: "source.txt", startLine: 2, endLine: 3 },
    ],
    maxChars: 10_000,
  });

  assert.equal(response.ok, true);
  if (response.ok && "sections" in response.result) {
    assert.equal(response.result.sections.length, 2);
    assert.equal(response.result.truncated, false);
    const read = response.result.sections.find(
      (section) => section.kind === "read",
    );
    assert.equal(read?.kind, "read");
    if (read?.kind === "read") {
      assert.equal(read.startLine, 1);
      assert.equal(read.actualEndLine, 3);
      assert.equal(read.content, "1 | one\n2 | two\n3 | three");
    }
  } else {
    assert.fail("Expected a context result");
  }
});

test("rejects a context read range over 500 lines", async () => {
  const response = await handleRequest({
    version: PROTOCOL_VERSION,
    id: "context-read-501-lines",
    method: "inspection.context",
    rootPath: workspacePath,
    searches: [],
    reads: [{ path: "source.txt", startLine: 1, endLine: 501 }],
    maxChars: 10_000,
  });
  assert.equal(response.ok, false);
  if (!response.ok) {
    assert.equal(response.error.code, "INVALID_REQUEST");
    assert.match(response.error.message, /up to 500 lines/);
  }
});

test("enforces the context output character budget", async () => {
  const response = await handleRequest({
    version: PROTOCOL_VERSION,
    id: "context-budget",
    method: "inspection.context",
    rootPath: workspacePath,
    searches: ["repeat-token"],
    reads: [],
    maxChars: 1_000,
  });

  assert.equal(response.ok, true);
  if (response.ok && "sections" in response.result) {
    assert.equal(response.result.maxChars, 1_000);
    assert.equal(response.result.usedChars, 1_000);
    assert.equal(response.result.truncated, true);
    assert.equal(response.result.sections.length, 1);
    assert.equal(response.result.sections[0]?.content.length, 1_000);
  } else {
    assert.fail("Expected a context result");
  }
});

test("performs repository search for a name query", async () => {
  const response = await handleRequest({
    version: PROTOCOL_VERSION,
    id: "context-name-search",
    method: "inspection.context",
    rootPath: workspacePath,
    searches: [],
    reads: [],
    searchesByName: ["NativeMessage"],
    maxChars: 10_000,
  });

  assert.equal(response.ok, true);
  if (response.ok && "sections" in response.result) {
    assert.equal(response.result.sections.length, 1);
    const section = response.result.sections[0];
    assert.equal(section?.kind, "search");
    if (section?.kind === "search") {
      assert.equal(section.query, "NativeMessage");
      assert.equal(section.noMatches, false);
      assert.match(section.content, /matches\.txt:1:NativeMessage/);
    }
  } else {
    assert.fail("Expected a context result");
  }
});

test("builds repository map from the filesystem without an external symbol provider", async () => {
  const response = await handleRequest({
    version: PROTOCOL_VERSION,
    id: "context-repository-map-provider",
    method: "inspection.context",
    rootPath: workspacePath,
    searches: [],
    reads: [],
    includeRepositoryMap: true,
    maxChars: 10_000,
  });

  assert.equal(response.ok, true);
  if (response.ok && "sections" in response.result) {
    assert.equal(response.result.sections.length, 1);
    const section = response.result.sections[0];
    assert.equal(section?.kind, "repository-map");
    if (section?.kind === "repository-map") {
      assert.equal(section.provider, "filesystem");
      assert.ok(section.entryCount > 0);
      assert.match(section.content, /matches\.txt/);
      assert.doesNotMatch(section.content, /node_modules\//);
    }
  } else {
    assert.fail("Expected a context result");
  }
});

test("builds a bounded filesystem repository map", async () => {
  const full = await buildFilesystemRepositoryMap(workspacePath, 10_000);
  assert.equal(full.truncated, false);
  assert.ok(full.entryCount > 0);
  assert.match(full.content, /matches\.txt/);

  const bounded = await buildFilesystemRepositoryMap(workspacePath, 10);
  assert.equal(bounded.usedChars, 10);
  assert.equal(bounded.truncated, true);
});

test("allows workspace files whose names begin with two dots", async () => {
  const response = await handleRequest({
    version: PROTOCOL_VERSION,
    id: "read-dotdot-prefix",
    method: "inspection.read",
    rootPath: workspacePath,
    path: "..allowed.txt",
    startLine: 1,
    endLine: 1,
  });
  assert.equal(response.ok, true);
  if (response.ok && "content" in response.result) {
    assert.equal(response.result.content, "1 | allowed");
  } else {
    assert.fail("Expected a read result");
  }
});

for (const [name, path, startLine, endLine] of [
  ["absolute path", "/etc/passwd", 1, 1],
  ["parent traversal", "../source.txt", 1, 1],
  ["symlink escape", "outside-link", 1, 1],
  ["directory", ".", 1, 1],
  ["invalid lines", "source.txt", 0, 1],
  ["large range", "source.txt", 1, 501],
  ["oversized file", "oversized.txt", 1, 1],
] as const) {
  test(`rejects read ${name}`, async () => {
    const response = await handleRequest({
      version: PROTOCOL_VERSION,
      id: `read-${name}`,
      method: "inspection.read",
      rootPath: workspacePath,
      path,
      startLine,
      endLine,
    });
    assert.equal(response.ok, false);
    if (!response.ok) assert.equal(response.error.code, "INVALID_REQUEST");
  });
}

test("applies a workspace patch", async () => {
  const response = await handleRequest({
    version: PROTOCOL_VERSION,
    id: "patch-update",
    method: "workspace.patch",
    rootPath: workspacePath,
    patch:
      "*** Begin Patch\n*** Update File: patch-target.txt\n@@\n-before\n+after\n*** End Patch",
  });

  assert.equal(response.ok, true);
  if (response.ok && "filesChanged" in response.result) {
    assert.deepEqual(response.result.filesChanged, ["patch-target.txt"]);
    assert.equal(response.result.additions, 1);
    assert.equal(response.result.deletions, 1);
  } else {
    assert.fail("Expected a workspace patch result");
  }
  assert.equal(
    await readFile(join(workspacePath, "patch-target.txt"), "utf8"),
    "after\n",
  );
});

test("undoes an applied workspace patch without touching unrelated files", async () => {
  const updatePath = join(workspacePath, "undo-target.txt");
  const unrelatedPath = join(workspacePath, "undo-unrelated.txt");
  const addedPath = join(workspacePath, "undo-added.txt");
  await writeFile(updatePath, "before\n", "utf8");
  await writeFile(unrelatedPath, "keep me\n", "utf8");

  const patchResponse = await handleRequest({
    version: PROTOCOL_VERSION,
    id: "patch-for-undo",
    method: "workspace.patch",
    rootPath: workspacePath,
    patch: [
      "*** Begin Patch",
      "*** Update File: undo-target.txt",
      "@@",
      "-before",
      "+after",
      "*** Add File: undo-added.txt",
      "@@",
      "+created",
      "*** End Patch",
    ].join("\n"),
  });

  assert.equal(patchResponse.ok, true);
  if (!patchResponse.ok || !("checkpointId" in patchResponse.result)) {
    assert.fail("Expected a workspace patch checkpoint");
  }
  assert.equal(await readFile(updatePath, "utf8"), "after\n");
  assert.equal(await readFile(addedPath, "utf8"), "created\n");

  const undoResponse = await handleRequest({
    version: PROTOCOL_VERSION,
    id: "undo-patch",
    method: "workspace.undo",
    rootPath: workspacePath,
    checkpointId: patchResponse.result.checkpointId,
  });

  assert.equal(undoResponse.ok, true);
  if (undoResponse.ok && "filesRestored" in undoResponse.result) {
    assert.deepEqual(undoResponse.result.filesRestored, [
      "undo-target.txt",
      "undo-added.txt",
    ]);
  } else {
    assert.fail("Expected a workspace undo result");
  }
  assert.equal(await readFile(updatePath, "utf8"), "before\n");
  await assert.rejects(readFile(addedPath, "utf8"), { code: "ENOENT" });
  assert.equal(await readFile(unrelatedPath, "utf8"), "keep me\n");
});

test("refuses undo when a patched file changed afterward", async () => {
  const target = join(workspacePath, "undo-conflict.txt");
  await writeFile(target, "before\n", "utf8");

  const patchResponse = await handleRequest({
    version: PROTOCOL_VERSION,
    id: "patch-for-undo-conflict",
    method: "workspace.patch",
    rootPath: workspacePath,
    patch:
      "*** Begin Patch\n*** Update File: undo-conflict.txt\n@@\n-before\n+after\n*** End Patch",
  });
  assert.equal(patchResponse.ok, true);
  if (!patchResponse.ok || !("checkpointId" in patchResponse.result)) {
    assert.fail("Expected a workspace patch checkpoint");
  }

  await writeFile(target, "newer human edit\n", "utf8");
  const undoResponse = await handleRequest({
    version: PROTOCOL_VERSION,
    id: "undo-conflict",
    method: "workspace.undo",
    rootPath: workspacePath,
    checkpointId: patchResponse.result.checkpointId,
  });

  assert.equal(undoResponse.ok, false);
  if (!undoResponse.ok) {
    assert.equal(undoResponse.error.code, "INVALID_REQUEST");
    assert.match(undoResponse.error.message, /UNDO_CONFLICT/);
  }
  assert.equal(await readFile(target, "utf8"), "newer human edit\n");
});

test("rejects a stale workspace patch without modifying the file", async () => {
  const response = await handleRequest({
    version: PROTOCOL_VERSION,
    id: "patch-conflict",
    method: "workspace.patch",
    rootPath: workspacePath,
    patch:
      "*** Begin Patch\n*** Update File: patch-target.txt\n@@\n-before\n+unexpected\n*** End Patch",
  });

  assert.equal(response.ok, false);
  if (!response.ok) assert.equal(response.error.code, "INVALID_REQUEST");
  assert.equal(
    await readFile(join(workspacePath, "patch-target.txt"), "utf8"),
    "after\n",
  );
});

test("rejects duplicate targets within one workspace patch", async () => {
  const response = await handleRequest({
    version: PROTOCOL_VERSION,
    id: "patch-duplicate-target",
    method: "workspace.patch",
    rootPath: workspacePath,
    patch: [
      "*** Begin Patch",
      "*** Update File: patch-target.txt",
      "@@",
      "-after",
      "+first",
      "*** Update File: patch-target.txt",
      "@@",
      "-after",
      "+second",
      "*** End Patch",
    ].join("\n"),
  });

  assert.equal(response.ok, false);
  if (!response.ok) assert.equal(response.error.code, "INVALID_REQUEST");
  assert.equal(
    await readFile(join(workspacePath, "patch-target.txt"), "utf8"),
    "after\n",
  );
});

test("rolls back earlier files when a later patch commit fails", async () => {
  let renameCalls = 0;
  const patch = [
    "*** Begin Patch",
    "*** Update File: patch-target.txt",
    "@@",
    "-after",
    "+first-new",
    "*** Update File: patch-target-2.txt",
    "@@",
    "-second-before",
    "+second-new",
    "*** End Patch",
  ].join("\n");

  await assert.rejects(
    applyWorkspacePatch(workspacePath, patch, {
      renameFile: async (from, to) => {
        renameCalls += 1;
        if (renameCalls === 2)
          throw new Error("simulated second-file commit failure");
        await rename(from, to);
      },
    }),
    /PATCH_COMMIT_FAILED/,
  );

  assert.equal(
    renameCalls,
    3,
    "expected first commit, failed second commit, then rollback",
  );
  assert.equal(
    await readFile(join(workspacePath, "patch-target.txt"), "utf8"),
    "after\n",
  );
  assert.equal(
    await readFile(join(workspacePath, "patch-target-2.txt"), "utf8"),
    "second-before\n",
  );
});

test("accepts standard unified patch hunk headers", async () => {
  const path = "standard-hunk-header.txt";
  const patch = [
    "*** Begin Patch",
    `*** Add File: ${path}`,
    "@@ -0,0 +1,2 @@",
    "+first",
    "+second",
    "*** End Patch",
  ].join("\n");

  const result = await applyWorkspacePatch(workspacePath, patch);
  assert.ok(result.filesChanged.includes(path));
  assert.equal(
    await readFile(join(workspacePath, path), "utf8"),
    "first\nsecond\n",
  );
});

test("runs an approved generic command in the registered workspace", async () => {
  const response = await handleRequest({
    version: PROTOCOL_VERSION,
    id: "run-pwd",
    method: "command.run",
    rootPath: workspacePath,
    command: "pwd",
  });

  assert.equal(response.ok, true);
  if (response.ok && "command" in response.result) {
    assert.equal(response.result.command, "pwd");
    assert.equal(response.result.exitCode, 0);
    assert.equal(response.result.stdout, `${workspacePath}\n`);
    assert.equal(response.result.stderr, "");
    assert.equal(response.result.timedOut, false);
  } else {
    assert.fail("Expected a generic command result");
  }
});

test("executes a structured command without shell interpretation", async () => {
  const response = await handleRequest({
    version: PROTOCOL_VERSION,
    id: "structured-command",
    method: "command.exec",
    rootPath: workspacePath,
    executable: process.execPath,
    args: ["-e", "console.log(process.argv[1])", "hello; echo injected"],
  });

  assert.equal(response.ok, true);
  if (
    response.ok &&
    "executable" in response.result &&
    "args" in response.result
  ) {
    assert.equal(response.result.executable, process.execPath);
    assert.deepEqual(response.result.args, [
      "-e",
      "console.log(process.argv[1])",
      "hello; echo injected",
    ]);
    assert.equal(response.result.exitCode, 0);
    assert.equal(response.result.stdout.trim(), "hello; echo injected");
  } else {
    assert.fail("Expected a structured command result");
  }
});

test("rejects an invalid structured command request", async () => {
  const response = await handleRequest({
    version: PROTOCOL_VERSION,
    id: "structured-command-invalid",
    method: "command.exec",
    rootPath: workspacePath,
    executable: "",
    args: [],
  });

  assert.equal(response.ok, false);
  if (!response.ok) assert.equal(response.error.code, "INVALID_REQUEST");
});

test("returns non-zero command exits and stderr as normal command results", async () => {
  const response = await handleRequest({
    version: PROTOCOL_VERSION,
    id: "run-failure",
    method: "command.run",
    rootPath: workspacePath,
    command: "printf 'command failed' >&2; exit 7",
  });

  assert.equal(response.ok, true);
  if (response.ok && "command" in response.result) {
    assert.equal(response.result.exitCode, 7);
    assert.equal(response.result.stderr, "command failed");
    assert.equal(response.result.timedOut, false);
  } else {
    assert.fail("Expected a generic command result");
  }
});

test("terminates a process after its timeout", async () => {
  const result = await runProcess(
    process.execPath,
    ["-e", "setInterval(() => {}, 1000)"],
    { cwd: workspacePath, timeoutMs: 50 },
  );
  assert.equal(result.timedOut, true);
  assert.ok(result.durationMs < 2000);
});

test("returns a structured error for an unknown method", async () => {
  const response = await handleRequest({
    version: PROTOCOL_VERSION,
    id: "abc",
    method: "nope",
  });
  assert.equal(response.ok, false);
  if (!response.ok) assert.equal(response.error.code, "METHOD_NOT_FOUND");
});

test("host wrapper handles multiple messages before stdin closes", async () => {
  const child = spawn(new URL("../run-host.sh", import.meta.url).pathname, [], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { PATH: "/usr/bin:/bin" },
  });
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
  child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));

  child.stdin.end(
    Buffer.concat([
      encodeMessage({ version: PROTOCOL_VERSION, id: "one", method: "ping" }),
      encodeMessage({ version: PROTOCOL_VERSION, id: "two", method: "ping" }),
    ]),
  );

  const exitCode = await new Promise<number | null>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  assert.equal(exitCode, 0, Buffer.concat(stderr).toString("utf8"));
  assert.deepEqual(new MessageDecoder().push(Buffer.concat(stdout)), [
    {
      version: PROTOCOL_VERSION,
      id: "one",
      ok: true,
      result: { message: "pong" },
    },
    {
      version: PROTOCOL_VERSION,
      id: "two",
      ok: true,
      result: { message: "pong" },
    },
  ]);
});

test("reports missing task roots consistently across host domains", async () => {
  const missingRoot = join(workspacePath, "missing-domain-root");
  const requests = [
    {
      id: "missing-read-root",
      method: "inspection.read",
      path: "source.txt",
      startLine: 1,
      endLine: 1,
    },
    {
      id: "missing-context-root",
      method: "inspection.context",
      searches: ["NativeMessage"],
      reads: [],
      searchesByName: [],
      includeRepositoryMap: false,
    },
    {
      id: "missing-patch-root",
      method: "workspace.patch",
      patch: "*** Begin Patch\\n*** End Patch",
    },
    {
      id: "missing-git-root",
      method: "git.status",
    },
    {
      id: "missing-task-root",
      method: "task.ensure",
      sessionId: "/c/missing-root",
    },
    {
      id: "missing-exec-root",
      method: "command.exec",
      executable: "pwd",
      args: [],
    },
  ] as const;

  for (const request of requests) {
    const response = await handleRequest({
      version: PROTOCOL_VERSION,
      rootPath: missingRoot,
      ...request,
    });
    assert.equal(response.ok, false, request.method);
    if (!response.ok) {
      assert.equal(response.error.code, "TASK_ROOT_NOT_FOUND", request.method);
    }
  }
});
