const COMPOSER_SELECTORS = [
  "[data-composer-markdown][contenteditable='true']",
  "[role='textbox'][contenteditable='true'][aria-label='Ask ChatGPT']",
  "#prompt-textarea[contenteditable='true']",
  "textarea#prompt-textarea",
  "textarea[data-testid='prompt-textarea']",
] as const;

export function findComposer(
  root: ParentNode = document,
): HTMLElement | undefined {
  for (const selector of COMPOSER_SELECTORS) {
    const composer = root.querySelector<HTMLElement>(selector);
    if (composer) return composer;
  }
  return undefined;
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
