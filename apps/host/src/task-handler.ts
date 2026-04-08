import { PROTOCOL_VERSION, type NativeResponse } from "@kavrith/protocol";
import {
  ensureTaskSession,
  recordTaskOperation,
  TaskStoreError,
} from "./task-store.js";
import {
  error,
  resolveTaskRoot,
  taskRootErrorResponse,
} from "./request-helpers.js";

export async function handleTaskRequest(
  id: string,
  request: Record<string, unknown>,
): Promise<NativeResponse | undefined> {
  if (request.method === "task.ensure") {
    if (
      typeof request.rootPath !== "string" ||
      typeof request.sessionId !== "string"
    ) {
      return error(id, "INVALID_REQUEST", "invalid task ensure");
    }
    try {
      const workspace = await resolveTaskRoot(request.rootPath);
      const result = await ensureTaskSession(
        request.rootPath,
        workspace,
        request.sessionId,
      );
      return { version: PROTOCOL_VERSION, id, ok: true, result };
    } catch (cause) {
      if (cause instanceof TaskStoreError)
        return error(id, "INVALID_REQUEST", cause.message);
      const rootError = taskRootErrorResponse(id, cause);
      if (rootError) return rootError;
      const message = cause instanceof Error ? cause.message : String(cause);
      return error(
        id,
        "INTERNAL_ERROR",
        `Unable to ensure task session: ${message}`,
      );
    }
  }

  if (request.method === "task.record") {
    if (
      typeof request.rootPath !== "string" ||
      request.rootPath.length === 0 ||
      typeof request.sessionId !== "string" ||
      typeof request.operation !== "string" ||
      request.operation.length === 0 ||
      typeof request.ok !== "boolean" ||
      (request.filesChanged !== undefined &&
        (!Array.isArray(request.filesChanged) ||
          request.filesChanged.some((path) => typeof path !== "string"))) ||
      (request.checkpointId !== undefined &&
        typeof request.checkpointId !== "string")
    ) {
      return error(id, "INVALID_REQUEST", "invalid task record");
    }
    try {
      const workspace = await resolveTaskRoot(request.rootPath);
      const result = await recordTaskOperation(
        request.rootPath,
        workspace,
        request.sessionId,
        {
          at: new Date().toISOString(),
          operation: request.operation,
          ok: request.ok,
          ...(request.filesChanged === undefined
            ? {}
            : { filesChanged: request.filesChanged }),
          ...(request.checkpointId === undefined
            ? {}
            : { checkpointId: request.checkpointId }),
        },
      );
      return { version: PROTOCOL_VERSION, id, ok: true, result };
    } catch (cause) {
      if (cause instanceof TaskStoreError)
        return error(id, "INVALID_REQUEST", cause.message);
      const rootError = taskRootErrorResponse(id, cause);
      if (rootError) return rootError;
      const message = cause instanceof Error ? cause.message : String(cause);
      return error(
        id,
        "INTERNAL_ERROR",
        `Unable to record task operation: ${message}`,
      );
    }
  }

  return undefined;
}
