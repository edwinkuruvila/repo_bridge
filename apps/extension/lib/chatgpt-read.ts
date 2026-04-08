export interface KavrithReadRequest {
  path: string;
  startLine: number;
  endLine: number;
}

function buildReadRequest(
  path: string,
  startText: string,
  endText: string,
): KavrithReadRequest | undefined {
  if (!path || !/^[1-9]\d*$/.test(startText) || !/^[1-9]\d*$/.test(endText)) {
    return undefined;
  }

  const startLine = Number(startText);
  const endLine = Number(endText);
  return Number.isSafeInteger(startLine) && Number.isSafeInteger(endLine)
    ? { path, startLine, endLine }
    : undefined;
}

export function parseKavrithRead(text: string): KavrithReadRequest | undefined {
  const normalized = text.replace(/\r\n?/g, "\n").trim();

  const oneLine = normalized.match(
    /^# kavrith:read\s+(.+?)\s+([1-9]\d*)\s+([1-9]\d*)$/,
  );
  if (oneLine) {
    return buildReadRequest(
      oneLine[1]?.trim() ?? "",
      oneLine[2] ?? "",
      oneLine[3] ?? "",
    );
  }

  const lines = normalized.split("\n");
  if (lines.length !== 4 || lines[0] !== "# kavrith:read") return undefined;

  return buildReadRequest(
    lines[1]?.trim() ?? "",
    lines[2]?.trim() ?? "",
    lines[3]?.trim() ?? "",
  );
}
