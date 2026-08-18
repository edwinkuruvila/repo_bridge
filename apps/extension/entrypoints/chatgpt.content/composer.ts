import {
  composerRollbackDecision,
  firstUsableCandidate,
} from "../../lib/composer-delivery";

const COMPOSER_SELECTORS = [
  "#prompt-textarea[contenteditable='true']",
  "textarea#prompt-textarea",
  "textarea[data-testid='prompt-textarea']",
] as const;

type Composer = HTMLElement | HTMLTextAreaElement;
const SEND_READY_TIMEOUT_MS = 15_000;

function findComposer(): Composer | undefined {
  for (const selector of COMPOSER_SELECTORS) {
    const element = document.querySelector<HTMLElement>(selector);
    if (element instanceof HTMLTextAreaElement || element?.isContentEditable)
      return element;
  }
  return undefined;
}

function composerText(composer: Composer): string {
  return composer instanceof HTMLTextAreaElement
    ? composer.value
    : composer.innerText;
}

function dispatchInput(composer: Composer, value: string): void {
  composer.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      inputType: "insertText",
      data: value,
    }),
  );
  composer.dispatchEvent(new Event("change", { bubbles: true }));
}

function writeTextarea(composer: HTMLTextAreaElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value",
  )?.set;
  if (!setter) throw new Error("Unable to update the ChatGPT composer");
  setter.call(composer, value);
}

function writeComposer(composer: Composer, value: string): void {
  if (composer instanceof HTMLTextAreaElement) {
    writeTextarea(composer, value);
  } else {
    composer.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(composer);
    selection?.removeAllRanges();
    selection?.addRange(range);
    if (!document.execCommand("insertText", false, value)) {
      composer.textContent = value;
    }
  }
  dispatchInput(composer, value);
}

function appendToComposer(
  result: string,
): { ok: true } | { ok: false; message: string } {
  const composer = findComposer();
  if (!composer)
    return {
      ok: false,
      message: "ChatGPT composer not found. Open a conversation and try again.",
    };

  const existing = composerText(composer);
  const value =
    existing.trim().length === 0 ? result : `${existing}\n\n${result}`;
  try {
    writeComposer(composer, value);
    composer.focus();
    return { ok: true };
  } catch (cause) {
    return {
      ok: false,
      message: cause instanceof Error ? cause.message : String(cause),
    };
  }
}

export async function sendToChatGPT(
  result: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  let composer = findComposer();
  if (!composer) {
    return {
      ok: false,
      message:
        "Result queued — ChatGPT's composer isn't ready. Try Send result again.",
    };
  }
  const original = composerText(composer);
  if (original.trim().length > 0) {
    return {
      ok: false,
      message:
        "ChatGPT composer contains a draft. Kavrith left it untouched; send the result after finishing your message.",
    };
  }

  const insertion = appendToComposer(result);
  if (!insertion.ok) return insertion;

  const selector = [
    "button[data-testid='send-button']",
    "button[aria-label='Send prompt']",
    "button[aria-label='Send']",
    "button[aria-label='Send message']",
  ].join(",");
  const deadline = performance.now() + SEND_READY_TIMEOUT_MS;

  while (performance.now() < deadline) {
    const currentComposer = findComposer();
    if (!currentComposer) {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      continue;
    }

    composer = currentComposer;
    const send = firstUsableCandidate(
      document.querySelectorAll<HTMLButtonElement>(selector),
      (button) => !button.disabled && button.getClientRects().length > 0,
    );
    if (send) {
      send.click();
      return { ok: true };
    }
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
  }

  // Sending failed after Kavrith inserted the result. Roll back only if the
  // composer still contains exactly our insertion; never overwrite user edits.
  if (
    composerRollbackDecision(original, result, composerText(composer)) ===
    "restore"
  ) {
    try {
      writeComposer(composer, original);
    } catch {
      return {
        ok: false,
        message: "Result queued — ChatGPT wasn't ready to send it.",
      };
    }
  } else {
    return {
      ok: false,
      message:
        "Result queued — the composer changed before Kavrith could send it. Your draft was left untouched.",
    };
  }

  return {
    ok: false,
    message: "Result queued — ChatGPT wasn't ready. Use Send result to retry.",
  };
}
