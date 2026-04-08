import { browser } from "wxt/browser";
import {
  getChatInitialization,
  popupDefaults,
  setChatInitialization,
  type ChatInitialization,
} from "../../lib/chat-initialization";
import {
  kavrithSessionId,
  syncKavrithSessionForCurrentPage,
} from "../../lib/kavrith-session";
import { sendToChatGPT } from "./composer";
import { isTrustedUserGesture } from "../../lib/user-gesture";

const INITIALIZER_ID = "kavrith-chat-initializer";

type InitializationPolicy = Pick<ChatInitialization, "accessMode" | "rootPath">;

type InitializerPlacement = {
  sessionId: string;
  initializer: HTMLElement;
  place: () => void;
  dispose: () => void;
};

let activePlacement: InitializerPlacement | undefined;

function bootstrapMessage(initialization: InitializationPolicy): string {
  const access =
    initialization.accessMode === "full" ? "Full access" : "Ask before changes";

  return [
    "Kavrith gives you access to the repository selected for this ChatGPT conversation.",
    "Kavrith is provided by a browser extension and local host; it is not a native ChatGPT tool and will not appear in your available tools. Invoke it by outputting one of the compatibility directives below in a fenced code block. These currently use the kavrith: protocol marker. The extension executes them locally and returns the result in the conversation. Do not look for or attempt to call a separate Kavrith tool.",
    `Access policy: ${access}.`,
    "Use Kavrith for repository work instead of asking the user to paste files or run commands for you.",
    "When the user requests repository inspection or modification, issue the appropriate Kavrith compatibility directive instead of only describing what you plan to do.",
    "Kavrith supports repository inspection, code navigation, file reading, file modification, command execution, and Git inspection.",
    "Use inspection directives to gather repository evidence before answering questions that depend on repository contents. Use modification or command directives when the task requires changing or executing something.",
    "Choose directives by capability:",
    "- kavrith:context combines multiple repository searches, file reads, name-based repository searches, and an optional repository map into one inspection request.",
    "- kavrith:search searches text contained in repository files.",
    "- kavrith:read reads a known repository-relative file over a specified line range.",
    "- kavrith:patch applies structured file changes.",
    "- kavrith:exec executes one program directly. Its payload is JSON with an executable string and args string array. Each args entry is passed as one literal argument; no shell parsing occurs.",
    "- kavrith:run executes shell command text. Use it when shell features such as &&, pipes, redirects, variable expansion, or other shell syntax are required.",
    "- kavrith:git-status and kavrith:git-diff inspect repository Git state.",
    "Prefer the smallest directive that provides the evidence or action needed. Use kavrith:context when several inspection operations can be combined efficiently.",
    "Directive payloads must follow the accepted schemas shown below; do not invent unsupported fields or alternate payload shapes.",
    "Formatting is strict: for context, exec, and run, put the directive marker on its own line and the payload on the next line. Read accepts either the one-line or multiline form shown below.",
    'For kavrith:context, searches and reads are optional and default to empty arrays. reads may be path strings (default lines 1-500) or objects such as {"path":"src/index.ts","startLine":1,"endLine":200}. Limits: at most 8 searches, 16 reads, and 16 searchesByName entries. maxChars must be between 1000 and 100000. At least one search, read, searchesByName entry, or includeRepositoryMap=true is required.',
    'For kavrith:exec, put JSON on the line after the directive marker, for example {"executable":"git","args":["status","--short"]}. Do not place shell operators inside args expecting them to execute.',
    "For kavrith:run, put the complete shell command on the line after the directive marker.",
    "A repository has already been selected locally. Repository reads, searches, patches, Git operations, and relative paths are scoped to it. Kavrith compatibility directives do not select or change the repository.",
    "Command execution starts in the task root but runs with the local OS user's permissions. Do not use commands to access unrelated filesystem locations.",
    "A fenced code block containing a valid kavrith: directive is a live Kavrith action, not documentation. Never emit a valid directive merely as an example, illustration, recap, or explanation. Only emit one when you intend Kavrith to execute it in the current turn. When discussing directive syntax without intending execution, describe it in prose or use deliberately non-executable pseudocode.",
    "Emit at most one Kavrith compatibility directive per assistant turn, only when repository work is needed. Do not emit one after the requested repository work is complete.",
    "Put the directive in one fenced code block with the directive marker as the first text. Put payloads on the following line.",
    "Accepted forms:",
    '# kavrith:context\n{"searches":["query"],"reads":["README.md"],"searchesByName":[],"includeRepositoryMap":false,"maxChars":12000}',
    "# kavrith:search\nQUERY",
    "# kavrith:read relative/path startLine endLine",
    "or",
    "# kavrith:read\nrelative/path\nstartLine\nendLine",
    "# kavrith:patch\n*** Begin Patch\n...\n*** End Patch",
    '# kavrith:exec\n{"executable":"git","args":["status","--short"]}',
    "# kavrith:run\ncommand",
    "# kavrith:git-status",
    "# kavrith:git-diff",
    "# kavrith:git-diff\nstaged",
  ].join("\n");
}

