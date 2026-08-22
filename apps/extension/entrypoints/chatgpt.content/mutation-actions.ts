import { sendRepoBridgeMessage } from "../../lib/background-client";
import type { RepoBridgeExecRequest } from "../../lib/chatgpt-exec";
import { classifyExecRisk } from "../../lib/exec-policy";
import {
  patchPreview,
  type RepoBridgePatchRequest,
} from "../../lib/chatgpt-patch";
import type { RepoBridgeRunRequest } from "../../lib/chatgpt-run";
import { repobridgeSessionId } from "../../lib/repobridge-session";
import { approvalIsClaimed, setupApprovalAction } from "./approval-action";
import { setDirectiveState } from "./directive-scanner";
import { returnErrorToChatGPT, returnResultToChatGPT } from "./result-delivery";
import {
  createActionButton,
  createPanel,
  errorMessage,
  renderPanel,
} from "./result-ui";
import { isTrustedUserGesture } from "../../lib/user-gesture";

const PROCESSED_ATTRIBUTE = "data-repobridge-action";

type MutationActionDependencies = {
  currentTaskRoot: () => Promise<string>;
  registerAction: (code: HTMLElement, ...elements: HTMLElement[]) => void;
};

function chatSession(): { sessionId: string } {
  return { sessionId: repobridgeSessionId() };
}

export function addPatchAction(
  code: HTMLElement,
  request: RepoBridgePatchRequest,
  identity: string,
  forceApproval = false,
  dependencies: MutationActionDependencies,
): void {
  const { patch } = request;
  const pre = code.closest("pre");
  if (!pre || pre.hasAttribute(PROCESSED_ATTRIBUTE)) return;
  if (approvalIsClaimed(identity)) return;
  pre.setAttribute(PROCESSED_ATTRIBUTE, "true");
  const preview = patchPreview(patch);
  const panel = createPanel();
  panel.hidden = false;
  renderPanel(
    panel,
    "Change requested",
    `${preview.files.length} file${preview.files.length === 1 ? "" : "s"} · +${preview.additions} -${preview.deletions}`,
    preview.files.join("\n"),
  );
  setupApprovalAction({
    pre,
    panel,
    identity,
    register: (...elements) => dependencies.registerAction(code, ...elements),
    forceApproval,
    onReject: () => renderPanel(panel, "Change rejected"),
    execute: async (authorization, controls) => {
      const rootPath = await dependencies.currentTaskRoot();
      renderPanel(panel, "Applying changes", rootPath);
      try {
        const response = await sendRepoBridgeMessage({
          type: "REPOBRIDGE_PATCH",
          ...chatSession(),
          patch,
          authorization,
        });
        if (!response.ok)
          throw new Error(`${response.error.code}: ${response.error.message}`);
        const result = response;
        const text = `<repobridge_result>\nroot: ${rootPath}\noperation: workspace.patch\nstatus: applied\ncheckpoint_id: ${result.result.checkpointId}\nfiles_changed: ${result.result.filesChanged.length}\n\nfiles:\n${result.result.filesChanged.join("\n")}\n</repobridge_result>`;
        renderPanel(
          panel,
          "Changes applied",
          `${rootPath} · ${result.result.filesChanged.length} file${result.result.filesChanged.length === 1 ? "" : "s"}`,
          result.result.filesChanged.join("\n"),
        );
        const undo = createActionButton("Undo changes");
        controls.hidden = false;
        controls.append(undo);
        await setDirectiveState(identity, "completed");
        await returnResultToChatGPT(controls, identity, text);
        undo.addEventListener("click", async (event) => {
          if (!isTrustedUserGesture(event)) return;
          undo.disabled = true;
          renderPanel(panel, "Undoing changes", rootPath);
          try {
            const undoResponse = await sendRepoBridgeMessage({
              type: "REPOBRIDGE_UNDO",
              ...chatSession(),
              checkpointId: result.result.checkpointId,
              authorization: "approved",
            });
            if (!undoResponse.ok)
              throw new Error(
                `${undoResponse.error.code}: ${undoResponse.error.message}`,
              );
            const undoResult = undoResponse;
            renderPanel(
              panel,
              "Changes undone",
              rootPath,
              undoResult.result.filesRestored.join("\n"),
            );
            undo.textContent = "Undone";
          } catch (cause) {
            await returnErrorToChatGPT(
              controls,
              `${identity}:undo`,
              "workspace.undo",
              cause,
              rootPath,
            );
            panel.textContent = [
              `RepoBridge undo request failed: ${cause instanceof Error ? cause.message : String(cause)}`,
              "",
              "The undo may have completed before the response was lost.",
              "Inspect repository state before trying another mutation.",
            ].join("\n");
          }
        });
      } catch (cause) {
        await setDirectiveState(identity, "failed");
        await returnErrorToChatGPT(
          controls,
          identity,
          "workspace.patch",
          cause,
          rootPath,
        );
        panel.textContent = [
          `RepoBridge patch request failed: ${cause instanceof Error ? cause.message : String(cause)}`,
          "",
          "The patch may have been applied before the response was lost.",
          "Inspect the repository state before issuing a new patch.",
        ].join("\n");
      }
    },
  });
}

