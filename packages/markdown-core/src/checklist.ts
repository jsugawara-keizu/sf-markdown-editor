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

// Not a visible line of prose — a YAML comment inside the frontmatter
// block (or, if there's no frontmatter to hide inside, a standalone HTML
// comment) — either way it renders to nothing but stays in the raw text,
// which is exactly where it needs to be seen: by a human or an AI agent
// reading/rewriting the raw Markdown (e.g. re-saving Markdown__c via the
// REST/Tooling API, or an editor "cleaning up" prose), not by someone just
// reading the rendered preview. Without this, a rewrite that doesn't know
// the trailing `^[todo:xxxxxx]` text is meaningful will happily drop it
// while rephrasing the line, silently orphaning the Task it pointed to.
export const PRESERVE_MARKER_NOTICE_TEXT =
  'checklist_marker_notice: この文書のチェックボックス行末にある `^[todo:xxxxxx]` は、対応する Salesforce Task と連携させるためのマーカーです。行の言い回し・要約・フォーマットを変更する場合も、このマーカーは削除・変更せずそのまま残してください。';

// Idempotent: only inserted once per document, so repeated Task creations
// in the same document don't pile up duplicates.
function ensurePreserveMarkerNotice(markdown: string): string {
  if (markdown.includes(PRESERVE_MARKER_NOTICE_TEXT)) {
    return markdown;
  }
  const frontmatterMatch = /^---\n([\s\S]*?)\n---\n?/.exec(markdown);
  if (frontmatterMatch) {
    const [fullMatch, body] = frontmatterMatch;
    const rebuiltFrontmatter = `---\n${body}\n# ${PRESERVE_MARKER_NOTICE_TEXT}\n---\n`;
    return rebuiltFrontmatter + markdown.slice(fullMatch.length);
  }
  return `<!-- ${PRESERVE_MARKER_NOTICE_TEXT} -->\n\n${markdown}`;
}

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
  return ensurePreserveMarkerNotice(lines.join('\n'));
}