function button(label: string): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = label;
  element.style.cssText = [
    "border:1px solid rgba(113,113,122,.35)",
    "border-radius:7px",
    "background:Canvas",
    "color:inherit",
    "min-height:28px",
    "padding:4px 8px",
    "cursor:pointer",
    "font:600 12px/1.4 ui-sans-serif,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
  ].join(";");
  return element;
}

function createInitializer(sessionId: string): HTMLDivElement {
  const root = document.createElement("div");
  root.id = INITIALIZER_ID;
  root.dataset.scope = sessionId;
  root.style.cssText =
    "position:fixed;z-index:2147483646;display:inline-flex;align-items:center;";

  const style = document.createElement("style");
  style.textContent = `
    #${INITIALIZER_ID} button:hover {
      background: color-mix(in srgb, CanvasText 6%, Canvas) !important;
    }
    #${INITIALIZER_ID} button:focus-visible,
    #${INITIALIZER_ID} input:focus-visible {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
  `;

  const badge = button("Kavrith");
  badge.style.display = "inline-flex";
  badge.style.alignItems = "center";
  badge.setAttribute("aria-haspopup", "dialog");
  badge.setAttribute("aria-expanded", "false");

  const panel = document.createElement("div");
  panel.hidden = true;
  panel.dataset.kavrithPanel = "true";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Kavrith");
  panel.style.cssText = [
    "position:absolute",
    "left:0",
    "bottom:calc(100% + 7px)",
    "z-index:2147483646",
    "width:280px",
    "padding:12px",
    "border:1px solid rgba(113,113,122,.35)",
    "border-radius:10px",
    "background:Canvas",
    "color:CanvasText",
    "box-shadow:0 8px 24px rgba(0,0,0,.14)",
    "max-height:min(420px,70vh)",
    "overflow:auto",
    "font:12px/1.4 ui-sans-serif,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
  ].join(";");

  const rootLabel = document.createElement("div");
  rootLabel.textContent = "Repository";
  rootLabel.style.cssText = "font-weight:650;margin-bottom:5px;";
  const rootRow = document.createElement("div");
  rootRow.style.cssText =
    "display:flex;gap:6px;align-items:center;margin-bottom:10px;";
  const rootValue = document.createElement("div");
  rootValue.style.cssText =
    "flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#71717a;font-size:11px;";
  rootValue.textContent = "Not selected";
  const chooseRoot = button("Choose");
  rootRow.append(rootValue, chooseRoot);

  const accessLabel = document.createElement("div");
  accessLabel.textContent = "Access";
  accessLabel.style.cssText = "font-weight:650;margin-bottom:5px;";

  const approvalLabel = document.createElement("label");
  approvalLabel.style.cssText = "display:block;margin:4px 0;";
  const approval = document.createElement("input");
  approval.type = "radio";
  approval.name = `kavrith-chat-access-${sessionId}`;
  approval.value = "approval";
  approvalLabel.append(approval, " Ask before changes");
  approvalLabel.title =
    "Repository reads run automatically. Edits and commands require your approval.";

  const fullLabel = document.createElement("label");
  fullLabel.style.cssText = "display:block;margin:4px 0 11px;";
  const full = document.createElement("input");
  full.type = "radio";
  full.name = `kavrith-chat-access-${sessionId}`;
  full.value = "full";
  fullLabel.append(full, " Full access");
  fullLabel.title =
    "Allows repository reads, edits, and commands without confirmation.";

  const action = button("Initialize");
  action.style.cssText +=
    ";width:100%;border-radius:7px;background:#18181b;color:#fff;border-color:#18181b;";

  const status = document.createElement("div");
  status.style.cssText =
    "margin-top:7px;color:#71717a;font-size:11px;line-height:1.4;";

  panel.append(
    rootLabel,
    rootRow,
    accessLabel,
    approvalLabel,
    fullLabel,
    action,
    status,
  );
  root.append(style, badge, panel);

  let selectedRootPath: string | undefined;
  let savedRootPath: string | undefined;
  let savedAccessMode: ChatInitialization["accessMode"] | undefined;
  let selectedAccessMode: ChatInitialization["accessMode"] = "approval";
  let initialized = false;

  const repositoryName = (path: string): string => {
    const normalized = path.replace(/[\\/]+$/, "");
    return normalized.split(/[\\/]/).at(-1) || path;
  };

  const updateAction = (): void => {
    if (!initialized) {
      action.hidden = false;
      action.textContent = "Connect repository";
      return;
    }
    const changed =
      selectedRootPath !== savedRootPath ||
      selectedAccessMode !== savedAccessMode;
    action.hidden = !changed;
    action.textContent = "Save";
  };

  const refresh = async (): Promise<void> => {
    try {
      const [initialization, defaults] = await Promise.all([
        getChatInitialization(sessionId),
        popupDefaults(),
      ]);

      if (initialization) {
        initialized = true;
        badge.title = "Kavrith active";
        approval.checked = initialization.accessMode === "approval";
        full.checked = initialization.accessMode === "full";
        selectedAccessMode = initialization.accessMode;
        selectedRootPath = initialization.rootPath;
        savedRootPath = initialization.rootPath;
        savedAccessMode = initialization.accessMode;
        rootValue.textContent = repositoryName(initialization.rootPath);
        rootValue.title = initialization.rootPath;
        chooseRoot.textContent = "Change";
      } else {
        initialized = false;
        badge.title = "Kavrith ready";
        approval.checked = defaults.accessMode === "approval";
        full.checked = defaults.accessMode === "full";
        selectedAccessMode = defaults.accessMode;
        selectedRootPath = undefined;
        savedRootPath = undefined;
        savedAccessMode = undefined;
        rootValue.textContent = "Not selected";
        rootValue.title = "";
        chooseRoot.textContent = "Choose";
      }

      action.disabled = false;
      status.textContent = "";
      updateAction();
    } catch (cause) {
      status.textContent =
        cause instanceof Error ? cause.message : String(cause);
    }
  };

  chooseRoot.addEventListener("click", async (event) => {
    if (!isTrustedUserGesture(event)) return;
    chooseRoot.disabled = true;
    chooseRoot.textContent = "Choosing…";
    status.textContent = "";
    try {
      const response = (await browser.runtime.sendMessage({
        type: "pick-task-root",
      })) as
        | { ok: true; result: { rootPath: string | null } }
        | { ok: false; error: { code: string; message: string } };
      if (!response.ok)
        throw new Error(`${response.error.code}: ${response.error.message}`);
      if (response.result.rootPath) {
        selectedRootPath = response.result.rootPath;
        rootValue.textContent = repositoryName(selectedRootPath);
        rootValue.title = selectedRootPath;
        updateAction();
      }
      status.textContent = "";
    } catch (cause) {
      status.textContent =
        cause instanceof Error ? cause.message : String(cause);
    } finally {
      chooseRoot.disabled = false;
      chooseRoot.textContent = selectedRootPath ? "Change" : "Choose";
    }
  });

  approval.addEventListener("change", (event) => {
    if (!isTrustedUserGesture(event)) {
      approval.checked = selectedAccessMode === "approval";
      return;
    }
    selectedAccessMode = "approval";
    updateAction();
  });
  full.addEventListener("change", (event) => {
    if (!isTrustedUserGesture(event)) {
      full.checked = selectedAccessMode === "full";
      return;
    }
    selectedAccessMode = "full";
    updateAction();
  });

  const closePanel = (): void => {
    panel.hidden = true;
    badge.setAttribute("aria-expanded", "false");
  };

  badge.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    badge.setAttribute("aria-expanded", String(!panel.hidden));
    if (!panel.hidden) void refresh();
  });

  root.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || panel.hidden) return;
    closePanel();
    badge.focus();
  });

  document.addEventListener(
    "pointerdown",
    (event) => {
      if (!panel.hidden && !event.composedPath().includes(root)) closePanel();
    },
    { capture: true },
  );

  action.addEventListener("click", async (event) => {
    if (!isTrustedUserGesture(event)) return;
    action.disabled = true;
    action.textContent = initialized ? "Saving…" : "Connecting…";
    status.textContent = "";

    try {
      const previous = await getChatInitialization(sessionId);
      const accessMode = selectedAccessMode;
      const rootPath = selectedRootPath ?? previous?.rootPath;
      if (!rootPath) throw new Error("Select a repository first");

      const initialization: ChatInitialization = {
        sessionId,
        rootPath,
        accessMode,
        initializedAt: previous?.initializedAt ?? new Date().toISOString(),
        ...(previous?.bootstrappedAt
          ? { bootstrappedAt: previous.bootstrappedAt }
          : {}),
      };

      if (!initialization.bootstrappedAt) {
        await setChatInitialization(initialization);
        const sent = await sendToChatGPT(bootstrapMessage(initialization));
        if (!sent.ok) {
          if (previous) await setChatInitialization(previous);
          throw new Error(sent.message);
        }
        initialization.bootstrappedAt = new Date().toISOString();
        await setChatInitialization(initialization);
      } else {
        await setChatInitialization(initialization);
      }

      await refresh();
      closePanel();
    } catch (cause) {
      status.textContent =
        cause instanceof Error ? cause.message : String(cause);
      action.disabled = false;
    }
  });

  void refresh();
  return root;
}