export function addRunAction(
  code: HTMLElement,
  request: RepoBridgeRunRequest,
  identity: string,
  forceApproval = false,
  dependencies: MutationActionDependencies,
): void {
  const { command } = request;
  const pre = code.closest("pre");
  if (!pre || pre.hasAttribute(PROCESSED_ATTRIBUTE)) return;
  if (approvalIsClaimed(identity)) return;
  pre.setAttribute(PROCESSED_ATTRIBUTE, "true");
  const panel = createPanel();
  panel.hidden = false;
  renderPanel(
    panel,
    "Command requested",
    "Runs locally with your user permissions",
    command,
  );
  setupApprovalAction({
    pre,
    panel,
    identity,
    register: (...elements) => dependencies.registerAction(code, ...elements),
    forceApproval,
    onReject: () => renderPanel(panel, "Command rejected"),
    execute: async (authorization, controls) => {
      const rootPath = await dependencies.currentTaskRoot();
      renderPanel(panel, "Running command", rootPath, command);
      try {
        const response = await sendRepoBridgeMessage({
          type: "REPOBRIDGE_RUN",
          ...chatSession(),
          command,
          authorization,
        });
        if (!response.ok)
          throw new Error(`${response.error.code}: ${response.error.message}`);
        const result = response;
        const text = `<repobridge_result>\nroot: ${rootPath}\noperation: command.run\ncommand: ${command}\nexit_code: ${result.result.exitCode}\nduration_ms: ${result.result.durationMs}\ntimed_out: ${result.result.timedOut}\ntruncated: ${result.result.truncated}\n\nstdout:\n${result.result.stdout}${result.result.stderr ? `\n\nstderr:\n${result.result.stderr}` : ""}\n</repobridge_result>`;
        renderPanel(
          panel,
          result.result.exitCode === 0
            ? "Command complete"
            : `Command exited ${result.result.exitCode}`,
          `${rootPath} · ${result.result.durationMs} ms${result.result.truncated ? " · truncated" : ""}`,
          [
            result.result.stdout,
            result.result.stderr ? `stderr:\n${result.result.stderr}` : "",
          ]
            .filter(Boolean)
            .join("\n\n") || "No output",
        );
        await setDirectiveState(identity, "completed");
        await returnResultToChatGPT(controls, identity, text);
      } catch (cause) {
        await setDirectiveState(identity, "failed");
        await returnErrorToChatGPT(
          controls,
          identity,
          "command.run",
          cause,
          rootPath,
        );
        panel.textContent = [
          `RepoBridge command request failed: ${errorMessage(cause)}`,
          "",
          "The command may have executed before the response was lost.",
          "Inspect local state before issuing a new command.",
        ].join("\n");
      }
    },
  });
}

export function addExecAction(
  code: HTMLElement,
  request: RepoBridgeExecRequest,
  identity: string,
  forceApproval = false,
  dependencies: MutationActionDependencies,
): void {
  const pre = code.closest("pre");
  if (!pre || pre.hasAttribute(PROCESSED_ATTRIBUTE)) return;
  if (approvalIsClaimed(identity)) return;
  pre.setAttribute(PROCESSED_ATTRIBUTE, "true");

  const risk = classifyExecRisk(request);
  const commandDisplay = [request.executable, ...request.args].join(" ");
  const panel = createPanel();
  panel.hidden = false;
  renderPanel(
    panel,
    "Command requested",
    `${risk.charAt(0).toUpperCase()}${risk.slice(1)} risk`,
    commandDisplay,
  );
  setupApprovalAction({
    pre,
    panel,
    identity,
    register: (...elements) => dependencies.registerAction(code, ...elements),
    forceApproval,
    onReject: () => renderPanel(panel, "Command rejected", risk),
    execute: async (authorization, controls) => {
      const rootPath = await dependencies.currentTaskRoot();
      renderPanel(
        panel,
        "Running command",
        `${risk.charAt(0).toUpperCase()}${risk.slice(1)} risk · ${rootPath}`,
        commandDisplay,
      );
      try {
        const response = await sendRepoBridgeMessage({
          type: "REPOBRIDGE_EXEC",
          ...chatSession(),
          executable: request.executable,
          args: request.args,
          authorization,
        });
        if (!response.ok)
          throw new Error(`${response.error.code}: ${response.error.message}`);
        const result = response;
        const text = `<repobridge_result>\nroot: ${rootPath}\noperation: command.exec\nexecutable: ${result.result.executable}\nargs: ${JSON.stringify(result.result.args)}\nrisk: ${risk}\nexit_code: ${result.result.exitCode}\nduration_ms: ${result.result.durationMs}\ntimed_out: ${result.result.timedOut}\ntruncated: ${result.result.truncated}\n\nstdout:\n${result.result.stdout}${result.result.stderr ? `\n\nstderr:\n${result.result.stderr}` : ""}\n</repobridge_result>`;
        renderPanel(
          panel,
          result.result.exitCode === 0
            ? "Command complete"
            : `Command exited ${result.result.exitCode}`,
          `${rootPath} · ${result.result.durationMs} ms · ${risk.charAt(0).toUpperCase()}${risk.slice(1)} risk${result.result.truncated ? " · truncated" : ""}`,
          [
            result.result.stdout,
            result.result.stderr ? `stderr:\n${result.result.stderr}` : "",
          ]
            .filter(Boolean)
            .join("\n\n") || "No output",
        );
        await setDirectiveState(identity, "completed");
        await returnResultToChatGPT(controls, identity, text);
      } catch (cause) {
        await setDirectiveState(identity, "failed");
        await returnErrorToChatGPT(
          controls,
          identity,
          "command.exec",
          cause,
          rootPath,
        );
        panel.textContent = [
          `RepoBridge structured command request failed: ${errorMessage(cause)}`,
          "",
          "The command may have executed before the response was lost.",
          "Inspect local state before issuing it again.",
        ].join("\n");
      }
    },
  });
}
