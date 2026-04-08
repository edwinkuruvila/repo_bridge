import type {
  InspectionReadResponse,
  InspectionSearchResponse,
} from "@kavrith/protocol";

export function formatKavrithResult(
  workspaceName: string,
  query: string,
  response: InspectionSearchResponse,
): string {
  const result = response.result;
  const stderr = result.stderr ? `\n\nstderr:\n${result.stderr}` : "";
  return [
    "<kavrith_result>",
    `workspace: ${workspaceName}`,
    "operation: inspection.search",
    `query: ${query}`,
    `exit_code: ${result.exitCode}`,
    `duration_ms: ${result.durationMs}`,
    `truncated: ${result.truncated}`,
    "",
    `stdout:\n${result.stdout}${stderr}`,
    "</kavrith_result>",
  ].join("\n");
}

export function formatKavrithReadResult(
  workspaceName: string,
  response: InspectionReadResponse,
): string {
  const result = response.result;
  return [
    "<kavrith_result>",
    `workspace: ${workspaceName}`,
    "operation: inspection.read",
    `path: ${result.path}`,
    `lines: ${result.startLine}-${result.actualEndLine}`,
    `truncated: ${result.truncated}`,
    "",
    `content:\n${result.content}`,
    "</kavrith_result>",
  ].join("\n");
}
