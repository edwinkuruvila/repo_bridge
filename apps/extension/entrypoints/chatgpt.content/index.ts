import { syncKavrithSessionForCurrentPage } from "../../lib/kavrith-session";
import { ensureChatInitializer } from "./initializer";
import {
  assistantMessageForNode,
  inspect,
  primeExistingDirectives,
  restoreQueuedResults,
} from "./directive-processing";

export default defineContentScript({
  matches: ["https://chatgpt.com/*"],
  runAt: "document_idle",
  main() {
    let activeSessionId: string | undefined;
    const syncSession = async (): Promise<void> => {
      const sessionId = await syncKavrithSessionForCurrentPage();
      if (activeSessionId !== sessionId) {
        activeSessionId = sessionId;
        primeExistingDirectives();
        await restoreQueuedResults();
      }
      // The ChatGPT composer can mount after document_idle. Retry rendering on
      // later DOM mutations even when the logical Kavrith session is unchanged.
      ensureChatInitializer();
    };
    void syncSession();
    let rescanTimer: number | undefined;
    const assistantIsGenerating = (): boolean => {
      const selectors = [
        "button[data-testid='stop-button']",
        "button[aria-label='Stop generating']",
        "button[aria-label='Stop']",
      ];
      return selectors.some((selector) => {
        const button = document.querySelector<HTMLElement>(selector);
        return Boolean(button && button.getClientRects().length > 0);
      });
    };
    const pendingAssistantMessages = new Set<HTMLElement>();

    new MutationObserver((records) => {
      const changedAssistantMessages = new Set<HTMLElement>();

      for (const record of records) {
        if (record.type === "characterData") {
          const message = assistantMessageForNode(record.target);
          if (message?.querySelector("pre")) {
            changedAssistantMessages.add(message);
          }
        }

        for (const node of record.addedNodes) {
          const message = assistantMessageForNode(node);
          if (!message) continue;

          const containsCode =
            node instanceof HTMLElement
              ? node.matches("pre") ||
                node.querySelector("pre") !== null ||
                message.querySelector("pre") !== null
              : message.querySelector("pre") !== null;

          if (containsCode) {
            changedAssistantMessages.add(message);
          }
        }
      }

      void syncSession();

      if (changedAssistantMessages.size === 0) return;

      for (const message of changedAssistantMessages) {
        pendingAssistantMessages.add(message);
      }

      if (rescanTimer !== undefined) {
        window.clearTimeout(rescanTimer);
      }

      rescanTimer = window.setTimeout(function scanWhenStable() {
        rescanTimer = undefined;
        if (assistantIsGenerating()) {
          rescanTimer = window.setTimeout(scanWhenStable, 1_000);
          return;
        }
        void (async () => {
          await syncSession();
          for (const message of pendingAssistantMessages) {
            inspect(message);
          }
          pendingAssistantMessages.clear();
        })();
      }, 1_200);
    }).observe(document.documentElement, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  },
});
