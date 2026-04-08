export type ComposerRollbackDecision = "restore" | "leave-user-changes";

export function composerRollbackDecision(
  original: string,
  inserted: string,
  current: string,
): ComposerRollbackDecision {
  return current === inserted && inserted !== original
    ? "restore"
    : "leave-user-changes";
}
