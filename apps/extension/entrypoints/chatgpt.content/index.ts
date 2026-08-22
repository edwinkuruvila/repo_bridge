import { syncRepoBridgeSessionForCurrentPage } from "../../lib/repobridge-session";
import { deferredPrimeDecision } from "../../lib/directive-stability";
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
    let pendingInitialPrime = false;
    let rescanTimer: number | undefined;
    const pendingAssistantMessages = new Set<HTMLElement>();

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

    const scheduleRescan = (delay: number): void => {
      if (rescanTimer !== undefined) {
        window.clearTimeout(rescanTimer);
      }
      rescanTimer = window.setTimeout(scanWhenStable, delay);
    };

    const syncSession = async (): Promise<void> => {
      const sessionId = await syncRepoBridgeSessionForCurrentPage();
      if (activeSessionId !== sessionId) {
        activeSessionId = sessionId;
        pendingInitialPrime = true;
        await restoreQueuedResults();

        const decision = deferredPrimeDecision(
          pendingInitialPrime,
          assistantIsGenerating(),
        );
        if (decision === "prime") {
          primeExistingDirectives();
          pendingInitialPrime = false;
        } else if (decision === "wait") {
          scheduleRescan(1_000);
        }
      }
      // The ChatGPT composer can mount after document_idle. Retry rendering on
      // later DOM mutations even when the logical RepoBridge session is unchanged.
      ensureChatInitializer();
    };

    async function scanWhenStable(): Promise<void> {
      rescanTimer = undefined;
      if (assistantIsGenerating()) {
        scheduleRescan(1_000);
        return;
      }

      await syncSession();

      if (deferredPrimeDecision(pendingInitialPrime, false) === "prime") {
        primeExistingDirectives();
        pendingInitialPrime = false;
      }

      for (const message of pendingAssistantMessages) {
        inspect(message);
      }
      pendingAssistantMessages.clear();
    }

    void syncSession();

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

      scheduleRescan(1_200);
    }).observe(document.documentElement, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  },
});
