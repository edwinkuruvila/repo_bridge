export const ACCESS_MODE_STORAGE_KEY = "accessMode";
export type AccessMode = "approval" | "full";
export type MutationAuthorization = "approved" | "full";

interface RepoBridgeChatMessage {
  sessionId?: string;
}

export interface RepoBridgeSearchMessage extends RepoBridgeChatMessage {
  type: "REPOBRIDGE_SEARCH";
  query: string;
}

export interface RepoBridgeReadMessage extends RepoBridgeChatMessage {
  type: "REPOBRIDGE_READ";
  path: string;
  startLine: number;
  endLine: number;
}
export interface RepoBridgeContextMessage extends RepoBridgeChatMessage {
  type: "REPOBRIDGE_CONTEXT";
  searches: string[];
  reads: Array<{ path: string; startLine: number; endLine: number }>;
  searchesByName?: string[];
  includeRepositoryMap?: boolean;
  maxChars?: number;
}
export interface RepoBridgePatchMessage extends RepoBridgeChatMessage {
  type: "REPOBRIDGE_PATCH";
  patch: string;
  authorization: MutationAuthorization;
}
export interface RepoBridgeRunMessage extends RepoBridgeChatMessage {
  type: "REPOBRIDGE_RUN";
  command: string;
  authorization: MutationAuthorization;
}
export interface RepoBridgeUndoMessage extends RepoBridgeChatMessage {
  type: "REPOBRIDGE_UNDO";
  checkpointId: string;
  authorization: MutationAuthorization;
}
export interface RepoBridgeGitStatusMessage extends RepoBridgeChatMessage {
  type: "REPOBRIDGE_GIT_STATUS";
}
export interface RepoBridgeGitDiffMessage extends RepoBridgeChatMessage {
  type: "REPOBRIDGE_GIT_DIFF";
  staged: boolean;
}
export interface RepoBridgeExecMessage extends RepoBridgeChatMessage {
  type: "REPOBRIDGE_EXEC";
  executable: string;
  args: string[];
  authorization: MutationAuthorization;
}

export function isRepoBridgeSearchMessage(
  message: unknown,
): message is RepoBridgeSearchMessage {
  if (typeof message !== "object" || message === null) return false;
  const candidate = message as Partial<RepoBridgeSearchMessage>;
  return (
    candidate.type === "REPOBRIDGE_SEARCH" && typeof candidate.query === "string"
  );
}

export function isRepoBridgeReadMessage(
  message: unknown,
): message is RepoBridgeReadMessage {
  if (typeof message !== "object" || message === null) return false;
  const candidate = message as Partial<RepoBridgeReadMessage>;
  return (
    candidate.type === "REPOBRIDGE_READ" &&
    typeof candidate.path === "string" &&
    Number.isSafeInteger(candidate.startLine) &&
    Number.isSafeInteger(candidate.endLine)
  );
}

export function isRepoBridgeContextMessage(
  message: unknown,
): message is RepoBridgeContextMessage {
  if (typeof message !== "object" || message === null) return false;
  const candidate = message as Partial<RepoBridgeContextMessage>;
  return (
    candidate.type === "REPOBRIDGE_CONTEXT" &&
    Array.isArray(candidate.searches) &&
    candidate.searches.every((query) => typeof query === "string") &&
    Array.isArray(candidate.reads) &&
    candidate.reads.every(
      (read) =>
        typeof read === "object" &&
        read !== null &&
        typeof read.path === "string" &&
        Number.isSafeInteger(read.startLine) &&
        Number.isSafeInteger(read.endLine),
    ) &&
    (candidate.searchesByName === undefined ||
      (Array.isArray(candidate.searchesByName) &&
        candidate.searchesByName.every((name) => typeof name === "string"))) &&
    (candidate.includeRepositoryMap === undefined ||
      typeof candidate.includeRepositoryMap === "boolean") &&
    (candidate.maxChars === undefined ||
      Number.isSafeInteger(candidate.maxChars))
  );
}
export function isRepoBridgePatchMessage(
  message: unknown,
): message is RepoBridgePatchMessage {
  if (typeof message !== "object" || message === null) return false;
  const candidate = message as Partial<RepoBridgePatchMessage>;
  return (
    candidate.type === "REPOBRIDGE_PATCH" &&
    typeof candidate.patch === "string" &&
    (candidate.authorization === "approved" ||
      candidate.authorization === "full")
  );
}
export function isRepoBridgeRunMessage(
  message: unknown,
): message is RepoBridgeRunMessage {
  if (typeof message !== "object" || message === null) return false;
  const candidate = message as Partial<RepoBridgeRunMessage>;
  return (
    candidate.type === "REPOBRIDGE_RUN" &&
    typeof candidate.command === "string" &&
    (candidate.authorization === "approved" ||
      candidate.authorization === "full")
  );
}
export function isRepoBridgeUndoMessage(
  message: unknown,
): message is RepoBridgeUndoMessage {
  if (typeof message !== "object" || message === null) return false;
  const candidate = message as Partial<RepoBridgeUndoMessage>;
  return (
    candidate.type === "REPOBRIDGE_UNDO" &&
    typeof candidate.checkpointId === "string" &&
    (candidate.authorization === "approved" ||
      candidate.authorization === "full")
  );
}
export function isRepoBridgeGitStatusMessage(
  message: unknown,
): message is RepoBridgeGitStatusMessage {
  if (typeof message !== "object" || message === null) return false;
  const candidate = message as Partial<RepoBridgeGitStatusMessage>;
  return candidate.type === "REPOBRIDGE_GIT_STATUS";
}
export function isRepoBridgeGitDiffMessage(
  message: unknown,
): message is RepoBridgeGitDiffMessage {
  if (typeof message !== "object" || message === null) return false;
  const candidate = message as Partial<RepoBridgeGitDiffMessage>;
  return (
    candidate.type === "REPOBRIDGE_GIT_DIFF" &&
    typeof candidate.staged === "boolean"
  );
}

export function isRepoBridgeExecMessage(
  message: unknown,
): message is RepoBridgeExecMessage {
  if (typeof message !== "object" || message === null) return false;
  const candidate = message as Partial<RepoBridgeExecMessage>;
  return (
    candidate.type === "REPOBRIDGE_EXEC" &&
    typeof candidate.executable === "string" &&
    Array.isArray(candidate.args) &&
    candidate.args.every((arg) => typeof arg === "string") &&
    (candidate.authorization === "approved" ||
      candidate.authorization === "full")
  );
}
