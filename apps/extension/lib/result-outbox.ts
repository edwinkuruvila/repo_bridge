export interface ResultOutboxEntry {
  directiveId: string;
  result: string;
  createdAt: number;
}

export type ResultOutboxByChat = Record<
  string,
  Record<string, ResultOutboxEntry>
>;

export function enqueueResult(
  byChat: ResultOutboxByChat,
  sessionId: string,
  directiveId: string,
  result: string,
  createdAt = Date.now(),
): ResultOutboxByChat {
  return {
    ...byChat,
    [sessionId]: {
      ...(byChat[sessionId] ?? {}),
      [directiveId]: { directiveId, result, createdAt },
    },
  };
}

export function removeResult(
  byChat: ResultOutboxByChat,
  sessionId: string,
  directiveId: string,
): ResultOutboxByChat {
  const current = byChat[sessionId];
  if (!current?.[directiveId]) return byChat;
  const nextChat = { ...current };
  delete nextChat[directiveId];
  const next = { ...byChat };
  if (Object.keys(nextChat).length === 0) {
    delete next[sessionId];
  } else {
    next[sessionId] = nextChat;
  }
  return next;
}

export function pendingResult(
  byChat: ResultOutboxByChat,
  sessionId: string,
  directiveId: string,
): ResultOutboxEntry | undefined {
  return byChat[sessionId]?.[directiveId];
}
