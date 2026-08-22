import { getChatInitialization } from "../../lib/chat-initialization";
import { repobridgeSessionId } from "../../lib/repobridge-session";
import { createControls } from "./result-ui";
import {
  directiveId,
  getDirectiveState,
  parseDirective,
  setDirectiveState,
} from "./directive-scanner";
import {
  addComposerAction,
  getOutbox,
  returnResultToChatGPT,
} from "./result-delivery";
import {
  addExecAction,
  addPatchAction,
  addRunAction,
} from "./mutation-actions";
import {
  addContextAction,
  addGitAction,
  addReadAction,
  addSearchAction,
} from "./inspection-actions";
import { pendingResult } from "../../lib/result-outbox";
import {
  directiveCodeContent,
  directiveCodeText,
  isUnprocessedCodeBlock,
  preferredDirectiveCodeText,
} from "../../lib/chatgpt-code-block";
import { repobridgeDirectiveParseError } from "../../lib/chatgpt-directive-error";

const PROCESSED_ATTRIBUTE = "data-repobridge-action";
const CLAIMING_ATTRIBUTE = "data-repobridge-claiming";
const ASSISTANT_CODE_SELECTOR = "[data-message-author-role='assistant'] pre";
const CODE_TEXT_REQUEST_EVENT = "repobridge:code-text-request";
const CODE_TEXT_RESPONSE_EVENT = "repobridge:code-text-response";
const CODE_READER_ID_ATTRIBUTE = "data-repobridge-code-reader-id";
const renderedActions = new WeakMap<HTMLElement, HTMLElement[]>();
const claimedMalformedDirectives = new Set<string>();

function fullDirectiveCodeText(pre: HTMLElement): string | undefined {
  const fallback = directiveCodeText(pre);
  const requestId = crypto.randomUUID();
  pre.setAttribute(CODE_READER_ID_ATTRIBUTE, requestId);
  let fullText: string | undefined;
  const onResponse = (event: Event): void => {
    if (!(event instanceof CustomEvent) || typeof event.detail !== "string") {
      return;
    }
    try {
      const response = JSON.parse(event.detail) as {
        requestId?: unknown;
        text?: unknown;
      };
      if (response.requestId !== requestId) return;
      if (typeof response.text === "string") fullText = response.text;
    } catch {
      // Ignore malformed page-world responses and use the DOM fallback.
    }
  };

  window.addEventListener(CODE_TEXT_RESPONSE_EVENT, onResponse);
  window.dispatchEvent(
    new CustomEvent(CODE_TEXT_REQUEST_EVENT, { detail: requestId }),
  );
  window.removeEventListener(CODE_TEXT_RESPONSE_EVENT, onResponse);
  if (pre.getAttribute(CODE_READER_ID_ATTRIBUTE) === requestId) {
    pre.removeAttribute(CODE_READER_ID_ATTRIBUTE);
  }
  return preferredDirectiveCodeText(fullText, fallback);
}

export function assistantMessageForNode(node: Node): HTMLElement | undefined {
  const element = node instanceof HTMLElement ? node : node.parentElement;

  return (
    element?.closest<HTMLElement>("[data-message-author-role='assistant']") ??
    undefined
  );
}

function registerAction(code: HTMLElement, ...elements: HTMLElement[]): void {
  for (const element of renderedActions.get(code) ?? []) element.remove();
  renderedActions.set(code, elements);
}

type MutationDirective = Extract<
  ReturnType<typeof parseDirective>,
  { type: "exec" | "run" | "patch" }
>;

function isMutationDirective(
  directive: ReturnType<typeof parseDirective>,
): directive is MutationDirective {
  return (
    directive?.type === "exec" ||
    directive?.type === "run" ||
    directive?.type === "patch"
  );
}

function addMutationAction(
  code: HTMLElement,
  directive: MutationDirective,
  identity: string,
  pending: boolean,
): void {
  const dependencies = { currentTaskRoot, registerAction };
  switch (directive.type) {
    case "exec":
      addExecAction(code, directive.request, identity, pending, dependencies);
      break;
    case "run":
      addRunAction(code, directive.request, identity, pending, dependencies);
      break;
    case "patch":
      addPatchAction(code, directive.request, identity, pending, dependencies);
      break;
  }
}

async function handleMalformedDirective(
  pre: HTMLElement,
  code: HTMLElement,
  text: string,
): Promise<boolean> {
  const parseError = repobridgeDirectiveParseError(text);
  if (!parseError) return false;

  const identity = directiveId(code, `invalid-${parseError.type}`, text);
  pre.setAttribute(PROCESSED_ATTRIBUTE, "true");

  if (identity) {
    if (claimedMalformedDirectives.has(identity)) {
      return true;
    }
    claimedMalformedDirectives.add(identity);

    if ((await getDirectiveState(identity)) !== undefined) {
      return true;
    }

    await setDirectiveState(identity, "failed");
  }

  const controls = createControls();
  const status = document.createElement("span");
  status.textContent = parseError.message;
  status.style.cssText =
    "display:block;margin-top:8px;color:#dc2626;font:12px/1.45 system-ui,sans-serif;white-space:pre-wrap;";
  controls.hidden = false;
  controls.append(status);
  pre.append(controls);
  registerAction(code, controls);

  if (identity) {
    const result = [
      "<repobridge_error>",
      `operation: directive.parse.${parseError.type}`,
      `message: ${parseError.message}`,
      "</repobridge_error>",
    ].join("\n");
    void returnResultToChatGPT(controls, identity, result);
  }

  return true;
}

