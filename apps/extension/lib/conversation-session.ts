export function conversationSessionIdFromUrl(
  rawUrl: string,
): string | undefined {
  try {
    const url = new URL(rawUrl);
    if (url.hostname !== "chatgpt.com") return undefined;
    const sessionId = /^\/c\/[^/]+/.exec(url.pathname)?.[0];
    if (!sessionId) return undefined;

    // ChatGPT can briefly navigate new chats through a provisional
    // /c/WEB:<uuid> route before replacing it with the persisted
    // conversation id. Never bind Kavrith state to that transient id.
    if (sessionId.startsWith("/c/WEB:")) return undefined;

    return sessionId;
  } catch {
    return undefined;
  }
}
