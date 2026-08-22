export const SEARCH_MARKER = "# repobridge:search";

export interface RepoBridgeSearchRequest {
  query: string;
}

export function parseRepoBridgeSearch(
  text: string,
): RepoBridgeSearchRequest | undefined {
  const [firstLine, ...queryLines] = text.replace(/\r\n?/g, "\n").split("\n");
  if (firstLine !== SEARCH_MARKER) return undefined;
  const query = queryLines.join("\n").trim();
  return query ? { query } : undefined;
}
