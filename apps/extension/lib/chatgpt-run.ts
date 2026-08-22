export interface RepoBridgeRunRequest {
  command: string;
}

export function parseRepoBridgeRun(
  text: string,
): RepoBridgeRunRequest | undefined {
  const prefix = "# repobridge:run\n";
  if (!text.startsWith(prefix)) return undefined;
  const command = text.slice(prefix.length).trim();
  return command && command.length <= 8_000 && !command.includes("\0")
    ? { command }
    : undefined;
}
