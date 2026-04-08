import { readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

export const MAX_READ_FILE_BYTES = 1024 * 1024;
export const MAX_READ_LINES = 500;

export class ReadFileError extends Error {}

function isWithin(parent: string, candidate: string): boolean {
  const path = relative(parent, candidate);
  return (
    path !== "" &&
    path !== ".." &&
    !path.startsWith(`..${sep}`) &&
    !isAbsolute(path)
  );
}

export interface ReadFileResult {
  path: string;
  startLine: number;
  endLine: number;
  actualEndLine: number;
  content: string;
  truncated: boolean;
}

export async function readWorkspaceFile(
  workspacePath: string,
  requestedPath: string,
  startLine: number,
  endLine: number,
): Promise<ReadFileResult> {
  if (
    !requestedPath ||
    requestedPath.includes("\0") ||
    isAbsolute(requestedPath)
  ) {
    throw new ReadFileError("path must be a non-empty workspace-relative path");
  }
  if (
    !Number.isSafeInteger(startLine) ||
    !Number.isSafeInteger(endLine) ||
    startLine < 1 ||
    endLine < startLine
  ) {
    throw new ReadFileError(
      "line numbers must be positive integers with endLine at least startLine",
    );
  }
  if (endLine - startLine + 1 > MAX_READ_LINES) {
    throw new ReadFileError(
      `line range may not exceed ${MAX_READ_LINES} lines`,
    );
  }

  const lexicalPath = resolve(workspacePath, requestedPath);
  if (!isWithin(workspacePath, lexicalPath))
    throw new ReadFileError("path must remain inside the registered workspace");

  let canonicalPath: string;
  try {
    canonicalPath = await realpath(lexicalPath);
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT")
      throw new ReadFileError("file does not exist");
    throw cause;
  }
  if (!isWithin(workspacePath, canonicalPath))
    throw new ReadFileError("resolved path escapes the registered workspace");

  const details = await stat(canonicalPath);
  if (!details.isFile())
    throw new ReadFileError("path must identify a regular file");
  if (details.size > MAX_READ_FILE_BYTES)
    throw new ReadFileError(
      `file exceeds the ${MAX_READ_FILE_BYTES} byte read limit`,
    );

  const source = await readFile(canonicalPath, "utf8");
  const normalized = source.replace(/\r\n?/g, "\n");
  const lines =
    normalized.length === 0
      ? []
      : normalized.endsWith("\n")
        ? normalized.slice(0, -1).split("\n")
        : normalized.split("\n");
  const actualEndLine = Math.min(endLine, lines.length);
  const content =
    actualEndLine < startLine
      ? ""
      : lines
          .slice(startLine - 1, actualEndLine)
          .map((line, index) => `${startLine + index} | ${line}`)
          .join("\n");

  return {
    path: requestedPath,
    startLine,
    endLine,
    actualEndLine,
    content,
    truncated: false,
  };
}
