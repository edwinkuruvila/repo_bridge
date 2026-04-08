import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { configPath } from "./workspaces.js";
import { runProcess } from "./process-runner.js";
import { findGit } from "./executable-discovery.js";

const MAX_SESSION_ID_LENGTH = 1000;
const MAX_OPERATIONS = 500;
const MAX_FILES_TOUCHED = 500;
const MAX_CHECKPOINTS = 100;

export class TaskStoreError extends Error {}

export interface TaskOperationRecord {
  at: string;
  operation: string;
  ok: boolean;
  filesChanged?: string[];
  checkpointId?: string;
}

interface TaskSession {
  version: 1;
  id: string;
  rootPath: string;
  sessionId: string;
  startedAt: string;
  updatedAt: string;
  operationCount: number;
  startingGit: {
    branch: string;
    dirty: boolean;
  };
  operations: TaskOperationRecord[];
  filesTouched: string[];
  checkpoints: string[];
}

const taskLocks = new Map<string, Promise<void>>();

export interface TaskSessionSummary {
  taskId: string;
  startedAt: string;
  updatedAt: string;
  startingBranch: string;
  startingDirty: boolean;
  operationCount: number;
  filesTouched: string[];
  checkpoints: string[];
}

function tasksDirectory(): string {
  return join(dirname(configPath()), "tasks");
}

function taskKey(rootPath: string, sessionId: string): string {
  return createHash("sha256")
    .update(rootPath)
    .update("\0")
    .update(sessionId)
    .digest("hex");
}

function taskPath(rootPath: string, sessionId: string): string {
  return join(tasksDirectory(), `${taskKey(rootPath, sessionId)}.json`);
}

async function withTaskLock<T>(
  rootPath: string,
  sessionId: string,
  operation: () => Promise<T>,
): Promise<T> {
  const key = taskKey(rootPath, sessionId);
  const previous = taskLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queued = previous.then(() => gate);
  taskLocks.set(key, queued);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (taskLocks.get(key) === queued) taskLocks.delete(key);
  }
}

function validateSessionId(sessionId: string): void {
  if (
    !sessionId ||
    sessionId.length > MAX_SESSION_ID_LENGTH ||
    sessionId.includes("\0")
  ) {
    throw new TaskStoreError(
      "sessionId must be non-empty, at most 1000 characters, and contain no NUL bytes",
    );
  }
}

async function startingGitState(
  rootPathValue: string,
): Promise<{ branch: string; dirty: boolean }> {
  const result = await runProcess(
    await findGit(),
    ["status", "--short", "--branch", "--untracked-files=all"],
    { cwd: rootPathValue, timeoutMs: 30_000, maxOutputBytes: 128 * 1024 },
  );
  if (result.spawnError || result.timedOut || result.exitCode !== 0) {
    return { branch: "", dirty: false };
  }
  const lines = result.stdout.replace(/\r\n?/g, "\n").trimEnd().split("\n");
  const branchLine = lines[0]?.startsWith("## ") ? (lines.shift() ?? "") : "";
  return {
    branch: branchLine.slice(3),
    dirty: lines.filter(Boolean).length > 0,
  };
}

async function writeTask(task: TaskSession): Promise<void> {
  const directory = tasksDirectory();
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const destination = taskPath(task.rootPath, task.sessionId);
  const temporary = `${destination}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(task, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(temporary, destination);
}

async function readTask(
  rootPath: string,
  sessionId: string,
): Promise<TaskSession | undefined> {
  validateSessionId(sessionId);
  let text: string;
  try {
    text = await readFile(taskPath(rootPath, sessionId), "utf8");
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw cause;
  }
  const value = JSON.parse(text) as Partial<TaskSession>;
  if (
    value.version !== 1 ||
    value.rootPath !== rootPath ||
    value.sessionId !== sessionId ||
    typeof value.id !== "string" ||
    typeof value.startedAt !== "string" ||
    typeof value.updatedAt !== "string" ||
    (value.operationCount !== undefined &&
      (!Number.isSafeInteger(value.operationCount) ||
        value.operationCount < 0)) ||
    typeof value.startingGit !== "object" ||
    value.startingGit === null ||
    !Array.isArray(value.operations) ||
    !Array.isArray(value.filesTouched) ||
    !Array.isArray(value.checkpoints)
  ) {
    throw new TaskStoreError("stored task session is invalid");
  }
  return {
    ...(value as TaskSession),
    operationCount: value.operationCount ?? value.operations.length,
  };
}

function summarize(task: TaskSession): TaskSessionSummary {
  return {
    taskId: task.id,
    startedAt: task.startedAt,
    updatedAt: task.updatedAt,
    startingBranch: task.startingGit.branch,
    startingDirty: task.startingGit.dirty,
    operationCount: task.operationCount,
    filesTouched: [...task.filesTouched],
    checkpoints: [...task.checkpoints],
  };
}

async function ensureTaskSessionUnlocked(
  rootPath: string,
  rootPathValue: string,
  sessionId: string,
): Promise<TaskSessionSummary> {
  validateSessionId(sessionId);
  const existing = await readTask(rootPath, sessionId);
  if (existing) return summarize(existing);
  const now = new Date().toISOString();
  const task: TaskSession = {
    version: 1,
    id: randomUUID(),
    rootPath,
    sessionId,
    startedAt: now,
    updatedAt: now,
    operationCount: 0,
    startingGit: await startingGitState(rootPathValue),
    operations: [],
    filesTouched: [],
    checkpoints: [],
  };
  await writeTask(task);
  return summarize(task);
}

export async function ensureTaskSession(
  rootPath: string,
  rootPathValue: string,
  sessionId: string,
): Promise<TaskSessionSummary> {
  validateSessionId(sessionId);
  return withTaskLock(rootPath, sessionId, () =>
    ensureTaskSessionUnlocked(rootPath, rootPathValue, sessionId),
  );
}

export async function recordTaskOperation(
  rootPath: string,
  rootPathValue: string,
  sessionId: string,
  record: TaskOperationRecord,
): Promise<TaskSessionSummary> {
  validateSessionId(sessionId);
  return withTaskLock(rootPath, sessionId, async () => {
    await ensureTaskSessionUnlocked(rootPath, rootPathValue, sessionId);
    const task = await readTask(rootPath, sessionId);
    if (!task)
      throw new TaskStoreError("task session disappeared after creation");
    task.operations.push(record);
    task.operationCount += 1;
    if (task.operations.length > MAX_OPERATIONS)
      task.operations.splice(0, task.operations.length - MAX_OPERATIONS);
    for (const path of record.filesChanged ?? []) {
      if (
        !task.filesTouched.includes(path) &&
        task.filesTouched.length < MAX_FILES_TOUCHED
      )
        task.filesTouched.push(path);
    }
    if (
      record.checkpointId &&
      !task.checkpoints.includes(record.checkpointId) &&
      task.checkpoints.length < MAX_CHECKPOINTS
    ) {
      task.checkpoints.push(record.checkpointId);
    }
    task.updatedAt = new Date().toISOString();
    await writeTask(task);
    return summarize(task);
  });
}
