import { realpath, stat } from "node:fs/promises";
import { PROTOCOL_VERSION, type ErrorResponse } from "@kavrith/protocol";

export class TaskRootError extends Error {}

export async function resolveTaskRoot(rootPath: string): Promise<string> {
  try {
    if (!rootPath || rootPath.length > 16_384 || rootPath.includes("\0")) {
      throw new Error("rootPath must be a non-empty filesystem path");
    }
    const canonical = await realpath(rootPath);
    const details = await stat(canonical);
    if (!details.isDirectory())
      throw new Error("Task root must be a directory");
    return canonical;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    throw new TaskRootError(message);
  }
}

export function taskRootErrorResponse(
  id: string,
  cause: unknown,
): ErrorResponse | undefined {
  if (!(cause instanceof TaskRootError)) return undefined;
  return error(
    id,
    "TASK_ROOT_NOT_FOUND",
    `Unable to resolve task root: ${cause.message}`,
  );
}

export function error(
  id: string,
  code: ErrorResponse["error"]["code"],
  message: string,
): ErrorResponse {
  return { version: PROTOCOL_VERSION, id, ok: false, error: { code, message } };
}
