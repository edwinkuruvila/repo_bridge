interface KavrithExecRequest {
  executable: string;
  args: string[];
}

export type ExecRisk = "read-only" | "code-execution" | "destructive";

function basename(executable: string): string {
  return (
    executable.replace(/\\/g, "/").split("/").filter(Boolean).at(-1) ??
    executable
  );
}

const DESTRUCTIVE_EXECUTABLES = new Set([
  "rm",
  "rmdir",
  "mv",
  "dd",
  "chmod",
  "chown",
  "kill",
  "killall",
]);

const READ_ONLY_EXECUTABLES = new Set([
  "pwd",
  "ls",
  "rg",
  "grep",
  "head",
  "tail",
  "wc",
  "stat",
]);

const READ_ONLY_GIT_SUBCOMMANDS = new Set([
  "status",
  "diff",
  "log",
  "show",
  "rev-parse",
]);

const DESTRUCTIVE_GIT_SUBCOMMANDS = new Set([
  "reset",
  "clean",
  "checkout",
  "restore",
  "switch",
  "commit",
  "merge",
  "rebase",
  "cherry-pick",
  "revert",
  "push",
]);

export function classifyExecRisk(request: KavrithExecRequest): ExecRisk {
  const executable = basename(request.executable);
  if (DESTRUCTIVE_EXECUTABLES.has(executable)) return "destructive";
  if (READ_ONLY_EXECUTABLES.has(executable)) return "read-only";
  if (executable === "git") {
    const subcommand = request.args.find((arg) => !arg.startsWith("-")) ?? "";
    if (subcommand === "branch") {
      const branchArgs = request.args.slice(
        request.args.indexOf(subcommand) + 1,
      );
      const mutating = branchArgs.some(
        (arg) =>
          arg === "-d" ||
          arg === "-D" ||
          arg === "-m" ||
          arg === "-M" ||
          arg === "-c" ||
          arg === "-C" ||
          arg === "--delete" ||
          arg === "--move" ||
          arg === "--copy" ||
          !arg.startsWith("-"),
      );
      return mutating ? "destructive" : "read-only";
    }
    if (READ_ONLY_GIT_SUBCOMMANDS.has(subcommand)) return "read-only";
    if (DESTRUCTIVE_GIT_SUBCOMMANDS.has(subcommand)) return "destructive";
  }
  return "code-execution";
}
