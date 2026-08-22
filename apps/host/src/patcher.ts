import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { constants } from "node:fs";
import type { Dirent } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { configPath } from "./workspaces.js";

const MAX_PATCH_BYTES = 256 * 1024;
const MAX_PATCH_FILES = 20;
const MAX_FILE_BYTES = 3 * 1024 * 1024;
const MAX_CHECKPOINTS = 50;
const CHECKPOINT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class PatchError extends Error {}
export class UndoError extends Error {}

type PatchFile = { kind: "update" | "add"; path: string; hunks: string[][] };
export interface PatchApplyOptions {
  renameFile?: typeof rename;
}

interface CheckpointFile {
  path: string;
  before: string | null;
  beforeMode?: number;
  afterSha256: string;
}

interface Checkpoint {
  version: 1;
  id: string;
  workspace: string;
  createdAt: string;
  files: CheckpointFile[];
}

function inside(root: string, candidate: string): boolean {
  const part = relative(root, candidate);
  return (
    part !== "" &&
    part !== ".." &&
    !part.startsWith(`..${sep}`) &&
    !isAbsolute(part)
  );
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function checkpointsDirectory(): string {
  return join(dirname(configPath()), "checkpoints");
}

async function pruneCheckpoints(): Promise<void> {
  const directory = checkpointsDirectory();
  let entries: Dirent[];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") return;
    throw cause;
  }
  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map(async (entry) => {
        const path = join(directory, entry.name);
        return { path, mtimeMs: (await stat(path)).mtimeMs };
      }),
  );
  files.sort((left, right) => right.mtimeMs - left.mtimeMs);
  await Promise.all(
    files
      .slice(MAX_CHECKPOINTS)
      .map((entry) => rm(entry.path, { force: true })),
  );
}

