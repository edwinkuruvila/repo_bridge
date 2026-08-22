import { browser } from "wxt/browser";
import { conversationSessionIdFromUrl } from "./conversation-session";

const REPOBRIDGE_SESSION_ID_SESSION_KEY = "repobridgeSessionId";
const REPOBRIDGE_CONVERSATION_SESSION_KEY = "repobridgeConversationSessionId";
const REPOBRIDGE_CONVERSATION_ALIASES_STORAGE_KEY =
  "repobridgeConversationAliases";

type ConversationAliases = Record<string, string>;

function setCurrentSession(sessionId: string, conversationId?: string): string {
  sessionStorage.setItem(REPOBRIDGE_SESSION_ID_SESSION_KEY, sessionId);
  if (conversationId) {
    sessionStorage.setItem(REPOBRIDGE_CONVERSATION_SESSION_KEY, conversationId);
  } else {
    sessionStorage.removeItem(REPOBRIDGE_CONVERSATION_SESSION_KEY);
  }
  return sessionId;
}

async function readConversationAliases(): Promise<ConversationAliases> {
  const stored = await browser.storage.local.get(
    REPOBRIDGE_CONVERSATION_ALIASES_STORAGE_KEY,
  );
  const value = stored[REPOBRIDGE_CONVERSATION_ALIASES_STORAGE_KEY];
  return typeof value === "object" && value !== null
    ? (value as ConversationAliases)
    : {};
}

export function repobridgeSessionId(): string {
  const existing =
    sessionStorage.getItem(REPOBRIDGE_SESSION_ID_SESSION_KEY) ?? undefined;
  if (existing) return existing;
  return setCurrentSession(crypto.randomUUID());
}

export async function syncRepoBridgeSessionForCurrentPage(): Promise<string> {
  const conversationId = conversationSessionIdFromUrl(location.href);
  const previousConversationId =
    sessionStorage.getItem(REPOBRIDGE_CONVERSATION_SESSION_KEY) ?? undefined;
  const existingLocalId =
    sessionStorage.getItem(REPOBRIDGE_SESSION_ID_SESSION_KEY) ?? undefined;

  if (!conversationId) {
    if (previousConversationId) {
      return setCurrentSession(crypto.randomUUID());
    }
    return existingLocalId ?? setCurrentSession(crypto.randomUUID());
  }

  const aliases = await readConversationAliases();
  const aliasedSessionId = aliases[conversationId];
  if (aliasedSessionId) {
    return setCurrentSession(aliasedSessionId, conversationId);
  }

  const sessionId =
    existingLocalId && !previousConversationId
      ? existingLocalId
      : previousConversationId === conversationId && existingLocalId
        ? existingLocalId
        : crypto.randomUUID();

  aliases[conversationId] = sessionId;
  await browser.storage.local.set({
    [REPOBRIDGE_CONVERSATION_ALIASES_STORAGE_KEY]: aliases,
  });
  return setCurrentSession(sessionId, conversationId);
}
