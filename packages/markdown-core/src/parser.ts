import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import type { Root as MdastRoot, Heading as MdastHeading, PhrasingContent } from 'mdast';

export interface Heading {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  id: string;
}

const mdParser = unified().use(remarkParse).use(remarkGfm).freeze();

export function parseMarkdownAst(markdown: string): MdastRoot {
  if (typeof markdown !== 'string' || markdown.trim() === '') {
    return { type: 'root', children: [] };
  }
  return mdParser.parse(markdown) as MdastRoot;
}

export function extractHeadings(markdown: string): Heading[] {
  const tree = parseMarkdownAst(markdown);
  const result: Heading[] = [];

  for (const node of tree.children) {
    if (node.type !== 'heading') continue;
    const heading = node as MdastHeading;
    const text = extractText(heading.children as PhrasingContent[]);
    result.push({
      level: heading.depth as Heading['level'],
      text,
      id: slugify(text),
    });
  }

  return result;
}

export function buildToc(markdown: string): string {
  const headings = extractHeadings(markdown);
  if (!headings.length) return '';

  const minLevel = Math.min(...headings.map((h) => h.level));
  return headings
    .map((h) => {
      const indent = '  '.repeat(h.level - minLevel);
      return `${indent}- [${h.text}](#${h.id})`;
    })
    .join('\n');
}

function extractText(nodes: PhrasingContent[]): string {
  return nodes
    .map((node) => {
      if ('value' in node) return String((node as { value: string }).value ?? '');
      if ('children' in node) {
        return extractText((node as { children: PhrasingContent[] }).children);
      }
      return '';
    })
    .join('');
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}
