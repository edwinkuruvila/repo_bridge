export type ComposerRollbackDecision = "restore" | "leave-user-changes";

function normalizedComposerText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trimEnd();
}

export function composerRollbackDecision(
  original: string,
  inserted: string,
  current: string,
): ComposerRollbackDecision {
  const normalizedCurrent = normalizedComposerText(current);
  const normalizedInserted = normalizedComposerText(inserted);
  const normalizedOriginal = normalizedComposerText(original);
  return normalizedCurrent === normalizedInserted &&
    normalizedInserted !== normalizedOriginal
    ? "restore"
    : "leave-user-changes";
}

export function firstUsableCandidate<T>(
  candidates: Iterable<T>,
  isUsable: (candidate: T) => boolean,
): T | undefined {
  for (const candidate of candidates) {
    if (isUsable(candidate)) return candidate;
  }
  return undefined;
}
