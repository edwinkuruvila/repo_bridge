import type { KavrithContextRequest } from "../../lib/chatgpt-context";
import type { KavrithSearchRequest } from "../../lib/chatgpt-search";
import {
  formatKavrithReadResult,
  formatKavrithResult,
} from "../../lib/kavrith-result";
import { sendKavrithMessage } from "../../lib/background-client";
import { kavrithSessionId } from "../../lib/kavrith-session";
import { setDirectiveState } from "./directive-scanner";
import { enqueueAutomaticOperation } from "./operation-queue";
import { returnErrorToChatGPT, returnResultToChatGPT } from "./result-delivery";
import {
  collapsePanel,
  createControls,
  createPanel,
  displayError,
  renderPanel,
} from "./result-ui";

const PROCESSED_ATTRIBUTE = "data-kavrith-action";

type InspectionActionDependencies = {
  currentTaskRoot: () => Promise<string>;
  registerAction: (code: HTMLElement, ...elements: HTMLElement[]) => void;
};

function chatSession(): { sessionId: string } {
  return { sessionId: kavrithSessionId() };
}

export function addSearchAction(
  code: HTMLElement,
  request: KavrithSearchRequest,
  identity: string,
  dependencies: InspectionActionDependencies,
): void {
  const { query } = request;
  const pre = code.closest("pre");
  if (!pre || pre.hasAttribute(PROCESSED_ATTRIBUTE)) return;
  pre.setAttribute(PROCESSED_ATTRIBUTE, "true");

  const controls = createControls();
  const panel = createPanel();
  panel.hidden = false;
  dependencies.registerAction(code, controls, panel);
  pre.append(controls, panel);

  enqueueAutomaticOperation(async () => {
    const rootPath = await dependencies.currentTaskRoot();
    renderPanel(panel, "Searching repository", rootPath, query);
    try {
      const response = await sendKavrithMessage({
        type: "KAVRITH_SEARCH",
        ...chatSession(),
        query,
      });
      if (!response.ok) {
        throw new Error(`${response.error.code}: ${response.error.message}`);
      }
      const searchResponse = response;
      collapsePanel(
        panel,
        searchResponse.result.noMatches ? "No matches" : "Search complete",
        `${searchResponse.result.durationMs} ms${searchResponse.result.truncated ? " · truncated" : ""}`,
      );
      await returnResultToChatGPT(
        controls,
        identity,
        formatKavrithResult(rootPath, query, searchResponse),
      );
      await setDirectiveState(identity, "completed");
    } catch (cause) {
      await setDirectiveState(identity, "failed");
      panel.textContent = displayError(cause);
      await returnErrorToChatGPT(
        controls,
        identity,
        "inspection.search",
        cause,
        rootPath,
      );
    }
  });
}

export function addReadAction(
  code: HTMLElement,
  path: string,
  startLine: number,
  endLine: number,
  identity: string,
  dependencies: InspectionActionDependencies,
): void {
  const pre = code.closest("pre");
  if (!pre || pre.hasAttribute(PROCESSED_ATTRIBUTE)) return;
  pre.setAttribute(PROCESSED_ATTRIBUTE, "true");

  const controls = createControls();
  const panel = createPanel();
  panel.hidden = false;
  dependencies.registerAction(code, controls, panel);
  pre.append(controls, panel);

  enqueueAutomaticOperation(async () => {
    const rootPath = await dependencies.currentTaskRoot();
    renderPanel(
      panel,
      "Reading file",
      rootPath,
      `${path}:${startLine}-${endLine}`,
    );
    try {
      const response = await sendKavrithMessage({
        type: "KAVRITH_READ",
        ...chatSession(),
        path,
        startLine,
        endLine,
      });
      if (!response.ok) {
        throw new Error(`${response.error.code}: ${response.error.message}`);
      }
      const readResponse = response;
      collapsePanel(
        panel,
        "Read complete",
        `${readResponse.result.path}:${readResponse.result.startLine}-${readResponse.result.actualEndLine}${readResponse.result.truncated ? " · truncated" : ""}`,
      );
      await returnResultToChatGPT(
        controls,
        identity,
        formatKavrithReadResult(rootPath, readResponse),
      );
      await setDirectiveState(identity, "completed");
    } catch (cause) {
      await setDirectiveState(identity, "failed");
      panel.textContent = displayError(cause);
      await returnErrorToChatGPT(
        controls,
        identity,
        "inspection.read",
        cause,
        rootPath,
      );
    }
  });
}

