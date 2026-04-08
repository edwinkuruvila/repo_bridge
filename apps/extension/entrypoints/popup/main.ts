import { browser } from "wxt/browser";
import { ACCESS_MODE_STORAGE_KEY, type AccessMode } from "../../lib/messages";

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Popup element is missing: ${selector}`);
  return element;
}

const connectionTitle = requiredElement<HTMLElement>("#connection-title");
const connectionDetail = requiredElement<HTMLElement>("#connection-detail");
const connectionDot = requiredElement<HTMLElement>("#connection-dot");
const connectionCard = requiredElement<HTMLElement>("#connection-card");
const version = requiredElement<HTMLElement>("#version");
const approvalMode = requiredElement<HTMLInputElement>("#mode-approval");
const fullMode = requiredElement<HTMLInputElement>("#mode-full");

function setConnection(
  state: "connected" | "error",
  title: string,
  detail: string,
): void {
  connectionTitle.textContent = title;
  connectionDetail.textContent = detail;
  connectionDot.dataset.state = state;
}

async function loadAccessMode(): Promise<void> {
  const stored = await browser.storage.local.get(ACCESS_MODE_STORAGE_KEY);
  const mode: AccessMode =
    stored[ACCESS_MODE_STORAGE_KEY] === "full" ? "full" : "approval";
  approvalMode.checked = mode === "approval";
  fullMode.checked = mode === "full";
}

async function checkConnection(): Promise<void> {
  try {
    const response = (await browser.runtime.sendMessage({
      type: "ping-host",
    })) as
      | { ok: true; result: { message: string } }
      | { ok: false; error: { code: string; message: string } };
    if (!response.ok)
      throw new Error(`${response.error.code}: ${response.error.message}`);
    connectionCard.hidden = true;
  } catch (cause) {
    connectionCard.hidden = false;
    setConnection(
      "error",
      "Local host unavailable",
      cause instanceof Error ? cause.message : String(cause),
    );
  }
}

for (const input of [approvalMode, fullMode]) {
  input.addEventListener("change", () => {
    if (input.checked)
      void browser.storage.local.set({
        [ACCESS_MODE_STORAGE_KEY]: input.value as AccessMode,
      });
  });
}

version.textContent = `v${browser.runtime.getManifest().version}`;
void checkConnection();
void loadAccessMode();
