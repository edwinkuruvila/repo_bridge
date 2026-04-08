import { constants } from "node:fs";
import { access } from "node:fs/promises";

export async function findExecutable(
  candidates: readonly string[],
  fallback: string,
): Promise<string> {
  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Try the next known location, then fall back to PATH lookup.
    }
  }
  return fallback;
}

const GIT_CANDIDATES = [
  "/usr/bin/git",
  "/opt/homebrew/bin/git",
  "/usr/local/bin/git",
] as const;

const RIPGREP_CANDIDATES = [
  "/opt/homebrew/bin/rg",
  "/usr/local/bin/rg",
  "/usr/bin/rg",
] as const;

let gitExecutable: Promise<string> | undefined;
let ripgrepExecutable: Promise<string> | undefined;

export function findGit(): Promise<string> {
  gitExecutable ??= findExecutable(GIT_CANDIDATES, "git");
  return gitExecutable;
}

export function findRipgrep(): Promise<string> {
  ripgrepExecutable ??= findExecutable(RIPGREP_CANDIDATES, "rg");
  return ripgrepExecutable;
}
