export interface RepoBridgeContextRead {
  path: string;
  startLine: number;
  endLine: number;
}

type ContextReadInput = RepoBridgeContextRead | string;

export interface RepoBridgeContextRequest {
  searches: string[];
  reads: RepoBridgeContextRead[];
  searchesByName?: string[];
  includeRepositoryMap?: boolean;
  maxChars?: number;
}

type ContextSearchInput =
  | string
  | {
      query?: unknown;
      q?: unknown;
    };

function normalizeSearches(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.length > MAX_SEARCHES) return undefined;
  const searches: string[] = [];
  for (const entry of value as ContextSearchInput[]) {
    const query =
      typeof entry === "string"
        ? entry
        : typeof entry === "object" && entry !== null
          ? typeof entry.query === "string"
            ? entry.query
            : typeof entry.q === "string"
              ? entry.q
              : undefined
          : undefined;
    if (
      query === undefined ||
      query.length === 0 ||
      query.length > MAX_QUERY_LENGTH ||
      query.includes("\0")
    ) {
      return undefined;
    }
    searches.push(query);
  }
  return searches;
}

const MAX_SEARCHES = 8;
const MAX_READS = 16;
const MAX_NAME_SEARCHES = 16;
const MAX_QUERY_LENGTH = 1_000;
const MAX_NAME_SEARCH_LENGTH = 500;
const MIN_MAX_CHARS = 1_000;
const MAX_MAX_CHARS = 100_000;

function normalizeReads(value: unknown): RepoBridgeContextRead[] | undefined {
  if (!Array.isArray(value) || value.length > MAX_READS) return undefined;
  const reads: RepoBridgeContextRead[] = [];
  for (const entry of value as ContextReadInput[]) {
    if (typeof entry === "string") {
      if (entry.length === 0 || entry.includes("\0")) return undefined;
      reads.push({ path: entry, startLine: 1, endLine: 500 });
      continue;
    }
    if (
      typeof entry !== "object" ||
      entry === null ||
      typeof entry.path !== "string" ||
      entry.path.length === 0 ||
      entry.path.includes("\0") ||
      !Number.isSafeInteger(entry.startLine) ||
      !Number.isSafeInteger(entry.endLine) ||
      entry.startLine < 1 ||
      entry.endLine < entry.startLine
    ) {
      return undefined;
    }
    reads.push({
      path: entry.path,
      startLine: entry.startLine,
      endLine: entry.endLine,
    });
  }
  return reads;
}

export function parseRepoBridgeContext(
  text: string,
): RepoBridgeContextRequest | undefined {
  const prefix = "# repobridge:context\n";
  const normalized = text.replace(/\r\n?/g, "\n");
  if (!normalized.startsWith(prefix)) return undefined;

  try {
    const value = JSON.parse(normalized.slice(prefix.length).trim()) as unknown;
    if (typeof value !== "object" || value === null) return undefined;

    const candidate = value as Partial<RepoBridgeContextRequest>;
    const searches = normalizeSearches(candidate.searches ?? []);
    if (!searches) return undefined;
    const reads = normalizeReads(candidate.reads ?? []);
    if (!reads) return undefined;
    const searchesByName = candidate.searchesByName ?? [];
    const includeRepositoryMap = candidate.includeRepositoryMap ?? false;
    if (
      !Array.isArray(searchesByName) ||
      searchesByName.length > MAX_NAME_SEARCHES ||
      searchesByName.some(
        (name) =>
          typeof name !== "string" ||
          name.length === 0 ||
          name.length > MAX_NAME_SEARCH_LENGTH ||
          name.includes("\0"),
      ) ||
      typeof includeRepositoryMap !== "boolean" ||
      (searches.length === 0 &&
        reads.length === 0 &&
        searchesByName.length === 0 &&
        !includeRepositoryMap) ||
      (candidate.maxChars !== undefined &&
        (!Number.isSafeInteger(candidate.maxChars) ||
          candidate.maxChars < MIN_MAX_CHARS ||
          candidate.maxChars > MAX_MAX_CHARS))
    ) {
      return undefined;
    }

    return {
      searches,
      reads,
      ...(searchesByName.length === 0
        ? {}
        : { searchesByName: [...searchesByName] }),
      ...(includeRepositoryMap ? { includeRepositoryMap: true } : {}),
      ...(candidate.maxChars === undefined
        ? {}
        : { maxChars: candidate.maxChars }),
    };
  } catch {
    return undefined;
  }
}
