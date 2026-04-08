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
} from "@kavrith/protocol";
import type {
  KavrithContextMessage,
  KavrithExecMessage,
  KavrithGitDiffMessage,
  KavrithGitStatusMessage,
  KavrithPatchMessage,
  KavrithReadMessage,
  KavrithRunMessage,
  KavrithSearchMessage,
  KavrithUndoMessage,
} from "./messages";

export function sendKavrithMessage(
  message: KavrithSearchMessage,
): Promise<InspectionSearchResponse | ErrorResponse>;
export function sendKavrithMessage(
  message: KavrithReadMessage,
): Promise<InspectionReadResponse | ErrorResponse>;
export function sendKavrithMessage(
  message: KavrithContextMessage,
): Promise<InspectionContextResponse | ErrorResponse>;
export function sendKavrithMessage(
  message: KavrithPatchMessage,
): Promise<WorkspacePatchResponse | ErrorResponse>;
export function sendKavrithMessage(
  message: KavrithUndoMessage,
): Promise<WorkspaceUndoResponse | ErrorResponse>;
export function sendKavrithMessage(
  message: KavrithGitStatusMessage,
): Promise<GitStatusResponse | ErrorResponse>;
export function sendKavrithMessage(
  message: KavrithGitDiffMessage,
): Promise<GitDiffResponse | ErrorResponse>;
export function sendKavrithMessage(
  message: KavrithExecMessage,
): Promise<CommandExecResponse | ErrorResponse>;
export function sendKavrithMessage(
  message: KavrithRunMessage,
): Promise<CommandRunResponse | ErrorResponse>;
export async function sendKavrithMessage(
  message:
    | KavrithSearchMessage
    | KavrithReadMessage
    | KavrithContextMessage
    | KavrithPatchMessage
    | KavrithUndoMessage
    | KavrithGitStatusMessage
    | KavrithGitDiffMessage
    | KavrithExecMessage
    | KavrithRunMessage,
): Promise<unknown> {
  return browser.runtime.sendMessage(message);
}
