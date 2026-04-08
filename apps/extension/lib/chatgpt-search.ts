export const SEARCH_MARKER = "# kavrith:search";

export interface KavrithSearchRequest {
  query: string;
}

export function parseKavrithSearch(
  text: string,
): KavrithSearchRequest | undefined {
  const [firstLine, ...queryLines] = text.replace(/\r\n?/g, "\n").split("\n");
  if (firstLine !== SEARCH_MARKER) return undefined;
  const query = queryLines.join("\n").trim();
  return query ? { query } : undefined;
}
