export interface RepoBridgeExecRequest {
  executable: string;
  args: string[];
}

const MAX_EXECUTABLE_LENGTH = 1_000;
const MAX_ARGS = 256;
const MAX_ARG_LENGTH = 8_000;

export function parseRepoBridgeExec(
  text: string,
): RepoBridgeExecRequest | undefined {
  const normalized = text.replace(/\r\n?/g, "\n");
  const match = normalized.match(/^# repobridge:exec(?:\n|[ \t]+)([\s\S]*)$/);
  if (!match) return undefined;
  try {
    const value = JSON.parse((match[1] ?? "").trim()) as unknown;
    if (typeof value !== "object" || value === null) return undefined;
    const candidate = value as Partial<RepoBridgeExecRequest>;
    if (
      typeof candidate.executable !== "string" ||
      candidate.executable.length === 0 ||
      candidate.executable.length > MAX_EXECUTABLE_LENGTH ||
      candidate.executable.includes("\0") ||
      !Array.isArray(candidate.args) ||
      candidate.args.length > MAX_ARGS ||
      candidate.args.some(
        (arg) =>
          typeof arg !== "string" ||
          arg.length > MAX_ARG_LENGTH ||
          arg.includes("\0"),
      )
    ) {
      return undefined;
    }
    return {
      executable: candidate.executable,
      args: [...candidate.args],
    };
  } catch {
    return undefined;
  }
}
