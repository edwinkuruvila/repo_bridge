export const ASSISTANT_MESSAGE_SELECTOR =
  "[data-message-author-role='assistant'], [data-chatgpt-search-unit-key$=':assistant'], [data-content-search-unit-key$=':assistant']";

export const CODE_BLOCK_SELECTOR = "pre, [data-markdown-copy='code-block']";

export function assistantMessageForNode(node: Node): HTMLElement | undefined {
  const element = node instanceof HTMLElement ? node : node.parentElement;
  return element?.closest<HTMLElement>(ASSISTANT_MESSAGE_SELECTOR) ?? undefined;
}

export function assistantCodeBlocks(root: ParentNode): HTMLElement[] {
  const blocks: HTMLElement[] = [];
  if (root instanceof HTMLElement && root.matches(CODE_BLOCK_SELECTOR)) {
    blocks.push(root);
  }
  blocks.push(...root.querySelectorAll<HTMLElement>(CODE_BLOCK_SELECTOR));

  return blocks.filter((block) => {
    if (!assistantMessageForNode(block)) return false;
    // Rendered blocks and RepoBridge result panels can contain nested <pre>s.
    return !block.parentElement?.closest(CODE_BLOCK_SELECTOR);
  });
}
