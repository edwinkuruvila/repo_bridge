export interface KavrithRunRequest {
  command: string;
}

export function parseKavrithRun(text: string): KavrithRunRequest | undefined {
  const prefix = "# kavrith:run\n";
  if (!text.startsWith(prefix)) return undefined;
  const command = text.slice(prefix.length).trim();
  return command && command.length <= 8_000 && !command.includes("\0")
    ? { command }
    : undefined;
}
