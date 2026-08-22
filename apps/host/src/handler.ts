import type { NativeResponse } from "@repobridge/protocol";
import { PROTOCOL_VERSION } from "@repobridge/protocol";
import { handleCommandRequest } from "./command-handler.js";
import { handleGitRequest } from "./git-handler.js";
import { handleInspectionRequest } from "./inspection-handler.js";
import { handleTaskRequest } from "./task-handler.js";
import {
  error,
  resolveTaskRoot,
  taskRootErrorResponse,
} from "./request-helpers.js";
import { platform } from "node:os";
import { runProcess } from "./process-runner.js";
import {
  applyWorkspacePatch,
  PatchError,
  undoWorkspaceCheckpoint,
  UndoError,
} from "./patcher.js";

async function pickTaskRoot(): Promise<string | undefined> {
  const currentPlatform = platform();
  if (currentPlatform === "darwin") {
    const result = await runProcess(
      "/usr/bin/osascript",
      [
        "-e",
        'POSIX path of (choose folder with prompt "Choose a repository for RepoBridge")',
      ],
      { cwd: process.cwd(), timeoutMs: 120_000, maxOutputBytes: 16 * 1024 },
    );
    if (result.exitCode !== 0) {
      if (result.stderr.includes("User canceled")) return undefined;
      throw new Error(result.stderr.trim() || "Unable to open folder picker");
    }
    return result.stdout.trim().replace(/\/$/, "");
  }

  if (currentPlatform === "win32") {
    const script = [
      "Add-Type -AssemblyName System.Windows.Forms",
      "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
      '$dialog.Description = "Choose a repository for RepoBridge"',
      "if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {",
      "  Write-Output $dialog.SelectedPath",
      "}",
    ].join("; ");
    const result = await runProcess(
      "powershell.exe",
      ["-NoProfile", "-Command", script],
      { cwd: process.cwd(), timeoutMs: 120_000, maxOutputBytes: 16 * 1024 },
    );
    if (result.exitCode !== 0)
      throw new Error(result.stderr.trim() || "Unable to open folder picker");
    return result.stdout.trim() || undefined;
  }

  for (const [executable, args] of [
    [
      "zenity",
      [
        "--file-selection",
        "--directory",
        "--title=Choose a repository for RepoBridge",
      ],
    ],
    [
      "kdialog",
      [
        "--getexistingdirectory",
        ".",
        "--title",
        "Choose a repository for RepoBridge",
      ],
    ],
  ] as const) {
    const result = await runProcess(executable, [...args], {
      cwd: process.cwd(),
      timeoutMs: 120_000,
      maxOutputBytes: 16 * 1024,
    });
    if (!result.spawnError) {
      if (result.exitCode !== 0) return undefined;
      return result.stdout.trim() || undefined;
    }
  }
  throw new Error("No supported folder picker is available on this system");
}

async function handleUtilityRequest(
  id: string,
  request: Record<string, unknown>,
): Promise<NativeResponse | undefined> {
  if (request.method === "task.root.pick") {
    try {
      return {
        version: PROTOCOL_VERSION,
        id,
        ok: true,
        result: { rootPath: (await pickTaskRoot()) ?? null },
      };
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      return error(
        id,
        "INTERNAL_ERROR",
        `Unable to choose task root: ${message}`,
      );
    }
  }

  if (request.method === "ping") {
    return {
      version: PROTOCOL_VERSION,
      id,
      ok: true,
      result: { message: "pong" },
    };
  }

  return undefined;
}

async function handleWorkspaceRequest(
  id: string,
  request: Record<string, unknown>,
): Promise<NativeResponse | undefined> {
  if (request.method === "workspace.patch") {
    if (
      typeof request.rootPath !== "string" ||
      request.rootPath.length === 0 ||
      typeof request.patch !== "string"
    ) {
      return error(id, "INVALID_REQUEST", "rootPath and patch are required");
    }
    try {
      const workspace = await resolveTaskRoot(request.rootPath);
      const patchResult = await applyWorkspacePatch(workspace, request.patch);
      return {
        version: PROTOCOL_VERSION,
        id,
        ok: true,
        result: patchResult,
      };
    } catch (cause) {
      if (cause instanceof PatchError)
        return error(id, "INVALID_REQUEST", cause.message);
      const rootError = taskRootErrorResponse(id, cause);
      if (rootError) return rootError;
      const message = cause instanceof Error ? cause.message : String(cause);
      return error(
        id,
        "INTERNAL_ERROR",
        `Unable to apply workspace patch: ${message}`,
      );
    }
  }

  if (request.method === "workspace.undo") {
    if (
      typeof request.rootPath !== "string" ||
      request.rootPath.length === 0 ||
      typeof request.checkpointId !== "string" ||
      request.checkpointId.length === 0
    ) {
      return error(
        id,
        "INVALID_REQUEST",
        "rootPath and checkpointId are required",
      );
    }
    try {
      const workspace = await resolveTaskRoot(request.rootPath);
      return {
        version: PROTOCOL_VERSION,
        id,
        ok: true,
        result: await undoWorkspaceCheckpoint(workspace, request.checkpointId),
      };
    } catch (cause) {
      if (cause instanceof UndoError)
        return error(id, "INVALID_REQUEST", cause.message);
      const rootError = taskRootErrorResponse(id, cause);
      if (rootError) return rootError;
      const message = cause instanceof Error ? cause.message : String(cause);
      return error(
        id,
        "INTERNAL_ERROR",
        `Unable to undo workspace checkpoint: ${message}`,
      );
    }
  }

  return undefined;
}

export async function handleRequest(value: unknown): Promise<NativeResponse> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return error("unknown", "INVALID_REQUEST", "Request must be a JSON object");
  }

  const request = value as Record<string, unknown>;
  const id = typeof request.id === "string" ? request.id : "unknown";

  if (typeof request.id !== "string" || request.id.length === 0) {
    return error(
      id,
      "INVALID_REQUEST",
      "Request id must be a non-empty string",
    );
  }
  if (request.version !== PROTOCOL_VERSION) {
    return error(
      id,
      "INVALID_REQUEST",
      `Unsupported protocol version: ${String(request.version)}`,
    );
  }
  if (typeof request.method !== "string") {
    return error(id, "INVALID_REQUEST", "Request method must be a string");
  }

  for (const handler of [
    handleUtilityRequest,
    handleInspectionRequest,
    handleWorkspaceRequest,
    handleGitRequest,
    handleTaskRequest,
    handleCommandRequest,
  ]) {
    const response = await handler(id, request);
    if (response) return response;
  }

  return error(id, "METHOD_NOT_FOUND", `Unknown method: ${request.method}`);
}
