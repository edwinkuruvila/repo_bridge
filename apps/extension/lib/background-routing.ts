import type { NativeRequest, NativeResponse } from "@kavrith/protocol";
import {
  isKavrithContextMessage,
  isKavrithExecMessage,
  isKavrithGitDiffMessage,
  isKavrithGitStatusMessage,
  isKavrithPatchMessage,
  isKavrithReadMessage,
  isKavrithRunMessage,
  isKavrithSearchMessage,
  isKavrithUndoMessage,
} from "./messages.js";

type NativeRequestInput = NativeRequest extends infer Request
  ? Request extends NativeRequest
    ? Omit<Request, "version" | "id">
    : never
  : never;

export interface BackgroundRoutingDependencies {
  sendNative(input: NativeRequestInput): Promise<NativeResponse>;
  sendTracked(
    input: NativeRequestInput & { rootPath: string },
    sessionId?: string,
  ): Promise<NativeResponse>;
  taskRoot(sessionId?: string): Promise<string>;
  authorizeMutation(
    authorization: "approved" | "full",
    sessionId?: string,
  ): Promise<void>;
}

function simpleMessageType(message: unknown): string | undefined {
  if (typeof message !== "object" || message === null || !("type" in message)) {
    return undefined;
  }
  return typeof message.type === "string" ? message.type : undefined;
}

export async function routeBackgroundMessage(
  message: unknown,
  deps: BackgroundRoutingDependencies,
): Promise<NativeResponse | undefined> {
  switch (simpleMessageType(message)) {
    case "ping-host":
      return deps.sendNative({ method: "ping" });
    case "pick-task-root":
      return deps.sendNative({ method: "task.root.pick" });
  }

  if (isKavrithSearchMessage(message)) {
    const rootPath = await deps.taskRoot(message.sessionId);
    const query = message.query.trim();
    if (!query) throw new Error("A non-empty search query is required");
    return deps.sendTracked(
      { method: "inspection.search", rootPath, query },
      message.sessionId,
    );
  }

  if (isKavrithReadMessage(message)) {
    const rootPath = await deps.taskRoot(message.sessionId);
    return deps.sendTracked(
      {
        method: "inspection.read",
        rootPath,
        path: message.path,
        startLine: message.startLine,
        endLine: message.endLine,
      },
      message.sessionId,
    );
  }

  if (isKavrithContextMessage(message)) {
    const rootPath = await deps.taskRoot(message.sessionId);
    return deps.sendTracked(
      {
        method: "inspection.context",
        rootPath,
        searches: message.searches,
        reads: message.reads,
        ...(message.searchesByName === undefined
          ? {}
          : { searchesByName: message.searchesByName }),
        ...(message.includeRepositoryMap === undefined
          ? {}
          : { includeRepositoryMap: message.includeRepositoryMap }),
        ...(message.maxChars === undefined
          ? {}
          : { maxChars: message.maxChars }),
      },
      message.sessionId,
    );
  }

  const mutation = async (
    authorization: "approved" | "full",
    sessionId: string | undefined,
    input: NativeRequestInput & { rootPath: string },
  ) => {
    await deps.authorizeMutation(authorization, sessionId);
    return deps.sendTracked(input, sessionId);
  };

  if (isKavrithPatchMessage(message)) {
    const rootPath = await deps.taskRoot(message.sessionId);
    return mutation(message.authorization, message.sessionId, {
      method: "workspace.patch",
      rootPath,
      patch: message.patch,
    });
  }

  if (isKavrithRunMessage(message)) {
    const rootPath = await deps.taskRoot(message.sessionId);
    return mutation(message.authorization, message.sessionId, {
      method: "command.run",
      rootPath,
      command: message.command,
    });
  }

  if (isKavrithUndoMessage(message)) {
    const rootPath = await deps.taskRoot(message.sessionId);
    return mutation(message.authorization, message.sessionId, {
      method: "workspace.undo",
      rootPath,
      checkpointId: message.checkpointId,
    });
  }

  if (isKavrithGitStatusMessage(message)) {
    const rootPath = await deps.taskRoot(message.sessionId);
    return deps.sendTracked(
      { method: "git.status", rootPath },
      message.sessionId,
    );
  }

  if (isKavrithGitDiffMessage(message)) {
    const rootPath = await deps.taskRoot(message.sessionId);
    return deps.sendTracked(
      { method: "git.diff", rootPath, staged: message.staged },
      message.sessionId,
    );
  }

  if (isKavrithExecMessage(message)) {
    const rootPath = await deps.taskRoot(message.sessionId);
    return mutation(message.authorization, message.sessionId, {
      method: "command.exec",
      rootPath,
      executable: message.executable,
      args: message.args,
    });
  }

  return undefined;
}
