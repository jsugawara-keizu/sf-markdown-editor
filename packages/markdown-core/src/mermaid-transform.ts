import { visit } from 'unist-util-visit';
import type { Root, Code, Html } from 'mdast';
import { mermaidDebugLog } from './debug';

function preview(value: string, max = 180): string {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function debugLog(event: string, payload: Record<string, unknown>): void {
  mermaidDebugLog('mermaid-transform', event, payload);
}

export interface MermaidCompiler {
  compile(definition: string, id: string): Promise<string>;
}

interface MermaidCandidate {
  node: Code;
  index: number;
  parent: { children: Array<Code | Html> };
}

const MERMAID_FIRST_LINE = /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie|mindmap|timeline|gitGraph|quadrantChart|requirementDiagram|c4Context|c4Container|c4Component|c4Dynamic|c4Deployment|architecture)\b/i;

export function isMermaidCode(node: Code): boolean {
  const rawLang = String(node.lang || '').trim().toLowerCase();
  if (rawLang === 'mermaid' || rawLang.startsWith('mermaid ')) {
    debugLog('isMermaidCode:lang-match', {
      lang: rawLang,
      firstLine: String(node.value || '').split('\n')[0] || ''
    });
    return true;
  }

  // Heuristic: some editors lose the fence language but keep Mermaid DSL body.
  if (!rawLang) {
    const firstLine = String(node.value || '').split('\n')[0]?.trim() || '';
    const matched = MERMAID_FIRST_LINE.test(firstLine);
    debugLog('isMermaidCode:heuristic', { firstLine, matched });
    return matched;
  }

  return false;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toErrorNode(message: string): Html {
  return {
    type: 'html',
    value: `<div class="mermaid-error">${escapeHtml(message)}</div>`
  };
}

export async function transformMermaidCodeBlocks(
  tree: Root,
  compiler: MermaidCompiler
): Promise<void> {
  const candidates: MermaidCandidate[] = [];

  visit(tree, 'code', (node, index, parent) => {
    const code = node as Code;
    if (!isMermaidCode(code)) return;
    if (typeof index !== 'number' || !parent || !Array.isArray((parent as { children?: unknown }).children)) {
      return;
    }
    candidates.push({
      node: code,
      index,
      parent: parent as MermaidCandidate['parent']
    });
  });

  debugLog('collect-candidates', { count: candidates.length });

  if (!candidates.length) return;

  // Mermaid's render() does synchronous, expensive DOM work (worse still under
  // Lightning Web Security's Proxy membrane). Compiling all diagrams via
  // Promise.all chains that work back-to-back on microtasks with no point at
  // which the browser can paint or handle input, which reads as a full page
  // freeze once a document has more than a couple of diagrams. Compile one at
  // a time and yield back to the event loop between diagrams so the browser
  // stays responsive regardless of diagram count.
  for (let seq = 0; seq < candidates.length; seq++) {
    const { node, index, parent } = candidates[seq];
    if (seq > 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const id = `mermaid-${Date.now()}-${seq}`;
    const source = String(node.value || '');
    debugLog('compile:start', {
      id,
      index,
      lang: node.lang || '',
      sourcePreview: preview(source),
      sourceLength: source.length
    });
    try {
      const rawSvg = await compiler.compile(source, id);
      debugLog('compile:success', {
        id,
        rawSvgLength: rawSvg.length,
        rawSvgPreview: preview(rawSvg)
      });
      parent.children[index] = {
        type: 'html',
        value: `<div class="mermaid-wrapper">${rawSvg}</div>`
      };
    } catch {
      const hint = source.split('\n')[0] || '';
      debugLog('compile:error', { id, hint });
      parent.children[index] = toErrorNode(
        hint ? `Mermaid compile error (${hint})` : 'Mermaid compile error'
      );
    }
  }
}
