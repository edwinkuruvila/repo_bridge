import { browser } from "wxt/browser";
import { shouldAutoExecuteCommand } from "../../lib/access-policy";
import { getChatInitialization } from "../../lib/chat-initialization";
import { ACCESS_MODE_STORAGE_KEY, type AccessMode } from "../../lib/messages";
import { repobridgeSessionId } from "../../lib/repobridge-session";
import { setDirectiveState } from "./directive-scanner";
import { enqueueAutomaticOperation } from "./operation-queue";
import { createActionButton, createControls } from "./result-ui";
import { isTrustedUserGesture } from "../../lib/user-gesture";

const claimedApprovalOperations = new Set<string>();
export type MutationAuthorization = "approved" | "full";

export function approvalIsClaimed(identity: string): boolean {
  return claimedApprovalOperations.has(identity);
}

async function getAccessMode(): Promise<AccessMode> {
  const sessionId = repobridgeSessionId();
  const initialization = await getChatInitialization(sessionId);
  if (initialization) return initialization.accessMode;

  const stored = await browser.storage.local.get(ACCESS_MODE_STORAGE_KEY);
  return stored[ACCESS_MODE_STORAGE_KEY] === "full" ? "full" : "approval";
}

export function setupApprovalAction(options: {
  pre: HTMLElement;
  panel: HTMLDivElement;
  identity: string;
  forceApproval: boolean;
  register: (...elements: HTMLElement[]) => void;
  onReject: () => void;
  execute: (
    authorization: MutationAuthorization,
    controls: HTMLDivElement,
  ) => Promise<void>;
}): void {
  const { pre, panel, identity, forceApproval, register, onReject, execute } =
    options;

  const controls = createControls();
  controls.hidden = true;
  const reject = createActionButton("Reject", "danger");
  const approve = createActionButton("Approve", "primary");
  controls.append(reject, approve);

  const setDisabled = (disabled: boolean): void => {
    for (const button of controls.querySelectorAll<HTMLButtonElement>(
      "button",
    )) {
      button.disabled = disabled;
    }
  };

  const clearControls = (): void => {
    controls.replaceChildren();
    controls.hidden = true;
  };

  const claimAndExecute = async (
    authorization: MutationAuthorization,
  ): Promise<void> => {
    if (claimedApprovalOperations.has(identity)) return;
    claimedApprovalOperations.add(identity);
    setDisabled(true);
    clearControls();
    await setDirectiveState(identity, "running");
    await execute(authorization, controls);
  };

  reject.addEventListener("click", (event) => {
    if (!isTrustedUserGesture(event)) return;
    if (claimedApprovalOperations.has(identity)) return;
    claimedApprovalOperations.add(identity);
    setDisabled(true);
    void setDirectiveState(identity, "rejected");
    onReject();
    clearControls();
  });

  approve.addEventListener("click", (event) => {
    if (!isTrustedUserGesture(event)) return;
    void claimAndExecute("approved");
  });

  register(controls, panel);
  pre.append(controls, panel);
  void setDirectiveState(identity, "pending");

  void getAccessMode().then((mode) => {
    if (shouldAutoExecuteCommand(mode, forceApproval)) {
      enqueueAutomaticOperation(() => claimAndExecute("full"));
    } else {
      controls.hidden = false;
    }
  });
}