export function addContextAction(
  code: HTMLElement,
  request: KavrithContextRequest,
  identity: string,
  dependencies: InspectionActionDependencies,
): void {
  const pre = code.closest("pre");
  if (!pre || pre.hasAttribute(PROCESSED_ATTRIBUTE)) return;
  pre.setAttribute(PROCESSED_ATTRIBUTE, "true");

  const controls = createControls();
  const panel = createPanel();
  panel.hidden = false;
  dependencies.registerAction(code, controls, panel);
  pre.append(controls, panel);

  enqueueAutomaticOperation(async () => {
    const rootPath = await dependencies.currentTaskRoot();

    renderPanel(
      panel,
      "Gathering repository context",
      [
        rootPath,
        `${request.searches.length} searches`,
        `${request.reads.length} reads`,
        ...((request.searchesByName?.length ?? 0) > 0
          ? [`${request.searchesByName?.length ?? 0} name searches`]
          : []),
        ...(request.includeRepositoryMap ? ["repository map"] : []),
      ].join(" · "),
    );

    try {
      const response = await sendKavrithMessage({
        type: "KAVRITH_CONTEXT",
        ...chatSession(),
        searches: request.searches,
        reads: request.reads,
        ...(request.searchesByName === undefined
          ? {}
          : { searchesByName: request.searchesByName }),
        ...(request.includeRepositoryMap === undefined
          ? {}
          : { includeRepositoryMap: request.includeRepositoryMap }),
        ...(request.maxChars === undefined
          ? {}
          : { maxChars: request.maxChars }),
      });
      if (!response.ok) {
        throw new Error(`${response.error.code}: ${response.error.message}`);
      }

      const context = response;
      const searchCount = context.result.sections.filter(
        (section) => section.kind === "search",
      ).length;
      const readCount = context.result.sections.filter(
        (section) => section.kind === "read",
      ).length;
      const mapCount = context.result.sections.filter(
        (section) => section.kind === "repository-map",
      ).length;
      collapsePanel(
        panel,
        "Context complete",
        [
          `${searchCount} searches`,
          `${readCount} reads`,
          ...(mapCount > 0 ? ["map"] : []),
          ...(context.result.truncated ? ["truncated"] : []),
        ].join(" · "),
      );

      const sections = context.result.sections
        .map((section, index) => {
          if (section.kind === "search") {
            return [
              `<section index="${index + 1}" kind="search" query=${JSON.stringify(section.query)} no_matches="${section.noMatches}" truncated="${section.truncated}">`,
              section.content || "(no matches)",
              "</section>",
            ].join("\n");
          }
          if (section.kind === "read") {
            return [
              `<section index="${index + 1}" kind="read" path=${JSON.stringify(section.path)} lines="${section.startLine}-${section.actualEndLine}" truncated="${section.truncated}">`,
              section.content || "(no content)",
              "</section>",
            ].join("\n");
          }
          return [
            `<section index="${index + 1}" kind="repository-map" provider=${JSON.stringify(section.provider)} entry_count="${section.entryCount}" truncated="${section.truncated}">`,
            section.content || "(no repository map available)",
            "</section>",
          ].join("\n");
        })
        .join("\n\n");

      const text = [
        "<kavrith_context>",
        `root: ${rootPath}`,
        "operation: inspection.context",
        `sections: ${context.result.sections.length}`,
        `used_chars: ${context.result.usedChars}`,
        `max_chars: ${context.result.maxChars}`,
        `truncated: ${context.result.truncated}`,
        "",
        sections,
        "</kavrith_context>",
      ].join("\n");

      await returnResultToChatGPT(controls, identity, text);
      await setDirectiveState(identity, "completed");
    } catch (cause) {
      await setDirectiveState(identity, "failed");
      panel.textContent = displayError(cause);
      await returnErrorToChatGPT(
        controls,
        identity,
        "inspection.context",
        cause,
        rootPath,
      );
    }
  });
}

export function addGitAction(
  code: HTMLElement,
  type: "status" | "diff",
  identity: string,
  staged = false,
  dependencies: InspectionActionDependencies,
): void {
  const pre = code.closest("pre");
  if (!pre || pre.hasAttribute(PROCESSED_ATTRIBUTE)) return;
  pre.setAttribute(PROCESSED_ATTRIBUTE, "true");
  const controls = createControls();
  const panel = createPanel();
  panel.hidden = false;
  dependencies.registerAction(code, controls, panel);
  pre.append(controls, panel);

  enqueueAutomaticOperation(async () => {
    const rootPath = await dependencies.currentTaskRoot();
    renderPanel(
      panel,
      type === "status" ? "Checking Git status" : "Reading Git diff",
      rootPath,
    );

    try {
      if (type === "status") {
        const response = await sendKavrithMessage({
          type: "KAVRITH_GIT_STATUS",
          ...chatSession(),
        });
        if (!response.ok) {
          throw new Error(`${response.error.code}: ${response.error.message}`);
        }

        const result = response.result;
        const text = `<kavrith_result>\nroot: ${rootPath}\noperation: git.status\nbranch: ${result.branch}\nclean: ${result.clean}\ntruncated: ${result.truncated}\n\nentries:\n${result.entries.join("\n") || "(clean)"}\n</kavrith_result>`;
        collapsePanel(
          panel,
          result.clean ? "Working tree clean" : "Git status complete",
          `${result.branch}${result.truncated ? " · truncated" : ""}`,
        );
        await returnResultToChatGPT(controls, identity, text);
      } else {
        const response = await sendKavrithMessage({
          type: "KAVRITH_GIT_DIFF",
          ...chatSession(),
          staged,
        });
        if (!response.ok) {
          throw new Error(`${response.error.code}: ${response.error.message}`);
        }

        const result = response.result;
        const text = `<kavrith_result>\nroot: ${rootPath}\noperation: git.diff\nstaged: ${result.staged}\ntruncated: ${result.truncated}\n\ndiff:\n${result.diff || "(no diff)"}\n</kavrith_result>`;
        collapsePanel(
          panel,
          result.staged ? "Staged diff complete" : "Diff complete",
          result.truncated ? "truncated" : undefined,
        );
        await returnResultToChatGPT(controls, identity, text);
      }

      await setDirectiveState(identity, "completed");
    } catch (cause) {
      await setDirectiveState(identity, "failed");
      panel.textContent = displayError(cause);
      await returnErrorToChatGPT(
        controls,
        identity,
        type === "status" ? "git.status" : "git.diff",
        cause,
        rootPath,
      );
    }
  });
}
