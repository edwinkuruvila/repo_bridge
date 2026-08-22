import type {
  ErrorResponse,
  InspectionContextRead,
  InspectionContextResponse,
  InspectionSearchResponse,
  NativeResponse,
} from "@repobridge/protocol";
import { PROTOCOL_VERSION } from "@repobridge/protocol";
import { findRipgrep } from "./executable-discovery.js";
import {
  MAX_READ_LINES,
  ReadFileError,
  readWorkspaceFile,
} from "./file-reader.js";
import { runProcess } from "./process-runner.js";
import { buildFilesystemRepositoryMap } from "./repository-map.js";
import {
  error,
  resolveTaskRoot,
  taskRootErrorResponse,
} from "./request-helpers.js";

async function searchRepository(
  id: string,
  cwd: string,
  query: string,
): Promise<NativeResponse> {
  const result = await runProcess(
    await findRipgrep(),
    ["-n", "--color=never", "--", query, "."],
    { cwd },
  );
  if (result.timedOut)
    return error(
      id,
      "PROCESS_TIMEOUT",
      "Repository search exceeded the 15 second timeout",
    );
  if (result.spawnError)
    return error(
      id,
      "INTERNAL_ERROR",
      `Failed to execute rg: ${result.spawnError}`,
    );
  if (result.exitCode !== 0 && result.exitCode !== 1)
    return error(
      id,
      "INTERNAL_ERROR",
      result.stderr.trim() || `rg exited with status ${result.exitCode}`,
    );
  return {
    version: PROTOCOL_VERSION,
    id,
    ok: true,
    result: {
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      durationMs: result.durationMs,
      truncated: result.truncated,
      noMatches: result.exitCode === 1,
    },
  };
}

const DEFAULT_CONTEXT_MAX_CHARS = 24_000;
const MIN_CONTEXT_MAX_CHARS = 1_000;
const MAX_CONTEXT_MAX_CHARS = 100_000;
const MAX_CONTEXT_SEARCHES = 8;
const MAX_CONTEXT_READS = 16;
const MAX_CONTEXT_NAME_SEARCHES = 16;

function mergeContextReads(
  reads: InspectionContextRead[],
): InspectionContextRead[] {
  const sorted = [...reads].sort(
    (left, right) =>
      left.path.localeCompare(right.path) ||
      left.startLine - right.startLine ||
      left.endLine - right.endLine,
  );
  const merged: InspectionContextRead[] = [];
  for (const read of sorted) {
    const previous = merged.at(-1);
    if (
      previous &&
      previous.path === read.path &&
      read.startLine <= previous.endLine + 1 &&
      Math.max(previous.endLine, read.endLine) - previous.startLine + 1 <=
        MAX_READ_LINES
    ) {
      previous.endLine = Math.max(previous.endLine, read.endLine);
    } else {
      merged.push({ ...read });
    }
  }
  return merged;
}

function fitContextContent(
  content: string,
  remainingChars: number,
): { content: string; used: number; truncated: boolean } {
  if (remainingChars <= 0)
    return { content: "", used: 0, truncated: content.length > 0 };
  if (content.length <= remainingChars) {
    return { content, used: content.length, truncated: false };
  }
  return {
    content: content.slice(0, remainingChars),
    used: remainingChars,
    truncated: true,
  };
}

