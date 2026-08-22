type CodeMirrorDoc = {
  toString(): string;
};

type CodeMirrorContent = HTMLElement & {
  cmTile?: {
    view?: {
      state?: {
        doc?: CodeMirrorDoc;
      };
    };
  };
};

const REQUEST_EVENT = "repobridge:code-text-request";
const RESPONSE_EVENT = "repobridge:code-text-response";
const BLOCK_ID_ATTRIBUTE = "data-repobridge-code-reader-id";
const READONLY_TEXTBOX_SELECTOR = '[role="textbox"][aria-readonly="true"]';

export default defineContentScript({
  matches: ["https://chatgpt.com/*"],
  world: "MAIN",
  main() {
    window.addEventListener(REQUEST_EVENT, (event) => {
      if (!(event instanceof CustomEvent)) return;
      const requestId =
        typeof event.detail === "string" ? event.detail : undefined;
      if (!requestId) return;

      const pre = document.querySelector<HTMLElement>(
        `pre[${BLOCK_ID_ATTRIBUTE}="${CSS.escape(requestId)}"]`,
      );
      const content = pre?.querySelector<CodeMirrorContent>(
        READONLY_TEXTBOX_SELECTOR,
      );
      const text = content?.cmTile?.view?.state?.doc?.toString();

      window.dispatchEvent(
        new CustomEvent(RESPONSE_EVENT, {
          detail: JSON.stringify({
            requestId,
            ...(typeof text === "string" ? { text } : {}),
          }),
        }),
      );
    });
  },
});
