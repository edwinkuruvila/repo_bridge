import type {
  InspectionReadResponse,
  InspectionSearchResponse,
} from "@repobridge/protocol";

export function formatRepoBridgeResult(
  workspaceName: string,
  query: string,
  response: InspectionSearchResponse,
): string {
  const result = response.result;
  const stderr = result.stderr ? `\n\nstderr:\n${result.stderr}` : "";
  return [
    "<repobridge_result>",
    `workspace: ${workspaceName}`,
    "operation: inspection.search",
    `query: ${query}`,
    `exit_code: ${result.exitCode}`,
    `duration_ms: ${result.durationMs}`,
    `truncated: ${result.truncated}`,
    "",
    `stdout:\n${result.stdout}${stderr}`,
    "</repobridge_result>",
  ].join("\n");
}

export function formatRepoBridgeReadResult(
  workspaceName: string,
  response: InspectionReadResponse,
): string {
  const result = response.result;
  return [
    "<repobridge_result>",
    `workspace: ${workspaceName}`,
    "operation: inspection.read",
    `path: ${result.path}`,
    `lines: ${result.startLine}-${result.actualEndLine}`,
    `truncated: ${result.truncated}`,
    "",
    `content:\n${result.content}`,
    "</repobridge_result>",
  ].join("\n");
}
