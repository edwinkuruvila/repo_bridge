import { browser } from "wxt/browser";
import { conversationSessionIdFromUrl } from "./conversation-session";

const KAVRITH_SESSION_ID_SESSION_KEY = "kavrithSessionId";
const KAVRITH_CONVERSATION_SESSION_KEY = "kavrithConversationSessionId";
const KAVRITH_CONVERSATION_ALIASES_STORAGE_KEY = "kavrithConversationAliases";

type ConversationAliases = Record<string, string>;

function setCurrentSession(sessionId: string, conversationId?: string): string {
  sessionStorage.setItem(KAVRITH_SESSION_ID_SESSION_KEY, sessionId);
  if (conversationId) {
    sessionStorage.setItem(KAVRITH_CONVERSATION_SESSION_KEY, conversationId);
  } else {
    sessionStorage.removeItem(KAVRITH_CONVERSATION_SESSION_KEY);
  }
  return sessionId;
}

async function readConversationAliases(): Promise<ConversationAliases> {
  const stored = await browser.storage.local.get(
    KAVRITH_CONVERSATION_ALIASES_STORAGE_KEY,
  );
  const value = stored[KAVRITH_CONVERSATION_ALIASES_STORAGE_KEY];
  return typeof value === "object" && value !== null
    ? (value as ConversationAliases)
    : {};
}

export function kavrithSessionId(): string {
  const existing =
    sessionStorage.getItem(KAVRITH_SESSION_ID_SESSION_KEY) ?? undefined;
  if (existing) return existing;
  return setCurrentSession(crypto.randomUUID());
}

export async function syncKavrithSessionForCurrentPage(): Promise<string> {
  const conversationId = conversationSessionIdFromUrl(location.href);
  const previousConversationId =
    sessionStorage.getItem(KAVRITH_CONVERSATION_SESSION_KEY) ?? undefined;
  const existingLocalId =
    sessionStorage.getItem(KAVRITH_SESSION_ID_SESSION_KEY) ?? undefined;

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
    [KAVRITH_CONVERSATION_ALIASES_STORAGE_KEY]: aliases,
  });
  return setCurrentSession(sessionId, conversationId);
}