async function buildInspectionContext(
  id: string,
  cwd: string,
  searches: string[],
  reads: InspectionContextRead[],
  searchesByName: string[],
  includeRepositoryMap: boolean,
  maxChars: number,
): Promise<InspectionContextResponse | ErrorResponse> {
  const sections: InspectionContextResponse["result"]["sections"] = [];
  let usedChars = 0;
  let truncated = false;
  for (const name of searchesByName) {
    if (usedChars >= maxChars) {
      truncated = true;
      break;
    }
    const response = await searchRepository(id, cwd, name);
    if (!response.ok) return response;
    const search = response as InspectionSearchResponse;
    const fitted = fitContextContent(
      search.result.stdout,
      maxChars - usedChars,
    );
    usedChars += fitted.used;
    truncated ||= fitted.truncated || search.result.truncated;
    sections.push({
      kind: "search",
      query: name,
      content: fitted.content,
      noMatches: search.result.noMatches,
      truncated: fitted.truncated || search.result.truncated,
    });
    if (fitted.truncated) break;
  }

  if (!truncated || usedChars < maxChars) {
    for (const read of mergeContextReads(reads)) {
      if (usedChars >= maxChars) {
        truncated = true;
        break;
      }
      try {
        const result = await readWorkspaceFile(
          cwd,
          read.path,
          read.startLine,
          read.endLine,
        );
        const fitted = fitContextContent(result.content, maxChars - usedChars);
        usedChars += fitted.used;
        truncated ||= fitted.truncated || result.truncated;
        sections.push({
          kind: "read",
          path: result.path,
          startLine: result.startLine,
          endLine: result.endLine,
          actualEndLine: result.actualEndLine,
          content: fitted.content,
          truncated: fitted.truncated || result.truncated,
        });
        if (fitted.truncated) break;
      } catch (cause) {
        if (cause instanceof ReadFileError)
          return error(id, "INVALID_REQUEST", cause.message);
        throw cause;
      }
    }
  }

  if (!truncated || usedChars < maxChars) {
    for (const query of searches) {
      if (usedChars >= maxChars) {
        truncated = true;
        break;
      }
      const response = await searchRepository(id, cwd, query);
      if (!response.ok) return response;
      const search = response as InspectionSearchResponse;
      const fitted = fitContextContent(
        search.result.stdout,
        maxChars - usedChars,
      );
      usedChars += fitted.used;
      truncated ||= fitted.truncated || search.result.truncated;
      sections.push({
        kind: "search",
        query,
        content: fitted.content,
        noMatches: search.result.noMatches,
        truncated: fitted.truncated || search.result.truncated,
      });
      if (fitted.truncated) break;
    }
  }

  if (includeRepositoryMap && (!truncated || usedChars < maxChars)) {
    const remaining = Math.max(0, maxChars - usedChars);
    const map = await buildFilesystemRepositoryMap(cwd, remaining);
    usedChars += map.usedChars;
    truncated ||= map.truncated;
    sections.push({
      kind: "repository-map",
      provider: "filesystem",
      content: map.content,
      entryCount: map.entryCount,
      truncated: map.truncated,
    });
  }

  return {
    version: PROTOCOL_VERSION,
    id,
    ok: true,
    result: { sections, maxChars, usedChars, truncated },
  };
}

