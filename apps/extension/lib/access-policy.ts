type AccessMode = "approval" | "full";

export function shouldAutoExecuteCommand(
  accessMode: AccessMode,
  forceApproval: boolean,
): boolean {
  return !forceApproval && accessMode === "full";
}
