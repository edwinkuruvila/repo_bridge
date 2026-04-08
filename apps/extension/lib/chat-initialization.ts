import { browser } from "wxt/browser";
import { ACCESS_MODE_STORAGE_KEY, type AccessMode } from "./messages";

const CHAT_INITIALIZATIONS_STORAGE_KEY = "chatInitializations";

export interface ChatInitialization {
  sessionId: string;
  rootPath: string;
  accessMode: AccessMode;
  initializedAt: string;
  bootstrappedAt?: string;
}

type StoredChatInitializations = Record<string, ChatInitialization>;

function parseChatInitialization(
  sessionId: string,
  value: unknown,
): ChatInitialization | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const candidate = value as Partial<ChatInitialization>;
  if (
    candidate.sessionId !== sessionId ||
    typeof candidate.rootPath !== "string" ||
    candidate.rootPath.length === 0 ||
    candidate.rootPath.includes("\0") ||
    (candidate.accessMode !== "approval" && candidate.accessMode !== "full") ||
    typeof candidate.initializedAt !== "string" ||
    (candidate.bootstrappedAt !== undefined &&
      typeof candidate.bootstrappedAt !== "string")
  ) {
    return undefined;
  }
  return {
    sessionId,
    rootPath: candidate.rootPath,
    accessMode: candidate.accessMode,
    initializedAt: candidate.initializedAt,
    ...(candidate.bootstrappedAt
      ? { bootstrappedAt: candidate.bootstrappedAt }
      : {}),
  };
}

async function readInitializations(): Promise<StoredChatInitializations> {
  const stored = await browser.storage.local.get(
    CHAT_INITIALIZATIONS_STORAGE_KEY,
  );
  const value = stored[CHAT_INITIALIZATIONS_STORAGE_KEY];
  return typeof value === "object" && value !== null
    ? (value as StoredChatInitializations)
    : {};
}

export async function getChatInitialization(
  sessionId: string,
): Promise<ChatInitialization | undefined> {
  const initializations = await readInitializations();
  const value = initializations[sessionId];
  const parsed = parseChatInitialization(sessionId, value);
  return parsed;
}

export async function setChatInitialization(
  initialization: ChatInitialization,
): Promise<void> {
  const initializations = await readInitializations();
  initializations[initialization.sessionId] = initialization;
  await browser.storage.local.set({
    [CHAT_INITIALIZATIONS_STORAGE_KEY]: initializations,
  });
}

export async function popupDefaults(): Promise<{ accessMode: AccessMode }> {
  const stored = await browser.storage.local.get(ACCESS_MODE_STORAGE_KEY);
  return {
    accessMode:
      stored[ACCESS_MODE_STORAGE_KEY] === "full" ? "full" : "approval",
  };
}
