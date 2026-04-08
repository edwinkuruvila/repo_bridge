export type KavrithGitRequest =
  | { type: "status" }
  | { type: "diff"; staged: boolean };

export function parseKavrithGit(text: string): KavrithGitRequest | undefined {
  const lines = text.replace(/\r\n?/g, "\n").trimEnd().split("\n");
  if (lines[0] === "# kavrith:git-status" && lines.length === 1)
    return { type: "status" };
  if (lines[0] === "# kavrith:git-diff" && lines.length === 1)
    return { type: "diff", staged: false };
  if (
    lines[0] === "# kavrith:git-diff" &&
    lines.length === 2 &&
    lines[1] === "staged"
  )
    return { type: "diff", staged: true };
  return undefined;
}
