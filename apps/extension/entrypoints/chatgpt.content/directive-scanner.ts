import { browser } from "wxt/browser";
import {
  parseKavrithContext,
  type KavrithContextRequest,
} from "../../lib/chatgpt-context";
import {
  parseKavrithExec,
  type KavrithExecRequest,
} from "../../lib/chatgpt-exec";
import { parseKavrithGit, type KavrithGitRequest } from "../../lib/chatgpt-git";
import {
  parseKavrithPatch,
  type KavrithPatchRequest,
} from "../../lib/chatgpt-patch";
import {
  parseKavrithRead,
  type KavrithReadRequest,
} from "../../lib/chatgpt-read";
import { parseKavrithRun, type KavrithRunRequest } from "../../lib/chatgpt-run";
import {
  parseKavrithSearch,
  type KavrithSearchRequest,
} from "../../lib/chatgpt-search";
import {
  directiveOccurrenceId,
  lifecycleState,
  withLifecycleState,
  type DirectiveLifecycleByChat,
  type DirectiveLifecycleState,
} from "../../lib/directive-lifecycle";
import { createAsyncMutationQueue } from "../../lib/async-mutation-queue";
import { kavrithSessionId } from "../../lib/kavrith-session";

const DIRECTIVE_LIFECYCLE_STORAGE_KEY = "chatDirectiveLifecycle";
const mutateLifecycle = createAsyncMutationQueue();

export type ParsedDirective =
  | { type: "context"; request: KavrithContextRequest }
  | { type: "exec"; request: KavrithExecRequest }
  | { type: "run"; request: KavrithRunRequest }
  | { type: "patch"; request: KavrithPatchRequest }
  | {
      type: "git-status";
      request: Extract<KavrithGitRequest, { type: "status" }>;
    }
  | {
      type: "git-diff";
      request: Extract<KavrithGitRequest, { type: "diff" }>;
    }
  | { type: "read"; request: KavrithReadRequest }
  | { type: "search"; request: KavrithSearchRequest };

export function parseDirective(text: string): ParsedDirective | undefined {
  const context = parseKavrithContext(text);
  if (context) return { type: "context", request: context };

  const exec = parseKavrithExec(text);
  if (exec) return { type: "exec", request: exec };

  const run = parseKavrithRun(text);
  if (run) return { type: "run", request: run };

  const patch = parseKavrithPatch(text);
  if (patch) return { type: "patch", request: patch };

  const git = parseKavrithGit(text);
  if (git?.type === "status") return { type: "git-status", request: git };
  if (git?.type === "diff") return { type: "git-diff", request: git };

  const read = parseKavrithRead(text);
  if (read) return { type: "read", request: read };

  const search = parseKavrithSearch(text);
  if (search) return { type: "search", request: search };

  return undefined;
}

export function directiveId(
  code: HTMLElement,
  type: string,
  text = code.textContent ?? "",
): string | undefined {
  const message = code.closest<HTMLElement>(
    "[data-message-author-role='assistant']",
  );
  if (!message) return undefined;
  const turn = message.closest<HTMLElement>(
    "[data-message-id], [data-testid^='conversation-turn-']",
  );
  const stableTurnIdentity = turn?.dataset.messageId ?? turn?.dataset.testid;
  const assistantTurns = [
    ...document.querySelectorAll<HTMLElement>(
      "[data-message-author-role='assistant']",
    ),
  ];
  const assistantTurnIndex = assistantTurns.indexOf(message);
  if (assistantTurnIndex < 0) return undefined;
  const pre = code.closest("pre");
  if (!pre) return undefined;
  const codes = [...message.querySelectorAll<HTMLElement>("pre")];
  const codeIndex = codes.indexOf(pre);
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
  const sessionId = kavrithSessionId();
  return lifecycleState(await getLifecycleMap(), sessionId, identity);
}

export async function setDirectiveState(
  identity: string,
  state: DirectiveLifecycleState,
): Promise<void> {
  await mutateLifecycle(async () => {
    const sessionId = kavrithSessionId();
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
