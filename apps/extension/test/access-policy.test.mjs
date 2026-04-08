import assert from "node:assert/strict";
import test from "node:test";
import { shouldAutoExecuteCommand } from "../dist-test/lib/access-policy.js";
import { classifyExecRisk } from "../dist-test/lib/exec-policy.js";
import { isTrustedUserGesture } from "../dist-test/lib/user-gesture.js";

test("Ask before changes never auto-executes commands", () => {
  assert.equal(shouldAutoExecuteCommand("approval", false), false);
});

test("Full access auto-executes commands", () => {
  assert.equal(shouldAutoExecuteCommand("full", false), true);
});

test("forced approval overrides Full access", () => {
  assert.equal(shouldAutoExecuteCommand("full", true), false);
});

test("read-only exec classification does not imply automatic execution", () => {
  const risk = classifyExecRisk({
    executable: "git",
    args: ["status", "--short"],
  });

  assert.equal(risk, "read-only");
  assert.equal(shouldAutoExecuteCommand("approval", false), false);
});

test("classifies representative mutating commands separately from approval policy", () => {
  assert.equal(
    classifyExecRisk({ executable: "git", args: ["commit", "-m", "test"] }),
    "destructive",
  );
  assert.equal(
    classifyExecRisk({ executable: "pnpm", args: ["test"] }),
    "code-execution",
  );
});

test("security-sensitive UI requires a trusted browser user gesture", () => {
  assert.equal(isTrustedUserGesture({ isTrusted: true }), true);
  assert.equal(isTrustedUserGesture({ isTrusted: false }), false);
});
