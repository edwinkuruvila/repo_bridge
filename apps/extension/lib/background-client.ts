import { browser } from "wxt/browser";
import type {
  CommandExecResponse,
  CommandRunResponse,
  ErrorResponse,
  GitDiffResponse,
  GitStatusResponse,
  InspectionContextResponse,
  InspectionReadResponse,
  InspectionSearchResponse,
  WorkspacePatchResponse,
  WorkspaceUndoResponse,
} from "@repobridge/protocol";
import type {
  RepoBridgeContextMessage,
  RepoBridgeExecMessage,
  RepoBridgeGitDiffMessage,
  RepoBridgeGitStatusMessage,
  RepoBridgePatchMessage,
  RepoBridgeReadMessage,
  RepoBridgeRunMessage,
  RepoBridgeSearchMessage,
  RepoBridgeUndoMessage,
} from "./messages";

export function sendRepoBridgeMessage(
  message: RepoBridgeSearchMessage,
): Promise<InspectionSearchResponse | ErrorResponse>;
export function sendRepoBridgeMessage(
  message: RepoBridgeReadMessage,
): Promise<InspectionReadResponse | ErrorResponse>;
export function sendRepoBridgeMessage(
  message: RepoBridgeContextMessage,
): Promise<InspectionContextResponse | ErrorResponse>;
export function sendRepoBridgeMessage(
  message: RepoBridgePatchMessage,
): Promise<WorkspacePatchResponse | ErrorResponse>;
export function sendRepoBridgeMessage(
  message: RepoBridgeUndoMessage,
): Promise<WorkspaceUndoResponse | ErrorResponse>;
export function sendRepoBridgeMessage(
  message: RepoBridgeGitStatusMessage,
): Promise<GitStatusResponse | ErrorResponse>;
export function sendRepoBridgeMessage(
  message: RepoBridgeGitDiffMessage,
): Promise<GitDiffResponse | ErrorResponse>;
export function sendRepoBridgeMessage(
  message: RepoBridgeExecMessage,
): Promise<CommandExecResponse | ErrorResponse>;
export function sendRepoBridgeMessage(
  message: RepoBridgeRunMessage,
): Promise<CommandRunResponse | ErrorResponse>;
export async function sendRepoBridgeMessage(
  message:
    | RepoBridgeSearchMessage
    | RepoBridgeReadMessage
    | RepoBridgeContextMessage
    | RepoBridgePatchMessage
    | RepoBridgeUndoMessage
    | RepoBridgeGitStatusMessage
    | RepoBridgeGitDiffMessage
    | RepoBridgeExecMessage
    | RepoBridgeRunMessage,
): Promise<unknown> {
  return browser.runtime.sendMessage(message);
}
