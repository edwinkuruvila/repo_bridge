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

      rescanTimer = window.setTimeout(() => {
        rescanTimer = undefined;
        void (async () => {
          await syncSession();
          for (const message of pendingAssistantMessages) {
            inspect(message);
          }
          pendingAssistantMessages.clear();
        })();
      }, 300);
    }).observe(document.documentElement, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  },
});
