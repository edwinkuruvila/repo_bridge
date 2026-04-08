const READONLY_TEXTBOX_SELECTOR = '[role="textbox"][aria-readonly="true"]';

export interface DirectiveCodeBlock {
  hasAttribute(name: string): boolean;
  querySelector(selector: string): DirectiveCodeContent | null;
}

export interface DirectiveCodeContent {
  innerText: string;
}

export function directiveCodeContent(
  pre: DirectiveCodeBlock,
): DirectiveCodeContent | undefined {
  return (
    pre.querySelector(READONLY_TEXTBOX_SELECTOR) ??
    pre.querySelector("code") ??
    undefined
  );
}

export function directiveCodeText(pre: DirectiveCodeBlock): string | undefined {
  return directiveCodeContent(pre)?.innerText.trim();
}

export function preferredDirectiveCodeText(
  pageText: string | undefined,
  domText: string | undefined,
): string | undefined {
  const page = pageText?.trim();
  const dom = domText?.trim();
  if (!page) return dom || undefined;
  if (!dom) return page;

  const normalizedPage = page.replace(/\r\n?/g, "\n");
  const normalizedDom = dom.replace(/\r\n?/g, "\n");
  const pageFirstLine = normalizedPage.split("\n", 1)[0];

  // ChatGPT can transiently expose only the first portion of a CodeMirror
  // document while the DOM already contains the complete block. Only prefer
  // the DOM candidate when it is an actual continuation of the page-world
  // text; sharing a directive marker alone is not enough.
  if (
    pageFirstLine?.startsWith("# kavrith:") &&
    normalizedDom.length > normalizedPage.length &&
    normalizedDom.startsWith(normalizedPage)
  ) {
    return dom;
  }

  return page;
}

export function isUnprocessedCodeBlock(
  pre: DirectiveCodeBlock,
  processedAttribute: string,
  claimingAttribute: string,
): boolean {
  return (
    !pre.hasAttribute(processedAttribute) &&
    !pre.hasAttribute(claimingAttribute)
  );
}