export function ensureChatInitializer(): void {
  void syncKavrithSessionForCurrentPage().then(() => {
    renderChatInitializer();
  });
}

function renderChatInitializer(): void {
  const sessionId = kavrithSessionId();
  const initializers = [
    ...document.querySelectorAll<HTMLElement>(`#${INITIALIZER_ID}`),
  ];
  const existing = initializers[0];

  for (const duplicate of initializers.slice(1)) {
    duplicate.remove();
  }

  if (
    existing?.dataset.scope === sessionId &&
    activePlacement?.sessionId === sessionId &&
    activePlacement.initializer === existing
  ) {
    activePlacement.place();
    return;
  }
  activePlacement?.dispose();
  existing?.remove();
  activePlacement = undefined;

  const composer = document.querySelector("#prompt-textarea");
  if (!composer) return;

  const initializer = createInitializer(sessionId);
  document.body.append(initializer);
  const panel = initializer.querySelector<HTMLElement>("[data-kavrith-panel]");

  let observedContainer: Element | undefined;
  const observer = new ResizeObserver(() => place());

  const currentContainer = (): Element | undefined => {
    const currentComposer = document.querySelector("#prompt-textarea");
    return (
      currentComposer?.closest("form") ??
      currentComposer?.parentElement?.parentElement ??
      currentComposer?.parentElement ??
      undefined
    );
  };

  const place = (): void => {
    if (!initializer.isConnected) return;
    const container = currentContainer();
    if (!container?.isConnected) return;

    if (observedContainer !== container) {
      observer.disconnect();
      observer.observe(container);
      observedContainer = container;
    }

    const rect = container.getBoundingClientRect();
    const width = initializer.offsetWidth || 92;
    const height = initializer.offsetHeight || 28;
    const left = Math.max(
      8,
      Math.min(rect.left + 8, window.innerWidth - width - 8),
    );
    const preferredTop = rect.top - height - 6;
    const placeBelow = preferredTop < 8;
    const top = placeBelow
      ? Math.min(rect.bottom + 6, window.innerHeight - height - 8)
      : preferredTop;
    initializer.style.left = `${Math.round(left)}px`;
    initializer.style.top = `${Math.round(top)}px`;
    if (panel) {
      const panelWidth = panel.offsetWidth || 280;
      const panelLeft = Math.min(0, window.innerWidth - 8 - left - panelWidth);
      panel.style.left = `${Math.round(panelLeft)}px`;

      if (!panel.hidden) {
        const panelHeight = panel.offsetHeight;
        const availableAbove = top - 8;
        const availableBelow = window.innerHeight - (top + height) - 8;
        const panelBelow =
          availableAbove < panelHeight + 7 && availableBelow >= availableAbove;
        panel.style.top = panelBelow ? "calc(100% + 7px)" : "";
        panel.style.bottom = panelBelow ? "" : "calc(100% + 7px)";
      }
    }
  };

  place();
  requestAnimationFrame(place);

  let panelObserver: MutationObserver | undefined;
  if (panel) {
    panelObserver = new MutationObserver(place);
    panelObserver.observe(panel, {
      attributes: true,
      attributeFilter: ["hidden"],
    });
  }
  window.addEventListener("resize", place, { passive: true });
  window.addEventListener("scroll", place, { passive: true, capture: true });

  const dispose = (): void => {
    observer.disconnect();
    panelObserver?.disconnect();
    window.removeEventListener("resize", place);
    window.removeEventListener("scroll", place, true);
  };

  activePlacement = {
    sessionId,
    initializer,
    place,
    dispose,
  };
}
