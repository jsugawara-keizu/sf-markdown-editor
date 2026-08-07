import { renderMarkdown, renderMarkdownAsync, setExternalMermaidCompiler } from './renderer';
import { parseMarkdownAst, extractHeadings, buildToc } from './parser';
import { createSanitizer, sanitizeHtml, sanitizeSvg } from './sanitize';
import { setMermaidDebugEnabled, isMermaidDebugEnabled } from './debug';
import { createMermaidFrameCompiler } from './mermaid-frame-compiler';
import type { Heading } from './parser';
import type { Sanitizer, SanitizerOptions } from './sanitize';
import type { MermaidCompiler } from './mermaid-transform';
import type { MermaidFrameCompilerOptions } from './mermaid-frame-compiler';

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
  setExternalMermaidCompiler,
  createMermaidFrameCompiler,
};

export type {
  Heading,
  Sanitizer,
  SanitizerOptions,
  MermaidCompiler,
  MermaidFrameCompilerOptions,
};

export function renderAndSanitize(markdown: string): string {
  return renderMarkdown(markdown);
}

export async function renderAndSanitizeAsync(markdown: string): Promise<string> {
  return renderMarkdownAsync(markdown);
}
