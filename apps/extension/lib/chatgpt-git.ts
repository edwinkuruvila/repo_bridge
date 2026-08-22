export type RepoBridgeGitRequest =
  | { type: "status" }
  | { type: "diff"; staged: boolean };

export function parseRepoBridgeGit(
  text: string,
): RepoBridgeGitRequest | undefined {
  const lines = text.replace(/\r\n?/g, "\n").trimEnd().split("\n");
  if (lines[0] === "# repobridge:git-status" && lines.length === 1)
    return { type: "status" };
  if (lines[0] === "# repobridge:git-diff" && lines.length === 1)
    return { type: "diff", staged: false };
  if (
    lines[0] === "# repobridge:git-diff" &&
    lines.length === 2 &&
    lines[1] === "staged"
  )
    return { type: "diff", staged: true };
  return undefined;
}
