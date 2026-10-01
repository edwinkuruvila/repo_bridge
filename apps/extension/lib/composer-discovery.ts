const COMPOSER_SELECTORS = [
  "[data-composer-markdown][contenteditable='true']",
  "[role='textbox'][contenteditable='true'][aria-label='Ask ChatGPT']",
  "#prompt-textarea[contenteditable='true']",
  "textarea#prompt-textarea",
  "textarea[data-testid='prompt-textarea']",
] as const;

function composerCandidates(root: ParentNode): HTMLElement[] {
  const candidates: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();

  for (const selector of COMPOSER_SELECTORS) {
    for (const composer of root.querySelectorAll<HTMLElement>(selector)) {
      if (seen.has(composer)) continue;
      seen.add(composer);
      candidates.push(composer);
    }
  }

  return candidates;
}

function isExplicitlyHidden(composer: HTMLElement): boolean {
  return Boolean(
    composer.hidden ||
      composer.getAttribute("aria-hidden") === "true" ||
      composer.closest("[hidden], [aria-hidden='true'], [inert]"),
  );
}

function isCurrentVisibleComposer(
  composer: HTMLElement,
  root: ParentNode,
): boolean {
  if (isExplicitlyHidden(composer)) return false;

  // Synthetic DOMs used by unit tests do not perform browser layout.
  // In the real ChatGPT document, require a rendered box so stale editors
  // left mounted by client-side navigation are not selected.
  if (
    typeof document !== "undefined" &&
    root === document &&
    typeof composer.getClientRects === "function"
  ) {
    return composer.getClientRects().length > 0;
  }

  return true;
}

export function findComposer(
  root: ParentNode = document,
): HTMLElement | undefined {
  return composerCandidates(root).find((composer) =>
    isCurrentVisibleComposer(composer, root),
  );
}

export function composerContainer(composer: HTMLElement): Element | undefined {
  return (
    composer.closest("[data-composer-footer-responsive]") ??
    composer.closest("form") ??
    composer.parentElement?.parentElement ??
    composer.parentElement ??
    undefined
  );
}
