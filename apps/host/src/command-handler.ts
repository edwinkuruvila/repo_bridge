import { PROTOCOL_VERSION, type NativeResponse } from "@kavrith/protocol";
import { runProcess, runShellCommand } from "./process-runner.js";
import {
  error,
  resolveTaskRoot,
  taskRootErrorResponse,
} from "./request-helpers.js";

export async function handleCommandRequest(
  id: string,
  request: Record<string, unknown>,
): Promise<NativeResponse | undefined> {
  if (request.method === "command.exec") {
    if (
      typeof request.rootPath !== "string" ||
      request.rootPath.length === 0 ||
      typeof request.executable !== "string" ||
      request.executable.length === 0 ||
      request.executable.length > 1_000 ||
      request.executable.includes("\0") ||
      !Array.isArray(request.args) ||
      request.args.length > 256 ||
      request.args.some(
        (arg) =>
          typeof arg !== "string" || arg.length > 8_000 || arg.includes("\0"),
      )
    ) {
      return error(id, "INVALID_REQUEST", "invalid command.exec request");
    }
    try {
      const workspace = await resolveTaskRoot(request.rootPath);
      const result = await runProcess(request.executable, request.args, {
        cwd: workspace,
        timeoutMs: 120_000,
        maxOutputBytes: 256 * 1024,
      });
      if (result.spawnError) {
        return error(
          id,
          "INVALID_REQUEST",
          `Unable to execute ${request.executable}: ${result.spawnError}`,
        );
      }
      return {
        version: PROTOCOL_VERSION,
        id,
        ok: true,
        result: {
          executable: request.executable,
          args: [...request.args],
          exitCode: result.exitCode,
          stdout: result.stdout,
          stderr: result.stderr,
          durationMs: result.durationMs,
          timedOut: result.timedOut,
          truncated: result.truncated,
        },
      };
    } catch (cause) {
      const rootError = taskRootErrorResponse(id, cause);
      if (rootError) return rootError;
      const message = cause instanceof Error ? cause.message : String(cause);
      return error(
        id,
        "INTERNAL_ERROR",
        `Unable to execute structured command: ${message}`,
      );
    }
  }

  if (request.method === "command.run") {
    if (
      typeof request.rootPath !== "string" ||
      request.rootPath.length === 0 ||
      typeof request.command !== "string"
    ) {
      return error(id, "INVALID_REQUEST", "rootPath and command are required");
    }
    if (
      !request.command.trim() ||
      request.command.length > 8_000 ||
      request.command.includes("\0")
    ) {
      return error(
        id,
        "INVALID_REQUEST",
        "command must be non-empty, at most 8000 characters, and contain no NUL bytes",
      );
    }
    try {
      const workspace = await resolveTaskRoot(request.rootPath);
      const result = await runShellCommand(request.command, workspace);
      if (result.spawnError)
        return error(
          id,
          "INTERNAL_ERROR",
          `Unable to start command: ${result.spawnError}`,
        );
      return {
        version: PROTOCOL_VERSION,
        id,
        ok: true,
        result: {
          command: request.command,
          exitCode: result.exitCode,
          stdout: result.stdout,
          stderr: result.stderr,
          durationMs: result.durationMs,
          timedOut: result.timedOut,
          truncated: result.truncated,
        },
      };
    } catch (cause) {
      const rootError = taskRootErrorResponse(id, cause);
      if (rootError) return rootError;
      const message = cause instanceof Error ? cause.message : String(cause);
      return error(id, "INTERNAL_ERROR", `Unable to run command: ${message}`);
    }
  }

  return undefined;
}
