export interface KavrithPatchRequest {
  patch: string;
}

export function parseKavrithPatch(
  text: string,
): KavrithPatchRequest | undefined {
  const normalized = text.replace(/\r\n?/g, "\n");
  const prefix = "# kavrith:patch\n";
  if (!normalized.startsWith(prefix)) return undefined;
  const patch = normalized.slice(prefix.length).trimEnd();
  return patch.startsWith("*** Begin Patch\n") &&
    patch.endsWith("*** End Patch")
    ? { patch }
    : undefined;
}

export function patchPreview(patch: string): {
  files: string[];
  additions: number;
  deletions: number;
} {
  const files = [...patch.matchAll(/^\*\*\* (?:Update|Add) File: (.+)$/gm)].map(
    (match) => match[1] ?? "",
  );
  return {
    files,
    additions: [...patch.matchAll(/^\+(?!\+\+)/gm)].length,
    deletions: [...patch.matchAll(/^-(?!---)/gm)].length,
  };
}
