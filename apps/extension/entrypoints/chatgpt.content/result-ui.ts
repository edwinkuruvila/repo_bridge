export function createPanel(): HTMLDivElement {
  const panel = document.createElement("div");
  panel.className = "repobridge-result";
  panel.style.cssText = [
    "margin:8px 0 0",
    "padding:10px 11px",
    "border:1px solid color-mix(in srgb, CanvasText 16%, transparent)",
    "border-radius:8px",
    "background:color-mix(in srgb, CanvasText 3%, Canvas)",
    "color:CanvasText",
    "overflow-wrap:anywhere",
    'font:13px/1.45 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
  ].join(";");
  return panel;
}

export function renderPanel(
  panel: HTMLDivElement,
  title: string,
  detail?: string,
  body?: string,
): void {
  panel.replaceChildren();

  const heading = document.createElement("div");
  heading.textContent = title;
  heading.style.cssText = "font-weight:650;line-height:1.35;";
  panel.append(heading);

  if (detail) {
    const meta = document.createElement("div");
    meta.textContent = detail;
    meta.style.cssText =
      "margin-top:2px;color:color-mix(in srgb, CanvasText 58%, transparent);font-size:11px;line-height:1.4;";
    panel.append(meta);
  }

  if (body) {
    const largeOutput = body.length > 2_000 || body.split("\n").length > 24;
    const output = document.createElement("pre");
    output.textContent = body;
    output.style.cssText = [
      "margin:10px 0 0",
      "padding:9px 10px",
      "max-height:300px",
      "overflow:auto",
      "border:1px solid color-mix(in srgb, CanvasText 10%, transparent)",
      "border-radius:6px",
      "background:color-mix(in srgb, CanvasText 4%, Canvas)",
      "color:CanvasText",
      "white-space:pre-wrap",
      "overflow-wrap:anywhere",
      "font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace",
    ].join(";");

    if (largeOutput) {
      const details = document.createElement("details");
      details.style.cssText = "margin-top:8px;";
      const summary = document.createElement("summary");
      summary.textContent = "Show output";
      summary.style.cssText =
        "cursor:pointer;font-size:11px;font-weight:600;user-select:none;";
      output.style.marginTop = "7px";
      details.append(summary, output);
      panel.append(details);
    } else {
      panel.append(output);
    }
  }
}

export function createControls(): HTMLDivElement {
  const controls = document.createElement("div");
  controls.hidden = true;
  controls.style.cssText =
    "margin-top:8px;display:flex;gap:7px;align-items:center;flex-wrap:wrap;";
  return controls;
}

export function collapsePanel(
  panel: HTMLDivElement,
  title: string,
  detail?: string,
): void {
  panel.replaceChildren();
  panel.style.padding = "7px 9px";

  const row = document.createElement("div");
  row.style.cssText =
    "display:flex;align-items:center;justify-content:space-between;gap:10px;";

  const heading = document.createElement("div");
  heading.textContent = title;
  heading.style.cssText = "font-weight:600;line-height:1.35;";
  row.append(heading);

  if (detail) {
    const meta = document.createElement("div");
    meta.textContent = detail;
    meta.style.cssText =
      "min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:color-mix(in srgb, CanvasText 54%, transparent);font-size:10px;";
    row.append(meta);
  }

  panel.append(row);
}

export function createActionButton(
  label: string,
  tone: "primary" | "secondary" | "danger" = "secondary",
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  const palette =
    tone === "primary"
      ? "background:CanvasText;color:Canvas;border-color:CanvasText;"
      : tone === "danger"
        ? "background:transparent;color:#dc2626;border-color:color-mix(in srgb, #dc2626 38%, transparent);"
        : "background:transparent;color:CanvasText;border-color:color-mix(in srgb, CanvasText 22%, transparent);";
  button.style.cssText = [
    "min-height:28px",
    "padding:4px 9px",
    "border:1px solid",
    "border-radius:7px",
    palette,
    "cursor:pointer",
    'font:600 12px/1.4 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
  ].join(";");
  button.addEventListener("focus", () => {
    if (button.matches(":focus-visible")) {
      button.style.outline = "2px solid Highlight";
      button.style.outlineOffset = "2px";
    }
  });
  button.addEventListener("blur", () => {
    button.style.outline = "";
    button.style.outlineOffset = "";
  });
  return button;
}

export function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

export function displayError(cause: unknown): string {
  const message = errorMessage(cause);
  if (message.includes("Receiving end does not exist")) {
    return "RepoBridge failed: extension background unavailable. Reload this ChatGPT tab after reloading the temporary extension.";
  }
  return `RepoBridge failed: ${message}`;
}
