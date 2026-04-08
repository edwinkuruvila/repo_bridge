import { spawn } from "node:child_process";

export const DEFAULT_MAX_OUTPUT_BYTES = 32 * 1024;
export const DEFAULT_TIMEOUT_MS = 15_000;

export interface ProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  truncated: boolean;
  timedOut: boolean;
  spawnError?: string;
}
export function runProcess(
  executable: string,
  args: readonly string[],
  options: { cwd: string; maxOutputBytes?: number; timeoutMs?: number },
): Promise<ProcessResult> {
  const startedAt = performance.now();
  const maxOutputBytes = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return new Promise((resolve) => {
    const child = spawn(executable, args, {
      cwd: options.cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let capturedBytes = 0;
    let truncated = false;
    let timedOut = false;
    let spawnError: string | undefined;
    let forceKillTimer: NodeJS.Timeout | undefined;

    const capture = (target: Buffer[], chunk: Buffer): void => {
      const remaining = Math.max(0, maxOutputBytes - capturedBytes);
      if (chunk.length > remaining) truncated = true;
      if (remaining > 0) {
        const captured = Buffer.from(chunk.subarray(0, remaining));
        target.push(captured);
        capturedBytes += captured.length;
      }
    };

    child.stdout.on("data", (chunk: Buffer) => capture(stdout, chunk));
    child.stderr.on("data", (chunk: Buffer) => capture(stderr, chunk));
    child.once("error", (cause) => {
      spawnError = cause.message;
    });

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      forceKillTimer = setTimeout(() => child.kill("SIGKILL"), 500);
    }, timeoutMs);

    child.once("close", (exitCode) => {
      clearTimeout(timeout);
      if (forceKillTimer) clearTimeout(forceKillTimer);
      resolve({
        exitCode: exitCode ?? -1,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
        durationMs: Math.round(performance.now() - startedAt),
        truncated,
        timedOut,
        ...(spawnError ? { spawnError } : {}),
      });
    });
  });
}

export function runShellCommand(
  command: string,
  cwd: string,
): Promise<ProcessResult> {
  const shell = process.env.SHELL?.startsWith("/")
    ? process.env.SHELL
    : "/bin/sh";
  return runProcess(shell, ["-lc", command], {
    cwd,
    timeoutMs: 120_000,
    maxOutputBytes: 256 * 1024,
  });
}