async function writeCheckpoint(
  workspace: string,
  prepared: Array<{
    path: string;
    kind: "update" | "add";
    source: string;
    mode: number | undefined;
    content: string;
  }>,
): Promise<string> {
  const id = randomUUID();
  const checkpoint: Checkpoint = {
    version: 1,
    id,
    workspace,
    createdAt: new Date().toISOString(),
    files: prepared.map((file) => ({
      path: file.path,
      before: file.kind === "add" ? null : file.source,
      ...(file.mode === undefined ? {} : { beforeMode: file.mode }),
      afterSha256: sha256(file.content),
    })),
  };
  const directory = checkpointsDirectory();
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const destination = join(directory, `${id}.json`);
  const temporary = `${destination}.tmp`;
  await writeFile(temporary, `${JSON.stringify(checkpoint)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(temporary, destination);
  await pruneCheckpoints();
  return id;
}

async function readCheckpoint(
  workspace: string,
  checkpointId: string,
): Promise<Checkpoint> {
  if (!CHECKPOINT_ID_PATTERN.test(checkpointId))
    throw new UndoError("invalid checkpoint ID");
  let text: string;
  try {
    text = await readFile(
      join(checkpointsDirectory(), `${checkpointId}.json`),
      "utf8",
    );
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT")
      throw new UndoError("checkpoint does not exist");
    throw cause;
  }
  const value = JSON.parse(text) as Partial<Checkpoint>;
  if (
    value.version !== 1 ||
    value.id !== checkpointId ||
    value.workspace !== workspace ||
    !Array.isArray(value.files)
  ) {
    throw new UndoError("checkpoint is invalid for this workspace");
  }
  return value as Checkpoint;
}

function parsePatch(patch: string): PatchFile[] {
  if (Buffer.byteLength(patch, "utf8") > MAX_PATCH_BYTES)
    throw new PatchError("patch exceeds 256 KiB limit");
  const lines = patch.replace(/\r\n?/g, "\n").split("\n");
  if (lines[0] !== "*** Begin Patch" || lines.at(-1) !== "*** End Patch")
    throw new PatchError("patch must use the RepoBridge patch envelope");
  const files: PatchFile[] = [];
  let current: PatchFile | undefined;
  let hunk: string[] | undefined;
  for (const line of lines.slice(1, -1)) {
    const header = /^\*\*\* (Update|Add) File: (.+)$/.exec(line);
    if (header) {
      if (hunk) current?.hunks.push(hunk);
      const kind = header[1] === "Update" ? "update" : "add";
      current = { kind, path: header[2] ?? "", hunks: [] };
      files.push(current);
      hunk = undefined;
      continue;
    }
    const isHunkHeader =
      line === "@@" ||
      /^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@(?: .*)?$/.test(line);
    if (isHunkHeader) {
      if (!current) throw new PatchError("hunk appears before a file header");
      if (hunk) current.hunks.push(hunk);
      hunk = [];
      continue;
    }
    if (!hunk || !/^[ +-]/.test(line))
      throw new PatchError("malformed patch hunk");
    hunk.push(line);
  }
  if (hunk) current?.hunks.push(hunk);
  if (
    files.length === 0 ||
    files.length > MAX_PATCH_FILES ||
    files.some((file) => file.hunks.length === 0)
  )
    throw new PatchError("patch must contain 1-20 files with hunks");
  return files;
}

function applyHunks(
  source: string,
  hunks: string[][],
  add: boolean,
): { content: string; additions: number; deletions: number } {
  const hadFinalNewline = /\r?\n$/.test(source);
  const lines =
    source.length === 0
      ? []
      : source.replace(/\r\n?/g, "\n").replace(/\n$/, "").split("\n");
  let cursor = 0;
  let additions = 0;
  let deletions = 0;
  for (const hunk of hunks) {
    const oldLines = hunk
      .filter((line) => line[0] !== "+")
      .map((line) => line.slice(1));
    const newLines = hunk
      .filter((line) => line[0] !== "-")
      .map((line) => line.slice(1));
    if (add && oldLines.length > 0)
      throw new PatchError("Add File hunks may not contain existing context");
    let index = cursor;
    if (!add) {
      index = -1;
      for (
        let start = cursor;
        start <= lines.length - oldLines.length;
        start += 1
      ) {
        if (oldLines.every((line, offset) => lines[start + offset] === line)) {
          index = start;
          break;
        }
      }
      if (index < 0)
        throw new PatchError(
          "PATCH_CONFLICT: patch context no longer matches file content",
        );
    }
    lines.splice(index, oldLines.length, ...newLines);
    cursor = index + newLines.length;
    additions += hunk.filter((line) => line[0] === "+").length;
    deletions += hunk.filter((line) => line[0] === "-").length;
  }
  const preserveFinalNewline = add || hadFinalNewline;
  const content = `${lines.join("\n")}${lines.length > 0 && preserveFinalNewline ? "\n" : ""}`;
  if (Buffer.byteLength(content, "utf8") > MAX_FILE_BYTES)
    throw new PatchError("resulting file exceeds 3 MiB limit");
  return { content, additions, deletions };
}

async function targetPath(
  workspace: string,
  requested: string,
  isAdd: boolean,
): Promise<string> {
  if (!requested || requested.includes("\0") || isAbsolute(requested))
    throw new PatchError("patch path must be a non-empty relative path");
  const lexical = resolve(workspace, requested);
  if (!inside(workspace, lexical))
    throw new PatchError("patch path escapes the registered workspace");
  if (!isAdd) {
    let canonical: string;
    try {
      canonical = await realpath(lexical);
    } catch {
      throw new PatchError("update target does not exist");
    }
    if (!inside(workspace, canonical))
      throw new PatchError("patch target escapes the registered workspace");
    if (!(await stat(canonical)).isFile())
      throw new PatchError("patch target must be a regular file");
    return canonical;
  }
  try {
    await access(lexical, constants.F_OK);
    throw new PatchError("Add File target already exists");
  } catch (cause) {
    if (cause instanceof PatchError) throw cause;
  }
  let parent = dirname(lexical);
  while (parent !== workspace) {
    try {
      await access(parent);
      break;
    } catch {
      parent = dirname(parent);
    }
  }
  const canonicalParent = await realpath(parent);
  if (!inside(workspace, canonicalParent) && canonicalParent !== workspace)
    throw new PatchError("patch parent escapes the registered workspace");
  return lexical;
}

export async function applyWorkspacePatch(
  workspace: string,
  patch: string,
  options: PatchApplyOptions = {},
): Promise<{
  filesChanged: string[];
  additions: number;
  deletions: number;
  checkpointId: string;
}> {
  const renameFile = options.renameFile ?? rename;
  const files = parsePatch(patch);
  const prepared = await Promise.all(
    files.map(async (file) => {
      const target = await targetPath(
        workspace,
        file.path,
        file.kind === "add",
      );
      const source = file.kind === "add" ? "" : await readFile(target, "utf8");
      const mode =
        file.kind === "add" ? undefined : (await stat(target)).mode & 0o777;
      const result = applyHunks(source, file.hunks, file.kind === "add");
      return { ...file, target, source, mode, ...result };
    }),
  );
  const targets = new Set<string>();
  for (const file of prepared) {
    if (targets.has(file.target))
      throw new PatchError(
        "patch must not target the same file more than once",
      );
    targets.add(file.target);
  }
  const temporary = await mkdtemp(join(workspace, ".repobridge-patch-"));
  const staged = prepared.map((file, index) => ({
    file,
    replacement: join(temporary, `${index}.new`),
    backup: join(temporary, `${index}.old`),
  }));
  const applied: typeof staged = [];
  let checkpointId: string | undefined;
  try {
    for (const entry of staged) {
      await writeFile(
        entry.replacement,
        entry.file.content,
        entry.file.mode === undefined
          ? "utf8"
          : { encoding: "utf8", mode: entry.file.mode },
      );
      if (entry.file.kind === "update") {
        await writeFile(entry.backup, entry.file.source, {
          encoding: "utf8",
          mode: entry.file.mode,
        });
      }
    }
    checkpointId = await writeCheckpoint(workspace, prepared);

    try {
      for (const entry of staged) {
        await renameFile(entry.replacement, entry.file.target);
        applied.push(entry);
      }
    } catch (cause) {
      if (checkpointId) {
        await rm(join(checkpointsDirectory(), `${checkpointId}.json`), {
          force: true,
        });
        checkpointId = undefined;
      }
      const rollbackErrors: string[] = [];
      for (const entry of [...applied].reverse()) {
        try {
          if (entry.file.kind === "add") {
            await rm(entry.file.target, { force: true });
          } else {
            await renameFile(entry.backup, entry.file.target);
          }
        } catch (rollbackCause) {
          rollbackErrors.push(
            rollbackCause instanceof Error
              ? rollbackCause.message
              : String(rollbackCause),
          );
        }
      }
      const message = cause instanceof Error ? cause.message : String(cause);
      if (rollbackErrors.length > 0) {
        throw new PatchError(
          `PATCH_COMMIT_FAILED: ${message}; rollback also failed: ${rollbackErrors.join("; ")}`,
        );
      }
      throw new PatchError(
        `PATCH_COMMIT_FAILED: ${message}; previously applied files were rolled back`,
      );
    }
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
  if (!checkpointId) throw new PatchError("failed to create patch checkpoint");
  return {
    filesChanged: files.map((file) => file.path),
    additions: prepared.reduce((sum, file) => sum + file.additions, 0),
    deletions: prepared.reduce((sum, file) => sum + file.deletions, 0),
    checkpointId,
  };
}

export async function undoWorkspaceCheckpoint(
  workspace: string,
  checkpointId: string,
): Promise<{ checkpointId: string; filesRestored: string[] }> {
  const checkpoint = await readCheckpoint(workspace, checkpointId);
  const current = await Promise.all(
    checkpoint.files.map(async (file) => {
      const target = resolve(workspace, file.path);
      if (!inside(workspace, target))
        throw new UndoError("checkpoint path escapes the registered workspace");
      let canonical: string;
      try {
        canonical = await realpath(target);
      } catch {
        throw new UndoError(`UNDO_CONFLICT: ${file.path} no longer exists`);
      }
      if (!inside(workspace, canonical))
        throw new UndoError(
          "checkpoint target escapes the registered workspace",
        );
      const details = await stat(canonical);
      if (!details.isFile())
        throw new UndoError(
          `UNDO_CONFLICT: ${file.path} is no longer a regular file`,
        );
      const content = await readFile(canonical, "utf8");
      if (sha256(content) !== file.afterSha256) {
        throw new UndoError(
          `UNDO_CONFLICT: ${file.path} changed after the RepoBridge patch`,
        );
      }
      return { file, target: canonical, content, mode: details.mode & 0o777 };
    }),
  );

  const temporary = await mkdtemp(join(workspace, ".repobridge-undo-"));
  const staged = current.map((entry, index) => ({
    ...entry,
    restore:
      entry.file.before === null
        ? undefined
        : join(temporary, `${index}.restore`),
    rollback: join(temporary, `${index}.rollback`),
  }));
  const applied: typeof staged = [];
  try {
    for (const entry of staged) {
      await writeFile(entry.rollback, entry.content, {
        encoding: "utf8",
        mode: entry.mode,
      });
      if (entry.restore && entry.file.before !== null) {
        await writeFile(entry.restore, entry.file.before, {
          encoding: "utf8",
          mode: entry.file.beforeMode ?? entry.mode,
        });
      }
    }
    try {
      for (const entry of staged) {
        if (entry.restore) await rename(entry.restore, entry.target);
        else await rm(entry.target);
        applied.push(entry);
      }
    } catch (cause) {
      const rollbackErrors: string[] = [];
      for (const entry of [...applied].reverse()) {
        try {
          await rename(entry.rollback, entry.target);
        } catch (rollbackCause) {
          rollbackErrors.push(
            rollbackCause instanceof Error
              ? rollbackCause.message
              : String(rollbackCause),
          );
        }
      }
      const message = cause instanceof Error ? cause.message : String(cause);
      throw new UndoError(
        rollbackErrors.length > 0
          ? `UNDO_COMMIT_FAILED: ${message}; rollback also failed: ${rollbackErrors.join("; ")}`
          : `UNDO_COMMIT_FAILED: ${message}; previously restored files were rolled back`,
      );
    }
    await rm(join(checkpointsDirectory(), `${checkpointId}.json`), {
      force: true,
    });
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
  return {
    checkpointId,
    filesRestored: checkpoint.files.map((file) => file.path),
  };
}
