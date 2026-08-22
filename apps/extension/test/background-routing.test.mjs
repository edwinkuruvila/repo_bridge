import assert from "node:assert/strict";
import test from "node:test";
import { routeBackgroundMessage } from "../dist-test/lib/background-routing.js";

function harness() {
  const calls = [];
  const response = {
    version: 1,
    id: "test",
    ok: true,
    result: { message: "ok" },
  };
  return {
    calls,
    deps: {
      async sendNative(input) {
        calls.push(["native", input]);
        return response;
      },
      async sendTracked(input, sessionId) {
        calls.push(["tracked", input, sessionId]);
        return response;
      },
      async taskRoot(sessionId) {
        calls.push(["root", sessionId]);
        return "/repo";
      },
      async authorizeMutation(authorization, sessionId) {
        calls.push(["authorize", authorization, sessionId]);
      },
    },
  };
}

test("routes canonical context messages", async () => {
  const { calls, deps } = harness();
  await routeBackgroundMessage(
    {
      type: "REPOBRIDGE_CONTEXT",
      sessionId: "session",
      searches: ["needle"],
      reads: [],
      searchesByName: ["NativeMessage"],
      includeRepositoryMap: true,
    },
    deps,
  );
  assert.deepEqual(calls, [
    ["root", "session"],
    [
      "tracked",
      {
        method: "inspection.context",
        rootPath: "/repo",
        searches: ["needle"],
        reads: [],
        searchesByName: ["NativeMessage"],
        includeRepositoryMap: true,
      },
      "session",
    ],
  ]);
});

test("authorizes mutations before dispatch", async () => {
  const { calls, deps } = harness();
  await routeBackgroundMessage(
    {
      type: "REPOBRIDGE_PATCH",
      sessionId: "session",
      authorization: "full",
      patch: "*** Begin Patch\\n*** End Patch",
    },
    deps,
  );
  assert.deepEqual(calls, [
    ["root", "session"],
    ["authorize", "full", "session"],
    [
      "tracked",
      {
        method: "workspace.patch",
        rootPath: "/repo",
        patch: "*** Begin Patch\\n*** End Patch",
      },
      "session",
    ],
  ]);
});

test("routes git status and diff", async () => {
  const { calls, deps } = harness();
  await routeBackgroundMessage(
    { type: "REPOBRIDGE_GIT_STATUS", sessionId: "session" },
    deps,
  );
  await routeBackgroundMessage(
    { type: "REPOBRIDGE_GIT_DIFF", sessionId: "session", staged: true },
    deps,
  );

  assert.deepEqual(calls[1], [
    "tracked",
    { method: "git.status", rootPath: "/repo" },
    "session",
  ]);
  assert.deepEqual(calls[3], [
    "tracked",
    { method: "git.diff", rootPath: "/repo", staged: true },
    "session",
  ]);
});
