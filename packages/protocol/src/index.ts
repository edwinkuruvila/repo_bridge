export const PROTOCOL_VERSION = 1 as const;

export interface PingRequest {
  version: typeof PROTOCOL_VERSION;
  id: string;
  method: "ping";
}

export interface TaskRootPickRequest {
  version: typeof PROTOCOL_VERSION;
  id: string;
  method: "task.root.pick";
}

export interface InspectionSearchRequest {
  version: typeof PROTOCOL_VERSION;
  id: string;
  method: "inspection.search";
  rootPath: string;
  query: string;
}

export interface InspectionReadRequest {
  version: typeof PROTOCOL_VERSION;
  id: string;
  method: "inspection.read";
  rootPath: string;
  path: string;
  startLine: number;
  endLine: number;
}

export interface InspectionContextRead {
  path: string;
  startLine: number;
  endLine: number;
}

export interface InspectionContextRequest {
  version: typeof PROTOCOL_VERSION;
  id: string;
  method: "inspection.context";
  rootPath: string;
  searches: string[];
  reads: InspectionContextRead[];
  searchesByName?: string[];
  includeRepositoryMap?: boolean;
  maxChars?: number;
}

export interface WorkspacePatchRequest {
  version: typeof PROTOCOL_VERSION;
  id: string;
  method: "workspace.patch";
  rootPath: string;
  patch: string;
}
export interface WorkspaceUndoRequest {
  version: typeof PROTOCOL_VERSION;
  id: string;
  method: "workspace.undo";
  rootPath: string;
  checkpointId: string;
}
export interface GitStatusRequest {
  version: typeof PROTOCOL_VERSION;
  id: string;
  method: "git.status";
  rootPath: string;
}
export interface GitDiffRequest {
  version: typeof PROTOCOL_VERSION;
  id: string;
  method: "git.diff";
  rootPath: string;
  staged: boolean;
}
export interface TaskRecordRequest {
  version: typeof PROTOCOL_VERSION;
  id: string;
  method: "task.record";
  rootPath: string;
  sessionId: string;
  operation: string;
  ok: boolean;
  filesChanged?: string[];
  checkpointId?: string;
}
export interface TaskEnsureRequest {
  version: typeof PROTOCOL_VERSION;
  id: string;
  method: "task.ensure";
  rootPath: string;
  sessionId: string;
}
export interface CommandExecRequest {
  version: typeof PROTOCOL_VERSION;
  id: string;
  method: "command.exec";
  rootPath: string;
  executable: string;
  args: string[];
}
export interface CommandRunRequest {
  version: typeof PROTOCOL_VERSION;
  id: string;
  method: "command.run";
  rootPath: string;
  command: string;
}
export type NativeRequest =
  | PingRequest
  | TaskRootPickRequest
  | InspectionSearchRequest
  | InspectionReadRequest
  | InspectionContextRequest
  | WorkspacePatchRequest
  | WorkspaceUndoRequest
  | GitStatusRequest
  | GitDiffRequest
  | TaskEnsureRequest
  | TaskRecordRequest
  | CommandExecRequest
  | CommandRunRequest;

export interface PingResponse {
  version: typeof PROTOCOL_VERSION;
  id: string;
  ok: true;
  result: {
    message: "pong";
  };
}

export interface TaskRootPickResponse {
  version: typeof PROTOCOL_VERSION;
  id: string;
  ok: true;
  result: { rootPath: string | null };
}

export interface InspectionSearchResponse {
  version: typeof PROTOCOL_VERSION;
  id: string;
  ok: true;
  result: {
    exitCode: number;
    stdout: string;
    stderr: string;
    durationMs: number;
    truncated: boolean;
    noMatches: boolean;
  };
}

export interface InspectionReadResponse {
  version: typeof PROTOCOL_VERSION;
  id: string;
  ok: true;
  result: {
    path: string;
    startLine: number;
    endLine: number;
    actualEndLine: number;
    content: string;
    truncated: boolean;
  };
}

export interface InspectionContextResponse {
  version: typeof PROTOCOL_VERSION;
  id: string;
  ok: true;
  result: {
    sections: Array<
      | {
          kind: "search";
          query: string;
          content: string;
          noMatches: boolean;
          truncated: boolean;
        }
      | {
          kind: "read";
          path: string;
          startLine: number;
          endLine: number;
          actualEndLine: number;
          content: string;
          truncated: boolean;
        }
      | {
          kind: "repository-map";
          provider: string;
          content: string;
          entryCount: number;
          truncated: boolean;
        }
    >;
    maxChars: number;
    usedChars: number;
    truncated: boolean;
  };
}

export interface WorkspacePatchResponse {
  version: typeof PROTOCOL_VERSION;
  id: string;
  ok: true;
  result: {
    filesChanged: string[];
    additions: number;
    deletions: number;
    checkpointId: string;
  };
}
export interface WorkspaceUndoResponse {
  version: typeof PROTOCOL_VERSION;
  id: string;
  ok: true;
  result: { checkpointId: string; filesRestored: string[] };
}
export interface GitStatusResponse {
  version: typeof PROTOCOL_VERSION;
  id: string;
  ok: true;
  result: {
    branch: string;
    clean: boolean;
    entries: string[];
    durationMs: number;
    truncated: boolean;
  };
}
export interface GitDiffResponse {
  version: typeof PROTOCOL_VERSION;
  id: string;
  ok: true;
  result: {
    staged: boolean;
    diff: string;
    durationMs: number;
    truncated: boolean;
  };
}
export interface TaskSessionResult {
  taskId: string;
  startedAt: string;
  updatedAt: string;
  startingBranch: string;
  startingDirty: boolean;
  operationCount: number;
  filesTouched: string[];
  checkpoints: string[];
}
export interface TaskRecordResponse {
  version: typeof PROTOCOL_VERSION;
  id: string;
  ok: true;
  result: TaskSessionResult;
}
export interface TaskEnsureResponse {
  version: typeof PROTOCOL_VERSION;
  id: string;
  ok: true;
  result: TaskSessionResult;
}
export interface CommandExecResponse {
  version: typeof PROTOCOL_VERSION;
  id: string;
  ok: true;
  result: {
    executable: string;
    args: string[];
    exitCode: number;
    stdout: string;
    stderr: string;
    durationMs: number;
    timedOut: boolean;
    truncated: boolean;
  };
}
export interface CommandRunResponse {
  version: typeof PROTOCOL_VERSION;
  id: string;
  ok: true;
  result: {
    command: string;
    exitCode: number;
    stdout: string;
    stderr: string;
    durationMs: number;
    timedOut: boolean;
    truncated: boolean;
  };
}
export interface ErrorResponse {
  version: typeof PROTOCOL_VERSION;
  id: string;
  ok: false;
  error: {
    code:
      | "INVALID_REQUEST"
      | "METHOD_NOT_FOUND"
      | "TASK_ROOT_NOT_FOUND"
      | "PROCESS_TIMEOUT"
      | "INTERNAL_ERROR";
    message: string;
  };
}

export type NativeResponse =
  | PingResponse
  | TaskRootPickResponse
  | InspectionSearchResponse
  | InspectionReadResponse
  | InspectionContextResponse
  | WorkspacePatchResponse
  | WorkspaceUndoResponse
  | GitStatusResponse
  | GitDiffResponse
  | TaskEnsureResponse
  | TaskRecordResponse
  | CommandExecResponse
  | CommandRunResponse
  | ErrorResponse;
