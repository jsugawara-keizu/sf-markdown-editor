import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeSlug from 'rehype-slug';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import type { Root as MdastRoot } from 'mdast';
import { visit } from 'unist-util-visit';
import type { Code, Html } from 'mdast';
import { parseMarkdownAst } from './parser';
import { transformMermaidCodeBlocks, isMermaidCode, type MermaidCompiler } from './mermaid-transform';
import { markdownSanitizeSchema } from './sanitize';
import { mermaidDebugLog } from './debug';

function preview(value: string, max = 180): string {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function debugLog(event: string, payload: Record<string, unknown>): void {
  mermaidDebugLog('renderer', event, payload);
}

interface MermaidGlobalLike {
  initialize(cfg: Record<string, unknown>): void;
  render(id: string, definition: string): Promise<{ svg: string }>;
}

let mermaidInitialized = false;

function resolveRuntimeGlobals(): Record<string, unknown>[] {
  const globals: Record<string, unknown>[] = [];

  if (typeof globalThis !== 'undefined' && globalThis) {
    globals.push(globalThis as unknown as Record<string, unknown>);
  }
  if (typeof window !== 'undefined' && window) {
    globals.push(window as unknown as Record<string, unknown>);
  }
  if (typeof self !== 'undefined' && self) {
    globals.push(self as unknown as Record<string, unknown>);
  }

  return globals.filter((value, index, arr) => arr.indexOf(value) === index);
}

function resolveRuntimeMermaidGlobal(): MermaidGlobalLike | undefined {
  for (const g of resolveRuntimeGlobals()) {
    const m = (g as { mermaid?: MermaidGlobalLike }).mermaid;
    if (m) {
      return m;
    }
  }
  return undefined;
}

function resolveGlobalMermaidCompiler(): MermaidCompiler | null {
  const m = resolveRuntimeMermaidGlobal();
  if (!m || typeof m.render !== 'function' || typeof m.initialize !== 'function') {
    debugLog('compiler:global-missing', { hasMermaid: Boolean(m) });
    return null;
  }

  debugLog('compiler:global-found', { hasRender: true, hasInitialize: true });

  return {
    async compile(definition: string, id: string): Promise<string> {
      if (!mermaidInitialized) {
        // LWS still breaks Mermaid's HTML-label path in several diagram types,
        // so keep plain SVG labels and avoid DOMPurify's NodeIterator path.
        m.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
          htmlLabels: false,
          flowchart: { htmlLabels: false }
        });
        mermaidInitialized = true;
        debugLog('compiler:initialized', { id });
      }
      debugLog('compiler:render-start', {
        id,
        definitionLength: definition.length,
        definitionPreview: preview(definition)
      });
      try {
        const result = await m.render(id, definition);
        const svg = typeof result === 'string' ? result : result?.svg || '';
        if (!svg) {
          throw new Error(`render() returned empty: ${JSON.stringify(result)}`);
        }
        debugLog('compiler:render-success', {
          id,
          svgLength: svg.length,
          svgPreview: preview(svg)
        });
        return svg;
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        debugLog('compiler:render-error', {
          id,
          error: errMsg,
          definitionPreview: preview(definition)
        });
        throw error;
      }
    },
  };
}

const markdownToHtmlProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkBreaks)
  .use(remarkMath)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeSlug)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .use(rehypeHighlight as any, { ignoreMissing: true })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .use(rehypeKatex as any, { output: 'mathml' })
  .use(rehypeSanitize, markdownSanitizeSchema)
  .use(rehypeStringify)
  .freeze();

const mdastToHtmlProcessor = unified()
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeSlug)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .use(rehypeHighlight as any, { ignoreMissing: true })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .use(rehypeKatex as any, { output: 'mathml' })
  .use(rehypeSanitize, markdownSanitizeSchema)
  .use(rehypeStringify)
  .freeze();

function stringifyMdast(tree: MdastRoot): string {
  const hast = mdastToHtmlProcessor.runSync(tree);
  return String(mdastToHtmlProcessor.stringify(hast));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function transformMermaidToMissingRuntimeErrors(tree: MdastRoot): void {
  let converted = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  visit(tree as any, 'code', (node: Code, index: number | undefined, parent: any) => {
    if (!isMermaidCode(node) || typeof index !== 'number' || !parent?.children) {
      return;
    }
    const source = String(node.value || '');
    const hint = source.split('\n')[0] || '';
    converted += 1;
    debugLog('fallback:runtime-missing', {
      index,
      sourceLength: source.length,
      sourcePreview: preview(source)
    });
    const replacement: Html = {
      type: 'html',
      value: `<div class="mermaid-error">${escapeHtml(
        hint ? `Mermaid runtime not loaded (${hint})` : 'Mermaid runtime not loaded'
      )}</div>`
    };
    parent.children[index] = replacement;
  });
  debugLog('fallback:runtime-missing-summary', { converted });
}

export function renderMarkdown(markdown: string): string {
  if (typeof markdown !== 'string' || markdown.trim() === '') {
    return '';
  }
  try {
    return String(markdownToHtmlProcessor.processSync(markdown));
  } catch {
    return '';
  }
}

export async function renderMarkdownAsync(markdown: string): Promise<string> {
  if (typeof markdown !== 'string' || markdown.trim() === '') {
    return '';
  }

  debugLog('renderMarkdownAsync:start', {
    markdownLength: markdown.length,
    markdownPreview: preview(markdown)
  });

  try {
    const tree = parseMarkdownAst(markdown);
    debugLog('renderMarkdownAsync:parsed', {
      childCount: Array.isArray(tree.children) ? tree.children.length : 0
    });

    const compiler = resolveGlobalMermaidCompiler();
    debugLog('renderMarkdownAsync:path', {
      path: compiler ? 'runtime-svg' : 'runtime-missing-error'
    });

    if (compiler) {
      await transformMermaidCodeBlocks(tree, compiler);
    } else {
      transformMermaidToMissingRuntimeErrors(tree);
    }

    debugLog('renderMarkdownAsync:transformed', {});

    const html = stringifyMdast(tree);
    debugLog('renderMarkdownAsync:result', {
      htmlLength: html.length,
      htmlPreview: preview(html)
    });
    return html;
  } catch (error) {
    const err = error as { name?: string; message?: string; stack?: string } | undefined;
    debugLog('renderMarkdownAsync:error', {
      name: err?.name || 'UnknownError',
      message: err?.message || String(error),
      stack: err?.stack || ''
    });
    return renderMarkdown(markdown);
  }
}
