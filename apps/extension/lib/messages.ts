export const ACCESS_MODE_STORAGE_KEY = "accessMode";
export type AccessMode = "approval" | "full";
export type MutationAuthorization = "approved" | "full";

interface KavrithChatMessage {
  sessionId?: string;
}

export interface KavrithSearchMessage extends KavrithChatMessage {
  type: "KAVRITH_SEARCH";
  query: string;
}

export interface KavrithReadMessage extends KavrithChatMessage {
  type: "KAVRITH_READ";
  path: string;
  startLine: number;
  endLine: number;
}
export interface KavrithContextMessage extends KavrithChatMessage {
  type: "KAVRITH_CONTEXT";
  searches: string[];
  reads: Array<{ path: string; startLine: number; endLine: number }>;
  searchesByName?: string[];
  includeRepositoryMap?: boolean;
  maxChars?: number;
}
export interface KavrithPatchMessage extends KavrithChatMessage {
  type: "KAVRITH_PATCH";
  patch: string;
  authorization: MutationAuthorization;
}
export interface KavrithRunMessage extends KavrithChatMessage {
  type: "KAVRITH_RUN";
  command: string;
  authorization: MutationAuthorization;
}
export interface KavrithUndoMessage extends KavrithChatMessage {
  type: "KAVRITH_UNDO";
  checkpointId: string;
  authorization: MutationAuthorization;
}
export interface KavrithGitStatusMessage extends KavrithChatMessage {
  type: "KAVRITH_GIT_STATUS";
}
export interface KavrithGitDiffMessage extends KavrithChatMessage {
  type: "KAVRITH_GIT_DIFF";
  staged: boolean;
}
export interface KavrithExecMessage extends KavrithChatMessage {
  type: "KAVRITH_EXEC";
  executable: string;
  args: string[];
  authorization: MutationAuthorization;
}

export function isKavrithSearchMessage(
  message: unknown,
): message is KavrithSearchMessage {
  if (typeof message !== "object" || message === null) return false;
  const candidate = message as Partial<KavrithSearchMessage>;
  return (
    candidate.type === "KAVRITH_SEARCH" && typeof candidate.query === "string"
  );
}

export function isKavrithReadMessage(
  message: unknown,
): message is KavrithReadMessage {
  if (typeof message !== "object" || message === null) return false;
  const candidate = message as Partial<KavrithReadMessage>;
  return (
    candidate.type === "KAVRITH_READ" &&
    typeof candidate.path === "string" &&
    Number.isSafeInteger(candidate.startLine) &&
    Number.isSafeInteger(candidate.endLine)
  );
}

export function isKavrithContextMessage(
  message: unknown,
): message is KavrithContextMessage {
  if (typeof message !== "object" || message === null) return false;
  const candidate = message as Partial<KavrithContextMessage>;
  return (
    candidate.type === "KAVRITH_CONTEXT" &&
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
export function isKavrithPatchMessage(
  message: unknown,
): message is KavrithPatchMessage {
  if (typeof message !== "object" || message === null) return false;
  const candidate = message as Partial<KavrithPatchMessage>;
  return (
    candidate.type === "KAVRITH_PATCH" &&
    typeof candidate.patch === "string" &&
    (candidate.authorization === "approved" ||
      candidate.authorization === "full")
  );
}
export function isKavrithRunMessage(
  message: unknown,
): message is KavrithRunMessage {
  if (typeof message !== "object" || message === null) return false;
  const candidate = message as Partial<KavrithRunMessage>;
  return (
    candidate.type === "KAVRITH_RUN" &&
    typeof candidate.command === "string" &&
    (candidate.authorization === "approved" ||
      candidate.authorization === "full")
  );
}
export function isKavrithUndoMessage(
  message: unknown,
): message is KavrithUndoMessage {
  if (typeof message !== "object" || message === null) return false;
  const candidate = message as Partial<KavrithUndoMessage>;
  return (
    candidate.type === "KAVRITH_UNDO" &&
    typeof candidate.checkpointId === "string" &&
    (candidate.authorization === "approved" ||
      candidate.authorization === "full")
  );
}
export function isKavrithGitStatusMessage(
  message: unknown,
): message is KavrithGitStatusMessage {
  if (typeof message !== "object" || message === null) return false;
  const candidate = message as Partial<KavrithGitStatusMessage>;
  return candidate.type === "KAVRITH_GIT_STATUS";
}
export function isKavrithGitDiffMessage(
  message: unknown,
): message is KavrithGitDiffMessage {
  if (typeof message !== "object" || message === null) return false;
  const candidate = message as Partial<KavrithGitDiffMessage>;
  return (
    candidate.type === "KAVRITH_GIT_DIFF" &&
    typeof candidate.staged === "boolean"
  );
}

export function isKavrithExecMessage(
  message: unknown,
): message is KavrithExecMessage {
  if (typeof message !== "object" || message === null) return false;
  const candidate = message as Partial<KavrithExecMessage>;
  return (
    candidate.type === "KAVRITH_EXEC" &&
    typeof candidate.executable === "string" &&
    Array.isArray(candidate.args) &&
    candidate.args.every((arg) => typeof arg === "string") &&
    (candidate.authorization === "approved" ||
      candidate.authorization === "full")
  );
}
