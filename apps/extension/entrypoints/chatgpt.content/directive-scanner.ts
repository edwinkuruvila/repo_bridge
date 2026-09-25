import { browser } from "wxt/browser";
import { createAsyncMutationQueue } from "../../lib/async-mutation-queue";
import {
  ASSISTANT_MESSAGE_SELECTOR,
  assistantCodeBlocks,
  assistantMessageForNode,
  CODE_BLOCK_SELECTOR,
} from "../../lib/chatgpt-assistant-dom";
import {
  parseRepoBridgeContext,
  type RepoBridgeContextRequest,
} from "../../lib/chatgpt-context";
import {
  parseRepoBridgeExec,
  type RepoBridgeExecRequest,
} from "../../lib/chatgpt-exec";
import {
  parseRepoBridgeGit,
  type RepoBridgeGitRequest,
} from "../../lib/chatgpt-git";
import {
  parseRepoBridgePatch,
  type RepoBridgePatchRequest,
} from "../../lib/chatgpt-patch";
import {
  parseRepoBridgeRead,
  type RepoBridgeReadRequest,
} from "../../lib/chatgpt-read";
import {
  parseRepoBridgeRun,
  type RepoBridgeRunRequest,
} from "../../lib/chatgpt-run";
import {
  parseRepoBridgeSearch,
  type RepoBridgeSearchRequest,
} from "../../lib/chatgpt-search";
import {
  type DirectiveLifecycleByChat,
  type DirectiveLifecycleState,
  directiveOccurrenceId,
  lifecycleState,
  withLifecycleState,
} from "../../lib/directive-lifecycle";
import { repobridgeSessionId } from "../../lib/repobridge-session";

const DIRECTIVE_LIFECYCLE_STORAGE_KEY = "chatDirectiveLifecycle";
const mutateLifecycle = createAsyncMutationQueue();

export type ParsedDirective =
  | { type: "context"; request: RepoBridgeContextRequest }
  | { type: "exec"; request: RepoBridgeExecRequest }
  | { type: "run"; request: RepoBridgeRunRequest }
  | { type: "patch"; request: RepoBridgePatchRequest }
  | {
      type: "git-status";
      request: Extract<RepoBridgeGitRequest, { type: "status" }>;
    }
  | {
      type: "git-diff";
      request: Extract<RepoBridgeGitRequest, { type: "diff" }>;
    }
  | { type: "read"; request: RepoBridgeReadRequest }
  | { type: "search"; request: RepoBridgeSearchRequest };

export function parseDirective(text: string): ParsedDirective | undefined {
  const context = parseRepoBridgeContext(text);
  if (context) return { type: "context", request: context };

  const exec = parseRepoBridgeExec(text);
  if (exec) return { type: "exec", request: exec };

  const run = parseRepoBridgeRun(text);
  if (run) return { type: "run", request: run };

  const patch = parseRepoBridgePatch(text);
  if (patch) return { type: "patch", request: patch };

  const git = parseRepoBridgeGit(text);
  if (git?.type === "status") return { type: "git-status", request: git };
  if (git?.type === "diff") return { type: "git-diff", request: git };

  const read = parseRepoBridgeRead(text);
  if (read) return { type: "read", request: read };

  const search = parseRepoBridgeSearch(text);
  if (search) return { type: "search", request: search };

  return undefined;
}

export function directiveId(
  code: HTMLElement,
  type: string,
  text = code.textContent ?? "",
): string | undefined {
  const message = assistantMessageForNode(code);
  if (!message) return undefined;
  const turn = message.closest<HTMLElement>(
    "[data-message-id], [data-testid^='conversation-turn-'], [data-turn-key]",
  );
  const stableTurnIdentity =
    message.querySelector<HTMLElement>("[data-chatgpt-selection-message-id]")
      ?.dataset.chatgptSelectionMessageId ??
    turn?.dataset.messageId ??
    turn?.dataset.testid ??
    turn?.dataset.turnKey;
  const assistantTurns = [
    ...document.querySelectorAll<HTMLElement>(ASSISTANT_MESSAGE_SELECTOR),
  ];
  const assistantTurnIndex = assistantTurns.indexOf(message);
  if (assistantTurnIndex < 0) return undefined;
  const block = code.closest<HTMLElement>(CODE_BLOCK_SELECTOR);
  if (!block) return undefined;
  const codeIndex = assistantCodeBlocks(message).indexOf(block);
  if (codeIndex < 0) return undefined;
  return directiveOccurrenceId(
    stableTurnIdentity ?? assistantTurnIndex,
    codeIndex,
    type,
    text,
  );
}

async function getLifecycleMap(): Promise<DirectiveLifecycleByChat> {
  const stored = await browser.storage.local.get(
    DIRECTIVE_LIFECYCLE_STORAGE_KEY,
  );
  const value = stored[DIRECTIVE_LIFECYCLE_STORAGE_KEY];
  return typeof value === "object" && value !== null
    ? (value as DirectiveLifecycleByChat)
    : {};
}

export async function getDirectiveState(
  identity: string,
): Promise<DirectiveLifecycleState | undefined> {
  const sessionId = repobridgeSessionId();
  return lifecycleState(await getLifecycleMap(), sessionId, identity);
}

export async function setDirectiveState(
  identity: string,
  state: DirectiveLifecycleState,
): Promise<void> {
  await mutateLifecycle(async () => {
    const sessionId = repobridgeSessionId();
    const byChat = withLifecycleState(
      await getLifecycleMap(),
      sessionId,
      identity,
      state,
    );
    await browser.storage.local.set({
      [DIRECTIVE_LIFECYCLE_STORAGE_KEY]: byChat,
    });
  });
}
