import { visit } from 'unist-util-visit';
import type { ListItem } from 'mdast';
import { parseMarkdownAst } from './parser';

export interface CheckboxItem {
  line: number;
  text: string;
  checked: boolean;
  markerId: string | null;
}

// Marker embedded at the end of a checkbox line once it's been turned into a
// Task (see markdownChecklistPanel). Kept as plain trailing text rather than
// a Markdown construct so it survives round-tripping through remark/rehype
// untouched except for the rendering-time strip in checkbox-transform.ts.
export const TODO_MARKER_RE = /\s*\^\[todo:([0-9a-f]+)\]\s*$/;
const TASK_LIST_PREFIX_RE = /^\s*[-*+]\s+\[[ xX]\]\s*/;

// `line` is 1-based, matching markdown-core's data-md-line convention
// (mdast/hast `position.start.line`).
export function extractCheckboxItems(markdown: string): CheckboxItem[] {
  if (typeof markdown !== 'string' || markdown.trim() === '') {
    return [];
  }

  const lines = markdown.split('\n');
  const tree = parseMarkdownAst(markdown);
  const items: CheckboxItem[] = [];

  visit(tree, 'listItem', (node: ListItem) => {
    if (typeof node.checked !== 'boolean') {
      return;
    }
    const line = node.position?.start.line;
    if (typeof line !== 'number') {
      return;
    }

    const rawLine = lines[line - 1] ?? '';
    const markerMatch = TODO_MARKER_RE.exec(rawLine);
    const markerId = markerMatch ? markerMatch[1] : null;
    const withoutMarker = markerMatch
      ? rawLine.slice(0, markerMatch.index)
      : rawLine;
    const text = withoutMarker.replace(TASK_LIST_PREFIX_RE, '').trim();

    items.push({ line, text, checked: node.checked, markerId });
  });

  return items;
}

export function insertCheckboxMarker(
  markdown: string,
  line: number,
  markerId: string
): string {
  const lines = markdown.split('\n');
  const idx = line - 1;
  if (idx < 0 || idx >= lines.length) {
    return markdown;
  }
  lines[idx] = `${lines[idx]} ^[todo:${markerId}]`;
  return lines.join('\n');
}