async function currentTaskRoot(): Promise<string> {
  const sessionId = repobridgeSessionId();
  const initialization = await getChatInitialization(sessionId);
  if (!initialization)
    throw new Error("RepoBridge is not initialized for this chat");
  return initialization.rootPath;
}

export async function restoreQueuedResults(): Promise<void> {
  const sessionId = repobridgeSessionId();
  const outbox = await getOutbox();
  const entries = Object.values(outbox[sessionId] ?? {});
  if (entries.length === 0) return;

  const codes = document.querySelectorAll<HTMLElement>(ASSISTANT_CODE_SELECTOR);
  for (const pre of codes) {
    const code = directiveCodeContent(pre) as HTMLElement | undefined;
    const text = fullDirectiveCodeText(pre);
    if (!code || text === undefined) continue;
    const directive = parseDirective(text);
    const parseError = directive
      ? undefined
      : repobridgeDirectiveParseError(text);
    const identity = directive
      ? directiveId(code, directive.type, text)
      : parseError
        ? directiveId(code, `invalid-${parseError.type}`, text)
        : undefined;
    if (!identity) continue;
    const queued = pendingResult(outbox, sessionId, identity);
    if (!queued) continue;

    const controls = createControls();
    addComposerAction(controls, identity, queued.result);
    const status = document.createElement("span");
    status.textContent = "RepoBridge result is queued for delivery.";
    status.style.cssText = "font:12px system-ui,sans-serif;color:#7f1d1d;";
    controls.append(status);
    pre.append(controls);
    registerAction(code, controls);
  }
}

export function inspect(root: ParentNode): void {
  if (
    root instanceof HTMLElement &&
    !root.matches("pre") &&
    !root.querySelector("pre")
  )
    return;
  const codes: HTMLElement[] = [];
  if (root instanceof HTMLElement && root.matches(ASSISTANT_CODE_SELECTOR))
    codes.push(root);
  codes.push(...root.querySelectorAll<HTMLElement>(ASSISTANT_CODE_SELECTOR));
  for (const pre of codes) {
    if (!isUnprocessedCodeBlock(pre, PROCESSED_ATTRIBUTE, CLAIMING_ATTRIBUTE))
      continue;

    const code = directiveCodeContent(pre) as HTMLElement | undefined;
    const text = fullDirectiveCodeText(pre);
    if (!code || text === undefined) continue;
    const directive = parseDirective(text);
    if (!directive) {
      void handleMalformedDirective(pre, code, text);
      continue;
    }

    const identity = directiveId(code, directive.type, text);
    if (!identity) continue;

    pre?.setAttribute(CLAIMING_ATTRIBUTE, "true");
    void getDirectiveState(identity).then(
      async (state) => {
        pre?.removeAttribute(CLAIMING_ATTRIBUTE);
        if (state !== undefined) {
          if (state === "pending" && isMutationDirective(directive)) {
            addMutationAction(code, directive, identity, true);
            return;
          }
          pre?.setAttribute(PROCESSED_ATTRIBUTE, "true");
          return;
        }
        await setDirectiveState(identity, "discovered");
        switch (directive.type) {
          case "context":
            addContextAction(code, directive.request, identity, {
              currentTaskRoot,
              registerAction,
            });
            break;
          case "exec":
          case "run":
          case "patch":
            addMutationAction(code, directive, identity, false);
            break;
          case "git-status":
            addGitAction(code, "status", identity, false, {
              currentTaskRoot,
              registerAction,
            });
            break;
          case "git-diff":
            addGitAction(code, "diff", identity, directive.request.staged, {
              currentTaskRoot,
              registerAction,
            });
            break;
          case "read":
            addReadAction(
              code,
              directive.request.path,
              directive.request.startLine,
              directive.request.endLine,
              identity,
              {
                currentTaskRoot,
                registerAction,
              },
            );
            break;
          case "search":
            addSearchAction(code, directive.request, identity, {
              currentTaskRoot,
              registerAction,
            });
            break;
        }
      },
      () => {
        pre?.removeAttribute(CLAIMING_ATTRIBUTE);
      },
    );
  }
}

export function primeExistingDirectives(): void {
  const codes = document.querySelectorAll<HTMLElement>(ASSISTANT_CODE_SELECTOR);
  for (const pre of codes) {
    if (!isUnprocessedCodeBlock(pre, PROCESSED_ATTRIBUTE, CLAIMING_ATTRIBUTE))
      continue;

    const code = directiveCodeContent(pre) as HTMLElement | undefined;
    const text = fullDirectiveCodeText(pre);
    if (!code || text === undefined) continue;
    const directive = parseDirective(text);
    if (!directive) {
      void handleMalformedDirective(pre, code, text);
      continue;
    }

    const identity = directiveId(code, directive.type, text);
    if (!identity) continue;

    if (isMutationDirective(directive)) {
      pre.setAttribute(CLAIMING_ATTRIBUTE, "true");
      void getDirectiveState(identity).then(
        (state) => {
          pre.removeAttribute(CLAIMING_ATTRIBUTE);
          if (state !== "pending") {
            pre.setAttribute(PROCESSED_ATTRIBUTE, "true");
            return;
          }
          addMutationAction(code, directive, identity, true);
        },
        () => {
          pre.removeAttribute(CLAIMING_ATTRIBUTE);
        },
      );
      continue;
    }

    pre?.setAttribute(CLAIMING_ATTRIBUTE, "true");
    void setDirectiveState(identity, "completed").then(
      () => {
        pre?.removeAttribute(CLAIMING_ATTRIBUTE);
        pre?.setAttribute(PROCESSED_ATTRIBUTE, "true");
      },
      () => {
        pre?.removeAttribute(CLAIMING_ATTRIBUTE);
      },
    );
  }
}
