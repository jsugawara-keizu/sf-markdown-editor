import { renderMarkdown, renderMarkdownAsync } from './renderer';
import { parseMarkdownAst, extractHeadings, buildToc } from './parser';
import { createSanitizer, sanitizeHtml, sanitizeSvg } from './sanitize';
import { setMermaidDebugEnabled, isMermaidDebugEnabled } from './debug';
import type { Heading } from './parser';
import type { Sanitizer, SanitizerOptions } from './sanitize';
import type { MermaidCompiler } from './mermaid-transform';

export {
  renderMarkdown,
  renderMarkdownAsync,
  parseMarkdownAst,
  extractHeadings,
  buildToc,
  createSanitizer,
  sanitizeHtml,
  sanitizeSvg,
  setMermaidDebugEnabled,
  isMermaidDebugEnabled,
};

export type {
  Heading,
  Sanitizer,
  SanitizerOptions,
  MermaidCompiler,
};

export function renderAndSanitize(markdown: string): string {
  return renderMarkdown(markdown);
}

export async function renderAndSanitizeAsync(markdown: string): Promise<string> {
  return renderMarkdownAsync(markdown);
}
