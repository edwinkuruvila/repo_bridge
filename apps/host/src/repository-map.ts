import { readdir } from "node:fs/promises";
import { join } from "node:path";

const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".output",
  "build",
  "coverage",
  "dist",
  "node_modules",
]);

const MAX_ENTRIES = 5_000;

interface RepositoryMapEntry {
  path: string;
  directory: boolean;
}

async function collectEntries(
  rootPath: string,
  relativePath = "",
  entries: RepositoryMapEntry[] = [],
): Promise<RepositoryMapEntry[]> {
  if (entries.length >= MAX_ENTRIES) return entries;

  const absolutePath = relativePath ? join(rootPath, relativePath) : rootPath;
  const children = await readdir(absolutePath, { withFileTypes: true });
  children.sort(
    (left, right) =>
      Number(right.isDirectory()) - Number(left.isDirectory()) ||
      left.name.localeCompare(right.name),
  );

  for (const child of children) {
    if (entries.length >= MAX_ENTRIES) break;
    if (child.isDirectory() && IGNORED_DIRECTORIES.has(child.name)) continue;

    const childPath = relativePath
      ? `${relativePath}/${child.name}`
      : child.name;

    if (child.isDirectory()) {
      entries.push({ path: childPath, directory: true });
      await collectEntries(rootPath, childPath, entries);
    } else if (child.isFile()) {
      entries.push({ path: childPath, directory: false });
    }
  }

  return entries;
}

export async function buildFilesystemRepositoryMap(
  rootPath: string,
  maxChars: number,
): Promise<{
  content: string;
  entryCount: number;
  usedChars: number;
  truncated: boolean;
}> {
  const entries = await collectEntries(rootPath);
  let content = "";
  let entryCount = 0;
  let truncated = entries.length >= MAX_ENTRIES;

  for (const entry of entries) {
    const depth = entry.path.split("/").length - 1;
    const name = entry.path.split("/").at(-1) ?? entry.path;
    const line = `${"  ".repeat(depth)}${name}${entry.directory ? "/" : ""}\n`;

    if (content.length + line.length > maxChars) {
      const remaining = Math.max(0, maxChars - content.length);
      content += line.slice(0, remaining);
      truncated = true;
      break;
    }

    content += line;
    entryCount += 1;
  }

  return { content, entryCount, usedChars: content.length, truncated };
}
