export function conversationSessionIdFromUrl(
  rawUrl: string,
): string | undefined {
  try {
    const url = new URL(rawUrl);
    if (url.hostname !== "chatgpt.com") return undefined;
    const sessionId = /^(?:\/c\/[^/]+|\/g\/g-p-[^/]+\/c\/[^/]+)/.exec(
      url.pathname,
    )?.[0];
    if (!sessionId) return undefined;

    // ChatGPT can briefly navigate new chats through a provisional
    // /c/WEB:<uuid> route before replacing it with the persisted
    // conversation id. Never bind RepoBridge state to that transient id.
    if (sessionId.split("/").at(-1)?.startsWith("WEB:")) return undefined;

    return sessionId;
  } catch {
    return undefined;
  }
}

export function isDraftChatUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    return (
      url.hostname === "chatgpt.com" &&
      (url.pathname === "/" ||
        /^\/g\/g-p-[^/]+\/project\/?$/.test(url.pathname))
    );
  } catch {
    return false;
  }
}
