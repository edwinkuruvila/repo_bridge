import { browser } from "wxt/browser";
import {
  enqueueResult,
  removeResult,
  type ResultOutboxByChat,
} from "../../lib/result-outbox";
import { createAsyncMutationQueue } from "../../lib/async-mutation-queue";
import { repobridgeSessionId } from "../../lib/repobridge-session";
import { sendToChatGPT } from "./composer";
import { createActionButton, errorMessage } from "./result-ui";

const RESULT_OUTBOX_STORAGE_KEY = "chatResultOutbox";
const mutateOutbox = createAsyncMutationQueue();

export async function getOutbox(): Promise<ResultOutboxByChat> {
  const stored = await browser.storage.local.get(RESULT_OUTBOX_STORAGE_KEY);
  const value = stored[RESULT_OUTBOX_STORAGE_KEY];
  return typeof value === "object" && value !== null
    ? (value as ResultOutboxByChat)
    : {};
}

async function queueResult(identity: string, result: string): Promise<void> {
  await mutateOutbox(async () => {
    const sessionId = repobridgeSessionId();
    await browser.storage.local.set({
      [RESULT_OUTBOX_STORAGE_KEY]: enqueueResult(
        await getOutbox(),
        sessionId,
        identity,
        result,
      ),
    });
  });
}

async function clearQueuedResult(identity: string): Promise<void> {
  await mutateOutbox(async () => {
    const sessionId = repobridgeSessionId();
    await browser.storage.local.set({
      [RESULT_OUTBOX_STORAGE_KEY]: removeResult(
        await getOutbox(),
        sessionId,
        identity,
      ),
    });
  });
}

export function addComposerAction(
  controls: HTMLElement,
  identity: string,
  result: string,
): void {
  controls.hidden = false;
  const button = createActionButton("Send result");
  const status = document.createElement("span");
  status.style.cssText = "font:12px system-ui,sans-serif;color:#dc2626;";
  controls.append(button, status);

  button.addEventListener("click", async () => {
    button.disabled = true;
    button.textContent = "Sending…";
    const sent = await sendToChatGPT(result);
    if (!sent.ok) {
      status.textContent = sent.message;
      button.disabled = false;
      button.textContent = "Send result";
      return;
    }
    await clearQueuedResult(identity);
    status.textContent = "";
    button.textContent = "Sent";
  });
}

export async function returnResultToChatGPT(
  controls: HTMLElement,
  identity: string,
  result: string,
): Promise<void> {
  await queueResult(identity, result);
  const sent = await sendToChatGPT(result);
  if (sent.ok) {
    await clearQueuedResult(identity);
    return;
  }

  addComposerAction(controls, identity, result);
  const status = document.createElement("span");
  status.textContent = sent.message;
  status.style.cssText = "font:12px system-ui,sans-serif;color:#dc2626;";
  controls.append(status);
}

function formatRepoBridgeError(
  operation: string,
  cause: unknown,
  workspaceName?: string,
): string {
  const message = errorMessage(cause);
  return [
    "<repobridge_error>",
    ...(workspaceName ? [`workspace: ${workspaceName}`] : []),
    `operation: ${operation}`,
    `message: ${message}`,
    "</repobridge_error>",
  ].join("\n");
}

export async function returnErrorToChatGPT(
  controls: HTMLElement,
  identity: string,
  operation: string,
  cause: unknown,
  workspaceName?: string,
): Promise<void> {
  await returnResultToChatGPT(
    controls,
    identity,
    formatRepoBridgeError(operation, cause, workspaceName),
  );
}