export async function handleInspectionRequest(
  id: string,
  request: Record<string, unknown>,
): Promise<NativeResponse | undefined> {
  if (request.method === "inspection.search") {
    if (typeof request.rootPath !== "string" || request.rootPath.length === 0) {
      return error(
        id,
        "INVALID_REQUEST",
        "rootPath must be a non-empty string",
      );
    }
    if (
      typeof request.query !== "string" ||
      request.query.length === 0 ||
      request.query.length > 1000
    ) {
      return error(
        id,
        "INVALID_REQUEST",
        "query must be between 1 and 1000 characters",
      );
    }
    try {
      const cwd = await resolveTaskRoot(request.rootPath);
      return searchRepository(id, cwd, request.query);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      return error(
        id,
        "TASK_ROOT_NOT_FOUND",
        `Unable to resolve task root: ${message}`,
      );
    }
  }

  if (request.method === "inspection.read") {
    if (typeof request.rootPath !== "string" || request.rootPath.length === 0) {
      return error(
        id,
        "INVALID_REQUEST",
        "rootPath must be a non-empty string",
      );
    }
    if (
      typeof request.path !== "string" ||
      typeof request.startLine !== "number" ||
      !Number.isSafeInteger(request.startLine) ||
      typeof request.endLine !== "number" ||
      !Number.isSafeInteger(request.endLine)
    ) {
      return error(
        id,
        "INVALID_REQUEST",
        "path, startLine, and endLine are required",
      );
    }
    try {
      const workspace = await resolveTaskRoot(request.rootPath);
      return {
        version: PROTOCOL_VERSION,
        id,
        ok: true,
        result: await readWorkspaceFile(
          workspace,
          request.path,
          request.startLine,
          request.endLine,
        ),
      };
    } catch (cause) {
      if (cause instanceof ReadFileError)
        return error(id, "INVALID_REQUEST", cause.message);
      const rootError = taskRootErrorResponse(id, cause);
      if (rootError) return rootError;
      const message = cause instanceof Error ? cause.message : String(cause);
      return error(
        id,
        "INTERNAL_ERROR",
        `Unable to read workspace file: ${message}`,
      );
    }
  }

  if (request.method === "inspection.context") {
    if (typeof request.rootPath !== "string" || request.rootPath.length === 0) {
      return error(
        id,
        "INVALID_REQUEST",
        "rootPath must be a non-empty string",
      );
    }
    if (
      !Array.isArray(request.searches) ||
      request.searches.length > MAX_CONTEXT_SEARCHES ||
      !request.searches.every(
        (query) =>
          typeof query === "string" && query.length > 0 && query.length <= 1000,
      )
    ) {
      return error(
        id,
        "INVALID_REQUEST",
        `searches must contain at most ${MAX_CONTEXT_SEARCHES} non-empty queries up to 1000 characters each`,
      );
    }
    if (
      !Array.isArray(request.reads) ||
      request.reads.length > MAX_CONTEXT_READS ||
      !request.reads.every(
        (read) =>
          typeof read === "object" &&
          read !== null &&
          typeof read.path === "string" &&
          Number.isSafeInteger(read.startLine) &&
          Number.isSafeInteger(read.endLine) &&
          read.startLine >= 1 &&
          read.endLine >= read.startLine &&
          read.endLine - read.startLine + 1 <= MAX_READ_LINES,
      )
    ) {
      return error(
        id,
        "INVALID_REQUEST",
        `reads must contain at most ${MAX_CONTEXT_READS} valid workspace-relative ranges of up to ${MAX_READ_LINES} lines`,
      );
    }
    const searchesByName =
      request.searchesByName === undefined ? [] : request.searchesByName;
    if (
      !Array.isArray(searchesByName) ||
      searchesByName.length > MAX_CONTEXT_NAME_SEARCHES ||
      !searchesByName.every(
        (name) =>
          typeof name === "string" && name.length > 0 && name.length <= 500,
      )
    ) {
      return error(
        id,
        "INVALID_REQUEST",
        `searchesByName must contain at most ${MAX_CONTEXT_NAME_SEARCHES} non-empty queries up to 500 characters each`,
      );
    }
    if (
      request.includeRepositoryMap !== undefined &&
      typeof request.includeRepositoryMap !== "boolean"
    ) {
      return error(
        id,
        "INVALID_REQUEST",
        "includeRepositoryMap must be a boolean when provided",
      );
    }
    const includeRepositoryMap = request.includeRepositoryMap === true;
    if (
      request.searches.length === 0 &&
      request.reads.length === 0 &&
      searchesByName.length === 0 &&
      !includeRepositoryMap
    ) {
      return error(
        id,
        "INVALID_REQUEST",
        "inspection.context requires at least one search, read, name search, or repository map",
      );
    }
    const maxChars =
      typeof request.maxChars === "number"
        ? request.maxChars
        : DEFAULT_CONTEXT_MAX_CHARS;
    if (
      !Number.isSafeInteger(maxChars) ||
      maxChars < MIN_CONTEXT_MAX_CHARS ||
      maxChars > MAX_CONTEXT_MAX_CHARS
    ) {
      return error(
        id,
        "INVALID_REQUEST",
        `maxChars must be an integer between ${MIN_CONTEXT_MAX_CHARS} and ${MAX_CONTEXT_MAX_CHARS}`,
      );
    }
    try {
      const workspace = await resolveTaskRoot(request.rootPath);
      return await buildInspectionContext(
        id,
        workspace,
        request.searches,
        request.reads,
        searchesByName,
        includeRepositoryMap,
        maxChars,
      );
    } catch (cause) {
      const rootError = taskRootErrorResponse(id, cause);
      if (rootError) return rootError;
      const message = cause instanceof Error ? cause.message : String(cause);
      return error(
        id,
        "INTERNAL_ERROR",
        `Unable to build workspace context: ${message}`,
      );
    }
  }

  return undefined;
}
