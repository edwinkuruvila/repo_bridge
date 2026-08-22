import { browser } from "wxt/browser";
import {
  PROTOCOL_VERSION,
  type NativeRequest,
  type NativeResponse,
} from "@repobridge/protocol";
import { ACCESS_MODE_STORAGE_KEY, type AccessMode } from "../lib/messages";
import { routeBackgroundMessage } from "../lib/background-routing";
import { getChatInitialization } from "../lib/chat-initialization";

const HOST_NAME = "com.repobridge.host";
let port: ReturnType<typeof browser.runtime.connectNative> | undefined;
const pending = new Map<
  string,
  {
    resolve: (response: NativeResponse) => void;
    reject: (reason: Error) => void;
  }
>();

function rejectPending(message: string): void {
  for (const { reject } of pending.values()) reject(new Error(message));
  pending.clear();
}

function getPort(): ReturnType<typeof browser.runtime.connectNative> {
  if (port) return port;

  port = browser.runtime.connectNative(HOST_NAME);
  port.onMessage.addListener((message: unknown) => {
    if (typeof message !== "object" || message === null) return;
    const response = message as Partial<NativeResponse>;
    if (typeof response.id !== "string") return;
    const request = pending.get(response.id);
    if (!request) return;
    pending.delete(response.id);
    request.resolve(message as NativeResponse);
  });
  const connectedPort = port;
  port.onDisconnect.addListener(() => {
    const firefoxError = (
      connectedPort as typeof connectedPort & { error?: Error }
    ).error;
    const message =
      firefoxError?.message ??
      browser.runtime.lastError?.message ??
      "Native host disconnected";
    console.error("RepoBridge local host disconnected:", message);
    port = undefined;
    rejectPending(message);
  });
  return port;
}

type NativeRequestInput = NativeRequest extends infer Request
  ? Request extends NativeRequest
    ? Omit<Request, "version" | "id">
    : never
  : never;

function sendNative(input: NativeRequestInput): Promise<NativeResponse> {
  const id = crypto.randomUUID();
  const request = { ...input, version: PROTOCOL_VERSION, id } as NativeRequest;

  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    try {
      getPort().postMessage(request);
    } catch (cause) {
      pending.delete(id);
      reject(cause instanceof Error ? cause : new Error(String(cause)));
    }
  });
}

async function taskRoot(sessionId?: string): Promise<string> {
  if (!sessionId) throw new Error("RepoBridge session id is unavailable");
  const initialization = await getChatInitialization(sessionId);
  if (!initialization)
    throw new Error("RepoBridge is not initialized for this chat");
  return initialization.rootPath;
}

async function authorizeMutation(
  authorization: "approved" | "full",
  sessionId?: string,
): Promise<void> {
  if (authorization === "approved") return;
  if (sessionId) {
    const initialization = await getChatInitialization(sessionId);
    if (initialization) {
      if (initialization.accessMode !== "full") {
        throw new Error("Full Access mode is not enabled for this chat");
      }
      return;
    }
  }
  const stored = await browser.storage.local.get(ACCESS_MODE_STORAGE_KEY);
  const mode = stored[ACCESS_MODE_STORAGE_KEY] as AccessMode | undefined;
  if (mode !== "full") throw new Error("Full Access mode is not enabled");
}

async function recordOperation(
  rootPath: string,
  operation: string,
  response: NativeResponse,
  sessionId?: string,
): Promise<void> {
  if (!sessionId) return;
  const filesChanged =
    response.ok && "filesChanged" in response.result
      ? response.result.filesChanged
      : undefined;
  const checkpointId =
    response.ok && "checkpointId" in response.result
      ? response.result.checkpointId
      : undefined;
  try {
    await sendNative({
      method: "task.record",
      rootPath,
      sessionId,
      operation,
      ok: response.ok,
      ...(filesChanged === undefined ? {} : { filesChanged }),
      ...(checkpointId === undefined ? {} : { checkpointId }),
    });
  } catch (cause) {
    console.warn("RepoBridge task journal write failed:", cause);
  }
}

async function sendTracked(
  input: NativeRequestInput & { rootPath: string },
  sessionId?: string,
): Promise<NativeResponse> {
  if (sessionId) {
    try {
      await sendNative({
        method: "task.ensure",
        rootPath: input.rootPath,
        sessionId,
      });
    } catch (cause) {
      console.warn("RepoBridge task session initialization failed:", cause);
    }
  }
  const response = await sendNative(input);
  await recordOperation(input.rootPath, input.method, response, sessionId);
  return response;
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: unknown) =>
    routeBackgroundMessage(message, {
      sendNative,
      sendTracked,
      taskRoot,
      authorizeMutation,
    }),
  );
});
