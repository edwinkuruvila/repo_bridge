import {
  PROTOCOL_VERSION,
  type ErrorResponse,
  type NativeResponse,
} from "@kavrith/protocol";
import { runProcess } from "./process-runner.js";
import { findGit } from "./executable-discovery.js";
import {
  error,
  resolveTaskRoot,
  taskRootErrorResponse,
} from "./request-helpers.js";

async function executeGit(
  id: string,
  cwd: string,
  args: readonly string[],
): Promise<
  | { result: Awaited<ReturnType<typeof runProcess>> }
  | { response: ErrorResponse }
> {
  const result = await runProcess(await findGit(), args, {
    cwd,
    timeoutMs: 30_000,
    maxOutputBytes: 128 * 1024,
  });
  if (result.timedOut) {
    return {
      response: error(
        id,
        "PROCESS_TIMEOUT",
        "Git operation exceeded the 30 second timeout",
      ),
    };
  }
  if (result.spawnError) {
    return {
      response: error(
        id,
        "INTERNAL_ERROR",
        `Failed to execute git: ${result.spawnError}`,
      ),
    };
  }
  if (result.exitCode !== 0) {
    return {
      response: error(
        id,
        "INVALID_REQUEST",
        result.stderr.trim() || `git exited with status ${result.exitCode}`,
      ),
    };
  }
  return { result };
}

export async function handleGitRequest(
  id: string,
  request: Record<string, unknown>,
): Promise<NativeResponse | undefined> {
  if (request.method === "git.status") {
    if (typeof request.rootPath !== "string" || request.rootPath.length === 0) {
      return error(
        id,
        "INVALID_REQUEST",
        "rootPath must be a non-empty string",
      );
    }
    try {
      const workspace = await resolveTaskRoot(request.rootPath);
      const execution = await executeGit(id, workspace, [
        "status",
        "--short",
        "--branch",
        "--untracked-files=all",
      ]);
      if ("response" in execution) return execution.response;
      const lines = execution.result.stdout
        .replace(/\r\n?/g, "\n")
        .trimEnd()
        .split("\n");
      const branchLine = lines[0]?.startsWith("## ")
        ? (lines.shift() ?? "")
        : "";
      const entries = lines.filter(Boolean);
      return {
        version: PROTOCOL_VERSION,
        id,
        ok: true,
        result: {
          branch: branchLine.slice(3),
          clean: entries.length === 0,
          entries,
          durationMs: execution.result.durationMs,
          truncated: execution.result.truncated,
        },
      };
    } catch (cause) {
      const rootError = taskRootErrorResponse(id, cause);
      if (rootError) return rootError;
      const message = cause instanceof Error ? cause.message : String(cause);
      return error(
        id,
        "INTERNAL_ERROR",
        `Unable to inspect Git status: ${message}`,
      );
    }
  }

  if (request.method === "git.diff") {
    if (
      typeof request.rootPath !== "string" ||
      request.rootPath.length === 0 ||
      typeof request.staged !== "boolean"
    ) {
      return error(id, "INVALID_REQUEST", "rootPath and staged are required");
    }
    try {
      const workspace = await resolveTaskRoot(request.rootPath);
      const args = ["diff", "--no-ext-diff", "--no-color", "--unified=3"];
      if (request.staged) args.push("--cached");
      const execution = await executeGit(id, workspace, args);
      if ("response" in execution) return execution.response;
      return {
        version: PROTOCOL_VERSION,
        id,
        ok: true,
        result: {
          staged: request.staged,
          diff: execution.result.stdout,
          durationMs: execution.result.durationMs,
          truncated: execution.result.truncated,
        },
      };
    } catch (cause) {
      const rootError = taskRootErrorResponse(id, cause);
      if (rootError) return rootError;
      const message = cause instanceof Error ? cause.message : String(cause);
      return error(
        id,
        "INTERNAL_ERROR",
        `Unable to inspect Git diff: ${message}`,
      );
    }
  }

  return undefined;
}
