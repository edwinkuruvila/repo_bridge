export type DirectiveLifecycleState =
  | "discovered"
  | "pending"
  | "running"
  | "completed"
  | "rejected"
  | "failed";

export interface DirectiveLifecycleRecord {
  state: DirectiveLifecycleState;
  updatedAt: number;
}

export type DirectiveLifecycleByChat = Record<
  string,
  Record<string, DirectiveLifecycleRecord>
>;

export function hashDirectiveText(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function directiveOccurrenceId(
  assistantTurnIdentity: number | string,
  codeIndex: number,
  type: string,
  text: string,
): string {
  return `${assistantTurnIdentity}:${codeIndex}:${type}:${hashDirectiveText(text)}`;
}

function lifecycleRecord(
  state: DirectiveLifecycleState,
  updatedAt = Date.now(),
): DirectiveLifecycleRecord {
  return { state, updatedAt };
}

export function lifecycleState(
  byChat: DirectiveLifecycleByChat,
  sessionId: string,
  directiveId: string,
): DirectiveLifecycleState | undefined {
  return byChat[sessionId]?.[directiveId]?.state;
}

export function withLifecycleState(
  byChat: DirectiveLifecycleByChat,
  sessionId: string,
  directiveId: string,
  state: DirectiveLifecycleState,
  updatedAt = Date.now(),
): DirectiveLifecycleByChat {
  return {
    ...byChat,
    [sessionId]: {
      ...(byChat[sessionId] ?? {}),
      [directiveId]: lifecycleRecord(state, updatedAt),
    },
  };
}
